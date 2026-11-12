"""Test dell'agente revisore (review.py): esecuzione reale contro carta, ingressi saltati.
Esegui: python tests/test_review.py
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import review  # noqa: E402

NOW = datetime(2026, 12, 20, 12, 0, tzinfo=timezone.utc)
T1 = int(datetime(2026, 12, 10, tzinfo=timezone.utc).timestamp())
T2 = int(datetime(2026, 12, 12, tzinfo=timezone.utc).timestamp())
OLD = int(datetime(2026, 10, 1, tzinfo=timezone.utc).timestamp())


def data(gap_extra=0.0):
    live = {"positions": {
        f"s:1d:BTCUSDT:{T1}": {"symbol": "BTCUSDT", "side": "long", "status": "closed", "opened_at": datetime.fromtimestamp(T1 + 86400, timezone.utc).isoformat()},
        f"s:1d:SOLUSDT:{T2}": {"symbol": "SOLUSDT", "side": "short", "status": "closed", "opened_at": datetime.fromtimestamp(T2 + 86400, timezone.utc).isoformat()},
        f"s:1d:XRPUSDT:{T2}": {"symbol": "XRPUSDT", "side": "long", "status": "skipped", "reason": "quantità sotto il minimo del contratto"},
        f"s:1d:ETHUSDT:{T2}": {"symbol": "ETHUSDT", "side": "long", "status": "skipped", "reason": "pausa dell'agente eventi (Bitget blocca i prelievi)"},
        f"s:1d:ADAUSDT:{T2}": {"symbol": "ADAUSDT", "side": "long", "status": "error", "reason": "rifiutato"},
        f"s:1d:DOGEUSDT:{OLD}": {"symbol": "DOGEUSDT", "side": "long", "status": "skipped", "reason": "vecchio"},
    }, "account": {"history": [
        {"symbol": "BTCUSDT", "side": "long", "size": 0.001, "entry": 100_100.0, "exit": 103_000.0, "net": 2.8 - gap_extra * 1.001, "opened_at": (T1 + 86400) * 1000 + 5000},
        {"symbol": "SOLUSDT", "side": "short", "size": 1.0, "entry": 199.8, "exit": 190.0, "net": 9.5, "opened_at": (T2 + 86400) * 1000 + 3000},
    ]}}
    paper = {"strategies": {"s:1d": {"trades": [
        {"id": f"s:1d:BTCUSDT:{T1}", "entry": 100_000.0, "net": 3.0, "open": False},
        {"id": f"s:1d:SOLUSDT:{T2}", "entry": 200.0, "net": 5.0, "open": False},
    ]}}}
    return live, paper


def test_confronto():
    live, paper = data()
    r = review.review(live, paper, NOW)
    assert r["skipped"] == {"quantità sotto il minimo del contratto": 1, "pausa dell'agente eventi": 1}, r["skipped"]
    assert r["errors"] == 1 and r["opened"] == 2 and r["matched"] == 2
    btc = next(x for x in r["rows"] if x["symbol"] == "BTCUSDT")
    sol = next(x for x in r["rows"] if x["symbol"] == "SOLUSDT")
    assert abs(btc["entry_slip_pct"] - 0.1) < 1e-6, btc          # long pagato più caro: peggio
    assert abs(sol["entry_slip_pct"] - 0.1) < 1e-6, sol          # short venduto più basso: peggio
    assert abs(btc["real_net_pct"] - 2.8 / 100.1 * 100) < 1e-3 and btc["gap_pct"] > 0
    f = review.facts(r)
    assert any("saltati" in x and "2 (" in x for x in f) and any("fallite" in x for x in f) and any("Esecuzione reale" in x for x in f)
    assert not r["alert"]
    print("ok confronto: slippage, scarto dalla carta, saltati per motivo, finestra di 30 giorni")


def test_avviso_e_testi():
    live, paper = data(gap_extra=300.0)
    live["positions"]["s:1d:LINKUSDT:" + str(T2)] = {"symbol": "LINKUSDT", "side": "long", "status": "closed", "opened_at": datetime.fromtimestamp(T2 + 86400, timezone.utc).isoformat()}
    live["account"]["history"].append({"symbol": "LINKUSDT", "side": "long", "size": 1.0, "entry": 20.0, "net": -1.0, "opened_at": (T2 + 86400) * 1000})
    paper["strategies"]["s:1d"]["trades"].append({"id": "s:1d:LINKUSDT:" + str(T2), "entry": 20.0, "net": 2.0, "open": False})
    r = review.review(live, paper, NOW)
    assert r["matched"] == 3 and r["alert"] and any("Attenzione" in x for x in review.facts(r))
    assert review.summary_text(r).startswith("3 trade reali")
    empty = review.review({"positions": {}}, {}, NOW)
    assert review.facts(empty) == [] and review.summary_text(empty) == "nessun trade reale da confrontare"
    assert review.summary_text(None) == "in attesa del primo controllo"
    print("ok avviso: scarto medio oltre 0,5% con almeno 3 trade; testi senza dati")


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
    print(f"{len(tests)} test superati")
