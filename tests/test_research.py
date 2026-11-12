"""Test dell'agente ricercatore (research.py): grammatica chiusa, limiti, registrazione nel laboratorio.
Esegui: python tests/test_research.py
"""
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import research  # noqa: E402

NOW = datetime(2026, 11, 15, 18, 41, tzinfo=timezone.utc)


class Resp:
    def __init__(self, data):
        self._data = data

    def json(self):
        return self._data


def get(url, **kw):
    return Resp({"data": [{"id": "llama-3.3-70b-versatile"}]})


def post_with(proposals):
    def post(url, headers=None, json=None, timeout=None):
        post.prompt = json["messages"][0]["content"]
        return Resp({"choices": [{"message": {"content": __import__("json").dumps({"proposals": proposals})}}]})
    return post


def test_grammatica():
    assert research.valid("breakout", {"n": 30, "trail": 2})
    assert not research.valid("breakout", {"n": 31, "trail": 2}), "valore non ammesso"
    assert not research.valid("breakout", {"n": 30}), "parametro mancante"
    assert not research.valid("breakout", {"n": 30, "trail": 2, "x": 1}), "parametro in più"
    assert not research.valid("ema_cross", {"f": 30, "s": 30}) and research.valid("ema_cross", {"f": 20, "s": 100})
    assert not research.valid("import os", {}), "modello inventato"
    assert research.name_of("momentum", {"hold": 5, "p": 45}) == "r_momentum_45_5"
    print("ok grammatica: solo modelli e valori ammessi, nomi deterministici")


def test_proposte_e_limiti():
    with tempfile.TemporaryDirectory() as d:
        path, summary, notes = os.path.join(d, "research.json"), os.path.join(d, "lab.json"), []
        json.dump({"results": {"donchian20:1d": {"n": 179, "family": "trend", "excess_avg_pct": 4.5, "stable": True}}}, open(summary, "w"))
        props = [{"template": "breakout", "params": {"n": 30, "trail": 2}, "why": "orizzonte intermedio"},
                 {"template": "breakout", "params": {"n": 31, "trail": 2}, "why": "fuori grammatica"},
                 {"template": "momentum", "params": {"p": 45, "hold": 5}, "why": "momento"},
                 {"template": "rsi_pullback", "params": {"r": 2, "lv": 5}, "why": "terza: oltre il limite"}]
        post = post_with(props)
        added = research.run(summary, path, key="k", now=NOW, notify=notes.append, post=post, get=get)
        assert added == ["r_breakout_30_2", "r_momentum_45_5"], added
        assert "donchian20:1d (trend)" in post.prompt and "breakout" in post.prompt
        saved = json.load(open(path))["proposals"]
        assert [p["name"] for p in saved] == added and saved[0]["declared_at"].startswith("2026-11-15") and "RICERCATORE" in notes[-1]
        # stessa settimana: niente altre proposte
        assert research.run(summary, path, key="k", now=NOW, post=post_with(props[3:]), get=get) == []
        # senza IA: niente proposte (nessuna scelta a caso)
        assert research.run(summary, path, key="", now=NOW.replace(day=22)) == []
        # settimana dopo, una già proposta viene saltata
        nxt = research.run(summary, path, key="k", now=NOW.replace(day=22), post=post_with(props[:1] + props[3:]), get=get)
        assert nxt == ["r_rsi_pullback_2_5"], nxt
    print("ok proposte: massimo 2 a settimana, fuori grammatica scartate, niente doppioni, niente senza IA")


def test_registrazione_nel_laboratorio():
    import lab_strategies as ls
    import strategy_lab as lab
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "research.json")
        json.dump({"proposals": [
            {"name": "r_breakout_30_2", "template": "breakout", "params": {"n": 30, "trail": 2}, "why": "x", "declared_at": "2026-11-15T18:41:00+00:00"},
            {"name": "r_ema_cross_20_100", "template": "ema_cross", "params": {"f": 20, "s": 100}, "why": "y", "declared_at": "2026-11-15T18:41:00+00:00"},
            {"name": "r_falso", "template": "breakout", "params": {"n": 30, "trail": 2}},          # nome che non corrisponde: scartata
            {"name": "r_x", "template": "eval", "params": {}}]}, open(path, "w"))
        before = set(ls.STRATEGIES)
        ls._register_research(path)
        new = set(ls.STRATEGIES) - before
        assert new <= {"r_breakout_30_2", "r_ema_cross_20_100"} and "r_falso" not in ls.STRATEGIES and "r_x" not in ls.STRATEGIES
        spec = ls.STRATEGIES["r_breakout_30_2"]
        assert spec["family"] == "ricerca" and spec["tfs"] == ["1d"] and spec["exit"]["trail_atr"] == 2.0 and "ricercatore" in spec["description"]
        # gira davvero nel motore del laboratorio
        n = 600
        t = pd.date_range("2024-01-01", periods=n, freq="D", tz="UTC")
        rng = np.random.default_rng(1)
        c = 100 * np.exp(np.cumsum(rng.normal(0, 0.03, n)))
        df = pd.DataFrame({"time": t, "open": c, "high": c * 1.01, "low": c * 0.99, "close": c, "volume": np.ones(n)})
        for name in ("r_breakout_30_2", "r_ema_cross_20_100"):
            trades = lab.simulate(df, "1d", "BTCUSDT", ls.STRATEGIES[name])
            assert isinstance(trades, list) and len(trades) > 0, name
    print("ok laboratorio: le varianti valide diventano strategie della famiglia ricerca e girano nel motore")


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
    print(f"{len(tests)} test superati")
