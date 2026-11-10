"""Test della validazione storica (senza modello). `python3 tests/test_validation.py` oppure pytest."""
import os
import sys
import tempfile

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import validation as va  # noqa: E402
import validation_stats as vs  # noqa: E402
from kronos_core import PRED_LEN, FEE_PCT, SLIPPAGE_PCT, TAX_RATE  # noqa: E402

H = 3600
T0 = 1_700_000_000 - (1_700_000_000 % (28 * H))  # nel passato: le candele risultano chiuse
COSTS = (FEE_PCT + SLIPPAGE_PCT) * 2


def row(k=0, prob_up=90.0, move=2.0, symbol="BTCUSDT", past=99.0, forecast_move=4.0, atr=1.0, horizon=None):
    """Previsione a T0 + k*7h con prezzo 100: l'orizzonte sale in linea retta di `move`%."""
    if horizon is None:
        closes = [100 + move * (j + 1) / PRED_LEN for j in range(PRED_LEN)]
        horizon = [[c, max(c, 100) + 0.01, min(c, 100) - 0.01, c] for c in closes]
    t = T0 + k * 7 * H
    return {"id": f"{symbol}_1h_{t}", "symbol": symbol, "tf": "1h", "candle_time": t, "ref_close": 100.0,
            "prob_up": prob_up, "atr": atr, "forecast": [100 + forecast_move] * PRED_LEN,
            "p10": [99.0] * PRED_LEN, "p90": [103.0] * PRED_LEN, "past_close": past, "horizon": horizon,
            "context_len": 400, "n_samples": 50, "model": "test", "oos_start": T0}


def test_costi():
    pre, post = vs.after_costs(2.0)
    assert abs(pre - (2.0 - COSTS)) < 1e-12 and abs(post - (2.0 - COSTS) * (1 - TAX_RATE)) < 1e-12
    pre, post = vs.after_costs(-1.0)
    assert pre == post == -1.0 - COSTS  # sulle perdite niente tasse


def test_esiti_di_una_previsione():
    # LONG operativo: stop 98.5 (1.5 x ATR), target 103 (modello a +4, tetto 3R = 104.5 -> 104)
    e = vs.enrich(row(prob_up=90, move=2.0))
    g = e["gross"]
    assert e["up"] == 1.0 and e["kronos_dir"] == 1 and e["momentum_dir"] == 1 and e["in_band"] == 1.0
    assert abs(g["always_long"] - 2.0) < 1e-9 and abs(g["kronos_all"] - 2.0) < 1e-9 and abs(g["momentum"] - 2.0) < 1e-9
    assert abs(g["kronos_signal"] - 2.0) < 1e-9
    assert abs(g["kronos_plan"] - 2.0) < 1e-9          # né stop né target: uscita a fine orizzonte
    # stesso segnale ma il prezzo tocca lo stop alla prima candela
    hz = [[100, 100.2, 98.0, 99.0]] + [[99, 99.5, 98.8, 99.0]] * (PRED_LEN - 1)
    e = vs.enrich(row(prob_up=90, horizon=hz))
    assert abs(e["gross"]["kronos_plan"] - (-1.5)) < 1e-9 and abs(e["gross"]["kronos_signal"] - (-1.0)) < 1e-9
    # SHORT giusto, momentum (in salita) sbagliato
    e = vs.enrich(row(prob_up=10, move=-2.0, forecast_move=-4.0))
    assert e["kronos_dir"] == -1 and abs(e["gross"]["kronos_all"] - 2.0) < 1e-9 and abs(e["gross"]["momentum"] + 2.0) < 1e-9
    # neutro: nessun segnale, resta solo la direzione; fuori dalla fascia P10-P90
    e = vs.enrich(row(prob_up=60, move=5.0))
    assert e["gross"]["kronos_plan"] is None and e["gross"]["kronos_signal"] is None and e["in_band"] == 0.0
    # segnale con R/R troppo basso: direzionale ma non operativo
    e = vs.enrich(row(prob_up=90, forecast_move=1.0))
    assert e["gross"]["kronos_plan"] is None and e["gross"]["kronos_signal"] is not None


def test_isotonica_crescente():
    xs, ys = vs.isotonic_fit([0.1, 0.1, 0.3, 0.5, 0.7, 0.9], [0, 1, 0, 1, 0, 1])
    assert list(xs) == [0.1, 0.3, 0.5, 0.7, 0.9]
    assert all(b >= a for a, b in zip(ys, ys[1:]))
    assert abs(ys[0] - 1 / 3) < 1e-9 and abs(ys[2] - 0.5) < 1e-9 and ys[-1] == 1.0  # violazioni fuse


def test_calibrazione_senza_futuro():
    # prima metà: il 90% dichiarato sale sempre; seconda metà: non sale mai.
    n = vs.MIN_TRAIN_CAL + 60
    pts = [vs.enrich(row(k=k, prob_up=90, move=2.0 if k < n else -2.0)) for k in range(2 * n)]
    cal = vs.walk_forward_calibration(pts)
    assert np.isnan(cal[:vs.MIN_TRAIN_CAL]).all()          # storico concluso troppo corto
    assert not np.isnan(cal[vs.MIN_TRAIN_CAL + 2:]).any()
    # appena prima del cambio la calibrazione conosce solo rialzi: non può "sapere" del crollo
    assert cal[n - 1] == 0.98 and cal[n] == 0.98 and cal[n + 1] == 0.98
    assert cal[-1] < 0.6                                   # poi si adegua, ma solo dopo averlo visto
    base = vs.walk_forward_base_rate(pts)
    assert base[0] == 0.5 and base[n] == 1.0 and base[-1] < 0.6


def test_intervalli_e_giudizio():
    rng = np.random.default_rng(1)
    v = rng.normal(1.0, 1.0, 400)
    ci = vs.cluster_ci(v, np.arange(400))
    assert ci[0] < 1.0 < ci[1] and ci[0] > 0.7 and ci[1] < 1.3
    # stessi valori ma tutti dipendenti a gruppi di 40: intervallo più largo
    wide = vs.cluster_ci(np.repeat(v[:10], 40), np.repeat(np.arange(10), 40))
    assert wide[1] - wide[0] > ci[1] - ci[0]
    assert vs.cluster_ci(v[:4], np.arange(4)) is None       # troppo pochi blocchi
    assert vs.verdict([0.1, 0.5], 100) == "positivo" and vs.verdict([-0.5, -0.1], 100) == "negativo"
    assert vs.verdict([-0.1, 0.5], 100) == "non_dimostrato"
    assert vs.verdict([0.1, 0.5], 10) == "campione_insufficiente" and vs.verdict(None, 100) == "campione_insufficiente"


def test_riepilogo():
    rng = np.random.default_rng(7)
    rows = []
    for k in range(300):
        up = rng.random() < 0.5
        informed = rng.random() < 0.8                       # Kronos "indovina" 8 volte su 10
        prob = (90.0 if up else 10.0) if informed else (10.0 if up else 90.0)
        for sym in ("BTCUSDT", "ETHUSDT"):
            rows.append(row(k=k, prob_up=prob, move=2.0 if up else -2.0, symbol=sym,
                            forecast_move=4.0 if prob > 50 else -4.0, past=99.0 if rng.random() < 0.5 else 101.0))
    rows.append(dict(row(k=-5), id="vecchia", candle_time=T0 - 100 * H))  # prima del fuori campione: scartata
    s = vs.build_summary(rows)
    assert s["counts"]["total"] == 600 and set(s["by_pair"]) == {"BTCUSDT_1h", "ETHUSDT_1h"} and set(s["by_tf"]) == {"1h"}
    o = s["overall"]
    d = o["direction"]
    assert 74 < d["hit_rate"] < 86 and d["hit_rate_ci"][0] > 50 and d["verdict_direction"] == "positivo"
    assert d["brier"] < d["brier_base_rate"] and d["verdict_probability"] == "positivo"
    assert [b["range"] for b in d["calibration"]] == ["10-20", "90-100"]
    assert o["strategies"]["kronos_plan"]["n"] == 600 and o["verdict"] == "positivo"
    assert o["strategies"]["momentum"]["verdict"] in ("non_dimostrato", "negativo")
    assert o["kronos_minus_momentum_ci"][0] > 0
    assert o["calibration_wf"]["n_test"] > 300 and len(o["calibration_wf"]["map"]) == 11
    assert s["by_pair"]["BTCUSDT_1h"]["n_samples"] == [50]
    assert "Validazione storica" in vs.to_markdown(s)
    # previsioni a caso: nessun vantaggio dimostrato
    rows = [row(k=k, prob_up=float(rng.choice([10, 90])), move=float(rng.choice([-2, 2]))) for k in range(300)]
    for r in rows:
        r["forecast"] = [100 + (4 if r["prob_up"] > 50 else -4)] * PRED_LEN
    assert vs.build_summary(rows)["overall"]["verdict"] != "positivo"


def frame(n, start=T0 - 500 * H, skip=()):
    ts = [start + i * H for i in range(n) if i not in skip]
    return pd.DataFrame({"time": pd.to_datetime(ts, unit="s", utc=True), "open": 100.0, "high": 101.0, "low": 99.0, "close": 100.0, "volume": 1.0})


def test_punti_candidati():
    df = frame(900)
    pts = va.candidate_points(df, "1h", 400, T0, 7)
    times = [int(df["time"].iloc[i].timestamp()) for i in pts]
    assert all(t >= T0 and (t // H) % 7 == 0 for t in times)
    assert all(i + PRED_LEN < len(df) and i >= 399 for i in pts)
    levels = [0 if (t // H) % 28 == 0 else 1 if (t // H) % 14 == 0 else 2 for t in times]
    assert levels == sorted(levels) and len(set(levels)) == 3      # prima la passata larga, poi le più fitte
    assert pts == va.candidate_points(df, "1h", 400, T0, 7)        # stesso ordine a ogni esecuzione
    # un buco nei dati esclude i punti che lo avrebbero nel contesto o nell'orizzonte
    hole = 500 + 30
    gap = va.candidate_points(frame(900, skip=(hole,)), "1h", 400, T0, 7)
    gap_times = {int(frame(900, skip=(hole,))["time"].iloc[i].timestamp()) for i in gap}
    hole_t = T0 - 500 * H + hole * H
    assert gap_times and all(not (t - 399 * H <= hole_t <= t + PRED_LEN * H) for t in gap_times)
    assert len(gap) < len(pts)


def test_download_a_pagine_e_ripresa():
    # finto Bitget: 1000 candele da 1h, pagine da 200 andando indietro
    now = T0 + 400 * H
    all_ts = [(T0 - 599 * H + i * H) * 1000 for i in range(1000)]
    calls = []

    class Resp:
        def __init__(self, data): self.data = data
        def raise_for_status(self): pass
        def json(self): return {"code": "00000", "data": self.data}

    # Bitget arrotonda endTime alla candela; a seconda dell'endpoint la candela di endTime è esclusa
    # o inclusa: in entrambi i casi lo storico scaricato non deve avere buchi tra una pagina e l'altra
    for inclusive in (False, True):
        def fake_get(url, params=None, timeout=None):
            calls.append(url)
            end = params["endTime"] // (H * 1000) * (H * 1000)
            page = [t for t in all_ts if t < end or (inclusive and t == end)][-params["limit"]:]
            return Resp([[str(t), "50000", "50100", "49900", "50000", "5", "500", "500"] for t in page])

        calls.clear()
        orig = va.requests.get
        va.requests.get = fake_get
        try:
            df = va.download_history("BTCUSDT", "1h", all_ts[300], now_ms=now * 1000, pause=0)
        finally:
            va.requests.get = orig
        assert len(df) >= 700 and df["time"].is_monotonic_increasing and df["time"].is_unique
        assert int(df["time"].iloc[0].timestamp()) * 1000 <= all_ts[300]
        assert set(df["time"].diff().dropna()) == {pd.Timedelta(hours=1)}       # nessuna candela persa
        assert all(u == va.BITGET_HISTORY_URL for u in calls)

    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "v", "p.jsonl")
        va.save_rows([row(k=2), row(k=1)], path)
        back = va.load_rows(path)
        assert [r["candle_time"] for r in back] == sorted(r["candle_time"] for r in back) and len(back) == 2


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
