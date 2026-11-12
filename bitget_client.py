"""Client Bitget per i futures USDT (API v2): solo quello che serve all'esecutore.

Le chiavi arrivano SOLO da variabili d'ambiente (segreti di GitHub Actions), mai da file del repository:
  BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE
  BITGET_DEMO=1   usa il conto demo di Bitget (header "paptrading: 1"): da usare per la prima prova

Raccomandazioni per la chiave API (da creare su Bitget):
- permessi: solo "Futures: Trade" (o "Contract: Orders/Positions"); MAI prelievi;
- limitata agli indirizzi IP, se possibile (GitHub Actions però usa IP variabili);
- su un sotto-conto dedicato con solo il capitale di prova.

Firma (documentazione Bitget): base64(HMAC_SHA256(secret, timestamp + METODO + percorso + ?query + corpo)).

ATTENZIONE: questo client non è stato provato contro Bitget dal vivo (dal sandbox di sviluppo Bitget
non è raggiungibile). Prima di usarlo con soldi veri va provato sul conto demo.
"""
import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from urllib.parse import urlencode

import requests

BASE_URL = "https://api.bitget.com"
PRODUCT_TYPE = "USDT-FUTURES"
MARGIN_COIN = "USDT"


class BitgetError(RuntimeError):
    pass


def sign(secret, timestamp, method, path, query="", body=""):
    """Firma di una richiesta privata. query senza "?", body come stringa JSON (vuota per GET)."""
    prehash = f"{timestamp}{method.upper()}{path}{('?' + query) if query else ''}{body}"
    return base64.b64encode(hmac.new(secret.encode(), prehash.encode(), hashlib.sha256).digest()).decode()


def round_down(value, places):
    """Arrotonda per difetto a `places` decimali (mai sopra la size calcolata)."""
    factor = 10 ** int(places)
    return int(value * factor) / factor


class BitgetClient:
    def __init__(self, key, secret, passphrase, demo=False, session=None, clock=time.time):
        if not (key and secret and passphrase):
            raise BitgetError("Chiavi Bitget mancanti")
        self.key, self.secret, self.passphrase, self.demo = key, secret, passphrase, demo
        self.session = session or requests.Session()
        self.clock = clock

    @classmethod
    def from_env(cls):
        return cls(os.environ.get("BITGET_API_KEY"), os.environ.get("BITGET_API_SECRET"),
                   os.environ.get("BITGET_API_PASSPHRASE"), demo=os.environ.get("BITGET_DEMO", "0") == "1")

    def _request(self, method, path, params=None, body=None):
        query = urlencode(sorted((params or {}).items()))
        payload = json.dumps(body, separators=(",", ":")) if body is not None else ""
        ts = str(int(self.clock() * 1000))
        headers = {
            "ACCESS-KEY": self.key,
            "ACCESS-SIGN": sign(self.secret, ts, method, path, query, payload),
            "ACCESS-TIMESTAMP": ts,
            "ACCESS-PASSPHRASE": self.passphrase,
            "Content-Type": "application/json",
            "locale": "en-US",
        }
        if self.demo:
            headers["paptrading"] = "1"
        url = BASE_URL + path + (("?" + query) if query else "")
        r = self.session.request(method, url, headers=headers, data=payload or None, timeout=15)
        try:
            data = r.json()
        except ValueError:
            raise BitgetError(f"{method} {path}: risposta non JSON (HTTP {r.status_code})") from None
        if r.status_code != 200 or str(data.get("code")) != "00000":
            raise BitgetError(f"{method} {path}: {data.get('code')} {data.get('msg')}")
        return data.get("data")

    # ---------- conto ----------
    def equity(self):
        """Patrimonio del conto futures in USDT (margine + profitti/perdite non realizzati)."""
        rows = self._request("GET", "/api/v2/mix/account/accounts", {"productType": PRODUCT_TYPE})
        for row in rows or []:
            if row.get("marginCoin") == MARGIN_COIN:
                return float(row.get("accountEquity") or row.get("usdtEquity") or 0)
        raise BitgetError("Conto USDT-FUTURES non trovato")

    def spot_balances(self):
        """Saldi del conto spot (sola lettura): {coin: quantità totale, compresa quella bloccata in ordini}."""
        rows = self._request("GET", "/api/v2/spot/account/assets")
        out = {}
        for row in rows or []:
            qty = sum(float(row.get(k) or 0) for k in ("available", "frozen", "locked"))
            if qty > 0:
                out[row.get("coin", "").upper()] = qty
        return out

    def all_balances_usdt(self):
        """Valore in USDT di ogni conto (spot, futures, funding, earn, bot, margin...), sola lettura.
        Endpoint /api/v2/account/all-account-balance: {tipo di conto: USDT}."""
        rows = self._request("GET", "/api/v2/account/all-account-balance")
        out = {}
        for row in rows or []:
            kind = str(row.get("accountType") or "").lower()
            try:
                out[kind] = float(row.get("usdtBalance") or 0)
            except (TypeError, ValueError):
                continue
        return out

    def spot_price_usdt(self, coin):
        """Prezzo pubblico in USDT (nessuna firma). None se la coppia non esiste."""
        if coin in ("USDT", "USDC"):
            return 1.0
        try:
            r = self.session.get(f"{BASE_URL}/api/v2/spot/market/tickers", params={"symbol": f"{coin}USDT"}, timeout=10)
            data = r.json().get("data") or []
            return float(data[0]["lastPr"]) if data else None
        except Exception:
            return None

    # ---------- spot (ordini veri: solo dopo conferma nell'app, controlli in position_cmd.py) ----------
    def spot_symbol(self, symbol):
        """Regole della coppia spot (API pubblica): decimali di quantità e prezzo, minimi."""
        r = self.session.get(f"{BASE_URL}/api/v2/spot/public/symbols", params={"symbol": symbol}, timeout=10)
        d = (r.json().get("data") or [{}])[0]
        return {"qty_place": int(d.get("quantityPrecision") or 4), "price_place": int(d.get("pricePrecision") or 2),
                "min_qty": float(d.get("minTradeAmount") or 0), "min_usdt": float(d.get("minTradeUSDT") or 1)}

    def spot_available(self, coin):
        """Quantità disponibile (non bloccata in ordini) di una coin nello spot."""
        for row in self._request("GET", "/api/v2/spot/account/assets", {"coin": coin}) or []:
            if str(row.get("coin", "")).upper() == coin.upper():
                return float(row.get("available") or 0)
        return 0.0

    def spot_order(self, symbol, side, qty, limit_price, client_oid=None):
        """Ordine limite "esegui subito o annulla" (IOC): la quantità è sempre in coin e il prezzo ha un tetto
        (acquisto) o un minimo (vendita) vicino al mercato. Quello che non si esegue subito viene annullato."""
        body = {"symbol": symbol, "side": side, "orderType": "limit", "force": "ioc", "price": str(limit_price),
                "size": str(qty), "clientOid": client_oid or f"sgt{uuid.uuid4().hex[:24]}"}
        return self._request("POST", "/api/v2/spot/trade/place-order", body=body)

    def spot_fills_raw(self, symbol, limit=100):
        """Eseguiti spot (acquisti e vendite) di una coppia, così come arrivano (ultimi 90 giorni)."""
        data = self._request("GET", "/api/v2/spot/trade/fills", {"symbol": symbol, "limit": str(limit)}) or []
        return data.get("fillList") if isinstance(data, dict) else data

    def spot_plan_orders(self, symbol):
        """Ordini a scatto spot in attesa (stop e target delle coin): [{orderId, side, triggerPrice, size}]."""
        data = self._request("GET", "/api/v2/spot/trade/current-plan-order", {"symbol": symbol}) or {}
        rows = data.get("orderList") if isinstance(data, dict) else data
        return [{"orderId": r.get("orderId"), "side": r.get("side"), "price": float(r.get("triggerPrice") or 0),
                 "size": float(r.get("size") or 0)} for r in rows or [] if r.get("symbol", symbol) == symbol]

    def spot_plan_sell(self, symbol, trigger_price, qty, client_oid=None):
        """Vendita a mercato quando il prezzo tocca il livello (stop o target di una coin)."""
        body = {"symbol": symbol, "side": "sell", "triggerPrice": str(trigger_price), "orderType": "market", "planType": "amount",
                "size": str(qty), "triggerType": "fill_price", "clientOid": client_oid or f"sgt{uuid.uuid4().hex[:24]}"}
        return self._request("POST", "/api/v2/spot/trade/place-plan-order", body=body)

    def spot_cancel_plan(self, order_id):
        return self._request("POST", "/api/v2/spot/trade/cancel-plan-order", body={"orderId": str(order_id)})

    def pos_mode(self, symbol):
        """Modalità delle posizioni del conto futures: "one_way_mode" (una direzione per coin) o "hedge_mode"."""
        data = self._request("GET", "/api/v2/mix/account/account", {"symbol": symbol, "productType": PRODUCT_TYPE, "marginCoin": MARGIN_COIN}) or {}
        return (data[0] if isinstance(data, list) and data else data).get("posMode") or "hedge_mode"

    def setup_symbol(self, symbol, leverage, side=None):
        """Margine isolato e leva per la coin. Da chiamare prima di aprire (con il margine isolato in modalità
        hedge la leva va data per direzione: holdSide)."""
        base = {"symbol": symbol, "productType": PRODUCT_TYPE, "marginCoin": MARGIN_COIN}
        self._request("POST", "/api/v2/mix/account/set-margin-mode", body={**base, "marginMode": "isolated"})
        self._request("POST", "/api/v2/mix/account/set-leverage", body={**base, "leverage": str(int(leverage)), **({"holdSide": side} if side else {})})

    def positions(self):
        """Posizioni aperte: {symbol: {"side": "long"/"short", "size": contratti}}."""
        rows = self._request("GET", "/api/v2/mix/position/all-position", {"productType": PRODUCT_TYPE, "marginCoin": MARGIN_COIN})
        out = {}
        num = lambda v: float(v) if v not in (None, "") else None
        for row in rows or []:
            size = float(row.get("total") or 0)
            if size > 0:
                # side e size servono alla riconciliazione; il resto è solo da mostrare nell'app
                out[row["symbol"]] = {"side": row.get("holdSide"), "size": size,
                                      "entry": num(row.get("openPriceAvg")), "mark": num(row.get("markPrice")),
                                      "upl": num(row.get("unrealizedPL")), "leverage": num(row.get("leverage")),
                                      "margin": num(row.get("marginSize")), "liq": num(row.get("liquidationPrice"))}
        return out

    def history_raw(self, limit=30):
        """Posizioni chiuse (storico di Bitget, ultimi 90 giorni), righe così come arrivano."""
        data = self._request("GET", "/api/v2/mix/position/history-position", {"productType": PRODUCT_TYPE, "limit": str(limit)}) or {}
        return (data.get("list") if isinstance(data, dict) else data) or []

    def closed_positions(self, limit=30):
        """Posizioni chiuse per il Diario dell'app (sola lettura), dalla più recente:
        side, size, entry, exit, pnl lordo, fee (apertura + chiusura), funding, netto e orari (ms)."""
        num = lambda v: float(v) if v not in (None, "") else None
        out = []
        for r in self.history_raw(limit):
            open_fee, close_fee = num(r.get("openFee")) or 0.0, num(r.get("closeFee")) or 0.0
            out.append({
                "id": str(r.get("positionId") or f"{r.get('symbol')}-{r.get('ctime')}"),
                "symbol": r.get("symbol"), "side": r.get("holdSide"),
                "size": num(r.get("closeTotalPos")) or num(r.get("openTotalPos")),
                "entry": num(r.get("openAvgPrice")), "exit": num(r.get("closeAvgPrice")),
                "pnl": num(r.get("pnl")), "fees": round(abs(open_fee) + abs(close_fee), 6),
                "funding": num(r.get("totalFunding")), "net": num(r.get("netProfit")),
                "opened_at": int(r["ctime"]) if r.get("ctime") else None, "closed_at": int(r["utime"]) if r.get("utime") else None,
                "margin_mode": r.get("marginMode")})
        return out

    # ---------- ordini ----------
    def open_position(self, symbol, side, size, stop_price, client_oid=None, take_price=None, one_way=False):
        """Ordine a mercato con stop loss (ed eventuale take profit) già impostati sull'exchange: proteggono
        anche se il bot si ferma. In modalità unidirezionale Bitget non vuole "tradeSide"."""
        body = {
            "symbol": symbol, "productType": PRODUCT_TYPE, "marginMode": "isolated", "marginCoin": MARGIN_COIN,
            "size": str(size), "side": "buy" if side == "long" else "sell", "orderType": "market",
            "presetStopLossPrice": str(stop_price), "clientOid": client_oid or f"sgt{uuid.uuid4().hex[:24]}",
        }
        if not one_way:
            body["tradeSide"] = "open"
        if take_price:
            body["presetStopSurplusPrice"] = str(take_price)
        return self._request("POST", "/api/v2/mix/order/place-order", body=body)

    def close_position(self, symbol, side):
        """Chiusura a mercato di tutta la posizione di quella coin e direzione."""
        body = {"symbol": symbol, "productType": PRODUCT_TYPE, "holdSide": side}
        return self._request("POST", "/api/v2/mix/order/close-positions", body=body)


    # ---------- take profit / stop loss della posizione (ordini sull'exchange) ----------
    # Bitget v2: place-tpsl-order con planType pos_profit (TP) o pos_loss (SL) vale per tutta la posizione
    # e scatta anche se il bot e l'app sono fermi. Prima di impostarne uno nuovo si toglie quello vecchio
    # dello stesso tipo (orders-plan-pending + cancel-plan-order).
    def tpsl_orders(self, symbol=None):
        """Ordini TP/SL in attesa: {symbol: {"tp": {...}, "sl": {...}}} con orderId, triggerPrice, holdSide."""
        params = {"productType": PRODUCT_TYPE, "planType": "profit_loss"}
        if symbol:
            params["symbol"] = symbol
        data = self._request("GET", "/api/v2/mix/order/orders-plan-pending", params) or {}
        rows = data.get("entrustedList") if isinstance(data, dict) else data
        out = {}
        for row in rows or []:
            kind = {"pos_profit": "tp", "profit_plan": "tp", "pos_loss": "sl", "loss_plan": "sl"}.get(row.get("planType"))
            if not kind:
                continue
            out.setdefault(row.get("symbol"), {})[kind] = {
                "orderId": row.get("orderId"), "planType": row.get("planType"), "holdSide": row.get("posSide") or row.get("holdSide"),
                "price": float(row.get("triggerPrice") or 0)}
        return out

    def cancel_tpsl(self, symbol, order_id, plan_type):
        body = {"symbol": symbol, "productType": PRODUCT_TYPE, "marginCoin": MARGIN_COIN, "planType": plan_type,
                "orderIdList": [{"orderId": str(order_id)}]}
        return self._request("POST", "/api/v2/mix/order/cancel-plan-order", body=body)

    def set_tpsl(self, symbol, side, kind, price):
        """kind 'tp' o 'sl': toglie quello esistente dello stesso tipo e mette il nuovo, a mercato quando
        il prezzo mark arriva al livello."""
        current = (self.tpsl_orders(symbol).get(symbol) or {}).get(kind)
        if current and current.get("orderId"):
            self.cancel_tpsl(symbol, current["orderId"], current.get("planType") or ("pos_profit" if kind == "tp" else "pos_loss"))
        body = {"marginCoin": MARGIN_COIN, "productType": PRODUCT_TYPE, "symbol": symbol,
                "planType": "pos_profit" if kind == "tp" else "pos_loss", "triggerPrice": str(price),
                "triggerType": "mark_price", "executePrice": "0", "holdSide": side,
                "clientOid": f"sgt{uuid.uuid4().hex[:24]}"}
        return self._request("POST", "/api/v2/mix/order/place-tpsl-order", body=body)

    def cancel_all_tpsl(self, symbol, only=None):
        """Toglie TP e SL della posizione; only='tp' o 'sl' per toglierne uno solo."""
        done = 0
        for kind, o in (self.tpsl_orders(symbol).get(symbol) or {}).items():
            if only and kind != only:
                continue
            if o.get("orderId"):
                self.cancel_tpsl(symbol, o["orderId"], o.get("planType"))
                done += 1
        return done


class DryRunClient:
    """Stesse funzioni del client vero, ma non manda nulla a Bitget: registra cosa avrebbe fatto.
    È la modalità di partenza: l'esecutore gira davvero, gli ordini restano simulati."""

    def __init__(self, equity=1000.0):
        self._equity = float(equity)
        self._positions = {}
        self.calls = []

    def equity(self):
        return self._equity

    def setup_symbol(self, symbol, leverage, side=None):
        self.calls.append(("setup", symbol, leverage))

    def positions(self):
        return {s: dict(p) for s, p in self._positions.items()}

    def open_position(self, symbol, side, size, stop_price, client_oid=None, take_price=None, one_way=False):
        self.calls.append(("open", symbol, side, size, stop_price))
        self._positions[symbol] = {"side": side, "size": size}
        return {"orderId": f"dry-{len(self.calls)}"}

    def close_position(self, symbol, side):
        self.calls.append(("close", symbol, side))
        self._positions.pop(symbol, None)
        return {}
