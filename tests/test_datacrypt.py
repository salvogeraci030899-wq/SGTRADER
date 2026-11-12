"""Cifratura dei dati personali (tools/datacrypt.py): formato, filtro git e unione di due salvataggi insieme.

Esegui: python tests/test_datacrypt.py   (serve la libreria cryptography e git)
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import datacrypt  # noqa: E402

KEY = b"chiave-di-prova-lunga-abbastanza-1234567890"


def test_formato():
    plain = b'{"saldo": 16.06}\n'
    enc = datacrypt.encrypt(plain, KEY)
    assert enc.startswith(b"SGTENC1:") and b"16.06" not in enc
    assert datacrypt.encrypt(plain, KEY) == enc, "stesso contenuto, stesso testo cifrato (niente modifiche finte)"
    assert datacrypt.decrypt(enc, KEY) == plain
    assert datacrypt.clean(enc, KEY) == enc, "un file già cifrato non si cifra due volte"
    assert datacrypt.smudge(plain, KEY) == plain, "un file in chiaro (prima della migrazione) passa invariato"
    assert datacrypt.clean(plain, None) == plain and datacrypt.smudge(enc, None) == enc, "senza chiave nulla cambia"
    assert datacrypt.smudge(enc, b"chiave-sbagliata-xxxxxxxxxxxxxxxxxxxx") == enc, "chiave sbagliata: resta cifrato"
    print("ok formato")


def git(cwd, *args, check=True):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, check=check).stdout


def setup_repo(path, keyfile):
    git(path, "init", "-q", "-b", "main")
    git(path, "config", "user.email", "t@t")
    git(path, "config", "user.name", "t")
    py = f"{sys.executable} {os.path.join(ROOT, 'tools', 'datacrypt.py')}"
    git(path, "config", "filter.sgtenc.clean", f"{py} clean")
    git(path, "config", "filter.sgtenc.smudge", f"{py} smudge")
    git(path, "config", "filter.sgtenc.required", "true")
    git(path, "config", "merge.sgtenc.driver", f"{py} merge %O %A %B %P")


def test_repository():
    d = tempfile.mkdtemp()
    try:
        keyfile = os.path.join(d, "key")
        with open(keyfile, "wb") as f:
            f.write(KEY)
        os.environ["SGT_DATA_KEY_FILE"] = keyfile
        origin, a, b = (os.path.join(d, n) for n in ("origin", "a", "b"))
        os.makedirs(origin)
        git(origin, "init", "-q", "--bare", "-b", "main")
        os.makedirs(a)
        setup_repo(a, keyfile)
        shutil.copy(os.path.join(ROOT, ".gitattributes"), a)
        cfg = {"risk": {"max_positions": 3}, "strategies": {"x:1d": "paper"}, "agent": {"profile": "bilanciato"}}
        with open(os.path.join(a, "automation.json"), "w") as f:
            json.dump(cfg, f, indent=1)
        os.makedirs(os.path.join(a, "events"))
        with open(os.path.join(a, "events", "2026-11.jsonl"), "w") as f:
            f.write('{"id":"e1"}\n')
        with open(os.path.join(a, "dashboard.json"), "w") as f:
            f.write('{"pubblico": true}\n')
        git(a, "add", ".")
        git(a, "commit", "-q", "-m", "primo")
        git(a, "remote", "add", "origin", origin)
        git(a, "push", "-q", "origin", "main")

        stored = git(a, "show", "HEAD:automation.json")
        assert stored.startswith("SGTENC1:") and "bilanciato" not in stored, "nel repository è cifrato"
        assert git(a, "show", "HEAD:dashboard.json").startswith('{"pubblico"'), "i file pubblici restano in chiaro"
        assert git(a, "status", "--porcelain") == "", "nessuna modifica finta dopo il commit"

        # secondo clone: vede i file in chiaro
        os.makedirs(b)
        setup_repo(b, keyfile)
        git(b, "remote", "add", "origin", origin)
        git(b, "fetch", "-q", "origin")
        git(b, "checkout", "-q", "-B", "main", "origin/main")
        with open(os.path.join(b, "automation.json")) as f:
            assert json.load(f)["agent"]["profile"] == "bilanciato", "nella cartella di lavoro è in chiaro"

        # due salvataggi insieme su parti diverse dello stesso file e righe nuove nel registro
        cfg_a = json.loads(json.dumps(cfg)); cfg_a["risk"]["max_positions"] = 4
        with open(os.path.join(a, "automation.json"), "w") as f:
            json.dump(cfg_a, f, indent=1)
        with open(os.path.join(a, "events", "2026-11.jsonl"), "a") as f:
            f.write('{"id":"a1"}\n')
        git(a, "commit", "-q", "-am", "a")
        git(a, "push", "-q", "origin", "main")

        cfg_b = json.loads(json.dumps(cfg)); cfg_b["agent"]["profile"] = "prudente"
        with open(os.path.join(b, "automation.json"), "w") as f:
            json.dump(cfg_b, f, indent=1)
        with open(os.path.join(b, "events", "2026-11.jsonl"), "a") as f:
            f.write('{"id":"b1"}\n')
        git(b, "commit", "-q", "-am", "b")
        git(b, "fetch", "-q", "origin")
        git(b, "rebase", "-q", "origin/main")
        with open(os.path.join(b, "automation.json")) as f:
            merged = json.load(f)
        assert merged["risk"]["max_positions"] == 4 and merged["agent"]["profile"] == "prudente", f"unione sbagliata: {merged}"
        with open(os.path.join(b, "events", "2026-11.jsonl")) as f:
            ids = [json.loads(line)["id"] for line in f if line.strip()]
        assert sorted(ids) == ["a1", "b1", "e1"], f"registro: {ids}"
        assert git(b, "show", "HEAD:automation.json").startswith("SGTENC1:"), "dopo l'unione resta cifrato"
        assert git(b, "show", "HEAD:events/2026-11.jsonl").startswith("SGTENC1:")
        assert git(b, "status", "--porcelain") == ""
        print("ok repository: cifrato nel repository, in chiaro nel lavoro, unione di due salvataggi")
    finally:
        os.environ.pop("SGT_DATA_KEY_FILE", None)
        shutil.rmtree(d, ignore_errors=True)


def test_migrazione():
    """File in chiaro nel repository (prima della chiave): con la chiave si cifrano al prossimo salvataggio."""
    d = tempfile.mkdtemp()
    try:
        git(d, "init", "-q", "-b", "main")
        git(d, "config", "user.email", "t@t")
        git(d, "config", "user.name", "t")
        shutil.copy(os.path.join(ROOT, ".gitattributes"), d)
        with open(os.path.join(d, "live_trades.json"), "w") as f:
            f.write('{"account": {"total_usdt": 16.06}}\n')
        git(d, "add", ".")
        git(d, "commit", "-q", "-m", "in chiaro")
        assert "16.06" in git(d, "show", "HEAD:live_trades.json")
        keyfile = os.path.join(d, ".k")
        with open(keyfile, "wb") as f:
            f.write(KEY)
        os.environ["SGT_DATA_KEY_FILE"] = keyfile
        setup_repo(d, keyfile)
        git(d, "add", "--renormalize", "--", "live_trades.json")
        git(d, "commit", "-q", "-m", "cifrato")
        assert git(d, "show", "HEAD:live_trades.json").startswith("SGTENC1:")
        with open(os.path.join(d, "live_trades.json")) as f:
            assert json.load(f)["account"]["total_usdt"] == 16.06
        print("ok migrazione")
    finally:
        os.environ.pop("SGT_DATA_KEY_FILE", None)
        shutil.rmtree(d, ignore_errors=True)


if __name__ == "__main__":
    test_formato()
    test_repository()
    test_migrazione()
    print("Cifratura dei dati: tutto in ordine.")
