"""Test del riepilogo giornaliero. `python3 tests/test_daily_report.py` oppure pytest."""
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import daily_report as dr  # noqa: E402

NOW = datetime(2026, 11, 12, 8, 17, tzinfo=timezone.utc)


def files(d, emergency=False, halted=False):
    paths = {k: os.path.join(d, f"{k}.json") for k in ("futures", "paper", "live", "automation", "lab")}
    json.dump({"symbols": {"BTCUSDT": {"funding_rate_pct": 0.01, "open_interest_change_24h_pct": -3.2}}}, open(paths["futures"], "w"))
    json.dump({"strategies": {"big_candle_trail:1d": {"stats": {"n": 3, "open": 1, "win_rate": 66.7, "avg_net_pct": 1.234}}}}, open(paths["paper"], "w"))
    json.dump({"mode": "simulata", "halted": halted, "positions": {"x": {"status": "open"}}}, open(paths["live"], "w"))
    json.dump({"emergency": emergency, "strategies": {"big_candle_trail:1d": "paper"}}, open(paths["automation"], "w"))
    json.dump({"confirmed": []}, open(paths["lab"], "w"))
    return paths


def frames():
    return {"BTCUSDT_1d": pd.DataFrame({"close": [100000.0, 102000.0]}), "ETHUSDT_1d": pd.DataFrame({"close": [3000.0]})}


def test_contenuto():
    with tempfile.TemporaryDirectory() as d:
        text = dr.build(frames(), NOW, files(d))
        assert text.startswith("📊 RIEPILOGO 12/11/2026")
        assert "BTC 102,000.00 (+2.00%)" in text and "ETH" not in text.split("\n")[1]          # ETH senza due candele: omesso
        assert "BTC funding +0.0100%, OI 24h -3.2%" in text
        assert "Strategie attive: big candle trail:1d (carta)" in text
        assert "Su carta big candle trail:1d: 3 chiusi (vincenti 67%, netto medio +1.23%), 1 aperti" in text
        assert "Esecutore: modalità simulata, 1 posizioni aperte" in text and "nessuna (ordini veri non consentiti)" in text
        assert "_" not in text and "*" not in text                                                 # Markdown di Telegram
        alarm = dr.build({}, NOW, files(d, emergency=True, halted=True))
        assert "EMERGENZA ATTIVA" in alarm and "BLOCCATO" in alarm
    # senza file: riepilogo comunque leggibile, nessun errore
    with tempfile.TemporaryDirectory() as d:
        text = dr.build({}, NOW, {k: os.path.join(d, "manca.json") for k in ("futures", "paper", "live", "automation", "lab")})
        assert "Strategie attive: nessuna" in text and "nessuna attività" in text


def test_una_volta_al_giorno():
    with tempfile.TemporaryDirectory() as d:
        paths, sent, state = files(d), [], {}
        notify = lambda t: sent.append(t) or True
        assert dr.maybe_send(state, {}, notify, now=NOW.replace(hour=6), paths=paths) is False        # troppo presto
        assert dr.maybe_send(state, {}, notify, now=NOW, paths=paths) is True and state[dr.STATE_KEY] == "2026-11-12"
        assert dr.maybe_send(state, {}, notify, now=NOW.replace(hour=20), paths=paths) is False       # già mandato oggi
        assert dr.maybe_send(state, {}, notify, now=NOW.replace(day=13), paths=paths) is True and len(sent) == 2
        # Telegram non risponde: si riprova al giro dopo
        state2 = {}
        assert dr.maybe_send(state2, {}, lambda t: False, now=NOW, paths=paths) is False and dr.STATE_KEY not in state2


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
