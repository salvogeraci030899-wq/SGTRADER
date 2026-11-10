"""Logica condivisa tra run_bot.py (live) e backtest.py.

Un solo posto per: parametri della strategia, download candele Bitget, ATR,
piano operativo e previsione Monte Carlo con Kronos. In questo modo il backtest
misura esattamente la strategia che gira in produzione.
"""
import os

import numpy as np
import pandas as pd
import requests

# =========================
# PARAMETRI STRATEGIA
# =========================
PRED_LEN = 7
LOOKBACK = 400

# Soglie segnale (probabilità di rialzo, in %)
LONG_THRESHOLD = 80
SHORT_THRESHOLD = 20

# Piano operativo basato su ATR
ATR_PERIOD = 14
ATR_MULT = float(os.environ.get("ATR_MULT", "1.5"))  # stop = ATR_MULT x ATR del timeframe
RR_MAX = 3.0   # il target del modello non supera RR_MAX x il rischio
MIN_RR = float(os.environ.get("MIN_RR", "1.5"))  # sotto questo R/R il segnale non è operativo

# Costi per trade usati da backtest e track record (in %, applicati a ingresso e uscita)
FEE_PCT = 0.1        # commissione exchange per lato
SLIPPAGE_PCT = 0.05  # slippage stimato per lato
TAX_RATE = 0.33      # tassa sulle plusvalenze, applicata ai trade in utile (stima prudente)

ALL_ASSETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
ALL_TIMEFRAMES = ["1d", "4h", "1h"]
TF_DELTA = {"1d": pd.Timedelta(days=1), "4h": pd.Timedelta(hours=4), "1h": pd.Timedelta(hours=1)}

BITGET_CANDLES_URL = "https://api.bitget.com/api/v2/spot/market/candles"
_TF_MAP = {"1d": "1day", "4h": "4h", "1h": "1h"}
_FREQ_MAP = {"1d": "D", "4h": "4h", "1h": "1h"}

# Scarta candele con prezzi palesemente errati (glitch dell'API)
MIN_PRICE = {"BTCUSDT": 1000, "ETHUSDT": 100, "SOLUSDT": 10}

MODEL_NAME = "Kronos-small"
_MODEL_REPO = "NeoQuasar/Kronos-small"
_TOKENIZER_REPO = "NeoQuasar/Kronos-Tokenizer-base"


def signal_from_prob(prob_up):
    if prob_up >= LONG_THRESHOLD:
        return "LONG"
    if prob_up <= SHORT_THRESHOLD:
        return "SHORT"
    return "NEUTRO"


# =========================
# DATI
# =========================
def get_historical_data(symbol, interval, limit=500, end_time=None):
    """Candele Bitget in ordine cronologico (lista di righe grezze), None se la chiamata fallisce."""
    params = {"symbol": symbol, "granularity": _TF_MAP.get(interval, "1day"), "limit": limit}
    if end_time:
        params["endTime"] = end_time
    try:
        r = requests.get(BITGET_CANDLES_URL, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()["data"][::-1]
        min_price = MIN_PRICE.get(symbol, 0)
        return [row for row in data if float(row[4]) >= min_price]
    except Exception as e:
        print(f"Errore API Bitget {symbol} {interval}: {e}")
        return None


def klines_to_df(klines, tf=None, closed_only=False):
    """Righe grezze Bitget -> DataFrame ordinato. Con closed_only tiene solo le candele CHIUSE."""
    df = pd.DataFrame(klines, columns=['time', 'open', 'high', 'low', 'close', 'volume', 'qav', 'usdt_vol'])
    df['time'] = pd.to_datetime(df['time'].astype(float), unit='ms', utc=True)
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = df[col].astype(float)
    df = df.drop_duplicates(subset=['time']).sort_values('time').reset_index(drop=True)
    if closed_only:
        # time = apertura della candela
        df = df[df['time'] + TF_DELTA[tf] <= pd.Timestamp.now(tz='UTC')].reset_index(drop=True)
    return df


def compute_atr(df, period=ATR_PERIOD):
    high, low, close = df['high'], df['low'], df['close']
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs()
    ], axis=1).max(axis=1)
    return float(tr.rolling(period).mean().iloc[-1])


# =========================
# PIANO OPERATIVO
# =========================
def build_trade_plan(price, atr, prob_up, forecast):
    """Stop = ATR_MULT x ATR. Target = estremo favorevole della traiettoria mediana prevista da Kronos
    (massimo per LONG, minimo per SHORT), limitato a RR_MAX x il rischio.
    Il segnale è operativo solo se R/R >= MIN_RR. Per i NEUTRO i livelli sono indicativi."""
    bias = signal_from_prob(prob_up)
    direction = "LONG" if prob_up >= 50 else "SHORT"
    risk = ATR_MULT * atr
    nd = 2 if price >= 10 else 4
    closes = [f["close"] for f in forecast] or [price]

    if direction == "LONG":
        stop = price - risk
        model_target = max(closes)
        reward = max(model_target - price, 0.0)
    else:
        stop = price + risk
        model_target = min(closes)
        reward = max(price - model_target, 0.0)

    reward = min(reward, RR_MAX * risk)
    rr = reward / risk if risk > 0 else 0.0
    take = price + reward if direction == "LONG" else price - reward

    return {
        "bias": bias,
        "direction": direction,
        "entry": round(price, nd),
        "stop_loss": round(stop, nd),
        "take_profit": round(take, nd),
        "risk_pct": round(risk / price * 100, 2),
        "reward_pct": round(reward / price * 100, 2),
        "rr": round(rr, 2),
        "atr": round(atr, nd),
        "model_target": round(model_target, nd),
        "tradeable": bool(bias != "NEUTRO" and rr >= MIN_RR),
        "min_rr": MIN_RR,
    }


# =========================
# MODELLO E PREVISIONE
# =========================
def load_predictor():
    """Carica Kronos. L'import è qui dentro così torch viene caricato solo quando serve davvero."""
    from model import Kronos, KronosTokenizer, KronosPredictor
    tokenizer = KronosTokenizer.from_pretrained(_TOKENIZER_REPO)
    model = Kronos.from_pretrained(_MODEL_REPO)
    return KronosPredictor(model=model, tokenizer=tokenizer, device="cpu", max_context=512)


def generate_monte_carlo_forecast(predictor, context_df, freq, n_samples, pred_len=PRED_LEN, return_paths=False):
    """Ritorna (forecast, band_upper, band_lower, prob_up). Deterministica a parità di contesto.
    Con return_paths aggiunge in coda tutte le traiettorie simulate (campioni x candele, chiusure)."""
    x_timestamp = pd.Series(context_df['time'].values, name='timestamps')
    start_date = context_df['time'].iloc[-1] + TF_DELTA[freq]
    y_dates = pd.date_range(start=start_date, periods=pred_len, freq=_FREQ_MAP[freq], tz='UTC')
    y_timestamp = pd.Series(y_dates, name='timestamps')
    forecast_input_df = context_df[['open', 'high', 'low', 'close', 'volume']].copy()
    last_close = float(context_df['close'].iloc[-1])

    seed = (int(context_df['time'].iloc[-1].timestamp()) + int(last_close * 100)) % (2 ** 31)
    np.random.seed(seed)
    try:
        import torch
        torch.manual_seed(seed)
    except Exception:
        pass

    paths = []
    for _ in range(n_samples):
        pred_df = predictor.predict(
            df=forecast_input_df, x_timestamp=x_timestamp, y_timestamp=y_timestamp,
            pred_len=pred_len, T=1.0, top_p=0.9, sample_count=1, verbose=False
        )
        paths.append(np.nan_to_num(pred_df['close'].values, nan=last_close))

    paths = np.array(paths)
    final_prices = paths[:, -1]
    prob_up = max(0.0, min(100.0, (np.sum(final_prices > last_close) / n_samples) * 100))

    median_path = np.median(paths, axis=0)
    p10_path = np.percentile(paths, 10, axis=0)
    p90_path = np.percentile(paths, 90, axis=0)

    forecast, band_upper, band_lower = [], [], []
    for i in range(pred_len):
        ts = int(y_timestamp.iloc[i].timestamp())
        close_val = float(median_path[i])
        if close_val <= 0 or np.isnan(close_val):
            close_val = last_close
        prev_close = last_close if i == 0 else float(median_path[i - 1])

        forecast.append({
            "time": ts, "open": prev_close, "high": max(close_val, prev_close) * 1.002,
            "low": min(close_val, prev_close) * 0.998, "close": close_val
        })
        p90 = float(p90_path[i]) if not np.isnan(p90_path[i]) else close_val
        p10 = float(p10_path[i]) if not np.isnan(p10_path[i]) else close_val
        band_upper.append({"time": ts, "value": p90})
        band_lower.append({"time": ts, "value": p10})

    if return_paths:
        return forecast, band_upper, band_lower, round(prob_up, 1), paths
    return forecast, band_upper, band_lower, round(prob_up, 1)
