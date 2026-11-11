"""Test del track record. Eseguibili con `python3 -m pytest tests` oppure `python3 tests/test_track_record.py`."""
import os
import sys
import tempfile

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import track_record as tr  # noqa: E402
from kronos_core import PRED_LEN, FEE_PCT, SLIPPAGE_PCT, TAX_RATE  # noqa: E402

H = 3600
T0 = 1_800_000_000 - (1_800_000_000 % H)  # candela di riferimento (apertura), 1h


def payload(prob_up=80.0, bias="LONG", direction="LONG", entry=100.0, sl=98.0, tp=104.0, tradeable=True, candle_time=T0):
    return {"last_candle_time": candle_time, "last_close": 100.0, "prob_up": prob_up, "model": "test", "n_samples": 50,
            "ai_plan": {"bias": bias, "direction": direction, "entry": entry, "stop_loss": sl, "take_profit": tp, "rr": 2.0, "tradeable": tradeable}}


def frame(rows, start=T0):
    """rows: lista di (open, high, low, close) per le candele dalla candela di riferimento in poi."""
    return pd.DataFrame([{"time": pd.Timestamp(start + i * H, unit="s", tz="UTC"), "open": o, "high": h, "low": l, "close": c}
                         for i, (o, h, l, c) in enumerate(rows)])


FLAT = (100, 100.5, 99.5, 100)
AFTER = T0 + (PRED_LEN + 1) * H + 1  # istante dopo la fine dell'orizzonte


def net(gross):
    return gross - (FEE_PCT + SLIPPAGE_PCT) * 2   # tasse escluse dal singolo trade


def test_prima_previsione_vince():
    led = []
    assert tr.record_prediction(led, "BTCUSDT", "1h", payload(prob_up=80))
    assert not tr.record_prediction(led, "BTCUSDT", "1h", payload(prob_up=20))  # ricalcolo della stessa candela
    assert len(led) == 1 and led[0]["prob_up"] == 80
    assert led[0]["horizon_end"] == T0 + (PRED_LEN + 1) * H


def test_resta_aperta_prima_dell_orizzonte_e_con_dati_incompleti():
    led = []
    tr.record_prediction(led, "BTCUSDT", "1h", payload())
    frames = {"BTCUSDT_1h": frame([FLAT] * (PRED_LEN + 1))}
    assert tr.resolve(led, frames, now_ts=AFTER - 10) == 0 and led[0]["status"] == "open"
    frames = {"BTCUSDT_1h": frame([FLAT] * PRED_LEN)}  # manca l'ultima candela dell'orizzonte
    assert tr.resolve(led, frames, now_ts=AFTER) == 0 and led[0]["status"] == "open"


def test_scaduta_se_candele_non_piu_disponibili():
    led = []
    tr.record_prediction(led, "BTCUSDT", "1h", payload())
    frames = {"BTCUSDT_1h": frame([FLAT] * 20, start=T0 + 5 * H)}
    assert tr.resolve(led, frames, now_ts=AFTER) == 1 and led[0]["status"] == "expired"


def test_long_target_stop_e_tempo():
    # target toccato alla terza candela
    led = []
    tr.record_prediction(led, "BTCUSDT", "1h", payload())
    rows = [FLAT, FLAT, FLAT, (100, 104.5, 99.8, 104)] + [FLAT] * PRED_LEN
    tr.resolve(led, {"BTCUSDT_1h": frame(rows)}, now_ts=AFTER)
    t = led[0]["outcome"]["trade"]
    assert t["exit_reason"] == "TP" and abs(t["net_pct"] - round(net(4.0), 4)) < 1e-9
    # stop e target nella stessa candela: conta lo stop
    led = []
    tr.record_prediction(led, "BTCUSDT", "1h", payload())
    rows = [FLAT, (100, 105, 97, 100)] + [FLAT] * PRED_LEN
    tr.resolve(led, {"BTCUSDT_1h": frame(rows)}, now_ts=AFTER)
    t = led[0]["outcome"]["trade"]
    assert t["exit_reason"] == "SL" and abs(t["net_pct"] - round(net(-2.0), 4)) < 1e-9
    # nessun tocco: uscita alla chiusura dell'ultima candela dell'orizzonte, direzione registrata
    led = []
    tr.record_prediction(led, "BTCUSDT", "1h", payload())
    rows = [FLAT] * PRED_LEN + [(100, 101.5, 99.5, 101)]
    tr.resolve(led, {"BTCUSDT_1h": frame(rows)}, now_ts=AFTER)
    o = led[0]["outcome"]
    assert o["trade"]["exit_reason"] == "TEMPO" and o["trade"]["exit_price"] == 101 and o["up"] is True


def test_short_e_neutro():
    led = []
    tr.record_prediction(led, "ETHUSDT", "1h", payload(prob_up=15, bias="SHORT", direction="SHORT", sl=102, tp=96))
    rows = [FLAT, (100, 100.2, 95.5, 96)] + [FLAT] * PRED_LEN
    tr.resolve(led, {"ETHUSDT_1h": frame(rows)}, now_ts=AFTER)
    t = led[0]["outcome"]["trade"]
    assert t["exit_reason"] == "TP" and t["gross_pct"] == 4.0
    # previsione neutra: si misura solo la direzione, nessun trade
    led = []
    tr.record_prediction(led, "ETHUSDT", "1h", payload(prob_up=55, bias="NEUTRO"))
    tr.resolve(led, {"ETHUSDT_1h": frame([FLAT] * (PRED_LEN + 1))}, now_ts=AFTER)
    assert led[0]["status"] == "resolved" and "trade" not in led[0]["outcome"]


def test_riepilogo_calibrazione_e_statistiche():
    led = []
    # 10 previsioni all'80%: 8 salgono, 2 scendono -> calibrazione perfetta nella fascia 80-90
    for i in range(10):
        tr.record_prediction(led, "SOLUSDT", "1h", payload(prob_up=80, bias="NEUTRO", candle_time=T0 + i * 100 * H))
        up = i < 8
        led[-1]["status"] = "resolved"
        led[-1]["outcome"] = {"up": up, "close_at_horizon": 101 if up else 99}
    s = tr.build_summary(led)
    p = s["overall"]["predictions"]
    assert p["n"] == 10 and p["direction_hit_rate"] == 80.0
    assert p["calibration"] == [{"range": "80-90", "n": 10, "predicted_up_pct": 80.0, "realized_up_pct": 80.0}]
    assert abs(p["brier"] - 0.16) < 1e-9 and abs(p["brier_baseline"] - 0.16) < 1e-9
    assert s["overall"]["tradeable_signals"] == {"n": 0}
    stats = tr._trade_stats([2.0, -1.0, -1.0, 3.0])
    assert stats["win_rate"] == 50.0 and stats["profit_factor"] == 2.5 and stats["max_drawdown_pct"] == -2.0
    # tasse sul totale: le perdite compensano i guadagni; se il totale è negativo non si paga nulla
    assert stats["total_net_pct"] == 3.0 and stats["total_after_tax_pct"] == round(3.0 * (1 - TAX_RATE), 2)
    assert tr._trade_stats([2.0, -3.0])["total_after_tax_pct"] == -1.0
    # il riepilogo riparte dal lordo: un esito salvato con la vecchia regola (netto già tassato) non falsa il conto
    led = []
    tr.record_prediction(led, "BTCUSDT", "1h", payload())
    led[0]["status"] = "resolved"
    led[0]["outcome"] = {"up": True, "close_at_horizon": 104, "trade": {"exit_reason": "TP", "exit_price": 104, "gross_pct": 4.0, "net_pct": 2.479}}
    t = tr.build_summary(led)["overall"]["tradeable_signals"]
    assert t["avg_net_pct"] == round(net(4.0), 3) and tr.build_summary(led)["costs"]["tax_basis"] == "totale"


def test_salvataggio_e_rilettura():
    led = []
    tr.record_prediction(led, "BTCUSDT", "4h", payload())
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "tr.jsonl")
        tr.save_ledger(led, path)
        assert tr.load_ledger(path) == led
        with open(path, "a") as f:
            f.write("{non json\n")
        try:
            tr.load_ledger(path)
            assert False, "un registro corrotto deve fermare il bot"
        except SystemExit:
            pass


def test_doppioni_da_unione_tolti():
    import json
    d = tempfile.mkdtemp()
    p = os.path.join(d, "l.jsonl")
    rows = [{"id": "a", "status": "open"}, {"id": "b", "status": "open"}, {"id": "a", "status": "hit_tp"}, {"id": "b", "status": "open"}, {"id": "c", "status": "open"}]
    with open(p, "w") as f:
        f.write("\n".join(json.dumps(r) for r in rows) + "\n")
    got = tr.load_ledger(p)
    assert [e["id"] for e in got] == ["a", "b", "c"] and got[0]["status"] == "hit_tp"


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
