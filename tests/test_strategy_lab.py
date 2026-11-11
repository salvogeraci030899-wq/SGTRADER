"""Test del laboratorio strategie. `python3 tests/test_strategy_lab.py` oppure pytest."""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import lab_strategies as ls  # noqa: E402
import strategy_lab as lab  # noqa: E402

D = 86400
T0 = 1_500_000_000 // D * D
W = lab.WARMUP


def frame(closes, highs=None, lows=None, opens=None, skip=()):
    """Candele giornaliere piatte a 100 per il riscaldamento, poi quelle indicate."""
    n = W + 1
    c = [100.0] * n + list(closes)
    o = [100.0] * n + list(opens if opens is not None else [100.0] + list(closes[:-1]))
    h = [101.0] * n + list(highs if highs is not None else [max(a, b) for a, b in zip(o[n:], c[n:])])
    l = [99.0] * n + list(lows if lows is not None else [min(a, b) for a, b in zip(o[n:], c[n:])])
    rows = [i for i in range(len(c)) if i not in skip]
    return pd.DataFrame({"time": pd.to_datetime([T0 + i * D for i in rows], unit="s", utc=True),
                         "open": [o[i] for i in rows], "high": [h[i] for i in rows], "low": [l[i] for i in rows],
                         "close": [c[i] for i in rows], "volume": 1.0})


def run(df, direction=1, at=W, **exit_rules):
    ex = {"stop_atr": 2.0, "target_atr": None, "trail_atr": None, "max_hold": 5, **exit_rules}
    sig = np.zeros(len(df), dtype=int)
    sig[at] = direction
    return lab.simulate(df, "1d", "BTCUSDT", {"exit": ex, "fn": None}, signal=sig)


def test_motore_uscite():
    # ATR = 2 nel riscaldamento (massimo 101, minimo 99): stop long a 96, target (2 ATR) a 104
    t = run(frame([101, 102, 103, 104, 105, 106]))[0]
    assert t["reason"] == "TEMPO" and t["bars"] == 5 and abs(t["gross"] - 5.0) < 1e-9 and t["dir"] == 1
    assert t["t"] == T0 + W * D and t["t_exit"] == T0 + (W + 6) * D
    t = run(frame([101, 97, 95, 95, 95, 95], lows=[100, 95.5, 95, 95, 95, 95]))[0]
    assert t["reason"] == "STOP" and abs(t["gross"] - (-4.0)) < 1e-9 and t["bars"] == 2            # stop toccato dentro la candela
    t = run(frame([101, 90, 90, 90, 90, 90], opens=[100, 92, 90, 90, 90, 90]))[0]
    assert t["reason"] == "STOP" and abs(t["gross"] - (-8.0)) < 1e-9                               # apertura oltre lo stop: si esce peggio
    t = run(frame([101, 103, 105, 105, 105, 105], highs=[101, 104.5, 105, 105, 105, 105]), target_atr=2.0)[0]
    assert t["reason"] == "TARGET" and abs(t["gross"] - 4.0) < 1e-9 and t["bars"] == 2
    # stesso candela: stop e target entrambi toccati -> conta lo stop
    t = run(frame([101, 100, 100, 100, 100, 100], highs=[101, 105, 100, 100, 100, 100], lows=[100, 95, 100, 100, 100, 100]), target_atr=2.0)[0]
    assert t["reason"] == "STOP"
    # stop che segue (2 ATR = 4 sotto la chiusura migliore): sale a 110 -> stop a 106, poi scende
    t = run(frame([104, 108, 110, 107, 105, 105], lows=[100, 104, 108, 106.5, 105, 105]), trail_atr=2.0, max_hold=6)[0]
    assert t["reason"] == "STOP" and abs(t["gross"] - 6.0) < 1e-9
    # short speculare
    t = run(frame([99, 98, 97, 96, 95, 94]), direction=-1)[0]
    assert t["dir"] == -1 and abs(t["gross"] - 5.0) < 1e-9
    t = run(frame([99, 103, 105, 105, 105, 105], highs=[100, 104.5, 105, 105, 105, 105]), direction=-1)[0]
    assert t["reason"] == "STOP" and abs(t["gross"] - (-4.0)) < 1e-9
    # buco nello storico durante il trade: uscita all'ultima chiusura disponibile
    t = run(frame([101, 102, 103, 104, 105, 106], skip=(W + 4,)))[0]
    assert t["reason"] == "BUCO" and t["bars"] == 3 and abs(t["gross"] - 3.0) < 1e-9


def test_un_trade_alla_volta_e_riscaldamento():
    df = frame([101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112])
    sig = np.ones(len(df), dtype=int)                                   # segnale sempre acceso, anche nel riscaldamento
    trades = lab.simulate(df, "1d", "BTCUSDT", {"exit": {"stop_atr": 50, "target_atr": None, "trail_atr": None, "max_hold": 5}, "fn": None}, signal=sig)
    assert [t["t"] for t in trades] == [T0 + W * D, T0 + (W + 5) * D, T0 + (W + 10) * D]    # mai prima del riscaldamento, mai sovrapposti
    assert all(a["t_exit"] <= b["t"] + D for a, b in zip(trades, trades[1:]))


def test_costi_funding_e_scenari():
    long = {"symbol": "BTCUSDT", "t": 1000 * D, "t_exit": 1002 * D, "dir": 1, "gross": 2.0}
    short = dict(long, dir=-1)
    ts = np.array([1000 * D + k * 8 * 3600 for k in range(-3, 12)], dtype=np.int64)
    funding = {"BTCUSDT": (ts, np.full(len(ts), 0.01))}
    # 2 giorni = 6 pagamenti da 0,01% (quello esattamente all'ingresso non conta, quello all'uscita sì)
    assert abs(lab.funding_cost(long, funding["BTCUSDT"])[0] - 0.06) < 1e-12 and lab.funding_cost(long, funding["BTCUSDT"])[1] is True
    assert abs(lab.funding_cost(short, funding["BTCUSDT"])[0] + 0.06) < 1e-12                      # lo short lo riceve
    net = lab.net_returns([long, short], "futures_taker", funding)
    assert abs(net[0] - (2.0 - 0.22 - 0.06)) < 1e-9 and abs(net[1] - (2.0 - 0.22 + 0.06)) < 1e-9
    assert abs(lab.net_returns([long], "futures_maker", funding)[0] - (2.0 - 0.04 - 0.06)) < 1e-9
    spot = lab.net_returns([long, short], "spot", funding)
    assert abs(spot[0] - (2.0 - 0.30)) < 1e-9 and spot[1] is None                                  # in spot niente short, niente funding
    # trade più vecchio dello storico reale: ipotesi prudente (il long paga 0,01% ogni 8 ore, lo short non riceve)
    old = dict(long, t=990 * D, t_exit=992 * D)
    cost, real = lab.funding_cost(old, funding["BTCUSDT"])
    assert real is False and abs(cost - 6 * lab.FUNDING_ASSUMED_LONG_PCT) < 1e-9
    assert lab.funding_cost(dict(old, dir=-1), funding["BTCUSDT"]) == (0.0, False)
    cost, real = lab.funding_cost(long, None)                                                      # nessuno storico: stessa ipotesi
    assert real is False and abs(cost - 0.06) < 1e-9 and lab.funding_cost(short, None) == (0.0, False)
    # a cavallo dell'inizio dello storico: prima l'ipotesi, poi i tassi reali (qui 0,02%)
    ts2 = np.array([1001 * D + k * 8 * 3600 for k in range(0, 6)], dtype=np.int64)
    cost, real = lab.funding_cost(long, (ts2, np.full(6, 0.02)))
    assert real is False and abs(cost - (3 * 0.01 + 4 * 0.02)) < 1e-9


def test_prove_multiple():
    # con 1 prova p=0.04 passa (soglia 0.10); con 40 prove registrate no; i p molto piccoli passano comunque
    assert lab.benjamini_hochberg({"a": 0.04}, 1) == {"a"}
    assert lab.benjamini_hochberg({"a": 0.04}, 40) == set()
    assert lab.benjamini_hochberg({"a": 0.0001, "b": 0.004, "c": 0.2, "d": None}, 40) == {"a", "b"}
    rng = np.random.default_rng(0)
    assert lab.cluster_p_value(rng.normal(0.5, 1, 400), np.arange(400)) < 0.001
    assert lab.cluster_p_value(rng.normal(0.0, 1, 400), np.arange(400)) > 0.01
    assert lab.cluster_p_value(rng.normal(-0.5, 1, 400), np.arange(400)) > 0.99
    assert lab.cluster_p_value([1.0] * 5, np.arange(5)) is None                                    # troppo pochi blocchi


def fake_trades(name_seed, edge, n=600, start="2020-01-01", days=3):
    rng = np.random.default_rng(name_seed)
    t0 = lab._ts(start)
    out = []
    for sym_i, sym in enumerate(("BTCUSDT", "ETHUSDT", "SOLUSDT")):
        for k in range(n):
            t = t0 + k * days * D + sym_i * 3600
            out.append({"symbol": sym, "tf": "1d", "t": t, "t_exit": t + days * D, "dir": 1 if k % 2 else -1,
                        "gross": float(rng.normal(edge, 3.0)), "bars": days, "reason": "TEMPO"})
    return out


def test_candidate_sigillo_e_registro():
    names = list(ls.STRATEGIES)[:3]
    per_trial = {(names[0], "1d"): fake_trades(1, 1.2, n=900), (names[1], "1d"): fake_trades(2, 0.0, n=900), (names[2], "1d"): fake_trades(3, -1.0, n=900)}
    registry = {"holdout_start": lab.HOLDOUT_START, "trials": {f"vecchia{i}:1d": {"first_tested": "2026-01-01"} for i in range(30)}, "unsealed": {}}
    s = lab.build_summary(per_trial, {}, registry, today="2026-11-11")
    good, flat, bad = (s["results"][f"{n}:1d"] for n in names)
    assert s["trials_registered"] == 33 and len(registry["trials"]) == 33                           # le prove vecchie restano nel conto
    assert s["candidates"] == [f"{names[0]}:1d"] and good["candidate"] and good["stable"] and good["p_value"] < 0.001
    assert not flat["candidate"] and not bad["candidate"] and bad["avg_net_pct"] < 0
    assert len(good["halves"]) == 2 and set(good["by_coin"]) == {"BTCUSDT", "ETHUSDT", "SOLUSDT"}
    # i mesi sigillati non entrano nella ricerca: 900 trade da 3 giorni dal 2020 arrivano al 2027, ma si contano solo quelli chiusi prima
    hold = lab._ts(lab.HOLDOUT_START)
    assert good["n"] == sum(1 for t in per_trial[(names[0], "1d")] if t["t_exit"] <= hold) < 2700
    assert "holdout" not in good and s["confirmed"] == []
    # apertura del sigillo: registrata con la data, e resta registrata alle esecuzioni successive
    s = lab.build_summary(per_trial, {}, registry, unseal=[f"{names[0]}:1d"], today="2026-11-12")
    hd = s["results"][f"{names[0]}:1d"]["holdout"]
    assert registry["unsealed"] == {f"{names[0]}:1d": "2026-11-12"} and hd["n"] > 100 and hd["unsealed_on"] == "2026-11-12"
    assert hd["confirmed"] is True and s["confirmed"] == [f"{names[0]}:1d"]
    s = lab.build_summary(per_trial, {}, registry, today="2026-12-01")
    assert s["results"][f"{names[0]}:1d"]["holdout"]["unsealed_on"] == "2026-11-12"
    md = lab.to_markdown(s)
    assert "CANDIDATA" in md and "CONFERMATA" in md and "sigillat" in md
    # una strategia instabile (positiva solo su una coin) non è candidata anche se significativa
    skew = [dict(t, gross=t["gross"] + (6.0 if t["symbol"] == "BTCUSDT" else -1.5)) for t in fake_trades(5, 0.0, n=900)]
    r = lab.build_summary({(names[0], "1d"): skew}, {}, {"holdout_start": lab.HOLDOUT_START, "trials": {}, "unsealed": {}})["results"][f"{names[0]}:1d"]
    assert r["significant"] and not r["stable"] and not r["candidate"]


def test_strategie_registrate_girano():
    rng = np.random.default_rng(11)
    n = 1200
    drift = np.repeat(rng.choice([-0.004, 0.0, 0.004], size=n // 40 + 1), 40)[:n]
    c = 100 * np.exp(np.cumsum(drift + rng.normal(0, 0.01, n)))
    o = np.concatenate([[100.0], c[:-1]])
    df = pd.DataFrame({"time": pd.to_datetime([T0 + i * D for i in range(n)], unit="s", utc=True), "open": o,
                       "high": np.maximum(o, c) * 1.004, "low": np.minimum(o, c) * 0.996, "close": c, "volume": rng.lognormal(0, 1.2, n)})
    x = lab.indicators(df)
    assert len(ls.STRATEGIES) >= 12
    for name, spec in ls.STRATEGIES.items():
        sig = np.asarray(spec["fn"](x))
        assert len(sig) == n and set(np.unique(sig)) <= {-1, 0, 1}, name
        assert set(spec["exit"]) == {"stop_atr", "target_atr", "trail_atr", "max_hold"}, name
        trades = lab.simulate(df, "1d", "BTCUSDT", spec)
        assert trades, name                                                  # ogni regola scatta almeno una volta
        assert all(t["t"] >= T0 + W * D and t["bars"] >= 1 and t["bars"] <= spec["exit"]["max_hold"] for t in trades), name
    # nessuna strategia guarda avanti: i segnali fino alla candela k non cambiano se si tolgono le candele successive
    k = 900
    x_cut = lab.indicators(df.iloc[:k + 1].reset_index(drop=True))
    for name, spec in ls.STRATEGIES.items():
        assert np.array_equal(np.asarray(spec["fn"](x))[W:k + 1], np.asarray(spec["fn"](x_cut))[W:k + 1]), name
    # massimo delle 20 candele precedenti: quella corrente è esclusa
    assert abs(x["high_max"](20)[500] - df["high"].iloc[480:500].max()) < 1e-12


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
