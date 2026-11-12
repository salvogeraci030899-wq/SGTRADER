import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import automation
import price_alerts as pa

T0 = "2026-11-11T10:00:00+00:00"
T0_MS = 1_794_391_200_000  # 2026-11-11T10:00:00Z


def test_aggiunta_e_regole():
    cfg = {}
    assert "BTC ≥ 75.000" in pa.add(cfg, "BTCUSDT:above:75000", now=T0)
    for bad in ["DOGEUSDT:above:1", "BTCUSDT:sopra:1", "BTCUSDT:above:-5", "BTCUSDT:above", "x"]:
        try:
            pa.add(cfg, bad)
            raise AssertionError(bad)
        except pa.AlertError:
            pass
    try:
        pa.add(cfg, "BTCUSDT:above:75000")
        raise AssertionError()
    except pa.AlertError as e:
        assert "già" in str(e)
    for i in range(9):
        pa.add(cfg, f"ETHUSDT:below:{1000 + i}")
    try:
        pa.add(cfg, "SOLUSDT:below:10")
        raise AssertionError()
    except pa.AlertError as e:
        assert "massimo" in str(e)
    # uno scattato libera un posto e viene tolto quando il file viene riscritto
    st = {pa.FIRED_KEY: [cfg["price_alerts"][0]["id"]]}
    pa.add(cfg, "SOLUSDT:below:10", st)
    assert len(cfg["price_alerts"]) == 10 and all(a["symbol"] != "BTCUSDT" for a in cfg["price_alerts"])


def test_controllo_sulle_candele():
    cfg = {}
    pa.add(cfg, "BTCUSDT:above:75000", now=T0)
    pa.add(cfg, "BTCUSDT:below:68000", now=T0)
    sent = []
    notify = lambda t: sent.append(t) or True
    # tocco di 75.000 PRIMA della creazione: non conta; dopo, sì
    candles = [(T0_MS - 120_000, 76000, 74000), (T0_MS + 60_000, 74900, 70000)]
    st = {}
    assert pa.check(cfg, st, notify, fetch=lambda s: candles) == 0 and not sent
    candles.append((T0_MS + 120_000, 75010, 74800))
    assert pa.check(cfg, st, notify, fetch=lambda s: candles) == 1
    assert "BTC ha toccato 75.000" in sent[0] and "Nessun ordine" in sent[0]
    # scatta una volta sola
    assert pa.check(cfg, st, notify, fetch=lambda s: candles) == 0 and len(sent) == 1
    assert len(pa.active(cfg, st)) == 1
    # Telegram non raggiunto: resta attivo e si riprova
    candles.append((T0_MS + 180_000, 70000, 67000))
    assert pa.check(cfg, st, lambda t: False, fetch=lambda s: candles) == 0 and len(pa.active(cfg, st)) == 1
    # candele non leggibili: nessun errore
    def boom(s):
        raise RuntimeError("rete")
    assert pa.check(cfg, st, notify, fetch=boom) == 0


def test_comando_automation():
    with tempfile.TemporaryDirectory() as d:
        path, sp = os.path.join(d, "automation.json"), os.path.join(d, "alerts_state.json")
        json.dump({"strategies": {}, "emergency": False, "history": []}, open(path, "w"))
        msg = automation.run(["alert", "add", "ETHUSDT:below:3000"], path=path, alerts_state_path=sp)
        assert "ETH ≤ 3.000" in msg
        cfg = json.load(open(path))
        aid = cfg["price_alerts"][0]["id"]
        assert cfg["history"][-1]["cmd"] == "alert"
        try:
            automation.run(["alert", "del", "nonesiste"], path=path, alerts_state_path=sp)
            raise AssertionError()
        except automation.CommandError:
            pass
        assert automation.run(["alert", "del", aid], path=path, alerts_state_path=sp) == "Avviso tolto."
        automation.run(["alert", "add", "SOLUSDT:above:300"], path=path, alerts_state_path=sp)
        assert "(1)" in automation.run(["alert", "clear"], path=path, alerts_state_path=sp)
        assert json.load(open(path))["price_alerts"] == []


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
