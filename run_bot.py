import json
import os
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta
from model import Kronos, KronosTokenizer, KronosPredictor

# =========================
# CONFIGURAZIONE
# =========================
SYMBOL_ENV = os.environ.get("SYMBOL", "ALL")
TIMEFRAME_ENV = os.environ.get("TIMEFRAME", "ALL")
N_SAMPLES = int(os.environ.get("N_SAMPLES", "20"))  # più campioni = probabilità meno "a scalini" (ma più lento)
PRED_LEN = 7
LOOKBACK = 400

# Soglie segnale (probabilità di rialzo, in %)
LONG_THRESHOLD = 80
SHORT_THRESHOLD = 20

# Piano operativo basato su ATR
ATR_PERIOD = 14
ATR_MULT = float(os.environ.get("ATR_MULT", "1.5"))  # stop = ATR_MULT x ATR del timeframe
RR_MAX = 3.0   # il target del modello non supera RR_MAX x il rischio
MIN_RR = float(os.environ.get("MIN_RR", "1.5"))  # sotto questo R/R il segnale non è operativo (niente alert)

# Filtro timeframe concordi: ignora i dati degli altri timeframe più vecchi di X ore
MAX_OTHER_TF_AGE_HOURS = 48

# Isteresi: dopo un alert, lo stato torna NEUTRO solo se la probabilità rientra in questa fascia.
# Evita alert ripetuti quando 20 campioni oscillano intorno alla soglia (es. 15% -> 25% -> 10%).
RESET_LOW, RESET_HIGH = 30, 70

# FORCE=1 ricalcola sempre (usato dalle esecuzioni manuali); altrimenti salta se non c'è una nuova candela chiusa
FORCE = os.environ.get("FORCE", "0") == "1"

ALL_ASSETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
ALL_TIMEFRAMES = ["1d", "4h", "1h"]
TF_DELTA = {"1d": pd.Timedelta(days=1), "4h": pd.Timedelta(hours=4), "1h": pd.Timedelta(hours=1)}

ASSETS_TO_RUN = ALL_ASSETS if SYMBOL_ENV == "ALL" else [SYMBOL_ENV]
TIMEFRAMES_TO_RUN = ALL_TIMEFRAMES if TIMEFRAME_ENV == "ALL" else [TIMEFRAME_ENV]

# Telegram
TG_TOKEN = os.environ.get("TELEGRAM_TOKEN")
TG_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")


# =========================
# UTILITY
# =========================
def send_telegram_alert(text):
    """Ritorna True solo se il messaggio è stato inviato davvero."""
    if not TG_TOKEN or not TG_CHAT_ID:
        return False
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    payload = {"chat_id": TG_CHAT_ID, "text": text, "parse_mode": "Markdown"}
    try:
        r = requests.post(url, json=payload, timeout=10)
        r.raise_for_status()
        return True
    except Exception as e:
        print(f"Errore invio Telegram: {e}")
        return False


def signal_from_prob(prob_up):
    if prob_up >= LONG_THRESHOLD:
        return "LONG"
    if prob_up <= SHORT_THRESHOLD:
        return "SHORT"
    return "NEUTRO"


def get_historical_data(symbol, interval, limit=500):
    tf_map = {"1d": "1day", "4h": "4h", "1h": "1h"}
    granularity = tf_map.get(interval, "1day")
    url = "https://api.bitget.com/api/v2/spot/market/candles"
    params = {"symbol": symbol, "granularity": granularity, "limit": limit}
    try:
        r = requests.get(url, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()["data"][::-1]
        cleaned_data = []
        for row in data:
            price = float(row[4])
            if symbol == "BTCUSDT" and price < 1000: continue
            if symbol == "ETHUSDT" and price < 100: continue
            if symbol == "SOLUSDT" and price < 10: continue
            cleaned_data.append(row)
        return cleaned_data
    except Exception as e:
        print(f"Errore API Bitget {symbol} {interval}: {e}")
        return None


def get_live_price(symbol, fallback):
    """Prezzo attuale dal ticker Bitget; se fallisce usa l'ultima chiusura."""
    try:
        r = requests.get(
            "https://api.bitget.com/api/v2/spot/market/tickers",
            params={"symbol": symbol}, timeout=10
        )
        r.raise_for_status()
        price = float(r.json()["data"][0]["lastPr"])
        # sanity check: scarta valori assurdi
        if price > 0 and abs(price / fallback - 1) < 0.25:
            return price
    except Exception as e:
        print(f"Errore ticker Bitget {symbol}: {e}")
    return fallback


def compute_atr(df, period=ATR_PERIOD):
    high, low, close = df['high'], df['low'], df['close']
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs()
    ], axis=1).max(axis=1)
    atr = tr.rolling(period).mean().iloc[-1]
    return float(atr)


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


def build_reasoning(data, plan):
    """Commento deterministico (niente LLM): evita interpretazioni sbagliate delle probabilità."""
    prob_up = data['prob_up']
    prob_down = round(100 - prob_up, 1)
    if plan['bias'] == 'NEUTRO':
        head = f"Segnale neutro: rialzo {prob_up}% / ribasso {prob_down}%, nessun vantaggio statistico chiaro."
    else:
        agree = prob_up if plan['bias'] == 'LONG' else prob_down
        head = f"{plan['bias']}: il modello vede questa direzione nel {agree}% delle simulazioni."
    p10 = data['band_lower'][-1]['value']
    p90 = data['band_upper'][-1]['value']
    text = (f"{head} Target {plan['reward_pct']}% dalla mediana prevista, rischio {plan['risk_pct']}% "
            f"(stop {ATR_MULT:g}x ATR): R/R 1:{plan['rr']:g}. Fascia P10-P90 a fine previsione ${p10:,.2f}-${p90:,.2f}.")
    if plan['bias'] != 'NEUTRO' and not plan['tradeable']:
        text += f" Non operativo: R/R sotto 1:{MIN_RR:g}."
    return text


# =========================
# PREVISIONE
# =========================
def generate_monte_carlo_forecast(predictor, context_df, freq, pred_len=PRED_LEN, n_samples=N_SAMPLES):
    x_timestamp = pd.Series(context_df['time'].values, name='timestamps')
    delta = TF_DELTA[freq]
    freq_str = 'D' if freq == '1d' else ('4h' if freq == '4h' else '1h')
    start_date = context_df['time'].iloc[-1] + delta
    y_dates = pd.date_range(start=start_date, periods=pred_len, freq=freq_str, tz='UTC')
    y_timestamp = pd.Series(y_dates, name='timestamps')
    forecast_input_df = context_df[['open', 'high', 'low', 'close', 'volume']].copy()

    seed = (int(context_df['time'].iloc[-1].timestamp()) + int(float(context_df['close'].iloc[-1]) * 100)) % (2 ** 31)
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
        path = np.nan_to_num(pred_df['close'].values, nan=float(context_df['close'].iloc[-1]))
        paths.append(path)

    paths = np.array(paths)
    last_close = float(context_df['close'].iloc[-1])
    final_prices = paths[:, -1]
    prob_up = max(0.0, min(100.0, (np.sum(final_prices > last_close) / n_samples) * 100))

    median_path = np.median(paths, axis=0)
    p10_path = np.percentile(paths, 10, axis=0)
    p90_path = np.percentile(paths, 90, axis=0)

    forecast, band_upper, band_lower = [], [], []
    for i in range(pred_len):
        ts = int(y_timestamp.iloc[i].timestamp())
        close_val = float(median_path[i])
        if close_val <= 0 or np.isnan(close_val): close_val = last_close
        prev_close = float(context_df['close'].iloc[-1]) if i == 0 else float(median_path[i-1])

        forecast.append({
            "time": ts, "open": prev_close, "high": max(close_val, prev_close) * 1.002,
            "low": min(close_val, prev_close) * 0.998, "close": close_val
        })
        p90 = float(p90_path[i]) if not np.isnan(p90_path[i]) else close_val
        p10 = float(p10_path[i]) if not np.isnan(p10_path[i]) else close_val
        band_upper.append({"time": ts, "value": p90})
        band_lower.append({"time": ts, "value": p10})

    return forecast, band_upper, band_lower, round(prob_up, 1)


def generate_payload(predictor, df, symbol, freq):
    context_df = df.tail(LOOKBACK).copy()
    forecast, band_upper, band_lower, prob_up = generate_monte_carlo_forecast(predictor, context_df, freq)

    historical = [{
        "time": int(row['time'].timestamp()), "open": float(row['open']),
        "high": float(row['high']), "low": float(row['low']), "close": float(row['close'])
    } for _, row in context_df.iterrows()]

    last_close = float(context_df['close'].iloc[-1])
    live_price = get_live_price(symbol, last_close)
    atr = compute_atr(context_df)

    base_data = {
        "status": "live", "last_update": datetime.now(timezone.utc).isoformat(),
        "current_price": live_price,
        "last_close": last_close,
        "last_candle_time": int(context_df['time'].iloc[-1].timestamp()),
        "prob_up": prob_up,
        "n_samples": N_SAMPLES,
        "historical": historical, "forecast": forecast,
        "band_upper": band_upper, "band_lower": band_lower,
        "model": "Kronos-small"
    }

    plan = build_trade_plan(live_price, atr, prob_up, forecast)
    plan["reasoning"] = build_reasoning(base_data, plan)
    base_data["ai_plan"] = plan
    return base_data


# =========================
# ALERT (candela chiusa + timeframe concordi)
# =========================
def other_timeframe_signals(dashboard_data, symbol, tf):
    """Segnali degli altri timeframe dello stesso asset (solo dati recenti)."""
    result = {}
    now = datetime.now(timezone.utc)
    for other in ALL_TIMEFRAMES:
        if other == tf:
            continue
        entry = dashboard_data.get(f"{symbol}_{other}")
        if not entry or "prob_up" not in entry:
            continue
        try:
            updated = datetime.fromisoformat(entry["last_update"])
            if updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            if now - updated > timedelta(hours=MAX_OTHER_TF_AGE_HOURS):
                continue
        except Exception:
            continue
        result[other] = signal_from_prob(entry["prob_up"])
    return result


def build_alert_text(symbol, tf, payload, signal, others):
    plan = payload['ai_plan']
    prob_up = payload['prob_up']
    prob_down = round(100 - prob_up, 1)
    candle_dt = datetime.fromtimestamp(payload['last_candle_time'], tz=timezone.utc) + TF_DELTA[tf].to_pytimedelta()
    sign_stop = "-" if signal == "LONG" else "+"
    sign_tp = "+" if signal == "LONG" else "-"

    text = f"🚨 *NUOVO SEGNALE: {symbol} ({tf})*\n\n"
    text += f"📊 *Prob. rialzo:* {prob_up}% | *ribasso:* {prob_down}%\n"
    text += f"🧭 *Direzione:* {signal}\n"
    text += f"💰 *Prezzo:* ${payload['current_price']:,.2f}\n\n"
    text += f"🎯 *Entry:* ${plan['entry']:,.2f}\n"
    text += f"🛑 *Stop Loss:* ${plan['stop_loss']:,.2f} ({sign_stop}{plan['risk_pct']}%)\n"
    text += f"✅ *Take Profit:* ${plan['take_profit']:,.2f} ({sign_tp}{plan['reward_pct']}%)\n"
    text += f"⚖️ *R/R:* 1:{plan['rr']:g} | *ATR:* ${plan['atr']:,.2f}\n\n"
    if others:
        others_txt = ", ".join(f"{k} {v}" for k, v in others.items())
        text += f"🔗 *Altri timeframe:* {others_txt}\n"
    text += f"🕯 Ultima candela chiusa alle: {candle_dt.strftime('%d/%m %H:%M')} UTC"
    return text


def process_alerts(processed, dashboard_data, alerts_state):
    for symbol, tf in processed:
        key = f"{symbol}_{tf}"
        payload = dashboard_data[key]
        if "last_candle_time" not in payload or "risk_pct" not in payload.get("ai_plan", {}):
            continue  # voce vecchia, verrà ricalcolata al prossimo run
        current_signal = signal_from_prob(payload['prob_up'])
        last_signal = alerts_state.get(key, "NEUTRO")

        if current_signal == "NEUTRO":
            if RESET_LOW < payload['prob_up'] < RESET_HIGH:
                alerts_state[key] = "NEUTRO"
            continue
        if current_signal == last_signal:
            continue  # anti-spam: segnale già notificato

        if not payload['ai_plan'].get('tradeable', False):
            print(f"Segnale {key} {current_signal} non operativo (R/R {payload['ai_plan'].get('rr')}), nessun alert.")
            continue

        others = other_timeframe_signals(dashboard_data, symbol, tf)
        opposite = "SHORT" if current_signal == "LONG" else "LONG"
        conflicts = [k for k, v in others.items() if v == opposite]
        if conflicts:
            print(f"Segnale {key} {current_signal} sospeso: timeframe in conflitto {conflicts}")
            continue  # lo stato non cambia: riproverà alla prossima esecuzione

        text = build_alert_text(symbol, tf, payload, current_signal, others)
        if send_telegram_alert(text):
            alerts_state[key] = current_signal


# =========================
# MAIN
# =========================
def load_json(path):
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Impossibile leggere {path}: {e}")
    return {}


def main():
    print(f"Avvio elaborazione per: {ASSETS_TO_RUN} su {TIMEFRAMES_TO_RUN}")
    dashboard_data = load_json("dashboard.json")
    alerts_state = load_json("alerts_state.json")

    predictor = None  # caricato solo se c'è almeno una nuova candela da calcolare
    processed = []
    for symbol in ASSETS_TO_RUN:
        for tf in TIMEFRAMES_TO_RUN:
            print(f"--> Calcolo {symbol} su {tf}...")
            klines = get_historical_data(symbol, tf)
            if not klines:
                continue

            df = pd.DataFrame(klines, columns=['time', 'open', 'high', 'low', 'close', 'volume', 'qav', 'usdt_vol'])
            df['time'] = pd.to_datetime(df['time'].astype(float), unit='ms', utc=True)
            for col in ['open', 'high', 'low', 'close', 'volume']:
                df[col] = df[col].astype(float)
            df = df.drop_duplicates(subset=['time']).sort_values('time')

            # Tieni solo candele CHIUSE (time = apertura candela)
            now = pd.Timestamp.now(tz='UTC')
            df = df[df['time'] + TF_DELTA[tf] <= now]
            if len(df) < ATR_PERIOD + 50:
                print(f"Dati insufficienti per {symbol} {tf}, salto.")
                continue

            key = f"{symbol}_{tf}"
            last_candle_ts = int(df['time'].iloc[-1].timestamp())
            prev = dashboard_data.get(key)

            # Nessuna nuova candela chiusa: niente modello, aggiorno solo prezzo e piano
            if (not FORCE and prev and prev.get("last_candle_time") == last_candle_ts
                    and "ai_plan" in prev and "tradeable" in prev["ai_plan"]):
                live = get_live_price(symbol, float(df['close'].iloc[-1]))
                old_plan = prev["ai_plan"]
                new_plan = build_trade_plan(live, old_plan["atr"], prev["prob_up"], prev["forecast"])
                new_plan["reasoning"] = build_reasoning(prev, new_plan)
                prev["current_price"] = live
                prev["ai_plan"] = new_plan
                prev["last_update"] = datetime.now(timezone.utc).isoformat()
                print(f"    Nessuna nuova candela chiusa per {key}, salto il modello.")
                continue

            if predictor is None:
                print("Caricamento Modello...")
                tokenizer = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
                model = Kronos.from_pretrained("NeoQuasar/Kronos-small")
                predictor = KronosPredictor(model=model, tokenizer=tokenizer, device="cpu", max_context=512)

            payload = generate_payload(predictor, df, symbol, tf)
            dashboard_data[key] = payload
            processed.append((symbol, tf))

    # Alert in un secondo passaggio, quando tutti i timeframe sono aggiornati.
    # Controllo tutte le coppie presenti (non solo quelle ricalcolate) così un segnale
    # sospeso per conflitto può partire appena il conflitto sparisce; alerts_state evita i doppioni.
    to_check = [(s, t) for s in ASSETS_TO_RUN for t in TIMEFRAMES_TO_RUN
                if f"{s}_{t}" in dashboard_data]
    process_alerts(to_check, dashboard_data, alerts_state)

    with open("dashboard.json", "w") as f:
        json.dump(dashboard_data, f)
    with open("alerts_state.json", "w") as f:
        json.dump(alerts_state, f)
    print("✅ dashboard.json e alerts_state.json aggiornati!")


if __name__ == "__main__":
    main()
