"""Dati pubblici dei futures Bitget (USDT perpetui) per BTC, ETH e SOL.

Per ora sono solo raccolti e mostrati: NON entrano ancora nei segnali. Servono a costruire uno
storico (funding, open interest, rapporto long/short, premio mark-indice) con cui, più avanti,
verificare sui dati se queste informazioni migliorano davvero le previsioni.

- futures_data.json: ultima fotografia per coin, letta dall'app (Grafici -> slide "Futures");
- futures_history.jsonl: una riga per coin per ora, mai riscritta (solo aggiunte).

Ogni dato è indipendente: se una chiamata fallisce quel campo resta vuoto, gli altri si salvano.
Un errore qui non deve mai fermare il bot.

    python futures_data.py --check     # prova le chiamate vere e stampa cosa risponde Bitget
"""
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone

import requests

from kronos_core import ALL_ASSETS

BASE_URL = "https://api.bitget.com"
PRODUCT_TYPE = "USDT-FUTURES"
SNAPSHOT_PATH = "futures_data.json"
HISTORY_PATH = "futures_history.jsonl"
HOUR = 3600

# Rapporto long/short: due misure diverse, salvate separate (mai mescolate nello stesso campo).
# "conti" = quota di conti con posizione long; "posizioni" = quota del valore delle posizioni long.
# (campo salvato, percorso, campo long, campo short)
LONG_SHORT_SOURCES = [
    ("long_accounts_pct", "/api/v2/mix/market/account-long-short", "longAccountRatio", "shortAccountRatio"),
    ("long_positions_pct", "/api/v2/mix/market/position-long-short", "longPositionRatio", "shortPositionRatio"),
]
LONG_SHORT_PAUSE = 1.1  # questi endpoint accettano circa una chiamata al secondo


def _get(path, **params):
    r = requests.get(BASE_URL + path, params=params, timeout=10)
    r.raise_for_status()
    body = r.json()
    if str(body.get("code")) != "00000":
        raise RuntimeError(f"Bitget: {body.get('msg')}")
    return body.get("data")


def _num(value):
    try:
        v = float(value)
        return v if v == v else None
    except (TypeError, ValueError):
        return None


def _first(data):
    return data[0] if isinstance(data, list) and data else data if isinstance(data, dict) else {}


def fetch_snapshot(symbol, get=None, pause=LONG_SHORT_PAUSE):
    """Fotografia dei futures di una coin. I campi non ottenuti restano None; gli errori finiscono in 'errors'."""
    get = get or _get
    snap = {"symbol": symbol, "last": None, "mark": None, "index": None, "premium_pct": None,
            "funding_rate_pct": None, "funding_interval_h": None, "next_funding_ts": None,
            "open_interest": None, "open_interest_usd": None,
            "long_accounts_pct": None, "long_positions_pct": None, "errors": []}

    try:
        t = _first(get("/api/v2/mix/market/ticker", symbol=symbol, productType=PRODUCT_TYPE))
        snap["last"], snap["mark"], snap["index"] = _num(t.get("lastPr")), _num(t.get("markPrice")), _num(t.get("indexPrice"))
        fr = _num(t.get("fundingRate"))
        snap["funding_rate_pct"] = None if fr is None else round(fr * 100, 6)
        snap["open_interest"] = _num(t.get("holdingAmount"))
    except Exception as e:
        snap["errors"].append(f"ticker: {e}")

    try:
        f = _first(get("/api/v2/mix/market/current-fund-rate", symbol=symbol, productType=PRODUCT_TYPE))
        fr = _num(f.get("fundingRate"))
        if fr is not None:
            snap["funding_rate_pct"] = round(fr * 100, 6)
        snap["funding_interval_h"] = _num(f.get("fundingRateInterval"))
        nxt = _num(f.get("nextUpdate"))
        snap["next_funding_ts"] = None if nxt is None else int(nxt / 1000)
    except Exception as e:
        snap["errors"].append(f"funding: {e}")

    if snap["open_interest"] is None:
        try:
            d = get("/api/v2/mix/market/open-interest", symbol=symbol, productType=PRODUCT_TYPE)
            snap["open_interest"] = _num(_first((d or {}).get("openInterestList")).get("size"))
        except Exception as e:
            snap["errors"].append(f"open interest: {e}")

    for field, path, long_key, short_key in LONG_SHORT_SOURCES:
        error = None
        for attempt in range(2):  # un secondo tentativo dopo la pausa: il limite di frequenza è stretto
            time.sleep(pause)
            try:
                rows = get(path, symbol=symbol, period="1h")
                rows = rows if isinstance(rows, list) else [rows]
                rows = [r for r in rows if isinstance(r, dict) and _num(r.get(long_key)) is not None and _num(r.get(short_key)) is not None]
                if not rows:
                    raise RuntimeError("risposta senza dati")
                last = max(rows, key=lambda r: _num(r.get("ts")) or 0)
                lo, sh = _num(last[long_key]), _num(last[short_key])
                if lo + sh <= 0:
                    raise RuntimeError("valori nulli")
                snap[field] = round(lo / (lo + sh) * 100, 2)
                error = None
                break
            except Exception as e:
                error = f"{field}: {e}"
        if error:
            snap["errors"].append(error)

    if snap["mark"] and snap["index"]:
        snap["premium_pct"] = round((snap["mark"] - snap["index"]) / snap["index"] * 100, 4)
    if snap["open_interest"] is not None and snap["mark"]:
        snap["open_interest_usd"] = round(snap["open_interest"] * snap["mark"], 0)
    return snap


# =========================
# STORICO
# =========================
def load_history(path=HISTORY_PATH):
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def history_row(snap, hour_ts):
    return {"t": hour_ts, "symbol": snap["symbol"], "mark": snap["mark"], "index": snap["index"],
            "funding_rate_pct": snap["funding_rate_pct"], "open_interest": snap["open_interest"],
            "long_accounts_pct": snap["long_accounts_pct"], "long_positions_pct": snap["long_positions_pct"]}


def oi_change_pct(history, symbol, hour_ts, hours=24):
    """Variazione % dell'open interest rispetto a ~24 ore prima (None se manca la riga di confronto)."""
    now = next((r for r in history if r["symbol"] == symbol and r["t"] == hour_ts), None)
    past = [r for r in history if r["symbol"] == symbol and abs(r["t"] - (hour_ts - hours * HOUR)) <= HOUR and r.get("open_interest")]
    if not now or not now.get("open_interest") or not past:
        return None
    ref = min(past, key=lambda r: abs(r["t"] - (hour_ts - hours * HOUR)))
    return round((now["open_interest"] / ref["open_interest"] - 1) * 100, 2)


def _write_atomic(path, text):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(text)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def collect(now_ts=None, get=None, snapshot_path=SNAPSHOT_PATH, history_path=HISTORY_PATH, pause=LONG_SHORT_PAUSE):
    """Una volta per ora: scarica la fotografia di ogni coin, aggiunge le righe allo storico e
    riscrive futures_data.json. Ritorna True se ha scritto qualcosa (quindi serve un commit)."""
    now_ts = int(now_ts or time.time())
    hour_ts = now_ts // HOUR * HOUR
    history = load_history(history_path)
    done = {r["symbol"] for r in history if r["t"] == hour_ts}
    if all(s in done for s in ALL_ASSETS):
        return False

    snapshots, new_rows = {}, []
    for symbol in ALL_ASSETS:
        if symbol in done:
            continue
        snap = fetch_snapshot(symbol, get, pause)
        for err in snap["errors"]:
            print(f"Futures {symbol}: {err}")
        if snap["mark"] is None and snap["funding_rate_pct"] is None and snap["open_interest"] is None:
            continue  # nessun dato utile: non registro una riga vuota, si riprova al prossimo giro
        snapshots[symbol] = snap
        new_rows.append(history_row(snap, hour_ts))
    if not new_rows:
        return False

    history += new_rows
    with open(history_path, "a") as f:
        for row in new_rows:
            f.write(json.dumps(row, separators=(",", ":")) + "\n")

    previous = {}
    if os.path.exists(snapshot_path):
        try:
            with open(snapshot_path) as f:
                previous = json.load(f).get("symbols", {})
        except Exception:
            previous = {}
    for symbol, snap in snapshots.items():
        snap["t"] = now_ts
        snap["open_interest_change_24h_pct"] = oi_change_pct(history, symbol, hour_ts)
        del snap["errors"]
        previous[symbol] = snap
    payload = {"updated_at": datetime.fromtimestamp(now_ts, tz=timezone.utc).isoformat(timespec="seconds"),
               "product_type": PRODUCT_TYPE, "symbols": previous}
    _write_atomic(snapshot_path, json.dumps(payload, indent=1))
    print(f"Futures: {len(new_rows)} righe aggiunte allo storico.")
    return True


if __name__ == "__main__":
    # Prova con Bitget vero: stampa la fotografia di ogni coin. Fallisce se mancano i dati essenziali.
    ok = True
    for sym in ALL_ASSETS:
        s = fetch_snapshot(sym)
        print(json.dumps(s, indent=1))
        if s["mark"] is None or s["funding_rate_pct"] is None or s["open_interest"] is None:
            ok = False
    if "--check" in sys.argv and not ok:
        sys.exit("Dati essenziali mancanti (prezzo mark, funding o open interest).")
