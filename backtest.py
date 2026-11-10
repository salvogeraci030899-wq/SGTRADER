import requests
import pandas as pd
import numpy as np
import time
import argparse
from datetime import datetime, timezone, timedelta
from model import Kronos, KronosTokenizer, KronosPredictor

# ==============================================================================
# CONFIGURAZIONE (Allineata al tuo run_bot.py)
# ==============================================================================
BITGET_API = "https://api.bitget.com/api/v2/spot/market/candles"
LOOKBACK = 400
PRED_LEN = 7
N_SAMPLES = 10  # 10 per velocizzare, puoi mettere 20 per matchare il live
ATR_PERIOD = 14
ATR_MULT = 1.5
RR_MAX = 3.0
MIN_RR = 1.5

FEE_PCT = 0.1      
SLIPPAGE_PCT = 0.05 
TAX_RATE = 0.33    

TF_DELTA = {"1d": pd.Timedelta(days=1), "4h": pd.Timedelta(hours=4), "1h": pd.Timedelta(hours=1)}

def get_historical_data(symbol, interval, limit=1000, end_time=None):
    tf_map = {"1d": "1day", "4h": "4h", "1h": "1h"}
    granularity = tf_map.get(interval, "1day")
    params = {"symbol": symbol, "granularity": granularity, "limit": limit}
    if end_time: params["endTime"] = end_time
    try:
        r = requests.get(BITGET_API, params=params, timeout=15)
        r.raise_for_status()
        return r.json()["data"][::-1]
    except Exception as e:
        print(f"Errore API Bitget {symbol} {interval}: {e}")
        return None

def compute_atr(df, period=ATR_PERIOD):
    high, low, close = df['high'], df['low'], df['close']
    prev_close = close.shift(1)
    tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
    atr = tr.rolling(period).mean().iloc[-1]
    return float(atr)

def build_trade_plan(price, atr, prob_up, forecast):
    bias = "LONG" if prob_up >= 80 else ("SHORT" if prob_up <= 20 else "NEUTRO")
    direction = "LONG" if prob_up >= 50 else "SHORT"
    risk = ATR_MULT * atr
    closes = [f["close"] for f in forecast] or [price]

    if direction == "LONG":
        stop = price - risk
        reward = max(max(closes) - price, 0.0)
    else:
        stop = price + risk
        reward = max(price - min(closes), 0.0)

    reward = min(reward, RR_MAX * risk)
    rr = reward / risk if risk > 0 else 0.0
    take = price + reward if direction == "LONG" else price - reward

    return {
        "bias": bias, "direction": direction, "entry": price,
        "stop_loss": stop, "take_profit": take,
        "rr": round(rr, 2), "tradeable": bool(bias != "NEUTRO" and rr >= MIN_RR),
    }

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
    forecast = []
    for i in range(pred_len):
        close_val = float(median_path[i])
        prev_c = float(context_df['close'].iloc[-1]) if i == 0 else float(median_path[i-1])
        forecast.append({"close": close_val, "open": prev_c})
        
    return forecast, round(prob_up, 1)

def run_backtest(predictor, symbol, freq, hold_candles):
    print(f"\nDownload dati storici per {symbol} {freq}...")
    all_klines = []
    end_time = int(time.time() * 1000)
    for _ in range(3):
        k = get_historical_data(symbol, freq, limit=1000, end_time=end_time)
        if not k: break
        all_klines = k + all_klines
        end_time = int(k[0][0]) - 1
        
    df = pd.DataFrame(all_klines, columns=['time', 'open', 'high', 'low', 'close', 'volume', 'qav', 'usdt_vol'])
    df['time'] = pd.to_datetime(df['time'].astype(float), unit='ms', utc=True)
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = df[col].astype(float)
    df = df.drop_duplicates(subset=['time']).sort_values('time').reset_index(drop=True)
    
    print(f"Candele totali scaricate: {len(df)}")
    trades = []
    
    for i in range(LOOKBACK, len(df) - hold_candles):
        if i % 50 == 0: print(f"Analisi candela {i}/{len(df)-hold_candles}...")
        
        context_df = df.iloc[i - LOOKBACK : i].copy()
        current_candle = df.iloc[i]
        
        forecast, prob_up = generate_monte_carlo_forecast(predictor, context_df, freq)
        atr = compute_atr(context_df)
        plan = build_trade_plan(current_candle['close'], atr, prob_up, forecast)
        
        if plan['tradeable']:
            entry, sl, tp, direction = plan['entry'], plan['stop_loss'], plan['take_profit'], plan['direction']
            exit_price, exit_reason = None, None
            
            for j in range(i+1, i+1+hold_candles):
                future = df.iloc[j]
                if direction == "LONG":
                    if future['low'] <= sl: exit_price, exit_reason = sl, "SL"; break
                    if future['high'] >= tp: exit_price, exit_reason = tp, "TP"; break
                else:
                    if future['high'] >= sl: exit_price, exit_reason = sl, "SL"; break
                    if future['low'] <= tp: exit_price, exit_reason = tp, "TP"; break
            
            if not exit_price:
                exit_price = df.iloc[i+hold_candles]['close']
                exit_reason = "TEMPO"
                
            gross_pnl_pct = (exit_price - entry) / entry * 100
            if direction == "SHORT": gross_pnl_pct = -gross_pnl_pct
                
            net_pnl_pct = gross_pnl_pct - ((FEE_PCT + SLIPPAGE_PCT) * 2)
            if net_pnl_pct > 0: net_pnl_pct = net_pnl_pct * (1 - TAX_RATE)
                
            trades.append({'date': current_candle['time'], 'type': direction, 'reason': exit_reason,
                           'entry': entry, 'exit': exit_price, 'gross_pnl': gross_pnl_pct, 'net_pnl': net_pnl_pct})
            
    return pd.DataFrame(trades)

def print_stats(df, title):
    if df.empty: return print(f"\n[{title}] Nessun trade generato.")
    total = len(df)
    wins = df[df['net_pnl'] > 0]
    losses = df[df['net_pnl'] <= 0]
    win_rate = (len(wins) / total) * 100
    gross_profit = wins['net_pnl'].sum()
    gross_loss = abs(losses['net_pnl'].sum())
    pf = gross_profit / gross_loss if gross_loss > 0 else float('inf')
    
    print(f"\n{'='*50}\n REPORT: {title}\n{'='*50}")
    print(f"Trade totali:   {total}")
    print(f"Win Rate:       {win_rate:.1f}%")
    print(f"Profit Factor:  {pf:.2f}")
    print(f"Expectancy:     {df['net_pnl'].mean():+.2f}% per trade")
    print(f"Ritorno Totale: {df['net_pnl'].sum():.1f}%")
    if pf > 1.3 and win_rate > 54: print("VERDETTO: EDGE POSITIVO")
    elif pf > 1.0: print("VERDETTO: MARGINALE")
    else: print("VERDETTO: PERDENTE")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", default="BTCUSDT")
    parser.add_argument("--tf", default="4h")
    args = parser.parse_args()

    print("Caricamento Modello Kronos...")
    tokenizer = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
    model = Kronos.from_pretrained("NeoQuasar/Kronos-small")
    predictor = KronosPredictor(model=model, tokenizer=tokenizer, device="cpu", max_context=512)
    
    hold_time = {"1h": 24, "4h": 18, "1d": 7}.get(args.tf, 24)
    res = run_backtest(predictor, args.symbol, args.tf, hold_time)
    
    if not res.empty: res.to_csv(f"trades_{args.symbol}_{args.tf}.csv", index=False)
    
    split = int(len(res) * 0.7)
    if len(res) > 5:
        print_stats(res.iloc[:split], f"IN-SAMPLE - {args.symbol} {args.tf}")
        print_stats(res.iloc[split:], f"OUT-OF-SAMPLE - {args.symbol} {args.tf}")
    else:
        print_stats(res, f"TOTALE (Campione piccolo) - {args.symbol} {args.tf}")
