"""Registra il webhook del bot Telegram sul server Cloudflare (lo usa il workflow "Pubblica server comandi").

Legge tutto dalle variabili d'ambiente, così il token non compare mai negli argomenti né nei log:
  TELEGRAM_TOKEN   token del bot (segreto GitHub)
  WEBHOOK_URL      indirizzo del worker + /api/telegram
  WEBHOOK_SECRET   segreto che Telegram allega a ogni messaggio (il server risponde solo con questo)
Stampa solo l'esito (ok / descrizione dell'errore di Telegram), mai il token.
"""
import os
import sys

import requests

COMMANDS = [
    ("stato", "Conto, modalità, strategie"),
    ("posizioni", "Posizioni reali aperte"),
    ("agente", "Agente: decisioni e proposte"),
    ("carta", "Strategie su carta"),
    ("avvisi", "Avvisi di prezzo attivi"),
    ("emergenza", "Spegne tutto (con CONFERMA)"),
    ("aiuto", "Elenco dei comandi"),
]


def main():
    token, url, secret = (os.environ.get(k, "").strip() for k in ("TELEGRAM_TOKEN", "WEBHOOK_URL", "WEBHOOK_SECRET"))
    if not (token and url and secret):
        print("Bot Telegram: configurazione incompleta, webhook non registrato.")
        return 0
    api = f"https://api.telegram.org/bot{token}"
    try:
        r = requests.post(f"{api}/setWebhook", json={"url": url, "secret_token": secret, "allowed_updates": ["message"]}, timeout=20).json()
        print(f"Webhook: {'registrato' if r.get('ok') else 'NON registrato: ' + str(r.get('description'))}")
        c = requests.post(f"{api}/setMyCommands", json={"commands": [{"command": a, "description": b} for a, b in COMMANDS]}, timeout=20).json()
        print(f"Menu dei comandi: {'impostato' if c.get('ok') else 'non impostato: ' + str(c.get('description'))}")
        return 0 if r.get("ok") else 1
    except requests.RequestException as e:
        print(f"Telegram non raggiungibile: {type(e).__name__}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
