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


def test_main_non_si_rompe_con_prova_su_carta_ed_esecutore():
    """Regressione v64: il blocco prova su carta/esecutore sovrascriveva il registro delle previsioni di Kronos
    e il salvataggio finale andava in errore. Qui main() gira davvero (rete e modello simulati)."""
    import pandas as pd
    import track_record
    with tempfile.TemporaryDirectory() as d:
        cwd = os.getcwd()
        os.chdir(d)
        try:
            json.dump({"paper_start": "2026-11-11", "strategies": {"big_candle_trail:1d": "paper"}}, open("automation.json", "w"))
            json.dump({"started": "2026-11-11", "strategies": {}}, open("paper_trades.json", "w"))
            t = pd.Timestamp.now(tz="UTC").floor("h") - pd.Timedelta(hours=300)   # candele tutte chiuse
            kl = [[str(int((t + pd.Timedelta(hours=i)).timestamp() * 1000)), "100", "101", "99", "100", "1", "1", "1"] for i in range(200)]
            saved = {k: getattr(run_bot, k) for k in ("ASSETS_TO_RUN", "TIMEFRAMES_TO_RUN", "get_historical_data", "load_predictor", "generate_payload", "get_live_price")}
            saved_fd = run_bot.futures_data.collect
            saved_paper = run_bot.paper.update
            run_bot.ASSETS_TO_RUN, run_bot.TIMEFRAMES_TO_RUN = ["BTCUSDT"], ["1h"]
            run_bot.get_historical_data = lambda s, tf: kl
            run_bot.load_predictor = lambda: object()
            run_bot.get_live_price = lambda s, f: f
            def payload(pred, df, symbol, freq):
                return {"status": "live", "last_update": "2026-11-11T10:00:00+00:00", "current_price": 100.0, "last_close": 100.0,
                        "last_candle_time": int(df["time"].iloc[-1].timestamp()), "prob_up": 50.0, "n_samples": 1, "model": "x",
                        "historical": [], "forecast": [], "band_upper": [], "band_lower": [],
                        "ai_plan": {"bias": "NEUTRO", "direction": "LONG", "entry": 100.0, "stop_loss": 98.0, "take_profit": 104.0,
                                    "rr": 2.0, "tradeable": False, "risk_pct": 2.0, "reward_pct": 4.0, "atr": 1.0}}
            run_bot.generate_payload = payload
            run_bot.futures_data.collect = lambda: False
            run_bot.paper.update = lambda *a, **k: False
            run_bot.main()
            assert os.path.exists("track_record.jsonl") and len(track_record.load_ledger()) == 1
            assert json.load(open("dashboard.json"))["BTCUSDT_1h"]["prob_up"] == 50.0
        finally:
            for k, v in saved.items():
                setattr(run_bot, k, v)
            run_bot.futures_data.collect = saved_fd
            run_bot.paper.update = saved_paper
            os.chdir(cwd)


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
