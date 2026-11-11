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


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
