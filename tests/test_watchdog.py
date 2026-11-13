"""Test del controllo di salute. `python3 tests/test_watchdog.py` oppure pytest."""
import os
import sys
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import watchdog as wd  # noqa: E402

NOW = datetime(2026, 11, 20, 12, 0, tzinfo=timezone.utc)


def test_tutto_in_ordine():
    assert wd.checks(NOW, NOW - timedelta(hours=1), "success", {"halted": False}, {"emergency": False}, date(2026, 11, 18)) == []
    assert wd.checks(NOW, NOW - timedelta(hours=1), "in_progress") == []          # giro in corso: va bene


def test_problemi():
    p = wd.checks(NOW, NOW - timedelta(hours=20), "failure", {"halted": True}, {"emergency": True}, date(2026, 11, 1))
    assert len(p) == 5
    assert "da 20 ore" in p[0] and "failure" in p[1] and "BLOCCATO" in p[2] and "Emergenza" in p[3] and "01/11" in p[4]
    assert wd.checks(NOW, None, None) == ["Il bot non risulta mai partito."]


def test_controllo_rapido_e_agente():
    ok = {"quick": (NOW - timedelta(minutes=10), "success"), "agent": (NOW - timedelta(hours=20), "success")}
    assert wd.checks(NOW, NOW - timedelta(hours=1), "success", others=ok) == []
    bad = {"quick": (NOW - timedelta(hours=3), "success"), "agent": (NOW - timedelta(hours=40), "failure")}
    p = wd.checks(NOW, NOW - timedelta(hours=1), "success", others=bad)
    assert len(p) == 3 and "controllo rapido" in p[0] and "da 3 ore" in p[0] and "da 40 ore" in p[1] and "failure" in p[2]
    assert wd.checks(NOW, NOW - timedelta(hours=1), "success", others={"agent": (None, None)}) == []   # mai partito: niente allarme


def test_tasti_sotto_i_messaggi():
    kb = lambda t: [b["callback_data"] for row in wd.keyboard_for(t)["inline_keyboard"] for b in row]  # noqa: E731
    assert kb("✅ POSIZIONE CHIUSA · Bitget reale") == ["stato", "posizioni", "agente"]
    assert kb("🤖 ESECUTORE (REALE)\nPosizioni diverse dal previsto. Esecutore bloccato: controlla su Bitget")[0] == "emg"
    assert kb("Perdita del giorno -3,20% oltre il limite (3%)")[0] == "emg"
    assert kb("🩺 PinscherTrade, CONTROLLO DI SALUTE\n- Il bot non parte da 3 ore")[0] == "emg"
    assert kb("Emergenza: chiuse 2 posizioni.") == ["stato", "posizioni", "agente"]          # già in emergenza
    assert all(b.get("callback_data") and not b.get("url") for row in wd.keyboard_for("⚠️")["inline_keyboard"] for b in row)   # niente link


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
