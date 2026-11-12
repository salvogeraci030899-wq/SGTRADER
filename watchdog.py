"""Controllo di salute indipendente dal bot: gira in un workflow a parte, ogni 3 ore.
Se qualcosa non va manda un avviso su Telegram (anche quando il bot stesso non parte).

Controlla:
- che il bot sia partito di recente e che l'ultimo giro non sia fallito;
- che l'esecutore non sia bloccato e che non ci sia un'emergenza attiva;
- che l'archivio futures non sia vecchio (aggiornamento settimanale fallito);
- che il controllo rapido (avvisi di prezzo, chiusure Bitget) e l'agente girino e non falliscano.

    python watchdog.py --last-run 2026-11-11T09:17:00Z --last-conclusion success
"""
import argparse
import json
import os
from datetime import datetime, timezone

import requests

MAX_BOT_GAP_HOURS = float(os.environ.get("WATCHDOG_MAX_HOURS", "2"))   # Cloudflare avvia il bot ogni 15 minuti: 2 ore = 8 giri saltati
MAX_ARCHIVE_AGE_DAYS = 10
# Altri workflow sorvegliati: (nome, ore massime senza giri). Il controllo rapido parte ogni 5 minuti,
# l'agente una volta al giorno (GitHub può ritardare i giri programmati anche di qualche ora).
WATCHED = {"quick": ("Il controllo rapido (avvisi di prezzo, chiusure Bitget)", 1.0), "agent": ("L'agente", 30.0)}
OK_STATES = (None, "", "success", "in_progress", "queued", "waiting", "requested", "pending", "skipped", "cancelled")


def _read(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def checks(now, last_run, last_conclusion, live=None, automation=None, archive_last_day=None, others=None):
    """Lista dei problemi trovati (testi brevi in italiano). Vuota se va tutto bene."""
    problems = []
    if last_run is None:
        problems.append("Il bot non risulta mai partito.")
    else:
        gap = (now - last_run).total_seconds() / 3600
        if gap > MAX_BOT_GAP_HOURS:
            problems.append(f"Il bot non parte da {gap:.0f} ore (limite {MAX_BOT_GAP_HOURS:g}). "
                            "Controlla il server Cloudflare (worker sgtrader-server): è lui che avvia il bot ogni 15 minuti.")
        if last_conclusion not in (None, "", "success", "in_progress", "queued", "waiting", "requested", "pending"):
            problems.append(f"L'ultimo giro del bot è finito con esito: {last_conclusion}. Controlla i log in GitHub, scheda Actions.")
    if live and live.get("halted"):
        problems.append("L'esecutore è BLOCCATO (posizioni su Bitget diverse dal previsto o emergenza). Controlla Bitget, poi Sblocca nell'app.")
    if automation and automation.get("emergency"):
        problems.append("Emergenza attiva: automazione ferma finché non la sblocchi dall'app.")
    for key, (when, conclusion) in (others or {}).items():
        name, max_h = WATCHED[key]
        if when is None:
            continue                     # mai partito (workflow nuovo): niente allarme
        gap = (now - when).total_seconds() / 3600
        if gap > max_h:
            problems.append(f"{name} non gira da {gap:.0f} ore (limite {max_h:g}).")
        if conclusion not in OK_STATES:
            problems.append(f"{name}: ultimo giro finito con esito {conclusion}. Controlla i log in GitHub, scheda Actions.")
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


# Tasti sotto i messaggi (li gestisce il server: src/core/telegram.js). Niente link che aprono Safari:
# rispondono dentro Telegram. Gli avvisi di allarme hanno anche ⛔ Emergenza (con conferma Sì/No).
INFO_ROW = [{"text": "📊 Stato", "callback_data": "stato"}, {"text": "📈 Posizioni", "callback_data": "posizioni"},
            {"text": "🤖 Agente", "callback_data": "agente"}]
ALARM_WORDS = ("⚠️", "BLOCCAT", "bloccato", "Perdita del giorno", "limite di perdita", "FALLITA", "NON riuscita", "non risponde",
               "Tornata su carta", "CONTROLLO DI SALUTE")


def keyboard_for(text):
    """Tasti adatti al messaggio: allarme → ⛔ Emergenza + informazioni; il resto → solo informazioni.
    Il messaggio che conferma un'emergenza già partita non ripropone il tasto."""
    t = str(text or "")
    alarm = any(w in t for w in ALARM_WORDS) and "Emergenza:" not in t and "EMERGENZA ATTIVA" not in t
    rows = ([[{"text": "⛔ Emergenza", "callback_data": "emg"}]] if alarm else []) + [INFO_ROW]
    return {"inline_keyboard": rows}


def send(text):
    token, chat = os.environ.get("TELEGRAM_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat:
        print("Telegram non configurato: avviso solo nel log.")
        return False
    try:
        r = requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                          json={"chat_id": chat, "text": text, "reply_markup": keyboard_for(text)}, timeout=10)
        return r.ok
    except Exception as e:
        print(f"Invio Telegram fallito: {e}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--last-run", default="")
    parser.add_argument("--last-conclusion", default="")
    for k in WATCHED:
        parser.add_argument(f"--{k}-run", default="")
        parser.add_argument(f"--{k}-conclusion", default="")
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    when = lambda v: datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None  # noqa: E731
    last_run = when(args.last_run)
    others = {k: (when(getattr(args, f"{k}_run")), getattr(args, f"{k}_conclusion") or None) for k in WATCHED}
    found = checks(now, last_run, args.last_conclusion or None, _read("live_trades.json"), _read("automation.json"), archive_last_day(), others)
    if found:
        text = "🩺 SGTRADER, CONTROLLO DI SALUTE\n" + "\n".join(f"- {p}" for p in found)
        print(text)
        send(text)
    else:
        print("Tutto in ordine.")
