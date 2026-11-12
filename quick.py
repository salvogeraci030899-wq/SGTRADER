"""Controllo rapido, ogni 5 minuti (workflow "Controllo rapido", avviato dal server Cloudflare).

Fa solo le cose che guadagnano dall'essere veloci, senza il modello Kronos (circa 30 secondi):
- avvisi di prezzo (price_alerts.py) sulle candele da 1 minuto di Bitget;
- avviso su Telegram per ogni posizione reale chiusa su Bitget (stop, target, a mano), in sola lettura.
Il bot completo (segnali, prova su carta, esecutore, conto) resta ogni 15 minuti: i segnali dipendono
dalla chiusura delle candele (la più breve è 1 ora), più spesso non cambierebbe nulla.

Scrive solo quick_state.json (avvisi scattati e chiusure già avvisate), e solo quando cambia: niente
conflitti con i file del bot e niente salvataggi a vuoto. Nessun ordine.
"""
import json
import os
import sys
from datetime import datetime, timezone

import executor
import price_alerts

STATE_PATH = "quick_state.json"
CONFIG_PATH = "automation.json"
LEGACY_ALERTS = "alerts_state.json"     # avvisi scattati prima che passassero al controllo rapido


def _load(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def run(notify, client=None, state_path=STATE_PATH, config_path=CONFIG_PATH, legacy_path=LEGACY_ALERTS, fetch=None, now=None):
    now = now or datetime.now(timezone.utc)
    state = _load(state_path, {})
    before = json.dumps(state, sort_keys=True)
    cfg = _load(config_path, {})

    # 1) avvisi di prezzo: quelli già scattati con il bot restano scattati
    legacy = _load(legacy_path, {}).get(price_alerts.FIRED_KEY, [])
    state[price_alerts.FIRED_KEY] = list(dict.fromkeys(legacy + state.get(price_alerts.FIRED_KEY, [])))[-price_alerts.FIRED_MAX:]
    try:
        n = price_alerts.check(cfg, state, notify, **({"fetch": fetch} if fetch else {}))
        if n:
            print(f"Avvisi di prezzo inviati: {n}")
    except Exception as e:
        print(f"Avvisi di prezzo non controllati: {e}")

    # 2) posizioni reali chiuse su Bitget (sola lettura)
    if client is None and all(os.environ.get(k) for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE")):
        from bitget_client import BitgetClient
        client = BitgetClient.from_env()
    if client is not None:
        try:
            account = {"connected": True, "demo": bool(getattr(client, "demo", False)), "history": client.closed_positions(30)}
            executor._notify_closed(state, account, notify, now)
        except Exception as e:
            print(f"Storico Bitget non letto: {e}")

    changed = json.dumps(state, sort_keys=True) != before
    if changed:
        with open(state_path, "w") as f:
            json.dump(state, f, separators=(",", ":"))
        print("Stato rapido aggiornato.")
    else:
        print("Nessun cambiamento.")
    return changed


if __name__ == "__main__":
    import watchdog
    run(watchdog.send)
    sys.exit(0)
