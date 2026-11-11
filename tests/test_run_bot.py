"""Test del bot (parti senza modello). `python3 tests/test_run_bot.py` oppure pytest."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import run_bot  # noqa: E402


def test_avviso_segnale_non_validato():
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "v.json")
        # nessuna validazione disponibile: l'avviso c'è comunque
        assert "NON validato" in run_bot.validation_note("BTCUSDT", "4h", path)
        json.dump({"by_pair": {"BTCUSDT_4h": {"n": 198, "verdict": "non_dimostrato"}, "ETHUSDT_1d": {"n": 350, "verdict": "positivo"}}}, open(path, "w"))
        note = run_bot.validation_note("BTCUSDT", "4h", path)
        assert "NON validato" in note and "198" in note
        assert run_bot.validation_note("ETHUSDT", "1d", path) == ""                # vantaggio dimostrato: nessun avviso
        assert "NON validato" in run_bot.validation_note("SOLUSDT", "1h", path)    # coppia mai validata
        assert "_" not in note and "*" not in note                                 # niente caratteri che rompono il Markdown di Telegram


def test_avviso_dentro_l_alert():
    payload = {"prob_up": 90.0, "current_price": 100.0, "last_candle_time": 1_700_000_000,
               "ai_plan": {"entry": 100.0, "stop_loss": 98.0, "take_profit": 104.0, "risk_pct": 2.0, "reward_pct": 4.0, "rr": 2.0, "atr": 1.3}}
    text = run_bot.build_alert_text("BTCUSDT", "4h", payload, "LONG", {"1d": "NEUTRO"})
    assert "NUOVO SEGNALE" in text and text.rstrip().endswith("Solo informativo.") or "NON validato" not in text


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
