"""Validazione storica di Kronos: walk-forward, fuori campione, al netto dei costi.

Ripercorre lo storico candela per candela come farebbe il bot: a ogni punto dà al modello solo
le candele già chiuse in quel momento, salva la previsione e accanto le candele uscite davvero.
Usa le stesse funzioni del bot live (kronos_core.py), quindi misura la strategia in produzione.

    python validation.py run --symbol BTCUSDT --tf 4h     # calcola (riprende da dove era rimasto)
    python validation.py analyze                           # statistiche -> validation_summary.json

Regole:
- fuori campione: valgono solo le previsioni successive alla data in cui i pesi del modello sono
  stati pubblicati su Hugging Face (prima di quella data il modello potrebbe aver visto i prezzi);
- stesso contesto del bot: stesso numero di candele che il bot riceve oggi da Bitget;
- i punti vengono calcolati a passate sempre più fitte e in ordine sparso, così anche un calcolo
  interrotto copre tutto il periodo in modo uniforme e non solo gli ultimi mesi;
- le righe già calcolate non si ricalcolano: ogni esecuzione aggiunge e basta.
"""
import argparse
import hashlib
import json
import os
import time
from datetime import datetime, timezone

import pandas as pd
import requests

import validation_stats as vs
from kronos_core import (
    ALL_ASSETS, ALL_TIMEFRAMES, LOOKBACK, PRED_LEN, ATR_PERIOD, MIN_PRICE, MODEL_NAME, TF_DELTA,
    BITGET_CANDLES_URL, _TF_MAP, _MODEL_REPO, _TOKENIZER_REPO,
    get_historical_data, klines_to_df, compute_atr, load_predictor, generate_monte_carlo_forecast,
)

OUT_DIR = "validation"
SUMMARY_PATH = "validation_summary.json"
REPORT_PATH = os.path.join(OUT_DIR, "REPORT.md")
BITGET_HISTORY_URL = "https://api.bitget.com/api/v2/spot/market/history-candles"

# Passo più fitto tra due previsioni, in candele. Si parte da 4x questo passo, poi 2x, poi 1x.
# 1h: 7 = orizzonti che non si sovrappongono. 4h e 1d: più fitti perché le candele sono poche.
STRIDE = {"1d": 1, "4h": 2, "1h": 7}
MOMENTUM_LOOKBACK = vs.MOMENTUM_LOOKBACK


def predictions_path(symbol, tf):
    return os.path.join(OUT_DIR, f"predictions_{symbol}_{tf}.jsonl")


# =========================
# FUORI CAMPIONE
# =========================
def model_published_at():
    """Data (timestamp) dell'ultimo aggiornamento dei pesi di modello e tokenizer su Hugging Face."""
    from huggingface_hub import HfApi
    api, latest = HfApi(), None
    for repo in (_MODEL_REPO, _TOKENIZER_REPO):
        dates = [f.last_commit.date for f in api.list_repo_tree(repo, expand=True)
                 if getattr(f, "last_commit", None) and f.path.endswith((".safetensors", ".bin", ".pt"))]
        if not dates:
            raise RuntimeError(f"nessun file di pesi trovato in {repo}")
        latest = max([latest] + dates) if latest else max(dates)
    return int(latest.timestamp())


# =========================
# STORICO
# =========================
def _fetch(url, symbol, tf, end_ms, limit):
    r = requests.get(url, params={"symbol": symbol, "granularity": _TF_MAP[tf], "endTime": end_ms, "limit": limit}, timeout=20)
    r.raise_for_status()
    body = r.json()
    if str(body.get("code")) != "00000":
        raise RuntimeError(f"Bitget: {body.get('msg')}")
    return body.get("data") or []


def download_history(symbol, tf, start_ms, now_ms=None, pause=0.15):
    """Candele chiuse da start_ms a oggi, scaricate a pagine andando indietro nel tempo.
    Prova l'archivio storico di Bitget e, se una pagina fallisce, l'endpoint usato dal bot."""
    end = now_ms or int(time.time() * 1000)
    rows = {}
    while end > start_ms:
        data = None
        for url, limit in ((BITGET_HISTORY_URL, 200), (BITGET_CANDLES_URL, 1000)):
            for attempt in range(3):
                try:
                    data = _fetch(url, symbol, tf, end, limit)
                    break
                except Exception as e:
                    print(f"  download {symbol} {tf} fallito ({e}), riprovo...")
                    time.sleep(1 + attempt * 2)
            if data:
                break
        if not data:
            break
        new = 0
        for row in data:
            t = int(float(row[0]))
            if t not in rows:
                rows[t] = row
                new += 1
        oldest = min(int(float(row[0])) for row in data)
        if new == 0:
            break  # nessuna candela nuova: l'archivio è finito
        # Riparto dalla candela più vecchia ricevuta, non da un millisecondo prima: Bitget arrotonda
        # endTime alla candela e la esclude, quindi con "oldest - 1" si perdeva una candela per pagina.
        # Se invece la include, torna un doppione che viene scartato.
        end = oldest
        time.sleep(pause)
    min_price = MIN_PRICE.get(symbol, 0)
    klines = [list(r[:6]) + [0, 0] for r in rows.values() if float(r[4]) >= min_price]
    if not klines:
        return None
    return klines_to_df(klines, tf, closed_only=True)


def live_context_len(symbol, tf):
    """Quante candele chiuse usa oggi il bot come contesto (Bitget ne restituisce meno di LOOKBACK su alcuni timeframe)."""
    klines = get_historical_data(symbol, tf)
    if not klines:
        return LOOKBACK
    return min(LOOKBACK, len(klines_to_df(klines, tf, closed_only=True)))


# =========================
# PUNTI DA CALCOLARE
# =========================
def candidate_points(df, tf, context_len, oos_start, stride):
    """Indici delle candele su cui fare una previsione, nell'ordine in cui calcolarle.
    Una candela vale se: è successiva a oos_start, ha context_len candele prima e PRED_LEN dopo
    senza buchi, e cade sulla griglia del passo (ancorata al tempo, uguale a ogni esecuzione)."""
    step = int(TF_DELTA[tf].total_seconds())
    times = [int(t.timestamp()) for t in df["time"]]
    need_before = max(context_len - 1, MOMENTUM_LOOKBACK)
    points = []
    for i in range(need_before, len(times) - PRED_LEN):
        t = times[i]
        k = t // step
        if t < oos_start or k % stride != 0:
            continue
        if times[i + PRED_LEN] - times[i - need_before] != (need_before + PRED_LEN) * step:
            continue  # manca qualche candela nel contesto o nell'orizzonte
        level = 0 if k % (stride * 4) == 0 else 1 if k % (stride * 2) == 0 else 2
        order = hashlib.sha256(f"{tf}_{t}".encode()).hexdigest()
        points.append((level, order, i))
    return [i for _, _, i in sorted(points)]



def load_rows(path):
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def save_rows(rows, path):
    """Riscrive il file ordinato per data (differenze git pulite)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        for r in sorted(rows, key=lambda r: r["candle_time"]):
            f.write(json.dumps(r, separators=(",", ":")) + "\n")
    os.replace(tmp, path)


def make_row(predictor, df, i, symbol, tf, context_len, n_samples, oos_start):
    context = df.iloc[i - context_len + 1: i + 1].copy()
    forecast, band_upper, band_lower, prob_up = generate_monte_carlo_forecast(predictor, context, tf, n_samples)
    r6 = lambda v: round(float(v), 6)
    candle_time = int(df["time"].iloc[i].timestamp())
    return {
        "id": f"{symbol}_{tf}_{candle_time}", "symbol": symbol, "tf": tf, "candle_time": candle_time,
        "ref_close": r6(df["close"].iloc[i]), "prob_up": prob_up, "atr": r6(compute_atr(context)),
        "forecast": [r6(f["close"]) for f in forecast],
        "p10": [r6(b["value"]) for b in band_lower], "p90": [r6(b["value"]) for b in band_upper],
        "past_close": r6(df["close"].iloc[i - MOMENTUM_LOOKBACK]),
        "horizon": [[r6(df[c].iloc[j]) for c in ("open", "high", "low", "close")] for j in range(i + 1, i + 1 + PRED_LEN)],
        "context_len": context_len, "n_samples": n_samples, "model": MODEL_NAME, "oos_start": oos_start,
        "computed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def run(symbol, tf, n_samples, max_minutes, max_points, oos_start=None, predictor=None):
    deadline = time.time() + max_minutes * 60 if max_minutes else None
    oos_start = oos_start or model_published_at()
    print(f"Fuori campione dal {datetime.fromtimestamp(oos_start, tz=timezone.utc):%d/%m/%Y} (pesi del modello pubblicati)")

    context_len = live_context_len(symbol, tf)
    if context_len < ATR_PERIOD + 50:
        raise SystemExit(f"Contesto troppo corto ({context_len} candele): Bitget non risponde correttamente.")
    step_ms = int(TF_DELTA[tf].total_seconds()) * 1000
    df = download_history(symbol, tf, oos_start * 1000 - (context_len + 5) * step_ms)
    if df is None or df.empty:
        raise SystemExit("Storico non scaricabile da Bitget.")
    print(f"{symbol} {tf}: {len(df)} candele chiuse dal {df['time'].iloc[0]:%d/%m/%Y} al {df['time'].iloc[-1]:%d/%m/%Y}, "
          f"contesto {context_len} candele (come il bot)")

    path = predictions_path(symbol, tf)
    rows = load_rows(path)
    done = {r["id"] for r in rows}
    points = candidate_points(df, tf, context_len, oos_start, STRIDE[tf])
    todo = [i for i in points if f"{symbol}_{tf}_{int(df['time'].iloc[i].timestamp())}" not in done]
    missing = len(todo)
    if max_points:
        todo = todo[:max_points]
    print(f"Punti validi: {len(points)}, ancora da calcolare: {missing}, in questa esecuzione: {len(todo)}")
    if not todo:
        return rows

    predictor = predictor or load_predictor()
    os.makedirs(OUT_DIR, exist_ok=True)
    started, computed = time.time(), 0
    with open(path, "a") as f:
        for i in todo:
            if deadline and time.time() > deadline:
                print(f"Tempo massimo raggiunto dopo {computed}/{len(todo)} previsioni: mi fermo e salvo.")
                break
            row = make_row(predictor, df, i, symbol, tf, context_len, n_samples, oos_start)
            f.write(json.dumps(row, separators=(",", ":")) + "\n")
            f.flush()
            rows.append(row)
            computed += 1
            if computed % 10 == 0 or computed == len(todo):
                rate = (time.time() - started) / computed
                print(f"  {computed}/{len(todo)} previsioni, {rate:.1f} s l'una")
    save_rows(rows, path)
    return rows


def analyze(out_dir=OUT_DIR, summary_path=SUMMARY_PATH, report_path=REPORT_PATH):
    rows = []
    for symbol in ALL_ASSETS:
        for tf in ALL_TIMEFRAMES:
            rows += load_rows(os.path.join(out_dir, f"predictions_{symbol}_{tf}.jsonl"))
    if not rows:
        print("Nessuna previsione da analizzare.")
        return None
    summary = vs.build_summary(rows)
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=1)
    report = vs.to_markdown(summary)
    os.makedirs(os.path.dirname(os.path.abspath(report_path)), exist_ok=True)
    with open(report_path, "w") as f:
        f.write(report)
    print(report)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_run = sub.add_parser("run")
    p_run.add_argument("--symbol", required=True, choices=ALL_ASSETS)
    p_run.add_argument("--tf", required=True, choices=ALL_TIMEFRAMES)
    p_run.add_argument("--n-samples", type=int, default=50, help="campioni Monte Carlo (il bot live ne usa 50)")
    p_run.add_argument("--max-minutes", type=float, default=320, help="si ferma e salva dopo questi minuti (0 = nessun limite)")
    p_run.add_argument("--max-points", type=int, default=0, help="numero massimo di previsioni in questa esecuzione (0 = tutte)")
    sub.add_parser("analyze")
    args = parser.parse_args()
    if args.cmd == "run":
        run(args.symbol, args.tf, args.n_samples, args.max_minutes, args.max_points)
    else:
        analyze()
