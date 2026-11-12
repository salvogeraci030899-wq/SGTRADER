"""Test del registro degli eventi (events.py) e dello storico del patrimonio (executor.record_equity)."""
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import automation  # noqa: E402
import events  # noqa: E402
import executor  # noqa: E402

NOW = datetime(2026, 11, 20, 10, 0, tzinfo=timezone.utc)


def _with_dir():
    d = tempfile.mkdtemp()
    os.environ["SGT_EVENTS_DIR"] = os.path.join(d, "events")
    return d


def test_spento_senza_variabile():
    os.environ.pop("SGT_EVENTS_DIR", None)
    assert events.record("sistema", "prova", "niente") is None


def test_scrive_per_mese_e_toglie_i_doppioni():
    d = _with_dir()
    e1 = events.record("avvisi", "scattato", "BTC ha toccato 75.000", at=NOW, symbol="BTCUSDT")
    events.record("sistema", "prova", "dicembre", at=datetime(2026, 12, 1, tzinfo=timezone.utc))
    assert events.record("tipo-sconosciuto", "x", "y") is None
    path = os.path.join(d, "events", "2026-11.jsonl")
    lines = open(path).read().splitlines()
    assert len(lines) == 1 and json.loads(lines[0])["id"] == e1["id"] and e1["at"] == "2026-11-20T10:00:00+00:00"
    with open(path, "a") as f:                      # doppione da unione di due salvataggi (merge=union)
        f.write(lines[0] + "\n" + "riga rotta\n")
    got = events.read("2026-11")
    assert len(got) == 1 and got[0]["text"] == "BTC ha toccato 75.000"
    assert len(events.read("2026-12")) == 1 and events.read("2030-01") == []
    os.environ.pop("SGT_EVENTS_DIR")


def test_comando_dall_app_nel_registro():
    d = _with_dir()
    cfg = os.path.join(d, "automation.json")
    automation.run(["agent", "profile", "prudente"], path=cfg)
    automation.run(["emergency"], path=cfg)
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    got = events.read(month)
    assert [(e["kind"], e["action"]) for e in got] == [("agente", "agent"), ("sistema", "emergency")]
    assert "prudente" in got[0]["text"]
    os.environ.pop("SGT_EVENTS_DIR")


def test_storico_del_patrimonio_e_versamenti():
    d = _with_dir()
    path = os.path.join(d, "equity_history.json")
    acc = {"day": "2026-11-20", "day_open_total": 16.0, "day_start_total": 16.0, "total_usdt": 16.5, "day_change": 0.5}
    assert executor.record_equity(acc, {}, NOW, path) is True
    assert executor.record_equity(acc, {}, NOW, path) is False            # nulla di nuovo: niente scrittura
    # versamento di 50 riconosciuto: la base sale a 66, il guadagno resta quello del trading
    acc2 = dict(acc, day_start_total=66.0, total_usdt=66.7, day_change=0.7)
    executor.record_equity(acc2, {}, NOW, path)
    row = json.load(open(path))["days"]["2026-11-20"]
    assert row == {"open": 16.0, "close": 66.7, "flows": 50.0, "pnl": 0.7, "demo": False, "at": NOW.isoformat(timespec="seconds")}
    ev = events.read("2026-11")
    assert len(ev) == 1 and ev[0]["kind"] == "conto" and ev[0]["action"] == "versamento" and ev[0]["usdt"] == 50.0
    os.environ.pop("SGT_EVENTS_DIR")


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
