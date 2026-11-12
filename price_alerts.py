"""Avvisi di prezzo su Telegram, chiesti all'assistente dell'app ("avvisami se BTC arriva a 75.000").

- Gli avvisi attivi stanno in automation.json ("price_alerts"), scritti solo dal workflow Automazione
  (python automation.py alert add|del|clear ...).
- Il bot (run_bot.py, ogni 15 minuti) controlla le candele da 1 minuto di Bitget dal momento della
  creazione: un tocco tra un giro e l'altro non si perde. Gli avvisi scattati finiscono in
  alerts_state.json ("_price_alerts_fired"), che scrive solo il bot: i due workflow non toccano mai lo
  stesso file. L'app mostra come attivi quelli non ancora scattati.
- Un avviso scatta una volta sola. Nessun ordine: è solo un messaggio.
"""
import secrets
from datetime import datetime, timezone

import requests

SYMBOLS = ("BTCUSDT", "ETHUSDT", "SOLUSDT")
SIDES = ("above", "below")
MAX_ALERTS = 10
FIRED_KEY = "_price_alerts_fired"
FIRED_MAX = 50


class AlertError(ValueError):
    pass


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _fmt(v):
    s = f"{v:,.4f}".rstrip("0").rstrip(".")
    return s.replace(",", "§").replace(".", ",").replace("§", ".")


def parse_spec(spec):
    """'BTCUSDT:above:75000' -> (symbol, side, price)"""
    try:
        symbol, side, price = spec.split(":")
        price = float(price)
    except (ValueError, AttributeError):
        raise AlertError(f"Avviso non valido: {spec}") from None
    if symbol not in SYMBOLS or side not in SIDES or not (0 < price < 1e9):
        raise AlertError(f"Avviso non valido: {spec}")
    return symbol, side, price


def fired_ids(alerts_state):
    return set((alerts_state or {}).get(FIRED_KEY, []))


def active(cfg, alerts_state=None):
    fired = fired_ids(alerts_state)
    return [a for a in cfg.get("price_alerts", []) if a.get("id") not in fired]


def add(cfg, spec, alerts_state=None, now=None):
    symbol, side, price = parse_spec(spec)
    alerts = active(cfg, alerts_state)        # gli scattati si tolgono qui, quando il file viene riscritto
    if any(a["symbol"] == symbol and a["side"] == side and a["price"] == price for a in alerts):
        raise AlertError("Questo avviso c'è già.")
    if len(alerts) >= MAX_ALERTS:
        raise AlertError(f"Al massimo {MAX_ALERTS} avvisi attivi: toglierne qualcuno prima.")
    alerts.append({"id": secrets.token_hex(4), "symbol": symbol, "side": side, "price": price, "created_at": now or _now()})
    cfg["price_alerts"] = alerts
    return f"Avviso aggiunto: {symbol.replace('USDT', '')} {'≥' if side == 'above' else '≤'} {_fmt(price)} (messaggio su Telegram, una volta)."


def remove(cfg, alert_id, alerts_state=None):
    alerts = active(cfg, alerts_state)
    left = [a for a in alerts if a["id"] != alert_id]
    if len(left) == len(alerts):
        raise AlertError("Avviso non trovato (forse è già scattato).")
    cfg["price_alerts"] = left
    return "Avviso tolto."


def clear(cfg):
    n = len(cfg.get("price_alerts", []))
    cfg["price_alerts"] = []
    return f"Tolti tutti gli avvisi ({n})." if n else "Non c'erano avvisi."


def fetch_minutes(symbol):
    """Candele da 1 minuto di Bitget (spot): [(ts_ms, high, low)], le più recenti ~16 ore."""
    r = requests.get("https://api.bitget.com/api/v2/spot/market/candles",
                     params={"symbol": symbol, "granularity": "1min", "limit": 1000}, timeout=10)
    r.raise_for_status()
    return [(int(c[0]), float(c[2]), float(c[3])) for c in r.json()["data"]]


def check(cfg, alerts_state, notify, fetch=fetch_minutes):
    """Manda gli avvisi toccati e li segna come scattati. Ritorna quanti sono scattati."""
    alerts = active(cfg, alerts_state)
    if not alerts:
        return 0
    fired = list(alerts_state.get(FIRED_KEY, []))
    candles, n = {}, 0
    for a in alerts:
        sym = a["symbol"]
        if sym not in candles:
            try:
                candles[sym] = fetch(sym)
            except Exception as e:
                print(f"Avvisi di prezzo: candele {sym} non lette ({e})")
                candles[sym] = []
        try:
            since = datetime.fromisoformat(a["created_at"]).timestamp() * 1000
        except (KeyError, ValueError):
            since = 0
        # dal minuto in cui è stato creato
        seen = [c for c in candles[sym] if c[0] + 60_000 > since]
        if not seen:
            continue
        hit = max(c[1] for c in seen) >= a["price"] if a["side"] == "above" else min(c[2] for c in seen) <= a["price"]
        if not hit:
            continue
        name = sym.replace("USDT", "")
        try:
            sent = notify(f"🔔 AVVISO PREZZO\n{name} ha toccato {_fmt(a['price'])} ({'in salita' if a['side'] == 'above' else 'in discesa'}).\nNessun ordine: è solo un avviso.")
        except Exception as e:
            print(f"Avviso di prezzo non inviato: {e}")
            sent = False
        if sent is False:       # Telegram non raggiunto: si riprova al giro dopo
            continue
        fired.append(a["id"])
        n += 1
        import events
        events.record("avvisi", "scattato", f"Avviso di prezzo: {name} ha toccato {_fmt(a['price'])} ({'in salita' if a['side'] == 'above' else 'in discesa'}).",
                      symbol=sym, price=a["price"])
    if n:
        alerts_state[FIRED_KEY] = fired[-FIRED_MAX:]
    return n
