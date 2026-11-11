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
            raise BitgetError(f"{method} {path}: risposta non JSON (HTTP {r.status_code})")
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

    def setup_symbol(self, symbol, leverage):
        """Margine isolato e leva per la coin. Da chiamare prima di aprire."""
        base = {"symbol": symbol, "productType": PRODUCT_TYPE, "marginCoin": MARGIN_COIN}
        self._request("POST", "/api/v2/mix/account/set-margin-mode", body={**base, "marginMode": "isolated"})
        self._request("POST", "/api/v2/mix/account/set-leverage", body={**base, "leverage": str(int(leverage))})

    def positions(self):
        """Posizioni aperte: {symbol: {"side": "long"/"short", "size": contratti}}."""
        rows = self._request("GET", "/api/v2/mix/position/all-position", {"productType": PRODUCT_TYPE, "marginCoin": MARGIN_COIN})
        out = {}
        for row in rows or []:
            size = float(row.get("total") or 0)
            if size > 0:
                out[row["symbol"]] = {"side": row.get("holdSide"), "size": size}
        return out

    # ---------- ordini ----------
    def open_position(self, symbol, side, size, stop_price, client_oid=None):
        """Ordine a mercato con stop loss già impostato sull'exchange (protegge anche se il bot si ferma)."""
        body = {
            "symbol": symbol, "productType": PRODUCT_TYPE, "marginMode": "isolated", "marginCoin": MARGIN_COIN,
            "size": str(size), "side": "buy" if side == "long" else "sell", "tradeSide": "open", "orderType": "market",
            "presetStopLossPrice": str(stop_price), "clientOid": client_oid or f"sgt{uuid.uuid4().hex[:24]}",
        }
        return self._request("POST", "/api/v2/mix/order/place-order", body=body)

    def close_position(self, symbol, side):
        """Chiusura a mercato di tutta la posizione di quella coin e direzione."""
        body = {"symbol": symbol, "productType": PRODUCT_TYPE, "holdSide": side}
        return self._request("POST", "/api/v2/mix/order/close-positions", body=body)


class DryRunClient:
    """Stesse funzioni del client vero, ma non manda nulla a Bitget: registra cosa avrebbe fatto.
    È la modalità di partenza: l'esecutore gira davvero, gli ordini restano simulati."""

    def __init__(self, equity=1000.0):
        self._equity = float(equity)
        self._positions = {}
        self.calls = []

    def equity(self):
        return self._equity

    def setup_symbol(self, symbol, leverage):
        self.calls.append(("setup", symbol, leverage))

    def positions(self):
        return {s: dict(p) for s, p in self._positions.items()}

    def open_position(self, symbol, side, size, stop_price, client_oid=None):
        self.calls.append(("open", symbol, side, size, stop_price))
        self._positions[symbol] = {"side": side, "size": size}
        return {"orderId": f"dry-{len(self.calls)}"}

    def close_position(self, symbol, side):
        self.calls.append(("close", symbol, side))
        self._positions.pop(symbol, None)
        return {}
