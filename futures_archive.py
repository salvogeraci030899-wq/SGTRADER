"""Storico gratuito di funding, open interest e rapporto long/short dall'archivio pubblico di Binance
(data.binance.vision, futures USDT-M). Serve al laboratorio per provare strategie con questi dati
subito, senza aspettare mesi di raccolta dal bot (Bitget pubblica solo gli ultimi ~3 mesi).

Fonti (file zip con CSV, pubblici, senza chiavi):
- funding: data/futures/um/monthly/fundingRate/{SYM}/{SYM}-fundingRate-AAAA-MM.zip
- metriche ogni 5 minuti (open interest, long/short): data/futures/um/daily/metrics/{SYM}/{SYM}-metrics-AAAA-MM-GG.zip

Tutto viene ridotto a una riga al giorno in futures_archive/{SYM}_daily.csv (piccolo, salvato nel
repository). Ogni esecuzione scarica solo i giorni mancanti.

Nota: sono dati di Binance, non di Bitget. Funding e posizionamento dei trader si muovono in modo
molto simile tra i grandi exchange, ma non sono identici: i risultati vanno letti con questo limite.

    python futures_archive.py                     # aggiorna tutto
    python futures_archive.py --since 2025-09-01  # solo da una data (prova veloce)
"""
import argparse
import csv
import io
import os
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
import requests

BASE = "https://data.binance.vision/data/futures/um"
OUT_DIR = "futures_archive"
COINS = ("BTCUSDT", "ETHUSDT", "SOLUSDT")
FIRST_DAY = date(2020, 1, 1)
COLUMNS = ["date", "funding_pct", "oi_value", "ls_accounts", "taker_ratio"]
DAY = 86400


def path_for(symbol, out_dir=OUT_DIR):
    return os.path.join(out_dir, f"{symbol}_daily.csv")


def _get_zip_csv(url, session, tries=3):
    """Righe del CSV dentro lo zip (lista di dict), [] se il file non esiste, None se la rete fallisce."""
    for attempt in range(tries):
        try:
            r = session.get(url, timeout=30)
            if r.status_code == 404:
                return []
            r.raise_for_status()
            with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                text = z.read(z.namelist()[0]).decode()
            lines = [ln for ln in text.splitlines() if ln.strip()]
            if not lines:
                return []
            if not lines[0][0].isdigit():                          # con intestazione
                return list(csv.DictReader(lines))
            return [dict(enumerate(row)) for row in csv.reader(lines)]   # senza intestazione (file vecchi)
        except Exception:
            time.sleep(1 + 2 * attempt)
    return None


def _num(v):
    try:
        x = float(v)
        return x if np.isfinite(x) else None
    except (TypeError, ValueError):
        return None


def funding_month(symbol, year, month, session):
    """{giorno: somma dei funding del giorno in %} per un mese."""
    rows = _get_zip_csv(f"{BASE}/monthly/fundingRate/{symbol}/{symbol}-fundingRate-{year}-{month:02d}.zip", session)
    if rows is None:
        return None
    out = {}
    for r in rows:
        t = _num(r.get("calc_time", r.get(0)))
        rate = _num(r.get("last_funding_rate", r.get(2)))
        if t is None or rate is None:
            continue
        d = datetime.fromtimestamp(t / 1000, tz=timezone.utc).date()
        out[d] = out.get(d, 0.0) + rate * 100
    return out


def metrics_day(symbol, day, session):
    """Open interest (valore in USDT a fine giornata), quota long sui conti e rapporto acquisti/vendite
    aggressive (medie della giornata). None se la rete fallisce, {} se il file non esiste."""
    rows = _get_zip_csv(f"{BASE}/daily/metrics/{symbol}/{symbol}-metrics-{day:%Y-%m-%d}.zip", session)
    if rows is None:
        return None
    if not rows:
        return {}
    oi = [_num(r.get("sum_open_interest_value")) for r in rows]
    ls = [_num(r.get("count_long_short_ratio")) for r in rows]
    tk = [_num(r.get("sum_taker_long_short_vol_ratio")) for r in rows]
    last = lambda xs: next((x for x in reversed(xs) if x is not None), None)
    mean = lambda xs: (float(np.mean([x for x in xs if x is not None])) if any(x is not None for x in xs) else None)
    return {"oi_value": last(oi), "ls_accounts": mean(ls), "taker_ratio": mean(tk)}


def load(symbol, out_dir=OUT_DIR):
    p = path_for(symbol, out_dir)
    if not os.path.exists(p):
        return pd.DataFrame(columns=COLUMNS)
    return pd.read_csv(p)


def fill_funding(old, symbol, session, lookback_days=70):
    """Binance pubblica il file mensile del funding solo a mese concluso: i giorni recenti restano
    senza funding. Qui si riprovano i mesi con buchi negli ultimi giorni. Ritorna i valori riempiti."""
    if not len(old):
        return 0
    recent = old[pd.to_datetime(old["date"]) >= pd.Timestamp(datetime.now(timezone.utc).date() - timedelta(days=lookback_days))]
    holes = recent[recent["funding_pct"].isna()]
    filled = 0
    for y, m in sorted({(int(d[:4]), int(d[5:7])) for d in holes["date"]}):
        f = funding_month(symbol, y, m, session)
        for d, v in (f or {}).items():
            mask = (old["date"] == d.isoformat()) & old["funding_pct"].isna()
            if mask.any():
                old.loc[mask, "funding_pct"] = v
                filled += int(mask.sum())
    return filled


def update(symbol, since=FIRST_DAY, until=None, out_dir=OUT_DIR, session=None, workers=8):
    """Aggiunge i giorni mancanti fino a ieri e riempie il funding arrivato dopo.
    Ritorna il numero di giorni nuovi o completati."""
    session = session or requests.Session()
    until = until or (datetime.now(timezone.utc).date() - timedelta(days=1))
    old = load(symbol, out_dir)
    filled = fill_funding(old, symbol, session)
    known = set(old["date"]) if len(old) else set()
    days = [since + timedelta(days=i) for i in range((until - since).days + 1)]
    todo = [d for d in days if d.isoformat() not in known]
    if not todo:
        if filled:
            old.to_csv(path_for(symbol, out_dir), index=False, float_format="%.8g")
        return filled
    months = sorted({(d.year, d.month) for d in todo})
    funding = {}
    for y, m in months:
        f = funding_month(symbol, y, m, session)
        if f:
            funding.update(f)
    with ThreadPoolExecutor(workers) as pool:
        metrics = dict(zip(todo, pool.map(lambda d: metrics_day(symbol, d, session), todo)))
    rows = []
    for d in todo:
        m = metrics[d]
        if m is None:
            continue                                    # rete: si riprova alla prossima esecuzione
        if not m and d not in funding:
            continue                                    # giorno senza dati (prima dell'inizio dell'archivio)
        rows.append({"date": d.isoformat(), "funding_pct": funding.get(d), **{k: m.get(k) for k in COLUMNS[2:]}})
    if not rows:
        if filled:
            old.to_csv(path_for(symbol, out_dir), index=False, float_format="%.8g")
        return filled
    df = pd.concat([old, pd.DataFrame(rows, columns=COLUMNS)], ignore_index=True)
    df = df.drop_duplicates("date", keep="last").sort_values("date").reset_index(drop=True)
    os.makedirs(out_dir, exist_ok=True)
    df.to_csv(path_for(symbol, out_dir), index=False, float_format="%.8g")
    return len(rows) + filled


# =========================
# CARATTERISTICHE PER IL LABORATORIO
# =========================
def daily_features(df):
    """Caratteristiche giornaliere derivate, ciascuna calcolata solo con i giorni fino a quello indicato."""
    d = df.copy()
    d["date"] = pd.to_datetime(d["date"])
    d = d.set_index("date").asfreq("D")
    out = pd.DataFrame(index=d.index)
    out["funding_7d"] = d["funding_pct"].rolling(7, min_periods=6).sum()
    # posizione del funding a 7 giorni rispetto all'ultimo anno: 0 = il più basso, 1 = il più alto
    out["funding_7d_rank"] = out["funding_7d"].rolling(365, min_periods=180).rank(pct=True)
    out["oi_chg_7d"] = d["oi_value"] / d["oi_value"].shift(7) - 1
    ls = d["ls_accounts"]
    out["ls_z_30"] = (ls - ls.rolling(30, min_periods=25).mean()) / ls.rolling(30, min_periods=25).std()
    return out


def align(features, candle_times, step):
    """Valori noti alla CHIUSURA di ogni candela: si usa l'ultimo giorno già concluso a quell'istante.
    features: DataFrame giornaliero (indice = giorno); candle_times: aperture delle candele in secondi."""
    day_end = np.array([int(ts.timestamp()) + DAY for ts in features.index.tz_localize("UTC")]) if features.index.tz is None \
        else np.array([int(ts.timestamp()) + DAY for ts in features.index])
    closes = np.asarray(candle_times) + step
    idx = np.searchsorted(day_end, closes, side="right") - 1
    out = {}
    for col in features.columns:
        vals = features[col].to_numpy(dtype=float)
        out[col] = np.where(idx >= 0, vals[np.clip(idx, 0, len(vals) - 1)], np.nan)
    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", default=FIRST_DAY.isoformat())
    args = parser.parse_args()
    since = datetime.strptime(args.since, "%Y-%m-%d").date()
    for s in COINS:
        n = update(s, since)
        df = load(s)
        print(f"{s}: {n} giorni nuovi, {len(df)} in archivio" + (f" dal {df['date'].iloc[0]} al {df['date'].iloc[-1]}" if len(df) else ""))
