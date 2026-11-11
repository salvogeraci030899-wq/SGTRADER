"""Controllo di salute indipendente dal bot: gira in un workflow a parte, ogni 3 ore.
Se qualcosa non va manda un avviso su Telegram (anche quando il bot stesso non parte).

Controlla:
- che il bot sia partito di recente e che l'ultimo giro non sia fallito;
- che l'esecutore non sia bloccato e che non ci sia un'emergenza attiva;
- che l'archivio futures non sia vecchio (aggiornamento settimanale fallito).

    python watchdog.py --last-run 2026-11-11T09:17:00Z --last-conclusion success
"""
import argparse
import json
import os
from datetime import datetime, timedelta, timezone

import requests

MAX_BOT_GAP_HOURS = float(os.environ.get("WATCHDOG_MAX_HOURS", "2"))   # Cloudflare avvia il bot ogni 30 minuti: 2 ore = 4 giri saltati
MAX_ARCHIVE_AGE_DAYS = 10


def _read(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def checks(now, last_run, last_conclusion, live=None, automation=None, archive_last_day=None):
    """Lista dei problemi trovati (testi brevi in italiano). Vuota se va tutto bene."""
    problems = []
    if last_run is None:
        problems.append("Il bot non risulta mai partito.")
    else:
        gap = (now - last_run).total_seconds() / 3600
        if gap > MAX_BOT_GAP_HOURS:
            problems.append(f"Il bot non parte da {gap:.0f} ore (limite {MAX_BOT_GAP_HOURS:g}). "
                            "Controlla il server Cloudflare (worker sgtrader-server): è lui che avvia il bot ogni 30 minuti.")
        if last_conclusion not in (None, "", "success", "in_progress", "queued", "waiting", "requested", "pending"):
            problems.append(f"L'ultimo giro del bot è finito con esito: {last_conclusion}. Controlla i log in GitHub, scheda Actions.")
    if live and live.get("halted"):
        problems.append("L'esecutore è BLOCCATO (posizioni su Bitget diverse dal previsto o emergenza). Controlla Bitget, poi Sblocca nell'app.")
    if automation and automation.get("emergency"):
        problems.append("Emergenza attiva: automazione ferma finché non la sblocchi dall'app.")
    if archive_last_day is not None and (now.date() - archive_last_day).days > MAX_ARCHIVE_AGE_DAYS:
        problems.append(f"Archivio futures fermo al {archive_last_day:%d/%m}: l'aggiornamento settimanale non funziona.")
    return problems


def archive_last_day(path="futures_archive/BTCUSDT_daily.csv"):
    try:
        with open(path) as f:
            last = f.read().strip().splitlines()[-1].split(",")[0]
        return datetime.strptime(last, "%Y-%m-%d").date()
    except Exception:
        return None


def send(text):
    token, chat = os.environ.get("TELEGRAM_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat:
        print("Telegram non configurato: avviso solo nel log.")
        return False
    try:
        r = requests.post(f"https://api.telegram.org/bot{token}/sendMessage", json={"chat_id": chat, "text": text}, timeout=10)
        return r.ok
    except Exception as e:
        print(f"Invio Telegram fallito: {e}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--last-run", default="")
    parser.add_argument("--last-conclusion", default="")
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    last_run = datetime.fromisoformat(args.last_run.replace("Z", "+00:00")) if args.last_run else None
    found = checks(now, last_run, args.last_conclusion or None, _read("live_trades.json"), _read("automation.json"), archive_last_day())
    if found:
        text = "🩺 SGTRADER, CONTROLLO DI SALUTE\n" + "\n".join(f"- {p}" for p in found)
        print(text)
        send(text)
    else:
        print("Tutto in ordine.")
