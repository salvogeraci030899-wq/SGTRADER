"""Validazione storica delle strategie tecniche della pagina Segnali (nessun modello).

Misura Breakout, Mean Reversion, MA Crossover e il loro consenso (almeno 2 su 3) con lo stesso
metro usato per Kronos: stesso orizzonte (7 candele), stessi costi, stesso piano
(stop 1,5 x ATR), intervalli di confidenza con bootstrap a blocchi di tempo, confronto con
momentum e "sempre long". Le regole sono quelle dell'app (src/ui/signals.js): alla chiusura di
una candela gli indicatori usano le 299 candele chiuse precedenti e il prezzo è la chiusura.

    python strategies_validation.py                      # tutto lo storico disponibile su Bitget
    python strategies_validation.py --start 2025-06-01   # solo un periodo (prova veloce)

Limiti dichiarati:
- le regole sono fisse e non vengono adattate ai dati, ma i loro parametri (RSI 35/65, EMA
  20/50/200...) sono valori "da manuale" scelti da qualcuno che conosceva il passato: per questo
  il report mostra anche prima e seconda metà del periodo separatamente;
- un trade alla volta per strategia e coppia: dopo un ingresso si aspetta la fine dell'orizzonte;
- costi dello spot anche per gli short (sui futures sono diversi: commissioni più basse, funding).
"""
import argparse
import json
import os
from datetime import datetime, timezone

import numpy as np

import track_record as tr
import validation as va
import validation_stats as vs
from kronos_core import (
    ALL_ASSETS, ALL_TIMEFRAMES, PRED_LEN, ATR_PERIOD, ATR_MULT, MIN_RR, FEE_PCT, SLIPPAGE_PCT, TAX_RATE, TF_DELTA,
)

SUMMARY_PATH = "strategies_summary.json"
REPORT_PATH = os.path.join(va.OUT_DIR, "STRATEGIE.md")
WINDOW = 299            # candele chiuse viste dall'app (300 richieste a Bitget, l'ultima è in corso)
DEFAULT_START = "2018-01-01"

STRATEGIES = ["breakout", "mean_reversion", "ma_crossover", "consensus", "momentum", "always_long"]
NAMES = {"breakout": "Breakout", "mean_reversion": "Mean Reversion", "ma_crossover": "MA Crossover",
         "consensus": "Consenso (almeno 2 su 3)", "momentum": "Momentum (confronto)", "always_long": "Sempre long (confronto)"}


# =========================
# INDICATORI (come helpers.js)
# =========================
def _window_ema(c, idx, period):
    """EMA come calcEMA dell'app: media semplice delle prime `period` chiusure della finestra, poi ricorsiva."""
    start = idx - WINDOW
    csum = np.concatenate([[0.0], np.cumsum(c)])
    ema = (csum[start + period] - csum[start]) / period
    k = 2 / (period + 1)
    for j in range(period, WINDOW):
        ema = c[start + j] * k + ema * (1 - k)
    return ema


def _window_rsi(c, idx, period=14):
    """RSI di Wilder calcolato dall'inizio della finestra, come calculateRSI dell'app."""
    start = idx - WINDOW
    gains, losses = np.zeros(len(idx)), np.zeros(len(idx))
    for j in range(1, period + 1):
        d = c[start + j] - c[start + j - 1]
        gains += np.where(d >= 0, d, 0)
        losses += np.where(d < 0, -d, 0)
    ag, al = gains / period, losses / period
    for j in range(period + 1, WINDOW):
        d = c[start + j] - c[start + j - 1]
        ag = (ag * (period - 1) + np.where(d > 0, d, 0)) / period
        al = (al * (period - 1) + np.where(d < 0, -d, 0)) / period
    rs = np.where(al == 0, 100.0, ag / np.where(al == 0, 1.0, al))
    return 100 - 100 / (1 + rs)


def compute_signals(df):
    """Per ogni candela i >= WINDOW: segnale (+1 long, -1 short, 0 nessuno) di ogni strategia alla sua chiusura.
    Ritorna (idx, {strategia: array}, atr) con atr = ATR(14) fino alla candela i compresa."""
    o, h, l, c, v = (df[k].to_numpy(dtype=float) for k in ("open", "high", "low", "close", "volume"))
    n = len(c)
    idx = np.arange(WINDOW, n)
    price = c[idx]

    ema20, ema50, ema200 = (_window_ema(c, idx, p) for p in (20, 50, 200))
    rsi = _window_rsi(c, idx)

    # Trend: serie di candele dello stesso colore che termina con l'ultima candela chiusa (i-1)
    green, red = c > o, c < o
    run = np.ones(n, dtype=int)
    for i in range(1, n):
        if (green[i] and green[i - 1]) or (red[i] and red[i - 1]):
            run[i] = run[i - 1] + 1
    last = idx - 1
    count = np.minimum(run[last], WINDOW)
    cv = np.concatenate([[0.0], np.cumsum(v)])
    avg_trend_vol = (cv[idx] - cv[idx - count]) / count
    avg24 = (cv[idx] - cv[idx - 24]) / 24
    vol_ratio = np.where(avg24 > 0, avg_trend_vol / np.where(avg24 > 0, avg24, 1.0), 1.0)
    bullish, bearish = green[last], red[last]

    hh20 = np.array([h[i - 20:i].max() for i in idx])          # massimo delle 20 candele chiuse precedenti
    macro = price > ema200

    breakout = np.where(bullish & (price > hh20) & macro & (rsi >= 55) & (vol_ratio >= 1.5), 1,
                        np.where(bearish & ~macro & (rsi <= 45) & (vol_ratio >= 1.5), -1, 0))
    mean_rev = np.where((rsi < 35) & (price > ema200 * 0.95), 1,
                        np.where((rsi > 65) & (price < ema200 * 1.05), -1, 0))
    ma_cross = np.where((ema20 > ema50) & (ema50 > ema200) & (price > ema50), 1,
                        np.where((ema20 < ema50) & (ema50 < ema200) & (price < ema50), -1, 0))
    longs = (breakout == 1).astype(int) + (mean_rev == 1) + (ma_cross == 1)
    shorts = (breakout == -1).astype(int) + (mean_rev == -1) + (ma_cross == -1)
    consensus = np.where((longs >= 2) & (longs > shorts), 1, np.where((shorts >= 2) & (shorts > longs), -1, 0))
    momentum = np.where(price >= c[idx - PRED_LEN], 1, -1)

    prev_close = np.concatenate([[c[0]], c[:-1]])
    true_range = np.maximum(h - l, np.maximum(np.abs(h - prev_close), np.abs(l - prev_close)))
    ctr = np.concatenate([[0.0], np.cumsum(true_range)])
    atr = (ctr[idx + 1] - ctr[idx + 1 - ATR_PERIOD]) / ATR_PERIOD

    signals = {"breakout": breakout, "mean_reversion": mean_rev, "ma_crossover": ma_cross, "consensus": consensus,
               "momentum": momentum, "always_long": np.ones(len(idx), dtype=int)}
    return idx, signals, atr


# =========================
# TRADE
# =========================
def simulate(df, tf, symbol):
    """Trade di ogni strategia su una coppia: ingresso alla chiusura della candela del segnale, un trade
    alla volta. Per ogni trade: esito del piano (stop 1,5 x ATR, target MIN_RR x rischio) e della sola
    direzione tenuta fino a fine orizzonte. Salta i tratti di storico con candele mancanti."""
    idx, signals, atr = compute_signals(df)
    step = int(TF_DELTA[tf].total_seconds())
    times = np.array([int(t.timestamp()) for t in df["time"]])
    o, h, l, c = (df[k].to_numpy(dtype=float) for k in ("open", "high", "low", "close"))
    n = len(c)
    # finestra + orizzonte senza buchi
    ok = np.zeros(len(idx), dtype=bool)
    for k, i in enumerate(idx):
        if i + PRED_LEN < n:
            ok[k] = times[i + PRED_LEN] - times[i - WINDOW] == (WINDOW + PRED_LEN) * step
    trades = {name: [] for name in STRATEGIES}
    for name in STRATEGIES:
        sig, next_free = signals[name], 0
        for k, i in enumerate(idx):
            if i < next_free or not ok[k] or sig[k] == 0:
                continue
            long = sig[k] == 1
            risk = ATR_MULT * atr[k]
            entry = c[i]
            plan = {"direction": "LONG" if long else "SHORT", "entry": entry,
                    "stop_loss": entry - risk if long else entry + risk,
                    "take_profit": entry + MIN_RR * risk if long else entry - MIN_RR * risk}
            horizon = [{"open": o[j], "high": h[j], "low": l[j], "close": c[j]} for j in range(i + 1, i + 1 + PRED_LEN)]
            hold = (c[i + PRED_LEN] - entry) / entry * 100 * (1 if long else -1)
            trades[name].append({"symbol": symbol, "tf": tf, "t": int(times[i]),
                                 "gross": {"plan": tr.simulate_plan(plan, horizon)["gross_pct"], "hold": float(hold)}})
            next_free = i + PRED_LEN
    span = {"from": int(times[idx[0]]), "to": int(times[-1]), "candles": int(len(idx)),
            "buy_hold_gross_pct": round(float((c[-1] / c[idx[0]] - 1) * 100), 1)} if len(idx) else None
    return trades, span


def stats(trades, cluster_seconds):
    """Statistiche di un gruppo di trade: piano e sola direzione, più stabilità (prima/seconda metà del periodo)."""
    if not trades:
        return {"plan": {"n": 0, "verdict": "campione_insufficiente"}, "hold": {"n": 0, "verdict": "campione_insufficiente"}}
    trades = sorted(trades, key=lambda x: (x["t"], x["symbol"]))
    clusters = np.array([x["t"] // cluster_seconds for x in trades])
    out = {kind: vs._strategy_stats(trades, clusters, kind) for kind in ("plan", "hold")}
    mid = (trades[0]["t"] + trades[-1]["t"]) / 2
    halves = []
    for part in ([x for x in trades if x["t"] <= mid], [x for x in trades if x["t"] > mid]):
        if part:
            s = vs._strategy_stats(part, np.array([x["t"] // cluster_seconds for x in part]), "plan")
            halves.append({"n": s["n"], "avg_net_pct": s["avg_net_pct"], "avg_net_ci": s["avg_net_ci"], "verdict": s["verdict"]})
    out["plan"]["halves"] = halves
    return out


def build_summary(per_pair, spans):
    """per_pair: {(symbol, tf): {strategia: [trade]}}."""
    by_pair, by_tf = {}, {}
    for (symbol, tf), trades in per_pair.items():
        cs = PRED_LEN * int(TF_DELTA[tf].total_seconds())
        by_pair[f"{symbol}_{tf}"] = {"period": spans[(symbol, tf)], "strategies": {name: stats(trades[name], cs) for name in STRATEGIES}}
    for tf in ALL_TIMEFRAMES:
        pairs = [k for k in per_pair if k[1] == tf]
        if not pairs:
            continue
        cs = PRED_LEN * int(TF_DELTA[tf].total_seconds())
        by_tf[tf] = {"strategies": {name: stats([t for k in pairs for t in per_pair[k][name]], cs) for name in STRATEGIES}}
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "horizon_candles": PRED_LEN,
        "plan": {"atr_mult": ATR_MULT, "target_rr": MIN_RR},
        "costs": {"fee_pct_per_side": FEE_PCT, "slippage_pct_per_side": SLIPPAGE_PCT, "tax_rate": TAX_RATE, "tax_basis": "totale"},
        "confidence": {"level": 95, "method": "bootstrap a blocchi di tempo", "n_boot": vs.N_BOOT, "min_n": vs.MIN_N},
        "by_tf": by_tf,
        "by_pair": by_pair,
    }


# =========================
# REPORT
# =========================
def _rows_md(strategies):
    out = ["| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |",
           "|---|---|---|---|---|---|---|---|---|"]
    for name in STRATEGIES:
        p, hd = strategies[name]["plan"], strategies[name]["hold"]
        if not p["n"]:
            out.append(f"| {NAMES[name]} | 0 | — | — | — | {vs.VERDICT_TEXT[p['verdict']]} | — | — | — |")
            continue
        halves = [f"{x['avg_net_pct']:+.3f}% ({x['n']})" for x in p.get("halves", [])] + ["—", "—"]
        out.append(f"| {NAMES[name]} | {p['n']} | {p['win_rate']}% | {p['avg_net_pct']:+.3f}% | {vs._ci(p['avg_net_ci'])} | "
                   f"{vs.VERDICT_TEXT[p['verdict']]} | {halves[0]} | {halves[1]} | {hd['avg_net_pct']:+.3f}% {vs._ci(hd['avg_net_ci'])} |")
    return out


def to_markdown(s):
    c = s["costs"]
    out = ["# Validazione storica delle strategie tecniche", "",
           f"Generato il {s['generated_at']} · orizzonte {s['horizon_candles']} candele · piano: stop {s['plan']['atr_mult']:g} x ATR, "
           f"target {s['plan']['target_rr']:g} x il rischio.", "",
           f"- **Costi**: commissione {c['fee_pct_per_side']}% e slippage {c['slippage_pct_per_side']}% per lato. \"Netto\" = dopo questi costi. Tasse {round(c['tax_rate'] * 100)}% applicate una volta al guadagno complessivo (le perdite compensano i guadagni).",
           "- **Giudizio**: un vantaggio è dimostrato solo se l'intero intervallo di confidenza al 95% del netto medio è sopra zero.",
           "- **Prima/seconda metà**: netto medio (e numero di trade) nelle due metà del periodo; un risultato che cambia segno non è stabile.",
           "- Regole fisse, non adattate ai dati; i parametri sono però valori noti scelti conoscendo il passato.",
           "- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.", ""]
    for tf, b in s["by_tf"].items():
        out += [f"### Timeframe {tf} (BTC, ETH e SOL insieme)", ""] + _rows_md(b["strategies"]) + [""]
    for key, b in s["by_pair"].items():
        p = b["period"]
        out += [f"### {key.replace('_', ' ')}", "",
                f"Dal {vs._day(p['from'])} al {vs._day(p['to'])}, {p['candles']} candele. Buy & hold nel periodo: {p['buy_hold_gross_pct']:+.1f}% lordo.", ""]
        out += _rows_md(b["strategies"]) + [""]
    return "\n".join(out) + "\n"


def main(start, symbols, tfs, summary_path=SUMMARY_PATH, report_path=REPORT_PATH):
    start_ms = int(datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp() * 1000)
    per_pair, spans = {}, {}
    for symbol in symbols:
        for tf in tfs:
            df = va.download_history(symbol, tf, start_ms)
            if df is None or len(df) < WINDOW + 100:
                print(f"{symbol} {tf}: storico insufficiente, salto.")
                continue
            trades, span = simulate(df, tf, symbol)
            per_pair[(symbol, tf)], spans[(symbol, tf)] = trades, span
            print(f"{symbol} {tf}: {len(df)} candele dal {df['time'].iloc[0]:%d/%m/%Y}, trade: "
                  + ", ".join(f"{name} {len(trades[name])}" for name in STRATEGIES))
    if not per_pair:
        raise SystemExit("Nessuno storico scaricato.")
    summary = build_summary(per_pair, spans)
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=1)
    os.makedirs(os.path.dirname(os.path.abspath(report_path)), exist_ok=True)
    with open(report_path, "w") as f:
        f.write(to_markdown(summary))
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", default=DEFAULT_START, help="data di inizio AAAA-MM-GG (di base: tutto lo storico)")
    parser.add_argument("--symbols", nargs="*", default=ALL_ASSETS, choices=ALL_ASSETS)
    parser.add_argument("--tfs", nargs="*", default=ALL_TIMEFRAMES, choices=ALL_TIMEFRAMES)
    args = parser.parse_args()
    main(args.start, args.symbols, args.tfs)
    print(open(REPORT_PATH).read())
