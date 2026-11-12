"""Controllo rapido ogni 5 minuti (quick.py): avvisi di prezzo e chiusure su Bitget, stato separato."""
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import quick  # noqa: E402

NOW = datetime(2026, 11, 12, 4, 0, tzinfo=timezone.utc)
MS = NOW.timestamp() * 1000


class Client:
    demo = False

    def __init__(self, hist):
        self.hist = hist

    def closed_positions(self, limit=30):
        return self.hist


def test_avvisi_e_chiusure():
    with tempfile.TemporaryDirectory() as d:
        st, cfg, legacy = (os.path.join(d, n) for n in ("q.json", "a.json", "old.json"))
        json.dump({"price_alerts": [
            {"id": "aaaa1111", "symbol": "BTCUSDT", "side": "above", "price": 75000, "created_at": "2026-11-12T03:00:00+00:00"},
            {"id": "bbbb2222", "symbol": "BTCUSDT", "side": "below", "price": 60000, "created_at": "2026-11-12T03:00:00+00:00"},
            {"id": "cccc3333", "symbol": "BTCUSDT", "side": "above", "price": 70000, "created_at": "2026-11-12T03:00:00+00:00"}]}, open(cfg, "w"))
        json.dump({"_price_alerts_fired": ["cccc3333"]}, open(legacy, "w"))          # già scattato quando lo controllava il bot
        candles = [(int(MS - 30 * 60e3), 75100.0, 74000.0)]
        h1 = {"id": "p1", "symbol": "SOLUSDT", "side": "short", "size": 0.1, "entry": 84, "exit": 83, "pnl": 0.1, "fees": 0.01, "funding": 0, "net": 0.09, "closed_at": MS - 60e3}
        sent = []
        notify = lambda t: sent.append(t) or True
        # primo giro: avviso a 75.000 toccato; storico Bitget memorizzato senza messaggi
        assert quick.run(notify, Client([h1]), st, cfg, legacy, fetch=lambda s: candles, now=NOW)
        assert len(sent) == 1 and "BTC ha toccato 75.000" in sent[0]
        s = json.load(open(st))
        assert set(s["_price_alerts_fired"]) == {"aaaa1111", "cccc3333"} and s["closed_notified"] == ["p1"]
        # secondo giro: niente di nuovo → nessun messaggio e file non riscritto
        assert not quick.run(notify, Client([h1]), st, cfg, legacy, fetch=lambda s: candles, now=NOW) and len(sent) == 1
        # una posizione chiusa adesso: un messaggio
        h2 = dict(h1, id="p2", net=-0.2, closed_at=MS - 10e3)
        assert quick.run(notify, Client([h2, h1]), st, cfg, legacy, fetch=lambda s: candles, now=NOW)
        assert len(sent) == 2 and sent[1].startswith("❌ POSIZIONE CHIUSA") and "Netto -0,20 USDT" in sent[1]
        # Bitget non risponde: nessun errore
        class Down:
            def closed_positions(self, limit=30):
                raise RuntimeError("rete")
        assert not quick.run(notify, Down(), st, cfg, legacy, fetch=lambda s: candles, now=NOW)


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
