"""Esecutore: porta su Bitget i trade delle strategie in modalità "live".

Segue la prova su carta (paper_trades.json): quando una strategia live apre un trade su carta,
l'esecutore apre la stessa posizione su Bitget; quando il trade su carta si chiude, chiude la posizione.
Così ciò che succede con i soldi veri è sempre confrontabile con la prova su carta.

Tre livelli, tutti necessari per mandare un ordine vero:
1. la strategia è "live" in automation.json, che a sua volta è ammesso solo se confermata dalla prova finale;
2. in automation.json "risk.trading_enabled" è true (interruttore generale, dall'app);
3. i segreti BITGET_API_KEY / SECRET / PASSPHRASE sono impostati su GitHub.
Se manca anche uno dei tre, l'esecutore gira lo stesso ma in modalità SIMULATA (nessun ordine).

Limiti di rischio (automation.json -> risk), controllati prima di ogni ingresso:
- risk_per_trade_pct: perdita massima se scatta lo stop, in % del patrimonio;
- max_leverage: leva massima (margine isolato);
- max_exposure_x: esposizione totale massima (somma dei nominali) in multipli del patrimonio,
  perché BTC, ETH e SOL si muovono insieme: tre posizioni sono quasi una sola scommessa;
- max_open_positions: posizioni aperte contemporaneamente;
- max_daily_loss_pct: se la perdita del giorno (UTC) supera questa soglia, niente nuovi ingressi fino a domani;
- daily_target_pct: se il guadagno del giorno raggiunge l'obiettivo, niente nuovi ingressi fino a domani (0 = nessuno).

Sicurezza:
- ogni posizione nasce con lo stop loss già sull'exchange: protetta anche se il bot si ferma;
- riconciliazione a ogni giro: se su Bitget c'è qualcosa che l'esecutore non si aspetta (o manca
  qualcosa che dovrebbe esserci) si blocca tutto e arriva un avviso;
- emergenza (dall'app): chiude le posizioni aperte dall'esecutore e blocca.
Limite noto: lo stop che segue il prezzo e le uscite a tempo vengono eseguiti alla chiusura della
candela (quando il trade su carta si chiude), non dentro la candela come nella simulazione.
"""
import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone

import requests

from bitget_client import BitgetClient, DryRunClient, round_down
from kronos_core import TF_DELTA

STATE_PATH = "live_trades.json"
DEFAULT_RISK = {
    "trading_enabled": False,
    "risk_per_trade_pct": 0.5,
    "max_leverage": 3,
    "max_exposure_x": 1.5,
    "max_open_positions": 3,
    "max_daily_loss_pct": 3.0,
    "daily_target_pct": 0.0,        # obiettivo del giorno: raggiunto, niente nuovi ingressi fino a domani (0 = nessuno)
    "max_strategy_dd_pct": 5.0,     # perdita massima di una strategia reale dal suo massimo: oltre, l'agente la riporta su carta
    "dry_run_equity": 1000.0,
}
# Valori ammessi per ogni limite (anche dall'app): fuori da qui il comando viene rifiutato
RISK_BOUNDS = {
    "risk_per_trade_pct": (0.1, 2.0),
    "max_leverage": (1, 5),
    "max_exposure_x": (0.5, 3.0),
    "max_open_positions": (1, 6),
    "max_daily_loss_pct": (1.0, 10.0),
    "daily_target_pct": (0.0, 10.0),
    "max_strategy_dd_pct": (1.0, 20.0),
    "dry_run_equity": (100.0, 1_000_000.0),
}
DEFAULT_SPECS = {"volume_place": 3, "price_place": 1, "min_size": 0.001}


def risk_config(cfg):
    return {**DEFAULT_RISK, **(cfg.get("risk") or {})}


def contract_specs(symbol):
    """Decimali di quantità e prezzo e quantità minima del contratto (API pubblica)."""
    try:
        r = requests.get("https://api.bitget.com/api/v2/mix/market/contracts",
                         params={"symbol": symbol, "productType": "USDT-FUTURES"}, timeout=10)
        c = r.json()["data"][0]
        return {"volume_place": int(c["volumePlace"]), "price_place": int(c["pricePlace"]), "min_size": float(c["minTradeNum"])}
    except Exception:
        return None


def size_position(equity, entry, stop, risk, open_notional, specs):
    """Quantità (in coin) da aprire, o (0, motivo) se un limite lo impedisce.
    Quantità = rischio ammesso / distanza dello stop, poi tagliata da leva ed esposizione totale."""
    if equity <= 0 or entry <= 0:
        return 0.0, "patrimonio o prezzo non validi"
    dist = abs(entry - stop) / entry
    if dist <= 0:
        return 0.0, "stop uguale all'ingresso"
    notional = equity * risk["risk_per_trade_pct"] / 100 / dist
    notional = min(notional, equity * risk["max_leverage"])                    # leva massima sul solo trade
    room = equity * risk["max_exposure_x"] - open_notional                     # esposizione totale rimasta
    if room <= 0:
        return 0.0, "esposizione totale al massimo"
    notional = min(notional, room)
    size = round_down(notional / entry, specs["volume_place"])
    if size < specs["min_size"]:
        return 0.0, "quantità sotto il minimo del contratto"
    return size, ""


def _load(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {"positions": {}, "day": {}, "halted": False, "events": []}


def _save(state, path):
    state["events"] = state["events"][-300:]
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(state, f, indent=1)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def make_client(cfg):
    """Client vero solo se l'interruttore generale è acceso e le chiavi ci sono; altrimenti simulato."""
    risk = risk_config(cfg)
    keys = all(os.environ.get(k) for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE"))
    if risk["trading_enabled"] and keys and not cfg.get("emergency"):
        return BitgetClient.from_env(), ("demo" if os.environ.get("BITGET_DEMO", "0") == "1" else "reale")
    return None, "simulata"


def run(cfg, ledger, client=None, mode="simulata", state_path=STATE_PATH, now=None, notify=None, specs_fn=contract_specs):
    """Un giro dell'esecutore. Ritorna True se lo stato è cambiato."""
    now = now or datetime.now(timezone.utc)
    now_ts, today = int(now.timestamp()), now.strftime("%Y-%m-%d")
    risk = risk_config(cfg)
    state = _load(state_path)
    before = json.dumps(state, sort_keys=True)
    state["mode"] = mode
    if client is None:
        sim = state.setdefault("simulated", {"equity": risk["dry_run_equity"], "positions": {}})
        client = DryRunClient(sim["equity"])
        client._positions = {s: dict(p) for s, p in sim["positions"].items()}
    say = (lambda text: notify(f"{'🤖' if mode != 'simulata' else '🧪'} ESECUTORE ({mode.upper()})\n{text}")) if notify else (lambda text: None)

    def log(kind, **data):
        state["events"].append({"at": now.isoformat(timespec="seconds"), "kind": kind, **data})

    ours = {tid: p for tid, p in state["positions"].items() if p["status"] == "open"}

    # --- emergenza: chiude tutto ciò che ha aperto e si ferma ---
    if cfg.get("emergency"):
        for tid, p in ours.items():
            try:
                client.close_position(p["symbol"], p["side"])
                p.update(status="closed", closed_at=now.isoformat(timespec="seconds"), close_reason="EMERGENZA")
                log("close", id=tid, reason="EMERGENZA")
            except Exception as e:
                log("error", id=tid, error=str(e))
                say(f"Emergenza: chiusura di {p['symbol']} FALLITA ({e}). Controlla subito su Bitget.")
        if ours:
            say(f"Emergenza: chiuse {len(ours)} posizioni.")
        state["halted"], state["halt_reason"] = True, "emergency"
        return _finish(state, before, state_path, client, mode)

    # Blocco dovuto all'emergenza ed emergenza ormai tolta: si sblocca da solo. Serve perché lo
    # sblocco dall'app può arrivare prima che il bot abbia salvato il blocco (due workflow diversi).
    # Il blocco per posizioni diverse dal previsto invece resta finché non lo togli tu.
    if state["halted"]:
        reason = state.get("halt_reason") or ("mismatch" if any(e.get("kind") == "halt" for e in state["events"]) else "emergency")
        if reason == "emergency":
            state["halted"], state["halt_reason"] = False, None
            log("unhalt", reason="emergenza tolta")

    # --- riconciliazione: Bitget deve avere esattamente le posizioni aperte dall'esecutore ---
    try:
        equity, exchange = client.equity(), client.positions()
    except Exception as e:
        log("error", error=f"lettura conto: {e}")
        say(f"Impossibile leggere il conto Bitget ({e}): nessuna operazione in questo giro.")
        return _finish(state, before, state_path, client, mode)
    # Le posizioni dell'esecutore devono esserci, con la direzione giusta. Le altre posizioni su Bitget sono
    # manuali (aperte da te nell'app o su Bitget): non bloccano nulla, ma su quella coin l'esecutore non entra.
    expected = {p["symbol"]: p["side"] for p in ours.values()}
    actual = {s: p["side"] for s, p in exchange.items()}
    missing = {s: v for s, v in expected.items() if actual.get(s) != v}
    manual = {s: p for s, p in exchange.items() if s not in expected}
    state["manual"] = sorted(manual)
    if missing:
        if not state["halted"]:
            say(f"Posizioni diverse dal previsto (attese {expected or 'nessuna'}, su Bitget {actual or 'nessuna'}). "
                "Esecutore bloccato: controlla su Bitget, poi usa Sblocca nell'app.")
            log("halt", expected=expected, actual=actual)
        state["halted"], state["halt_reason"] = True, "mismatch"
    if state["halted"]:
        return _finish(state, before, state_path, client, mode)

    # --- perdita massima del giorno ---
    if state["day"].get("date") != today:
        state["day"] = {"date": today, "start_equity": equity, "blocked": False}
    day_pnl = (equity / state["day"]["start_equity"] - 1) * 100 if state["day"]["start_equity"] else 0.0
    if day_pnl <= -risk["max_daily_loss_pct"] and not state["day"]["blocked"]:
        state["day"]["blocked"] = True
        say(f"Perdita del giorno {day_pnl:.2f}% oltre il limite ({risk['max_daily_loss_pct']}%): niente nuovi ingressi fino a domani.")
        log("daily_limit", pnl_pct=round(day_pnl, 2))
    # obiettivo del giorno: raggiunto, si smette di aprire (le posizioni aperte restano con i loro stop)
    target = risk.get("daily_target_pct") or 0
    if target > 0 and day_pnl >= target and not state["day"].get("target_hit"):
        state["day"]["target_hit"] = True
        say(f"Obiettivo del giorno raggiunto: {day_pnl:+.2f}% (obiettivo {target}%). Niente nuovi ingressi fino a domani.")
        log("daily_target", pnl_pct=round(day_pnl, 2))

    # --- trade che le strategie live vogliono aperti adesso ---
    wanted = {}
    for key, entry in (ledger.get("strategies") or {}).items():
        if entry.get("mode") != "live" or (cfg.get("strategies") or {}).get(key) != "live":
            continue
        for t in entry.get("trades", []):
            if t.get("open"):
                wanted[t["id"]] = dict(t, key=key)

    # uscite: il trade su carta si è chiuso (o la strategia non è più live)
    for tid, p in ours.items():
        if tid in wanted:
            continue
        try:
            client.close_position(p["symbol"], p["side"])
            p.update(status="closed", closed_at=now.isoformat(timespec="seconds"), close_reason="SEGUE LA CARTA")
            log("close", id=tid, symbol=p["symbol"])
            say(f"Chiusa {p['symbol']} {p['side'].upper()} ({p['key']}).")
        except Exception as e:
            log("error", id=tid, error=str(e))
            say(f"Chiusura di {p['symbol']} FALLITA ({e}). Controlla su Bitget.")

    # ingressi: trade su carta appena aperti, entro una candela dal segnale
    open_now = {tid: p for tid, p in state["positions"].items() if p["status"] == "open"}
    open_notional = sum(p["size"] * p["entry"] for p in open_now.values())
    open_notional += sum((p.get("size") or 0) * (p.get("entry") or p.get("mark") or 0) for p in manual.values())   # anche le manuali pesano
    busy = {p["symbol"] for p in open_now.values()} | set(manual)
    for tid, t in sorted(wanted.items(), key=lambda kv: kv[1]["t"]):
        if tid in state["positions"]:
            continue
        tf = t["key"].split(":")[1]
        skip = None
        if now_ts - t["t_entry"] > TF_DELTA[tf].total_seconds():
            skip = "segnale troppo vecchio (oltre una candela)"
        elif state["day"].get("blocked"):
            skip = "limite di perdita giornaliera"
        elif state["day"].get("target_hit"):
            skip = "obiettivo del giorno già raggiunto"
        elif t["symbol"] in busy:
            skip = "già una posizione su questa coin" + (" (aperta a mano)" if t["symbol"] in manual else "")
        elif len(open_now) >= risk["max_open_positions"]:
            skip = "numero massimo di posizioni"
        size, why = (0.0, "")
        side = "long" if t["dir"] > 0 else "short"
        if not skip:
            specs = specs_fn(t["symbol"]) or DEFAULT_SPECS
            size, why = size_position(equity, t["entry"], t["stop"], risk, open_notional, specs)
            skip = why or None
        if skip:
            state["positions"][tid] = {"key": t["key"], "symbol": t["symbol"], "side": side, "status": "skipped", "reason": skip}
            log("skip", id=tid, reason=skip)
            say(f"{t['symbol']} {side.upper()} ({t['key']}) NON aperta: {skip}.")
            continue
        stop = round(t["stop"], specs["price_place"])
        try:
            client.setup_symbol(t["symbol"], risk["max_leverage"])
            client.open_position(t["symbol"], side, size, stop, client_oid="sgt" + hashlib.sha1(tid.encode()).hexdigest()[:24])
        except Exception as e:
            state["positions"][tid] = {"key": t["key"], "symbol": t["symbol"], "side": side, "status": "error", "reason": str(e)}
            log("error", id=tid, error=str(e))
            say(f"Apertura di {t['symbol']} FALLITA ({e}).")
            continue
        p = {"key": t["key"], "symbol": t["symbol"], "side": side, "size": size, "entry": t["entry"], "stop": stop,
             "status": "open", "opened_at": now.isoformat(timespec="seconds"), "equity_at_open": round(equity, 2)}
        state["positions"][tid] = p
        open_now[tid] = p
        busy.add(t["symbol"])
        open_notional += size * t["entry"]
        log("open", id=tid, symbol=t["symbol"], side=side, size=size, stop=stop)
        risk_usdt = size * abs(t["entry"] - stop)
        say(f"Aperta {t['symbol']} {side.upper()} ({t['key']}): {size} a ~{t['entry']:,.2f}, stop {stop:,.2f} (rischio ~{risk_usdt:,.2f} USDT).")
    return _finish(state, before, state_path, client, mode)


def _finish(state, before, path, client, mode):
    if isinstance(client, DryRunClient):
        state.setdefault("simulated", {})["positions"] = client.positions()
        state["simulated"]["equity"] = client.equity()
    changed = json.dumps(state, sort_keys=True) != before
    if changed:
        _save(state, path)
    return changed


def _spot_value(client):
    """Valore del conto spot in USDT (saldi * prezzo pubblico). Le coin senza prezzo restano fuori
    dal totale ma sono elencate. Errori qui non rendono il conto "non collegato"."""
    if not hasattr(client, "spot_balances"):
        return {}
    try:
        balances = client.spot_balances()
    except Exception as e:
        return {"spot_error": str(e)[:120]}
    coins, total = [], 0.0
    for coin, qty in sorted(balances.items()):
        px = client.spot_price_usdt(coin)
        value = qty * px if px else None
        if value is not None:
            total += value
        if value is None or value >= 0.01:
            coins.append({"coin": coin, "qty": round(qty, 8), "usdt": round(value, 2) if value is not None else None})
    coins.sort(key=lambda c: -(c["usdt"] or 0))
    return {"spot_usdt": round(total, 2), "spot_coins": coins[:10]}


def spot_round_trips(fills, symbol):
    """Vendite spot come trade chiusi, con il costo medio degli acquisti precedenti (commissioni comprese).
    fills: eseguiti di Bitget di una coppia (qualunque ordine). Le vendite di coin comprate prima della
    finestra dello storico (90 giorni) non hanno un costo noto: restano fuori."""
    def num(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0
    def fee_usdt(f, price):
        fd = f.get("feeDetail") or {}
        fee = abs(num(fd.get("totalFee") or fd.get("totalDeductionFee") or f.get("fee")))
        coin = str(fd.get("feeCoin") or "USDT").upper()
        return fee if coin in ("USDT", "") else fee * price          # commissione pagata in coin: valore in USDT
    rows = sorted(fills or [], key=lambda f: int(num(f.get("cTime"))))
    qty, cost, first_buy, out = 0.0, 0.0, None, []
    for f in rows:
        size, price = num(f.get("size")), num(f.get("priceAvg") or f.get("price"))
        if size <= 0 or price <= 0:
            continue
        fee, t = fee_usdt(f, price), int(num(f.get("cTime")))
        if str(f.get("side")).lower() == "buy":
            if qty <= 1e-12:
                first_buy = t
            qty += size
            cost += size * price + fee
        elif qty > 1e-12:
            sold = min(size, qty)
            avg = cost / qty
            gross = (price - avg) * sold
            out.append({"id": f"spot-{f.get('tradeId') or f.get('orderId') or t}", "symbol": symbol, "side": "long", "market": "spot",
                        "size": round(sold, 8), "entry": round(avg, 8), "exit": price, "pnl": round(gross, 6), "fees": round(fee, 6),
                        "funding": 0.0, "net": round(gross - fee, 6), "opened_at": first_buy, "closed_at": t})
            cost -= avg * sold
            qty -= sold
    return out


def _spot_history(client, limit=30):
    out = []
    if not hasattr(client, "spot_fills_raw"):
        return out
    for sym in ("BTCUSDT", "ETHUSDT", "SOLUSDT"):
        try:
            out += spot_round_trips(client.spot_fills_raw(sym, 100), sym)
        except Exception as e:
            print(f"Eseguiti spot {sym} non letti: {e}")
    return sorted(out, key=lambda h: -(h.get("closed_at") or 0))[:limit]


def _spot_detail(client, coins):
    out = []
    if not hasattr(client, "spot_plan_orders"):
        return out
    for c in coins:
        sym = f"{c.get('coin')}USDT"
        if sym not in ("BTCUSDT", "ETHUSDT", "SOLUSDT") or not c.get("usdt") or c["usdt"] < 1:
            continue
        price = c["usdt"] / c["qty"] if c.get("qty") else None
        d = {"symbol": sym, "qty": c["qty"], "usdt": c["usdt"], "price": price, "tp": None, "sl": None}
        try:
            for o in client.spot_plan_orders(sym):
                if o.get("side") == "sell" and price:
                    d["tp" if o["price"] > price else "sl"] = o["price"]
        except Exception as e:
            d["orders_error"] = str(e)[:80]
        out.append(d)
    return out


def account_snapshot(state_path=STATE_PATH, client=None, now=None, notify=None):
    """Lettura del conto Bitget in SOLA LETTURA (patrimonio futures e numero di posizioni), a ogni giro,
    anche con gli ordini veri spenti: l'app mostra se le chiavi funzionano. Nessun ordine.
    Avvisa una sola volta quando la lettura passa da riuscita a fallita (es. chiave scaduta)."""
    keys = all(os.environ.get(k) for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE"))
    if client is None and not keys:
        account = {"connected": False, "reason": "chiavi non impostate"}
    else:
        now = now or datetime.now(timezone.utc)
        try:
            client = client or BitgetClient.from_env()
            pos = client.positions()
            account = {"connected": True, "demo": bool(client.demo), "equity": round(float(client.equity()), 2),
                       "positions": len(pos),
                       "positions_detail": [{"symbol": sym, **{k: (round(v, 6) if isinstance(v, float) else v) for k, v in p.items()}}
                                            for sym, p in sorted(pos.items())],
                       "upl": round(sum((p.get("upl") or 0) for p in pos.values()), 2)}
            # take profit / stop loss impostati sull'exchange (per mostrarli sulla posizione)
            if pos and hasattr(client, "tpsl_orders"):
                try:
                    orders = client.tpsl_orders()
                    for row in account["positions_detail"]:
                        o = orders.get(row["symbol"]) or {}
                        row["tp"] = (o.get("tp") or {}).get("price")
                        row["sl"] = (o.get("sl") or {}).get("price")
                except Exception as e:
                    account["tpsl_error"] = str(e)[:120]
            account.update(_spot_value(client))
            account["total_usdt"] = round(account["equity"] + (account.get("spot_usdt") or 0), 2)
            # Tutti i conti (anche Earn, Funding, bot): se Bitget li dà, il totale è la loro somma
            if hasattr(client, "all_balances_usdt"):
                try:
                    acc_all = {k: round(v, 2) for k, v in client.all_balances_usdt().items()}
                    if acc_all:
                        account["accounts_usdt"] = acc_all
                        account["total_usdt"] = round(sum(acc_all.values()), 2)
                except Exception as e:
                    account["accounts_error"] = str(e)[:120]
            # Coin spot di BTC, ETH e SOL (valore almeno 1 USDT) come "posizioni spot": stop e target sono gli
            # ordini a scatto di vendita in attesa; il prezzo d'acquisto lo aggiunge sotto chi ha lo stato
            account["spot_detail"] = _spot_detail(client, account.get("spot_coins") or [])
            # Posizioni chiuse (Diario dell'app in modalità Reale): un errore qui tiene lo storico precedente
            if hasattr(client, "closed_positions"):
                try:
                    account["history"] = client.closed_positions(30) + _spot_history(client)
                except Exception as e:
                    account["history_error"] = str(e)[:120]
        except Exception as e:
            account = {"connected": False, "demo": bool(getattr(client, "demo", False)), "reason": str(e)[:160]}
        account["checked_at"] = now.isoformat(timespec="seconds")
    state = _load(state_path)
    previous = state.get("account") or {}
    for d in account.get("spot_detail") or []:      # prezzo d'acquisto, se la coin è stata comprata dall'app
        e = (state.get("spot_entries") or {}).get(d["symbol"])
        if e:
            d["entry"] = e.get("entry")
    if account.get("connected") and "history" not in account and previous.get("history"):
        account["history"] = previous["history"]
    # Variazione di oggi: patrimonio totale rispetto alla prima lettura del giorno (UTC). Comprende
    # anche depositi e prelievi del giorno: nell'app è indicata come "variazione", non come guadagno.
    if account.get("connected") and account.get("total_usdt") is not None:
        today = (now or datetime.now(timezone.utc)).strftime("%Y-%m-%d")
        same_day = previous.get("day") == today and previous.get("day_start_total") is not None
        account["day"] = today
        start = previous["day_start_total"] if same_day else account["total_usdt"]
        # Versamenti e trasferimenti non sono guadagni: si spostano nella base del giorno.
        # - conto vuoto a inizio giornata e poi finanziato: la base diventa il saldo senza il PnL aperto;
        # - nessuna posizione né prima né ora: il saldo può cambiare solo per un trasferimento.
        if same_day and start <= 0.01 and account["total_usdt"] > 0.01:
            start = round(account["total_usdt"] - (account.get("upl") or 0), 2)
        elif (same_day and not previous.get("positions") and not account.get("positions")
              and previous.get("total_usdt") is not None):
            start = round(start + account["total_usdt"] - previous["total_usdt"], 2)
        account["day_start_total"] = start
        account["day_change"] = round(account["total_usdt"] - start, 2)
    if notify and keys and previous.get("connected") and not account["connected"]:
        notify(f"⚠️ Bitget non risponde alla lettura del conto: {account.get('reason')}. "
               "Se la chiave è scaduta, creane una nuova e aggiorna i segreti BITGET_*.")
    # gli avvisi delle posizioni chiuse partono dal controllo rapido ogni 5 minuti (quick.py → _notify_closed)
    if account != previous:
        state["account"] = account
        _save(state, state_path)
    return account


def _num_it(v, d=2, sign=False):
    s = f"{abs(v):,.{d}f}".replace(",", "§").replace(".", ",").replace("§", ".")
    return ("+" if v > 0 and sign else "-" if v < 0 else "") + s


def _price_it(v):
    """Prezzo all'italiana senza zeri inutili: 72.000 · 83,724 · 0,12345"""
    return _num_it(v, 1 if v >= 1000 else 3 if v >= 1 else 5).rstrip("0").rstrip(",")


def _notify_closed(state, account, notify, now):
    """Messaggio su Telegram per ogni posizione reale chiusa su Bitget (stop, target, a mano, liquidazione).
    Lo usa il controllo rapido (quick.py, ogni 5 minuti): gli id già avvisati restano in
    state["closed_notified"] (quick_state.json), così nessuna chiusura viene avvisata due volte.
    Alla prima lettura dello storico non si avvisa nulla (sarebbero chiusure vecchie)."""
    hist = account.get("history")
    if not notify or not account.get("connected") or hist is None:
        return False
    ids = [h.get("id") for h in hist if h.get("id")]
    seen = state.get("closed_notified")
    if seen is None:
        state["closed_notified"] = ids[:60]
        return True
    new = [h for h in hist if h.get("id") and h["id"] not in seen]
    if not new:
        return False
    recent = now.timestamp() * 1000 - 24 * 3600e3
    for h in reversed(new):                       # dalla più vecchia
        if (h.get("closed_at") or 0) < recent:
            continue
        net = h.get("net") if h.get("net") is not None else (h.get("pnl") or 0) - (h.get("fees") or 0)
        name = f"{(h.get('symbol') or '').replace('USDT', '')} {(h.get('side') or '').upper()}"
        try:
            notify(f"{'✅' if net >= 0 else '❌'} POSIZIONE CHIUSA · Bitget {'demo' if account.get('demo') else 'reale'}\n"
                   f"{name} {_num_it(h.get('size') or 0, 4).rstrip('0').rstrip(',')}: entrata {_price_it(h.get('entry') or 0)} → uscita {_price_it(h.get('exit') or 0)}\n"
                   f"Netto {_num_it(net, sign=True)} USDT (lordo {_num_it(h.get('pnl') or 0, sign=True)}, commissioni {_num_it(h.get('fees') or 0)}, "
                   f"funding {_num_it(h.get('funding') or 0, sign=True)})")
        except Exception as e:
            print(f"Avviso di chiusura non inviato: {e}")
    state["closed_notified"] = (ids + [x for x in seen if x not in ids])[:60]
    return True


def unhalt(state_path=STATE_PATH):
    """Sblocco dopo un blocco per riconciliazione o emergenza (dall'app, comando resume)."""
    state = _load(state_path)
    state["halted"], state["halt_reason"] = False, None
    state["events"].append({"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "kind": "unhalt"})
    _save(state, state_path)
