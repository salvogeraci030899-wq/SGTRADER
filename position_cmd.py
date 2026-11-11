"""Comandi sulle posizioni REALI di Bitget, avviati dall'assistente dell'app (workflow "Posizione Bitget").

    python position_cmd.py close BTCUSDT long          # chiude a mercato tutta la posizione
    python position_cmd.py tp    BTCUSDT long 72000    # take profit della posizione sull'exchange
    python position_cmd.py sl    BTCUSDT long 69500    # stop loss della posizione sull'exchange
    python position_cmd.py clear BTCUSDT long          # toglie TP e SL della posizione

Regole fatte rispettare qui, qualunque cosa arrivi dall'app:
- la posizione deve esistere su Bitget con quella direzione;
- il TP sta dal lato del guadagno rispetto al prezzo mark, lo SL dal lato della perdita
  (altrimenti scatterebbe subito), e lo SL di un LONG non può stare sotto la liquidazione (né sopra per uno SHORT);
- il prezzo viene arrotondato ai decimali del contratto.
Dopo il comando: stato dell'esecutore allineato (una chiusura manuale non deve farlo bloccare), conto
riletto e avviso su Telegram. Le chiavi arrivano solo dai segreti di GitHub.
"""
import json
import os
import sys
from datetime import datetime, timezone

import executor
from bitget_client import BitgetClient, BitgetError

ACTIONS = ("close", "tp", "sl", "clear")
SYMBOLS = ("BTCUSDT", "ETHUSDT", "SOLUSDT")


class CommandError(ValueError):
    pass


def _fmt(v):
    return f"{v:,.4f}".rstrip("0").rstrip(".").replace(",", "§").replace(".", ",").replace("§", ".")


def validate(action, symbol, side, price, position):
    """Ritorna il prezzo da usare (arrotondato) o solleva CommandError con il motivo."""
    if action not in ACTIONS:
        raise CommandError(f"Azione sconosciuta: {action}.")
    if symbol not in SYMBOLS or side not in ("long", "short"):
        raise CommandError("Coin o direzione non valide.")
    if not position or position.get("side") != side:
        raise CommandError(f"Su Bitget non c'è una posizione {side.upper()} su {symbol}.")
    if action in ("close", "clear"):
        return None
    if price is None or not price > 0:
        raise CommandError("Prezzo mancante o non valido.")
    mark = position.get("mark") or position.get("entry")
    long = side == "long"
    if mark:
        if action == "tp" and (price <= mark if long else price >= mark):
            raise CommandError(f"Il take profit di un {side.upper()} va {'sopra' if long else 'sotto'} il prezzo attuale ({_fmt(mark)}).")
        if action == "sl" and (price >= mark if long else price <= mark):
            raise CommandError(f"Lo stop di un {side.upper()} va {'sotto' if long else 'sopra'} il prezzo attuale ({_fmt(mark)}).")
    liq = position.get("liq")
    if action == "sl" and liq and (price <= liq if long else price >= liq):
        raise CommandError(f"Lo stop sarebbe oltre la liquidazione ({_fmt(liq)}): non servirebbe.")
    specs = executor.contract_specs(symbol) or {}
    places = int(specs.get("price_place", 2))
    return round(price, places)


def sync_executor(symbol, side, action, state_path=executor.STATE_PATH, now=None):
    """Una chiusura manuale toglie la posizione anche dallo stato dell'esecutore, che altrimenti al giro
    dopo la cercherebbe su Bitget e si bloccherebbe. Registra comunque l'evento."""
    now = (now or datetime.now(timezone.utc)).isoformat(timespec="seconds")
    state = executor._load(state_path)
    if action == "close":
        for p in state["positions"].values():
            if p.get("status") == "open" and p.get("symbol") == symbol and p.get("side") == side:
                p.update(status="closed", closed_at=now, close_reason="MANUALE (assistente)")
    state["events"].append({"at": now, "kind": "manual", "action": action, "symbol": symbol, "side": side})
    executor._save(state, state_path)


def run(argv, client=None, notify=None, state_path=executor.STATE_PATH):
    if len(argv) < 3:
        raise CommandError("Uso: azione coin direzione [prezzo]")
    action, symbol, side = argv[0], argv[1], argv[2]
    try:
        price = float(argv[3]) if len(argv) > 3 and argv[3] not in ("", "0") else None
    except ValueError:
        raise CommandError(f"Prezzo non valido: {argv[3]}")
    if client is None:
        if not all(os.environ.get(k) for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE")):
            raise CommandError("Chiavi Bitget non impostate nei segreti di GitHub.")
        client = BitgetClient.from_env()
    position = client.positions().get(symbol)
    price = validate(action, symbol, side, price, position)
    name = f"{symbol.replace('USDT', '')} {side.upper()}"
    if action == "close":
        client.close_position(symbol, side)
        msg = f"Chiusa a mercato {name} su Bitget."
    elif action == "clear":
        n = client.cancel_all_tpsl(symbol)
        msg = f"Tolti {n} ordini TP/SL di {name} su Bitget."
    else:
        client.set_tpsl(symbol, side, action, price)
        msg = f"{'Take profit' if action == 'tp' else 'Stop loss'} di {name} impostato su Bitget a {_fmt(price)} (scatta sul prezzo mark, a mercato)."
    sync_executor(symbol, side, action, state_path)
    try:
        executor.account_snapshot(state_path, client=client)
    except Exception as e:
        print(f"Conto non riletto: {e}")
    if notify:
        notify(f"🤖 ASSISTENTE · {'DEMO' if getattr(client, 'demo', False) else 'REALE'}\n{msg}")
    return msg


def sync_only(argv, state_path=executor.STATE_PATH):
    """Solo l'aggiornamento dello stato (nessun ordine): usato dal workflow per riapplicarlo sulla
    versione più recente del repository se il salvataggio incontra un giro del bot."""
    action, symbol, side = argv[0], argv[1], argv[2]
    sync_executor(symbol, side, action, state_path)
    if all(os.environ.get(k) for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE")):
        try:
            executor.account_snapshot(state_path)
        except Exception as e:
            print(f"Conto non riletto: {e}")


if __name__ == "__main__":
    import watchdog
    if sys.argv[1:2] == ["sync"]:
        sync_only(sys.argv[2:])
        sys.exit(0)
    try:
        print(run(sys.argv[1:], notify=watchdog.send))
    except (CommandError, BitgetError) as e:
        try:
            watchdog.send(f"⚠️ ASSISTENTE: comando sulla posizione NON eseguito.\n{e}")
        except Exception:
            pass
        sys.exit(f"Comando NON eseguito: {e}")
