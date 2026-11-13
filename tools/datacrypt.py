"""Cifratura dei dati personali nel repository pubblico (saldo, posizioni, strategie, agente, registro).

Nel repository i file elencati in .gitattributes (filter=ptenc) sono sempre cifrati; nei workflow,
dopo il passo "Dati cifrati" (.github/actions/data-key), git li decifra all'uscita (smudge) e li ricifra
all'ingresso (clean). Il codice del bot legge e scrive JSON normale e non sa niente della cifratura.
L'app e il server Cloudflare decifrano con la stessa chiave (src/core/datacrypt.js).

Chiave: il segreto GitHub DATA_KEY (stringa casuale lunga, generata dall'app). Mai nel repository né nei log.
Formato: una riga di testo  SGTENC1:<base64(nonce 12 byte + testo cifrato AES-256-GCM con tag)>
  chiave AES = HMAC-SHA256(DATA_KEY, "sgtrader-enc-v1")
  nonce      = primi 12 byte di HMAC-SHA256(HMAC-SHA256(DATA_KEY, "sgtrader-iv-v1"), testo in chiaro)
Il nonce deriva dal contenuto (come git-crypt): lo stesso file dà sempre lo stesso testo cifrato, così git
non vede modifiche finte a ogni giro. Rivela solo se due versioni sono identiche.

Senza chiave tutto passa invariato (prima della migrazione, nei test, in locale).

Uso (lo chiama git, configurato dal passo "Dati cifrati"):
  datacrypt.py clean | smudge                   filtro: stdin → stdout
  datacrypt.py merge <base> <ours> <theirs> <path>   unione a 3 vie sul testo in chiaro, risultato in <ours>
  datacrypt.py selftest                         prova cifra/decifra con la chiave configurata (non la stampa)
"""
import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys
import tempfile

PREFIX = b"SGTENC1:"
AAD = b"sgtrader-v1"


def _key():
    k = os.environ.get("PT_DATA_KEY", "").strip()
    if not k:
        path = os.environ.get("PT_DATA_KEY_FILE") or os.path.expanduser("~/.ptcrypt/key")
        try:
            with open(path) as f:
                k = f.read().strip()
        except OSError:
            k = ""
    return k.encode() if k else None


def _keys(key):
    enc = hmac.new(key, b"sgtrader-enc-v1", hashlib.sha256).digest()
    iv = hmac.new(key, b"sgtrader-iv-v1", hashlib.sha256).digest()
    return enc, iv


def is_encrypted(data: bytes) -> bool:
    return data.lstrip().startswith(PREFIX)


def encrypt(plain: bytes, key: bytes) -> bytes:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    enc, iv = _keys(key)
    nonce = hmac.new(iv, plain, hashlib.sha256).digest()[:12]
    return PREFIX + base64.b64encode(nonce + AESGCM(enc).encrypt(nonce, plain, AAD)) + b"\n"


def decrypt(data: bytes, key: bytes) -> bytes:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    enc, _ = _keys(key)
    raw = base64.b64decode(data.strip()[len(PREFIX):])
    return AESGCM(enc).decrypt(raw[:12], raw[12:], AAD)


def clean(data: bytes, key) -> bytes:
    """Verso il repository: cifra (se c'è la chiave e il file non è già cifrato)."""
    if not key or not data or is_encrypted(data):
        return data
    return encrypt(data, key)


def smudge(data: bytes, key) -> bytes:
    """Verso la cartella di lavoro: decifra. Con chiave sbagliata lascia il testo cifrato e lo dice:
    il bot si ferma su un JSON illeggibile invece di sovrascrivere i dati."""
    if not key or not is_encrypted(data):
        return data
    try:
        return decrypt(data, key)
    except Exception:       # noqa: BLE001
        sys.stderr.write("datacrypt: impossibile decifrare (DATA_KEY diversa da quella usata per cifrare?)\n")
        return data


def _plain(path, key):
    try:
        with open(path, "rb") as f:
            data = f.read()
    except OSError:
        return b""
    return smudge(data, key)


def merge(base, ours, theirs, path, key):
    """Come prima della cifratura: le parti diverse si uniscono; nei punti in conflitto vince <theirs>
    (in un rebase è il commit di questo giro, il più recente); i .jsonl tengono le righe di entrambi.
    Se il .json unito non è valido si tiene <theirs> per intero."""
    o, a, b = _plain(base, key), _plain(ours, key), _plain(theirs, key)
    union = path.endswith(".jsonl")
    with tempfile.TemporaryDirectory() as d:
        files = []
        for name, data in (("ours", a), ("base", o), ("theirs", b)):
            p = os.path.join(d, name)
            with open(p, "wb") as f:
                f.write(data)
            files.append(p)
        r = subprocess.run(["git", "merge-file", "-p", "--union" if union else "--theirs", *files], capture_output=True)
        out = b if r.returncode < 0 or r.returncode >= 127 else r.stdout     # 255 = errore di git, non conflitti
    if path.endswith(".json"):
        try:
            json.loads(out.decode() or "null")
        except ValueError:
            out = b
    with open(ours, "wb") as f:
        f.write(clean(out, key))
    return 0


def main(argv):
    cmd = argv[1] if len(argv) > 1 else ""
    key = _key()
    if cmd in ("clean", "smudge"):
        data = sys.stdin.buffer.read()
        sys.stdout.buffer.write((clean if cmd == "clean" else smudge)(data, key))
        return 0
    if cmd == "merge" and len(argv) >= 6:
        return merge(argv[2], argv[3], argv[4], argv[5], key)
    if cmd == "selftest":
        if not key:
            print("Chiave dei dati non configurata: i file restano in chiaro.")
            return 0
        sample = b'{"prova": 1}\n'
        ok = decrypt(encrypt(sample, key), key) == sample and encrypt(sample, key) == encrypt(sample, key)
        print("Chiave dei dati: " + ("cifratura funzionante." if ok else "ERRORE nella prova di cifratura."))
        return 0 if ok else 1
    sys.stderr.write(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
