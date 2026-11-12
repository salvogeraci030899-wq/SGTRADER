"""Test dell'agente eventi (event_guard.py): solo pausa dei nuovi ingressi, mai notizie inventate.
Esegui: python tests/test_event_guard.py
"""
import json
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bitget_client as bg  # noqa: E402
import event_guard as eg  # noqa: E402
import executor as ex  # noqa: E402

NOW = datetime(2026, 12, 1, 12, 0, tzinfo=timezone.utc)
RSS = """<?xml version="1.0"?><rss><channel>
<item><title>Bitget halts withdrawals after security incident</title><pubDate>Tue, 01 Dec 2026 11:20:00 +0000</pubDate></item>
<item><title>Analyst: BTC could reach new highs</title><pubDate>Tue, 01 Dec 2026 10:00:00 +0000</pubDate></item>
<item><title>Old news from last week</title><pubDate>Tue, 24 Nov 2026 10:00:00 +0000</pubDate></item>
</channel></rss>"""
ATOM = """<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>XRP network resumes</title><updated>2026-12-01T09:00:00Z</updated></entry></feed>"""


class Resp:
    def __init__(self, status=200, text="", data=None):
        self.status_code, self.text, self._data = status, text, data

    def json(self):
        return self._data


def fake_get(url, **kw):
    if "groq" in url:
        return Resp(data={"data": [{"id": "llama-3.3-70b-versatile"}]})
    if "coindesk" in url:
        return Resp(text=RSS)
    if "decrypt" in url:
        return Resp(text=ATOM)
    return Resp(status=500)


def fake_post(answer):
    calls = []

    def post(url, headers=None, json=None, timeout=None):
        calls.append(json)
        return Resp(data={"choices": [{"message": {"content": answer}}]})
    post.calls = calls
    return post


def test_lettura_feed():
    rss = eg.parse_feed(RSS, "CoinDesk")
    assert len(rss) == 3 and rss[0]["title"].startswith("Bitget halts") and rss[0]["at"] == "2026-12-01T11:20+00:00"
    assert eg.parse_feed(ATOM, "Decrypt")[0]["title"] == "XRP network resumes"
    assert eg.parse_feed("<non xml", "x") == []
    titles = eg.fetch_titles(NOW, fake_get)
    assert [t["title"] for t in titles] == ["Bitget halts withdrawals after security incident", "Analyst: BTC could reach new highs", "XRP network resumes"]
    print("ok lettura feed: RSS e Atom, solo le ultime 6 ore, fonte giù ignorata")


def test_validazione():
    titles = eg.fetch_titles(NOW, fake_get)
    v = eg.validate(json.dumps({"level": "pausa", "hours": 99, "headline": "bitget halts withdrawals after security incident", "reason": "blocco prelievi"}), titles)
    assert v["level"] == "pausa" and v["hours"] == 24 and v["headline"].startswith("Bitget") and v["source"] == "CoinDesk"
    inventato = eg.validate(json.dumps({"level": "pausa", "hours": 5, "headline": "Binance hacked", "reason": "x"}), titles)
    assert inventato["level"] == "normale", "titolo inventato: nessuna pausa"
    assert eg.validate('{"level": "vendi tutto"}', titles) == {"level": "normale"}
    assert eg.validate("non json", titles) is None
    assert eg.validate(json.dumps({"level": "pausa", "hours": "x", "headline": titles[0]["title"]}), titles)["hours"] == 6
    print("ok validazione: solo pausa o normale, titolo vero, 1-24 ore")


def test_pausa_e_fine():
    with tempfile.TemporaryDirectory() as d:
        path, notes = os.path.join(d, "guard.json"), []
        post = fake_post(json.dumps({"level": "pausa", "hours": 3, "headline": "Bitget halts withdrawals after security incident", "reason": "Bitget blocca i prelievi"}))
        assert eg.run(NOW, path, notes.append, key="k", get=fake_get, post=post)
        s = json.load(open(path))
        assert s["status"] == "pausa" and s["pause_until"].startswith("2026-12-01T15:00") and "Bitget blocca" in notes[-1]
        assert eg.active_pause(NOW + timedelta(hours=1), path) and not eg.active_pause(NOW + timedelta(hours=4), path)
        # un'ora dopo l'IA dice normale: la pausa resta fino alla scadenza, nessun messaggio nuovo
        n = len(notes)
        eg.run(NOW + timedelta(hours=1), path, notes.append, key="k", get=fake_get, post=fake_post('{"level": "normale"}'))
        assert json.load(open(path))["status"] == "pausa" and len(notes) == n
        # controllo troppo presto: niente richieste
        p2 = fake_post('{"level": "normale"}')
        assert eg.run(NOW + timedelta(hours=1, minutes=10), path, notes.append, key="k", get=fake_get, post=p2) is False and not p2.calls
        # scaduta: si toglie e si avvisa
        eg.run(NOW + timedelta(hours=4), path, notes.append, key="k", get=fake_get, post=fake_post('{"level": "normale"}'))
        s = json.load(open(path))
        assert s["status"] == "normale" and "pause_until" not in s and "Pausa finita" in notes[-1] and len(s["history"]) == 1
    print("ok pausa: avviso, durata, fine con avviso, al massimo un controllo all'ora")


def test_senza_chiave_o_ia_giu():
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "guard.json")
        eg.run(NOW, path, key="")
        assert "GROQ" in json.load(open(path))["status"] and not eg.active_pause(NOW, path)

        def broken_post(*a, **k):
            raise ConnectionError("giù")
        eg.run(NOW, path, key="k", get=fake_get, post=broken_post, force=True)
        assert json.load(open(path))["status"] == "IA non disponibile" and not eg.active_pause(NOW, path)
        eg.run(NOW, path, key="k", get=lambda *a, **k: Resp(status=503), post=broken_post, force=True)
        assert json.load(open(path))["status"] == "notizie non lette"
    print("ok guasti: senza chiave, IA giù o notizie non lette non c'è nessuna pausa")


def test_esecutore_non_entra_in_pausa():
    D = 86400
    t = int(NOW.timestamp()) // D * D - D
    trade = {"id": f"x:1d:BTCUSDT:{t}", "symbol": "BTCUSDT", "t": t, "t_entry": t + D, "dir": 1, "entry": 100_000.0, "stop": 98_000.0, "open": True}
    cfg = {"strategies": {"x:1d": "live"}, "emergency": False, "risk": {}}
    ledger = {"strategies": {"x:1d": {"mode": "live", "trades": [trade]}}}
    with tempfile.TemporaryDirectory() as d:
        state, guard = os.path.join(d, "live.json"), os.path.join(d, "guard_state.json")
        json.dump({"pause_until": (NOW + timedelta(hours=2)).isoformat(), "reason": "Bitget blocca i prelievi"}, open(guard, "w"))
        client = bg.DryRunClient(10_000)
        ex.run(cfg, ledger, client, "demo", state, now=NOW, specs_fn=lambda s: {"volume_place": 3, "price_place": 1, "min_size": 0.001})
        p = json.load(open(state))["positions"][trade["id"]]
        assert p["status"] == "skipped" and "agente eventi" in p["reason"] and client.positions() == {}
    print("ok esecutore: con la pausa non apre, le altre regole restano")


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
    print(f"{len(tests)} test superati")
