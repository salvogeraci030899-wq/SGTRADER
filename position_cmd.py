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
# "open": nuova posizione decisa da te nella pagina Trade (ordine a mercato con stop obbligatorio)
OPEN = "open"
CONFIG_PATH = "automation.json"
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


def mark_price(symbol):
    """Prezzo mark dei futures (API pubblica di Bitget)."""
    import requests
    r = requests.get("https://api.bitget.com/api/v2/mix/market/ticker", params={"symbol": symbol, "productType": "USDT-FUTURES"}, timeout=10)
    d = (r.json().get("data") or [{}])[0]
    return float(d.get("markPrice") or d.get("lastPr") or 0)


def validate_open(symbol, side, size, leverage, sl, tp, positions, mark, specs, cfg, equity):
    """Controlli di un ordine manuale, qualunque cosa arrivi dall'app. Ritorna (quantità, stop, target, leva)."""
    if symbol not in SYMBOLS or side not in ("long", "short"):
        raise CommandError("Coin o direzione non valide.")
    if cfg.get("emergency"):
        raise CommandError("Emergenza attiva: niente nuovi ordini finché non la sblocchi.")
    risk = executor.risk_config(cfg)
    if not risk.get("trading_enabled"):
        raise CommandError("La modalità Reale è spenta: accendila dall'app (Account) per mandare ordini veri.")
    if symbol in positions:
        raise CommandError(f"Su Bitget c'è già una posizione su {symbol.replace('USDT', '')}: gestiscila dalla pagina Posizioni.")
    try:
        lev = int(float(leverage))
    except (TypeError, ValueError):
        raise CommandError("Leva non valida.")
    if not 1 <= lev <= risk["max_leverage"]:
        raise CommandError(f"Leva fuori dai limiti: da 1 a {risk['max_leverage']}x (Impostazioni → Limiti di rischio).")
    if not (mark and mark > 0):
        raise CommandError("Prezzo attuale non disponibile: riprova.")
    if sl is None or not sl > 0:
        raise CommandError("Lo stop loss è obbligatorio.")
    long = side == "long"
    if (sl >= mark) if long else (sl <= mark):
        raise CommandError(f"Lo stop di un {side.upper()} va {'sotto' if long else 'sopra'} il prezzo attuale ({_fmt(mark)}).")
    if tp is not None and ((tp <= mark) if long else (tp >= mark)):
        raise CommandError(f"Il target di un {side.upper()} va {'sopra' if long else 'sotto'} il prezzo attuale ({_fmt(mark)}).")
    # con il margine isolato la liquidazione è circa a 1/leva dal prezzo: lo stop deve scattare prima
    liq = mark * (1 - 0.9 / lev) if long else mark * (1 + 0.9 / lev)
    if (sl <= liq) if long else (sl >= liq):
        raise CommandError(f"Con leva {lev}x lo stop sarebbe oltre la liquidazione (circa {_fmt(liq)}): abbassa la leva o avvicina lo stop.")
    from bitget_client import round_down
    qty = round_down(float(size or 0), specs["volume_place"])
    if qty < specs["min_size"]:
        raise CommandError(f"Quantità troppo piccola: il minimo su {symbol.replace('USDT', '')} è {_fmt(specs['min_size'])}.")
    notional = qty * mark
    margin = notional / lev
    if margin > equity * 0.9:
        raise CommandError(f"Margine richiesto {_fmt(margin)} USDT: oltre il 90% del conto futures ({_fmt(equity)} USDT).")
    loss = qty * abs(mark - sl) + notional * 0.0012          # allo stop, commissioni comprese
    cap = equity * risk["max_daily_loss_pct"] / 100
    if loss > cap:
        raise CommandError(f"Allo stop perderesti circa {_fmt(loss)} USDT, oltre il limite di {_fmt(cap)} "
                           f"({_fmt(risk['max_daily_loss_pct'])}% del conto, perdita massima del giorno).")
    places = specs["price_place"]
    return qty, round(sl, places), (round(tp, places) if tp else None), lev


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
    if len(argv) > 7 and argv[7] == "spot" and action != REFRESH:
        return run_spot(argv, client, notify, state_path)
    if action == REFRESH:
        if client is None:
            if not all(os.environ.get(k) for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE")):
                raise CommandError("Chiavi Bitget non impostate nei segreti di GitHub.")
            client = BitgetClient.from_env()
        return "Conto Bitget riletto." + ("" if refresh_if_changed(state_path, client) else " Nessun cambiamento.")
    if action == OPEN:
        return open_position(argv, client, notify, state_path)
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


# Modifiche allo stato che il passo di salvataggio del workflow deve riapplicare sulla versione più recente
# (es. il prezzo d'acquisto di una coin spot): {"spot_entry": {"symbol": ..., "entry": {...} oppure None}}
LAST_EXTRA = {}


def write_result(ok, msg, path=None, extra=None):
    with open(path or RESULT_PATH, "w") as f:
        json.dump({"ok": bool(ok), "msg": str(msg), "extra": extra or {}}, f)


def read_result(path=None):
    try:
        with open(path or RESULT_PATH) as f:
            r = json.load(f)
        return bool(r.get("ok")), str(r.get("msg", ""))
    except (OSError, ValueError, AttributeError):
        return False, "Esito sconosciuto: controlla la posizione su Bitget e i messaggi su Telegram."


def read_extra(path=None):
    try:
        with open(path or RESULT_PATH) as f:
            return json.load(f).get("extra") or {}
    except (OSError, ValueError, AttributeError):
        return {}


def apply_spot_entry(state_path, extra):
    se = (extra or {}).get("spot_entry")
    if not se or se.get("symbol") not in SYMBOLS:
        return
    state = executor._load(state_path)
    entries = state.setdefault("spot_entries", {})
    if se.get("entry"):
        entries[se["symbol"]] = se["entry"]
    else:
        entries.pop(se["symbol"], None)
    executor._save(state, state_path)


def _account_key(state):
    """Cosa conta per la rilettura chiesta dall'app: collegamento e posizioni (aperte, chiuse, TP/SL).
    Saldo e PnL cambiano a ogni secondo: li aggiorna il bot a ogni giro."""
    a = (state or {}).get("account") or {}
    pos = sorted((p.get("symbol"), p.get("side"), p.get("size"), p.get("entry"), p.get("tp"), p.get("sl"))
                 for p in a.get("positions_detail") or [])
    closed = [h.get("id") for h in a.get("history") or []]
    spot = sorted((d.get("symbol"), d.get("qty"), d.get("tp"), d.get("sl")) for d in a.get("spot_detail") or [])
    return json.dumps([a.get("connected"), a.get("positions"), pos, closed, spot], default=str)


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


def run_spot(argv, client=None, notify=None, state_path=executor.STATE_PATH, config_path=CONFIG_PATH):
    action, symbol = argv[0], argv[1]
    if action not in ACTIONS + (OPEN,) or symbol not in SYMBOLS:
        raise CommandError("Comando spot non valido.")
    if client is None:
        if not all(os.environ.get(k) for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE")):
            raise CommandError("Chiavi Bitget non impostate nei segreti di GitHub.")
        client = BitgetClient.from_env()
    try:
        with open(config_path) as f:
            cfg = json.load(f)
    except (OSError, ValueError):
        cfg = {}
    msg = spot_command(action, symbol, argv, client, cfg, state_path)
    sync_executor(symbol, "spot", action, state_path, msg=msg)
    try:
        executor.account_snapshot(state_path, client=client)
    except Exception as e:
        print(f"Conto non riletto: {e}")
    if notify:
        notify(f"🟢 SPOT · {'DEMO' if getattr(client, 'demo', False) else 'REALE'}\n{msg}")
    return msg


def open_position(argv, client=None, notify=None, state_path=executor.STATE_PATH, config_path=CONFIG_PATH, mark_fn=None, specs_fn=None):
    """open COIN DIREZIONE STOP QUANTITÀ LEVA [TARGET]: ordine a mercato con stop (e target) già sull'exchange."""
    symbol, side = argv[1], argv[2]
    def num(i):
        try:
            return float(argv[i]) if len(argv) > i and argv[i] not in ("", "0") else None
        except ValueError:
            raise CommandError(f"Valore non valido: {argv[i]}")
    sl, size, lev, tp = num(3), num(4), num(5), num(6)
    if client is None:
        if not all(os.environ.get(k) for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE")):
            raise CommandError("Chiavi Bitget non impostate nei segreti di GitHub.")
        client = BitgetClient.from_env()
    try:
        with open(config_path) as f:
            cfg = json.load(f)
    except (OSError, ValueError):
        cfg = {}
    mark = (mark_fn or mark_price)(symbol)
    specs = (specs_fn or executor.contract_specs)(symbol) or executor.DEFAULT_SPECS
    qty, sl, tp, lev = validate_open(symbol, side, size, lev, sl, tp, client.positions(), mark, specs, cfg, client.equity())
    try:
        one_way = client.pos_mode(symbol) == "one_way_mode"
    except Exception:
        one_way = False
    client.setup_symbol(symbol, lev, side)
    client.open_position(symbol, side, qty, sl, take_price=tp, one_way=one_way)
    name = f"{symbol.replace('USDT', '')} {side.upper()}"
    msg = (f"Aperta {name} {_fmt(qty)} a mercato su Bitget (circa {_fmt(mark)}, leva {lev}x, margine isolato): "
           f"stop {_fmt(sl)}" + (f", target {_fmt(tp)}" if tp else ", nessun target") + ".")
    sync_executor(symbol, side, OPEN, state_path, msg=msg)
    try:
        executor.account_snapshot(state_path, client=client)
    except Exception as e:
        print(f"Conto non riletto: {e}")
    if notify:
        notify(f"🟢 ORDINE MANUALE · {'DEMO' if getattr(client, 'demo', False) else 'REALE'}\n{msg}")
    return msg


# =====================================================================
# SPOT: le coin si comprano e si vendono (niente short né leva). Stop e target sono ordini a scatto di
# vendita sull'exchange. Acquisti e vendite con ordini limite IOC vicini al prezzo: la quantità è sempre in
# coin e il prezzo ha un tetto (acquisto) o un minimo (vendita).
# =====================================================================
SPOT_SLIP = 0.005          # tetto/minimo di prezzo degli ordini IOC: 0,5% dal prezzo attuale


def _spot_kind(order, price):
    """Un ordine a scatto di vendita sopra il prezzo è un target, sotto è uno stop."""
    return "tp" if order["price"] > price else "sl"


def validate_spot_buy(symbol, qty, sl, tp, price, rules, cfg, usdt_available, equity_total):
    if symbol not in SYMBOLS:
        raise CommandError("Coin non valida.")
    if cfg.get("emergency"):
        raise CommandError("Emergenza attiva: niente nuovi ordini finché non la sblocchi.")
    risk = executor.risk_config(cfg)
    if not risk.get("trading_enabled"):
        raise CommandError("La modalità Reale è spenta: accendila dall'app (Account) per mandare ordini veri.")
    if not (price and price > 0):
        raise CommandError("Prezzo attuale non disponibile: riprova.")
    if sl is None or not sl > 0:
        raise CommandError("Lo stop loss è obbligatorio.")
    if sl >= price:
        raise CommandError(f"Lo stop va sotto il prezzo attuale ({_fmt(price)}).")
    if tp is not None and tp <= price:
        raise CommandError(f"Il target va sopra il prezzo attuale ({_fmt(price)}).")
    from bitget_client import round_down
    qty = round_down(float(qty or 0), rules["qty_place"])
    cost = qty * price
    if qty <= 0 or qty < rules["min_qty"] or cost < rules["min_usdt"]:
        raise CommandError(f"Importo troppo piccolo: su Bitget spot servono almeno {_fmt(max(rules['min_usdt'], rules['min_qty'] * price))} USDT.")
    if cost * (1 + SPOT_SLIP) > usdt_available:
        raise CommandError(f"Nel conto spot ci sono {_fmt(usdt_available)} USDT disponibili: ne servono circa {_fmt(cost * (1 + SPOT_SLIP))}. "
                           "Trasferisci USDT dai futures allo spot nell'app Bitget.")
    loss = qty * (price - sl) + cost * 0.002
    cap = equity_total * risk["max_daily_loss_pct"] / 100
    if loss > cap:
        raise CommandError(f"Allo stop perderesti circa {_fmt(loss)} USDT, oltre il limite di {_fmt(cap)} "
                           f"({_fmt(risk['max_daily_loss_pct'])}% del patrimonio, perdita massima del giorno).")
    places = rules["price_place"]
    return qty, round(sl, places), (round(tp, places) if tp else None)


def _spot_place_exits(client, symbol, qty, sl, tp):
    """Stop e target come ordini a scatto. Ritorna le note da aggiungere al messaggio (anche se uno fallisce)."""
    notes = []
    for kind, level in (("stop", sl), ("target", tp)):
        if not level:
            continue
        try:
            client.spot_plan_sell(symbol, level, qty)
            notes.append(f"{kind} {_fmt(level)}")
        except Exception as e:
            notes.append(f"{kind.upper()} NON impostato ({str(e)[:80]}): rimettilo dalla chat")
    return notes


def spot_command(action, symbol, argv, client, cfg, state_path, now=None):
    coin = symbol.replace("USDT", "")
    rules = client.spot_symbol(symbol)
    price = client.spot_price_usdt(coin)
    from bitget_client import round_down
    def num(i):
        try:
            return float(argv[i]) if len(argv) > i and argv[i] not in ("", "0") else None
        except ValueError:
            raise CommandError(f"Valore non valido: {argv[i]}")
    if action == OPEN:
        sl, qty, tp = num(3), num(4), num(6)
        totals = client.all_balances_usdt() if hasattr(client, "all_balances_usdt") else {}
        qty, sl, tp = validate_spot_buy(symbol, qty, sl, tp, price, rules, cfg, client.spot_available("USDT"), sum(totals.values()) or 0)
        client.spot_order(symbol, "buy", qty, round(price * (1 + SPOT_SLIP), rules["price_place"]))
        held = round_down(client.spot_available(coin), rules["qty_place"])
        if held <= 0:
            return f"Acquisto di {coin} NON eseguito: il prezzo si è mosso oltre lo 0,5%. Nessuna spesa."
        notes = _spot_place_exits(client, symbol, held, sl, tp)
        LAST_EXTRA["spot_entry"] = {"symbol": symbol, "entry": {"entry": price, "qty": held, "at": (now or datetime.now(timezone.utc)).isoformat(timespec="seconds")}}
        apply_spot_entry(state_path, LAST_EXTRA)
        return f"Comprati {_fmt(held)} {coin} spot a circa {_fmt(price)} su Bitget" + (": " + ", ".join(notes) if notes else "") + "."
    held = round_down(client.spot_available(coin), rules["qty_place"])
    plans = [o for o in client.spot_plan_orders(symbol) if o.get("side") == "sell"]
    if action == "close":
        for o in plans:
            client.spot_cancel_plan(o["orderId"])
        if held <= 0:
            raise CommandError(f"Nello spot non c'è {coin} da vendere.")
        client.spot_order(symbol, "sell", held, round(price * (1 - SPOT_SLIP), rules["price_place"]))
        left = client.spot_available(coin)
        LAST_EXTRA["spot_entry"] = {"symbol": symbol, "entry": None}
        apply_spot_entry(state_path, LAST_EXTRA)
        return f"Venduti {_fmt(held - min(left, held))} {coin} spot a circa {_fmt(price)} su Bitget." + (f" Restano {_fmt(left)} {coin} (prezzo mosso oltre lo 0,5%)." if left > 10 ** -rules["qty_place"] else "")
    if action in ("clear", "untp", "unsl"):
        kinds = {"clear": ("tp", "sl"), "untp": ("tp",), "unsl": ("sl",)}[action]
        gone = [o for o in plans if _spot_kind(o, price) in kinds]
        for o in gone:
            client.spot_cancel_plan(o["orderId"])
        return f"Tolti {len(gone)} ordini a scatto di {coin} spot su Bitget."
    if action in ("tp", "sl"):
        level = num(3)
        if not level:
            raise CommandError("Prezzo mancante o non valido.")
        if held <= 0:
            raise CommandError(f"Nello spot non c'è {coin}: niente da proteggere.")
        if (action == "tp" and level <= price) or (action == "sl" and level >= price):
            raise CommandError(f"{'Il target va sopra' if action == 'tp' else 'Lo stop va sotto'} il prezzo attuale ({_fmt(price)}).")
        for o in plans:
            if _spot_kind(o, price) == action:
                client.spot_cancel_plan(o["orderId"])
        level = round(level, rules["price_place"])
        client.spot_plan_sell(symbol, level, held)
        return f"{'Target' if action == 'tp' else 'Stop'} di {coin} spot impostato su Bitget a {_fmt(level)} (vende {_fmt(held)} {coin} a mercato)."
    raise CommandError(f"Azione sconosciuta: {action}.")


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
    if os.environ.get("MARKET") == "spot":
        side = "spot"                     # niente da chiudere nell'esecutore (lavora solo sui futures)
        if ok:
            apply_spot_entry(state_path, read_extra(result_path))
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
        write_result(True, msg, extra=LAST_EXTRA)
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
