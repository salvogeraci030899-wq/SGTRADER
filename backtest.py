"""Backtest della strategia Kronos. Usa la stessa logica del bot live (kronos_core.py)."""
import argparse
import os
import time

import pandas as pd

from kronos_core import (
    ALL_ASSETS, ALL_TIMEFRAMES, LOOKBACK,
    get_historical_data, klines_to_df, compute_atr, build_trade_plan,
    load_predictor, generate_monte_carlo_forecast,
)

# Costi applicati a ogni trade
FEE_PCT = 0.1
SLIPPAGE_PCT = 0.05
TAX_RATE = 0.33

# Durata massima di un trade, in candele
HOLD_CANDLES = {"1h": 24, "4h": 18, "1d": 7}

SAVE_EVERY = 25  # salva il CSV parziale ogni N candele analizzate


def download_history(symbol, freq, pages=3):
    all_klines = []
    end_time = int(time.time() * 1000)
    for _ in range(pages):
        k = get_historical_data(symbol, freq, limit=1000, end_time=end_time)
        if not k:
            break
        all_klines = k + all_klines
        end_time = int(k[0][0]) - 1
    if not all_klines:
        return None
    return klines_to_df(all_klines, freq, closed_only=True)


def simulate_trade(df, i, plan, hold_candles):
    """Entra alla chiusura della candela i e scorre le candele successive.
    Se nella stessa candela vengono toccati sia stop che target conta lo stop (ipotesi prudente)."""
    entry, sl, tp, direction = plan['entry'], plan['stop_loss'], plan['take_profit'], plan['direction']
    exit_price, exit_reason = None, None

    for j in range(i + 1, i + 1 + hold_candles):
        future = df.iloc[j]
        if direction == "LONG":
            if future['low'] <= sl: exit_price, exit_reason = sl, "SL"; break
            if future['high'] >= tp: exit_price, exit_reason = tp, "TP"; break
        else:
            if future['high'] >= sl: exit_price, exit_reason = sl, "SL"; break
            if future['low'] <= tp: exit_price, exit_reason = tp, "TP"; break

    if exit_price is None:
        exit_price = float(df.iloc[i + hold_candles]['close'])
        exit_reason = "TEMPO"

    gross_pnl_pct = (exit_price - entry) / entry * 100
    if direction == "SHORT":
        gross_pnl_pct = -gross_pnl_pct

    net_pnl_pct = gross_pnl_pct - ((FEE_PCT + SLIPPAGE_PCT) * 2)
    if net_pnl_pct > 0:
        net_pnl_pct = net_pnl_pct * (1 - TAX_RATE)

    return {'date': df.iloc[i]['time'], 'type': direction, 'reason': exit_reason,
            'entry': entry, 'exit': exit_price, 'gross_pnl': gross_pnl_pct, 'net_pnl': net_pnl_pct}


def run_backtest(predictor, symbol, freq, n_samples, max_steps, max_minutes, out_path):
    hold_candles = HOLD_CANDLES.get(freq, 24)
    print(f"\nDownload dati storici per {symbol} {freq}...")
    df = download_history(symbol, freq)
    if df is None or len(df) <= LOOKBACK + hold_candles:
        print("Dati storici insufficienti.")
        return pd.DataFrame()
    print(f"Candele chiuse scaricate: {len(df)}")

    # Il contesto di ogni passo arriva fino alla candela i COMPRESA: si entra alla sua chiusura,
    # come fa il bot live (previsione subito dopo la chiusura dell'ultima candela).
    first = LOOKBACK - 1
    last = len(df) - hold_candles  # escluso
    if max_steps and last - first > max_steps:
        first = last - max_steps  # tengo la parte più recente dello storico
    total = last - first
    print(f"Candele da analizzare: {total} ({n_samples} campioni l'una)")

    deadline = time.time() + max_minutes * 60 if max_minutes else None
    trades = []
    for step, i in enumerate(range(first, last), start=1):
        if deadline and time.time() > deadline:
            print(f"Tempo massimo ({max_minutes} min) raggiunto dopo {step - 1}/{total} candele: mi fermo e salvo.")
            break

        context_df = df.iloc[i - LOOKBACK + 1: i + 1].copy()
        forecast, _, _, prob_up = generate_monte_carlo_forecast(predictor, context_df, freq, n_samples)
        atr = compute_atr(context_df)
        plan = build_trade_plan(float(df.iloc[i]['close']), atr, prob_up, forecast)

        if plan['tradeable']:
            trades.append(simulate_trade(df, i, plan, hold_candles))

        if step % SAVE_EVERY == 0:
            print(f"Analisi candela {step}/{total} - trade finora: {len(trades)}")
            if trades:
                pd.DataFrame(trades).to_csv(out_path, index=False)

    res = pd.DataFrame(trades)
    if not res.empty:
        res.to_csv(out_path, index=False)
    return res


def print_stats(df, title):
    if df.empty:
        return print(f"\n[{title}] Nessun trade generato.")
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
    parser.add_argument("--symbol", default="BTCUSDT", choices=ALL_ASSETS)
    parser.add_argument("--tf", default="4h", choices=ALL_TIMEFRAMES)
    parser.add_argument("--n-samples", type=int, default=int(os.environ.get("N_SAMPLES", "20")),
                        help="campioni Monte Carlo per candela (il bot live usa N_SAMPLES)")
    parser.add_argument("--max-steps", type=int, default=300,
                        help="numero massimo di candele da analizzare, le più recenti (0 = tutte)")
    parser.add_argument("--max-minutes", type=float, default=300,
                        help="si ferma e salva dopo questi minuti (0 = nessun limite)")
    args = parser.parse_args()

    print("Caricamento Modello Kronos...")
    predictor = load_predictor()

    out_path = f"trades_{args.symbol}_{args.tf}.csv"
    res = run_backtest(predictor, args.symbol, args.tf, args.n_samples,
                       args.max_steps, args.max_minutes, out_path)

    split = int(len(res) * 0.7)
    if len(res) > 5:
        print_stats(res.iloc[:split], f"PRIMO 70% - {args.symbol} {args.tf}")
        print_stats(res.iloc[split:], f"ULTIMO 30% - {args.symbol} {args.tf}")
    else:
        print_stats(res, f"TOTALE (Campione piccolo) - {args.symbol} {args.tf}")
