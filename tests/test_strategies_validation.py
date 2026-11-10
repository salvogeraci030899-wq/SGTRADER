"""Test della validazione delle strategie tecniche. `python3 tests/test_strategies_validation.py` oppure pytest.

Gli indicatori vettoriali vengono confrontati, candela per candela, con una trascrizione diretta
delle funzioni dell'app (helpers.js / signals.js): devono dare esattamente gli stessi segnali."""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import strategies_validation as sv  # noqa: E402
from kronos_core import PRED_LEN, ATR_MULT, MIN_RR  # noqa: E402

H = 3600
T0 = 1_600_000_000 // H * H


def make_df(n=900, seed=0, skip=()):
    rng = np.random.default_rng(seed)
    # tratti con tendenza e volatilità diverse, così tutte le regole scattano almeno qualche volta
    drift = np.repeat(rng.choice([-0.004, -0.001, 0.0, 0.001, 0.004], size=n // 30 + 1), 30)[:n]
    close = 100 * np.exp(np.cumsum(drift + rng.normal(0, 0.006, n)))
    open_ = np.concatenate([[100.0], close[:-1]])
    doji = rng.random(n) < 0.03                      # qualche candela senza colore (apertura = chiusura)
    open_[doji] = close[doji]
    high = np.maximum(open_, close) * (1 + np.abs(rng.normal(0, 0.002, n)))
    low = np.minimum(open_, close) * (1 - np.abs(rng.normal(0, 0.002, n)))
    vol = np.abs(rng.normal(100, 60, n)) + 1
    rows = [i for i in range(n) if i not in skip]
    return pd.DataFrame({"time": pd.to_datetime([T0 + i * H for i in rows], unit="s", utc=True),
                         "open": open_[rows], "high": high[rows], "low": low[rows], "close": close[rows], "volume": vol[rows]})


# --- trascrizione diretta delle funzioni dell'app ---
def js_ema(closes, period):
    if len(closes) < period:
        return closes[-1]
    k = 2 / (period + 1)
    ema = sum(closes[:period]) / period
    for x in closes[period:]:
        ema = x * k + ema * (1 - k)
    return ema


def js_rsi(closes, period=14):
    gains = losses = 0.0
    for i in range(1, period + 1):
        d = closes[i] - closes[i - 1]
        if d >= 0:
            gains += d
        else:
            losses -= d
    ag, al = gains / period, losses / period
    rs = 100 if al == 0 else ag / al
    for i in range(period + 1, len(closes)):
        d = closes[i] - closes[i - 1]
        ag = (ag * (period - 1) + (d if d > 0 else 0)) / period
        al = (al * (period - 1) + (-d if d < 0 else 0)) / period
        rs = 100 if al == 0 else ag / al
    return 100 - 100 / (1 + rs)


def js_signals(df, i):
    """Segnali dell'app alla chiusura della candela i: 299 candele chiuse precedenti, prezzo = chiusura di i."""
    closed = df.iloc[i - sv.WINDOW:i]
    price = df["close"].iloc[i]
    o, h, c, v = (closed[k].tolist() for k in ("open", "high", "close", "volume"))
    direction = "bullish" if c[-1] > o[-1] else "bearish" if c[-1] < o[-1] else "neutral"
    count = 0
    if direction != "neutral":
        count = 1
        for j in range(len(c) - 2, -1, -1):
            if not (c[j] > o[j] if direction == "bullish" else c[j] < o[j]):
                break
            count += 1
    vol_ratio = (sum(v[-count:]) / count) / (sum(v[-24:]) / 24) if count else 1
    rsi = js_rsi(c)
    ema20, ema50, ema200 = js_ema(c, 20), js_ema(c, 50), js_ema(c, 200)
    macro, breakout_pass = price > ema200, price > max(h[-20:])
    out = {}
    out["breakout"] = (1 if direction == "bullish" and breakout_pass and macro and rsi >= 55 and vol_ratio >= 1.5
                       else -1 if direction == "bearish" and not macro and rsi <= 45 and vol_ratio >= 1.5 else 0)
    out["mean_reversion"] = 1 if rsi < 35 and price > ema200 * 0.95 else -1 if rsi > 65 and price < ema200 * 1.05 else 0
    out["ma_crossover"] = (1 if ema20 > ema50 > ema200 and price > ema50
                           else -1 if ema20 < ema50 < ema200 and price < ema50 else 0)
    longs = sum(1 for k in ("breakout", "mean_reversion", "ma_crossover") if out[k] == 1)
    shorts = sum(1 for k in ("breakout", "mean_reversion", "ma_crossover") if out[k] == -1)
    out["consensus"] = 1 if longs >= 2 and longs > shorts else -1 if shorts >= 2 and shorts > longs else 0
    return out


def test_segnali_identici_a_quelli_dell_app():
    seen = {k: set() for k in ("breakout", "mean_reversion", "ma_crossover", "consensus")}
    for seed in (0, 1, 2):
        df = make_df(seed=seed)
        idx, signals, atr = sv.compute_signals(df)
        assert idx[0] == sv.WINDOW and len(idx) == len(df) - sv.WINDOW
        for k, i in enumerate(idx):
            ref = js_signals(df, int(i))
            for name, value in ref.items():
                assert signals[name][k] == value, (seed, i, name, signals[name][k], value)
                seen[name].add(value)
        # ATR(14) fino alla candela i compresa, come compute_atr del bot
        i = int(idx[50])
        h, l, c = df["high"].to_numpy(), df["low"].to_numpy(), df["close"].to_numpy()
        trs = [max(h[j] - l[j], abs(h[j] - c[j - 1]), abs(l[j] - c[j - 1])) for j in range(i - 13, i + 1)]
        assert abs(atr[50] - sum(trs) / 14) < 1e-9
        assert set(signals["momentum"]) <= {1, -1} and set(signals["always_long"]) == {1}
    # il confronto ha senso solo se le regole sono scattate in entrambe le direzioni
    assert seen["mean_reversion"] == {-1, 0, 1} and seen["ma_crossover"] == {-1, 0, 1} and len(seen["breakout"]) >= 2, seen


def test_trade_un_alla_volta_e_piano():
    df = make_df(seed=3)
    trades, span = sv.simulate(df, "1h", "BTCUSDT")
    al = trades["always_long"]
    times = [t["t"] for t in al]
    assert all(b - a >= PRED_LEN * H for a, b in zip(times, times[1:]))          # mai due trade sovrapposti
    assert len(al) == len(range(sv.WINDOW, len(df) - PRED_LEN, PRED_LEN))             # sempre in posizione, a blocchi di 7
    assert span["candles"] == len(df) - sv.WINDOW
    # primo trade "sempre long": direzione tenuta = rendimento a 7 candele; piano limitato da stop e target
    i = sv.WINDOW
    c = df["close"].to_numpy()
    assert abs(al[0]["gross"]["hold"] - (c[i + PRED_LEN] / c[i] - 1) * 100) < 1e-9
    _, _, atr = sv.compute_signals(df)
    risk_pct = ATR_MULT * atr[0] / c[i] * 100
    assert -risk_pct - 1e-3 <= al[0]["gross"]["plan"] <= MIN_RR * risk_pct + 1e-3   # l'esito è arrotondato a 4 decimali
    # un buco nello storico: nessun trade ha il buco nella finestra o nell'orizzonte
    hole = 500
    trades_gap, _ = sv.simulate(make_df(seed=3, skip=(hole,)), "1h", "BTCUSDT")
    hole_t = T0 + hole * H
    assert trades_gap["always_long"] and all(not (t["t"] - sv.WINDOW * H <= hole_t <= t["t"] + PRED_LEN * H) for t in trades_gap["always_long"])


def test_riepilogo_e_report():
    per_pair, spans = {}, {}
    for sym, seed in (("BTCUSDT", 4), ("ETHUSDT", 5)):
        per_pair[(sym, "1h")], spans[(sym, "1h")] = sv.simulate(make_df(n=1500, seed=seed), "1h", sym)
    s = sv.build_summary(per_pair, spans)
    assert set(s["by_pair"]) == {"BTCUSDT_1h", "ETHUSDT_1h"} and set(s["by_tf"]) == {"1h"}
    pooled = s["by_tf"]["1h"]["strategies"]["always_long"]["plan"]
    assert pooled["n"] == sum(len(per_pair[k]["always_long"]) for k in per_pair) and len(pooled["halves"]) == 2
    assert pooled["verdict"] in ("positivo", "negativo", "non_dimostrato")
    md = sv.to_markdown(s)
    assert "MA Crossover" in md and "Prima metà" in md and "BTCUSDT 1h" in md


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
