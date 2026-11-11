"""Test della prova su carta. `python3 tests/test_paper.py` oppure pytest."""
import json
import os
import sys
import tempfile

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import lab_strategies as ls  # noqa: E402
import paper  # noqa: E402
import strategy_lab as lab  # noqa: E402

D = 86400
START = "2024-01-01"
T_START = lab._ts(START)
W = lab.WARMUP

# Strategia di prova: sempre long, tenuta 3 candele, stop lontanissimo
ls.STRATEGIES["prova_long"] = {"name": "prova_long", "family": "test", "description": "", "tfs": None, "fn": lambda x: np.ones(len(x["close"]), dtype=int),
                               "exit": {"stop_atr": 50.0, "target_atr": None, "trail_atr": None, "channel_exit": None, "max_hold": 3}}
KEY = "prova_long:1d"


def frame(n_after, bump=0.0):
    """W+20 candele prima della partenza (prezzo 100), poi n_after candele che salgono di 1 al giorno."""
    before = W + 20
    closes = [100.0] * before + [100.0 + k + (bump if k == 4 else 0.0) for k in range(1, n_after + 1)]
    times = [T_START + (i - before) * D for i in range(len(closes))]
    c = np.array(closes)
    o = np.concatenate([[100.0], c[:-1]])
    return pd.DataFrame({"time": pd.to_datetime(times, unit="s", utc=True), "open": o, "high": np.maximum(o, c) + 1, "low": np.minimum(o, c) - 1, "close": c, "volume": 1.0})


def setup(d, mode="paper", confirmed=()):
    cfg, led = os.path.join(d, "automation.json"), os.path.join(d, "paper.json")
    json.dump({"paper_start": START, "strategies": {KEY: mode}}, open(cfg, "w"))
    paper.confirmed_keys = lambda *a, **k: set(confirmed)
    return cfg, led


def run(cfg, led, n_after, calls, notes, symbols=("BTCUSDT",), bump=0.0):
    def download(symbol, tf, start_ms):
        calls.append(symbol)
        return frame(n_after, bump)
    last = {f"{s}_1d": T_START + (n_after - 1) * D for s in symbols}
    return paper.update(last, cfg, led, download=download, funding_fetch=lambda s: (np.array([]), np.array([])), notify=notes.append)


def test_ciclo_completo():
    with tempfile.TemporaryDirectory() as d:
        cfg, led = setup(d)
        calls, notes = [], []
        # 1 candela dopo la partenza: nessun trade ancora, ma tutto regolare (registro creato)
        assert run(cfg, led, 1, calls, notes) is True and json.load(open(led))["strategies"][KEY]["trades"] == []
        # 3 candele: ingresso alla chiusura della prima (prezzo 101), trade aperto
        assert run(cfg, led, 3, calls, notes) is True
        e = json.load(open(led))["strategies"][KEY]
        assert len(e["trades"]) == 1 and e["trades"][0]["open"] and e["trades"][0]["entry"] == 101.0 and e["stats"] == {"n": 0, "open": 1}
        assert len(notes) == 1 and "PROVA SU CARTA" in notes[0] and "LONG" in notes[0] and "_" not in notes[0]
        first_seen = e["trades"][0]["first_seen"]
        # stessa candela: nessun download, nessuna modifica
        n_calls = len(calls)
        assert run(cfg, led, 3, calls, notes) is False and len(calls) == n_calls
        # 6 candele: primo trade chiuso dopo 3 candele (101 -> 104), secondo aperto
        assert run(cfg, led, 6, calls, notes) is True
        e = json.load(open(led))["strategies"][KEY]
        t0, t1 = e["trades"]
        assert not t0["open"] and t0["reason"] == "TEMPO" and abs(t0["gross"] - (104 / 101 - 1) * 100) < 1e-3 and t0["first_seen"] == first_seen
        assert t1["open"] and t1["entry"] == 104.0
        assert e["stats"]["n"] == 1 and e["stats"]["open"] == 1 and abs(e["stats"]["avg_net_pct"] - (t0["gross"] - 0.22 - 0.09)) < 1e-2   # costi futures e funding prudente (9 pagamenti)
        assert sum("Chiuso" in n for n in notes) == 1
        # dati corretti a posteriori da Bitget: il trade già chiuso NON viene riscritto, solo segnalato
        assert run(cfg, led, 7, calls, notes, bump=5.0) is True
        e = json.load(open(led))["strategies"][KEY]
        assert abs(e["trades"][0]["gross"] - t0["gross"]) < 1e-9 and e["trades"][0].get("revised") is True and e["stats"]["revised"] == 1


def test_modi_e_blocco_del_reale():
    assert paper.effective_mode("a:1d", "live", {"a:1d"}) == "live"
    assert paper.effective_mode("a:1d", "live", set()) == "paper"          # non confermata: mai in reale
    assert paper.effective_mode("a:1d", "paper", set()) == "paper" and paper.effective_mode("a:1d", "boh", set()) == "off"
    with tempfile.TemporaryDirectory() as d:
        cfg, led = setup(d, mode="live")
        calls, notes = [], []
        run(cfg, led, 3, calls, notes)
        assert json.load(open(led))["strategies"][KEY]["mode"] == "paper"
    with tempfile.TemporaryDirectory() as d:
        cfg, led = setup(d, mode="off")
        calls, notes = [], []
        run(cfg, led, 6, calls, notes)
        assert calls == [] and notes == [] and not os.path.exists(led)        # spenta: nessun download, nessun registro
    # spenta dopo essere stata su carta (es. emergenza): resta nel registro con i trade, ma "off"
    with tempfile.TemporaryDirectory() as d:
        cfg, led = setup(d)
        calls, notes = [], []
        run(cfg, led, 3, calls, notes)
        trades = json.load(open(led))["strategies"][KEY]["trades"]
        json.dump({"paper_start": START, "strategies": {}}, open(cfg, "w"))
        assert run(cfg, led, 4, calls, notes) is True
        e = json.load(open(led))["strategies"][KEY]
        assert e["mode"] == "off" and e["trades"] == trades
    # senza configurazione non succede nulla
    with tempfile.TemporaryDirectory() as d:
        assert paper.update({}, os.path.join(d, "no.json"), os.path.join(d, "l.json")) is False


def test_ripetibile_e_storico_corto():
    spec = ls.STRATEGIES["prova_long"]
    a = paper.replay(frame(9), "1d", "BTCUSDT", spec, T_START)
    # più storico prima della partenza non cambia i trade: il motore parte sempre dalla stessa candela
    longer = pd.concat([frame(9).iloc[:50].assign(time=lambda x: x["time"] - pd.Timedelta(days=50)), frame(9)], ignore_index=True)
    b = paper.replay(longer, "1d", "BTCUSDT", spec, T_START)
    assert [(t["t"], t["gross"], t["open"]) for t in a] == [(t["t"], t["gross"], t["open"]) for t in b] and len(a) == 3
    assert all(t["t"] >= T_START for t in a)
    assert paper.replay(frame(9).iloc[100:].reset_index(drop=True), "1d", "BTCUSDT", spec, T_START) is None     # troppo poche candele prima
    assert paper.replay(frame(1), "1d", "BTCUSDT", spec, T_START) == []


def test_confronto_con_lo_storico():
    ref = {"n": 100, "avg_net_pct": 2.0, "avg_net_ci": [0.04, 3.96]}             # variabilità per trade = 1/3.92*3.92*10 = 10
    assert paper.vs_backtest([1.0] * 5, ref)["verdict"] == "pochi_trade"
    assert paper.vs_backtest([2.5, -1.0, 4.0, 0.5, 3.0, 1.5, 2.0, -0.5, 5.0, 3.0], ref)["verdict"] == "in_linea"
    bad = paper.vs_backtest([-6.0] * 16, ref)                                      # z = (-6 - 2) / (10 / 4) = -3.2
    assert bad["verdict"] == "sotto" and bad["z"] == -3.2
    assert paper.vs_backtest([9.0] * 16, ref)["verdict"] == "sopra"
    assert paper.vs_backtest([1.0] * 20, None) is None and paper.vs_backtest([1.0] * 20, {"n": 5}) is None


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
