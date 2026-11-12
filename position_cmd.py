"""Comandi sulle posizioni REALI di Bitget, avviati dall'assistente dell'app (workflow "Posizione Bitget").

    python position_cmd.py close BTCUSDT long          # chiude a mercato tutta la posizione
    python position_cmd.py tp    BTCUSDT long 72000    # take profit della posizione sull'exchange
    python position_cmd.py sl    BTCUSDT long 69500    # stop loss della posizione sull'exchange
    python position_cmd.py clear BTCUSDT long          # toglie TP e SL della posizione
    python position_cmd.py unsl  BTCUSDT long          # toglie solo lo stop loss (untp: solo il take profit)

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
import re
import sys
from datetime import datetime, timezone

import executor
from bitget_client import BitgetClient, BitgetError

ACTIONS = ("close", "tp", "sl", "clear", "untp", "unsl")
# "refresh": nessun ordine, solo il conto riletto (chiesto dall'app aperta in modalità Reale)
REFRESH = "refresh"
# esito del comando, letto dal passo che salva lo stato (anche se il comando è fallito) e mostrato nell'app
RESULT_PATH = os.environ.get("POSITION_RESULT", "position_result.json")
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
    if action in ("close", "clear", "untp", "unsl"):
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


def clean_req(req):
    """Codice della richiesta generato dall'app: serve solo a ritrovarne l'esito in live_trades.json."""
    return req if isinstance(req, str) and re.fullmatch(r"[a-z0-9]{6,20}", req) else ""


def sync_executor(symbol, side, action, state_path=executor.STATE_PATH, now=None, req="", ok=True, msg=""):
    """Una chiusura manuale toglie la posizione anche dallo stato dell'esecutore, che altrimenti al giro
    dopo la cercherebbe su Bitget e si bloccherebbe. Registra comunque l'evento, riuscito o no, con
    l'esito leggibile dall'app."""
    now = (now or datetime.now(timezone.utc)).isoformat(timespec="seconds")
    state = executor._load(state_path)
    if action == "close" and ok:
        for p in state["positions"].values():
            if p.get("status") == "open" and p.get("symbol") == symbol and p.get("side") == side:
                p.update(status="closed", closed_at=now, close_reason="MANUALE (assistente)")
    ev = {"at": now, "kind": "manual", "action": action, "symbol": symbol, "side": side, "ok": bool(ok)}
    if clean_req(req):
        ev["req"] = clean_req(req)
    if msg:
        ev["msg"] = str(msg)[:300]
    state["events"].append(ev)
    executor._save(state, state_path)


def run(argv, client=None, notify=None, state_path=executor.STATE_PATH):
    if len(argv) < 3:
        raise CommandError("Uso: azione coin direzione [prezzo]")
    action, symbol, side = argv[0], argv[1], argv[2]
    if action == REFRESH:
        if client is None:
            if not all(os.environ.get(k) for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE")):
                raise CommandError("Chiavi Bitget non impostate nei segreti di GitHub.")
            client = BitgetClient.from_env()
        return "Conto Bitget riletto." + ("" if refresh_if_changed(state_path, client) else " Nessun cambiamento.")
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
    elif action in ("untp", "unsl"):
        kind = action[2:]
        n = client.cancel_all_tpsl(symbol, only=kind)
        the, a = ("il take profit", "un take profit") if kind == "tp" else ("lo stop loss", "uno stop loss")
        msg = f"Tolto {the} di {name} su Bitget." if n else f"Su Bitget {name} non aveva {a}."
    else:
        client.set_tpsl(symbol, side, action, price)
        msg = f"{'Take profit' if action == 'tp' else 'Stop loss'} di {name} impostato su Bitget a {_fmt(price)} (scatta sul prezzo mark, a mercato)."
    sync_executor(symbol, side, action, state_path, msg=msg)
    try:
        executor.account_snapshot(state_path, client=client)
    except Exception as e:
        print(f"Conto non riletto: {e}")
    if notify:
        notify(f"🤖 ASSISTENTE · {'DEMO' if getattr(client, 'demo', False) else 'REALE'}\n{msg}")
    return msg


def write_result(ok, msg, path=None):
    with open(path or RESULT_PATH, "w") as f:
        json.dump({"ok": bool(ok), "msg": str(msg)}, f)


def read_result(path=None):
    try:
        with open(path or RESULT_PATH) as f:
            r = json.load(f)
        return bool(r.get("ok")), str(r.get("msg", ""))
    except (OSError, ValueError, AttributeError):
        return False, "Esito sconosciuto: controlla la posizione su Bitget e i messaggi su Telegram."


def _account_key(state):
    """Cosa conta per la rilettura chiesta dall'app: collegamento e posizioni (aperte, chiuse, TP/SL).
    Saldo e PnL cambiano a ogni secondo: li aggiorna il bot a ogni giro."""
    a = (state or {}).get("account") or {}
    pos = sorted((p.get("symbol"), p.get("side"), p.get("size"), p.get("entry"), p.get("tp"), p.get("sl"))
                 for p in a.get("positions_detail") or [])
    return json.dumps([a.get("connected"), a.get("positions"), pos], default=str)


def refresh_if_changed(state_path=executor.STATE_PATH, client=None):
    """Rilegge il conto e lo salva solo se è cambiato qualcosa oltre all'ora del controllo: ogni
    salvataggio è un commit e una pubblicazione del sito (Vercel ne ammette 100 al giorno)."""
    with open(state_path) as f:
        before_text = f.read()
    before = json.loads(before_text)
    executor.account_snapshot(state_path, client=client)
    with open(state_path) as f:
        after = json.load(f)
    if _account_key(before) == _account_key(after):
        with open(state_path, "w") as f:
            f.write(before_text)
        print("Conto invariato: niente da salvare.")
        return False
    print("Conto cambiato: salvato.")
    return True


def sync_only(argv, state_path=executor.STATE_PATH, result_path=None):
    """Solo l'aggiornamento dello stato (nessun ordine): usato dal workflow per riapplicarlo sulla
    versione più recente del repository se il salvataggio incontra un giro del bot. Gira anche se il
    comando è fallito, così l'app vede il motivo."""
    action, symbol, side = argv[0], argv[1], argv[2]
    if action == REFRESH:      # nessun evento: solo il conto riletto sulla versione più recente
        if all(os.environ.get(k) for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE")):
            refresh_if_changed(state_path)
        return
    ok, msg = read_result(result_path)
    sync_executor(symbol, side, action, state_path, req=os.environ.get("REQ", ""), ok=ok, msg=msg)
    if ok and all(os.environ.get(k) for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE")):
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
        msg = run(sys.argv[1:], notify=None if sys.argv[1:2] == [REFRESH] else watchdog.send)
        write_result(True, msg)
        print(msg)
    except (CommandError, BitgetError) as e:
        write_result(False, f"Comando NON eseguito: {e}")
        try:
            watchdog.send(f"⚠️ ASSISTENTE: comando sulla posizione NON eseguito.\n{e}")
        except Exception:
            pass
        sys.exit(f"Comando NON eseguito: {e}")
    except Exception as e:
        write_result(False, f"Errore imprevisto ({type(e).__name__}): controlla la posizione su Bitget.")
        raise
