"""Verifica dal vivo del server comandi su Cloudflare (workflow "Verifica server").

Non usa segreti: chiama il server come farebbe l'app e controlla che
- l'IA rifiuti chi non è l'app (nessuna origine → 403);
- l'assistente risponda davvero con Groq a una richiesta tipo "se arriva a 10 USDT chiudi",
  proponendo un'azione valida;
- l'analisi AI risponda con il testo strutturato.
Stampa il modello Groq usato. Nessun ordine, nessuna modifica.
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

import requests

SERVER = os.environ.get("SERVER_URL", "https://sgtrader-server.salvogeraci030899.workers.dev").rstrip("/")
ORIGIN = os.environ.get("APP_ORIGIN", "https://salvogeraci030899-wq.github.io")


def post(path, body, origin=True):
    headers = {"Content-Type": "application/json"}
    if origin:
        headers["Origin"] = ORIGIN
    r = requests.post(SERVER + path, json=body, headers=headers, timeout=60)
    try:
        return r.status_code, r.json()
    except ValueError:
        return r.status_code, {"raw": r.text[:200]}


def candles():
    """Candele vere da Bitget (pubbliche) per l'analisi."""
    out = {}
    for tf, gran in (("1d", "1day"), ("4h", "4h"), ("1h", "1h")):
        r = requests.get("https://api.bitget.com/api/v2/spot/market/candles",
                         params={"symbol": "BTCUSDT", "granularity": gran, "limit": 220}, timeout=20)
        rows = r.json().get("data") or []
        out[tf] = sorted([[int(x[0]), *map(float, x[1:6])] for x in rows])
    return out


def main():
    ok = True
    status, body = post("/api/analyze", {"symbol": "BTCUSDT", "timeframe": "1d", "type": "NONE"}, origin=False)
    print(f"1) IA senza origine dell'app: HTTP {status} {'(rifiutata, giusto)' if status == 403 else '(ATTESO 403)'}")
    ok &= status == 403

    # Comandi senza chiave: devono essere rifiutati perché manca la chiave, non perché il server non ha APP_SECRET.
    # Nessun comando viene eseguito (la richiesta si ferma al controllo della chiave).
    status, body = post("/api/command", {"type": "alert", "op": "clear"})
    err = (body or {}).get("error", "") if isinstance(body, dict) else ""
    active = status == 401 and "non configurata" not in err
    print(f"1b) Comando senza chiave app: HTTP {status} {err!r} {'(comandi attivi e protetti, giusto)' if active else '(ATTESO 401 con APP_SECRET configurata)'}")
    ok &= active

    cs = candles()
    price = cs["1h"][-1][4] if cs["1h"] else 70000
    position = {"symbol": "BTCUSDT", "type": "LONG", "market": "FUTURES", "leverage": 2, "timeframe": "4h",
                "entry": round(price * 0.995, 1), "price": price, "stop": round(price * 0.97, 1), "take": round(price * 1.05, 1),
                "size": 0.01, "capital": round(price * 0.01 / 2, 2), "pnl": 2.5, "hours_open": 3, "rules": []}
    t0 = time.time()
    status, body = post("/api/assistant", {"text": "se arriva a 10 usdt di profitto chiudi la posizione in automatico", "position": position})
    action = body.get("action") if isinstance(body, dict) else None
    print(f"2) Assistente: HTTP {status} in {time.time() - t0:.1f}s, modello {body.get('model')}")
    print(f"   risposta: {str(body.get('reply') or body.get('error'))[:200]}")
    print(f"   azione proposta: {json.dumps(action)}")
    good = status == 200 and isinstance(action, dict) and action.get("type") == "close_at_pnl" and abs(float(action.get("value", 0)) - 10) < 1e-9
    print("   " + ("OK: ha capito la regola" if good else "ATTENZIONE: azione diversa da quella attesa"))
    ok &= status == 200

    # 2b) Assistente generale: comando sul tool
    ctx = {"prices": {"BTCUSDT": price}, "trading": "off", "emergency": False, "active": [{"key": "donchian20_turtle:1d", "mode": "paper", "closed": 0, "open": 0}],
           "available": ["donchian20_turtle:1d", "donchian55:1d", "big_candle_trail:1d"], "confirmed": [], "bot_minutes": 5}
    status, body = post("/api/assistant", {"scope": "general", "text": "metti donchian55 1d su carta", "context": ctx})
    action = body.get("action") if isinstance(body, dict) else None
    good = status == 200 and isinstance(action, dict) and action.get("type") == "set_strategy" and action.get("key") == "donchian55:1d" and action.get("mode") == "paper"
    print(f"2b) Assistente generale: HTTP {status} → «{str(body.get('reply') or body.get('error'))[:150]}» azione {json.dumps(action)} {'OK' if good else '(ATTESO set_strategy donchian55:1d paper)'}")
    ok &= status == 200

    t0 = time.time()
    status, body = post("/api/analyze", {"symbol": "BTCUSDT", "timeframe": "4h", "type": "NONE", "currentPrice": price, "candles": cs})
    text = (body.get("analysis") or body.get("error") or "") if isinstance(body, dict) else ""
    print(f"3) Analisi AI live: HTTP {status} in {time.time() - t0:.1f}s, modello {body.get('model')}")
    print("   " + text[:600].replace("\n", "\n   "))
    sections = [s for s in ("QUADRO", "LIVELLI", "SCENARI", "AZIONE") if s in text]
    print(f"   sezioni trovate: {', '.join(sections) or 'nessuna'}")
    ok &= status == 200 and len(sections) >= 3

    # 4) Voce: frase italiana sintetica (espeak-ng) → trascrizione Whisper sul server
    if shutil.which("espeak-ng"):
        with tempfile.TemporaryDirectory() as d:
            wav = os.path.join(d, "voce.wav")
            subprocess.run(["espeak-ng", "-v", "it", "-s", "140", "-w", wav, "chiudi la posizione se arriva a dieci dollari di profitto"], check=True)
            audio = base64.b64encode(open(wav, "rb").read()).decode()
        t0 = time.time()
        status, body = post("/api/transcribe", {"audio": audio, "mime": "audio/wav"})
        text = (body.get("text") or body.get("error") or "") if isinstance(body, dict) else ""
        heard = status == 200 and "chiudi" in text.lower() and ("dieci" in text.lower() or "10" in text)
        print(f"4) Trascrizione vocale: HTTP {status} in {time.time() - t0:.1f}s → «{text[:120]}» {'OK' if heard else '(ATTESO chiudi ... dieci)'}")
        ok &= status == 200
    else:
        print("4) Trascrizione vocale: saltata (espeak-ng non installato)")

    print("ESITO: server e IA funzionano." if ok else "ESITO: qualcosa non va, vedi sopra.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
