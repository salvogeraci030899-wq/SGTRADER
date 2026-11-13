"""Esperimento (non fa parte del bot): cooldown dopo uno stop e uscita parziale con break-even,
confrontati con le uscite attuali del laboratorio. Solo dati PRIMA dei mesi sigillati (holdout)."""
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lab_strategies  # noqa: E402
import strategy_lab as lab  # noqa: E402
import validation as va  # noqa: E402
from kronos_core import TF_DELTA, TRADE_ASSETS  # noqa: E402

COST = 0.22          # % andata e ritorno (taker futures 0,11% per lato)
END = lab._ts(lab.HOLDOUT_START) if hasattr(lab, "HOLDOUT_START") else lab._ts("2025-11-11")
START = lab._ts("2019-01-01")
SPLIT = lab._ts("2022-06-01")


def run(x, sig, df, tf, symbol, ex, cooldown=0, tp1_r=None, frac=0.5):
    o, h, l, c, atr = x["open"], x["high"], x["low"], x["close"], x["atr"]
    times = np.array([int(t.timestamp()) for t in df["time"]])
    step = int(TF_DELTA[tf].total_seconds())
    n, out, i = len(c), [], lab.WARMUP
    channel = (x["low_min"](ex["channel_exit"]), x["high_max"](ex["channel_exit"])) if ex.get("channel_exit") else None
    while i < n - 1:
        s = int(sig[i])
        if s == 0 or not np.isfinite(atr[i]) or atr[i] <= 0 or times[i + 1] - times[i] != step:
            i += 1
            continue
        long = s > 0
        sg = 1 if long else -1
        entry, a = c[i], atr[i]
        stop = entry - sg * ex["stop_atr"] * a
        risk = abs(entry - stop)
        target = None if ex.get("target_atr") is None else entry + sg * ex["target_atr"] * a
        tp1 = None if tp1_r is None else entry + sg * tp1_r * risk
        part = None                       # rendimento della parte già chiusa al TP1
        best, exit_price, reason, j = entry, None, "TEMPO", i
        last = min(i + ex["max_hold"], n - 1)
        while j < last:
            if times[j + 1] - times[j] != step:
                break
            j += 1
            if (l[j] <= stop) if long else (h[j] >= stop):
                exit_price, reason = (min(stop, o[j]) if long else max(stop, o[j])), "STOP"
                break
            if tp1 is not None and part is None and ((h[j] >= tp1) if long else (l[j] <= tp1)):
                part = max(tp1, o[j]) if long else min(tp1, o[j])
                stop = max(stop, entry) if long else min(stop, entry)          # break-even sul resto
            if target is not None and ((h[j] >= target) if long else (l[j] <= target)):
                exit_price, reason = target, "TARGET"
                break
            if ex.get("trail_atr") is not None:
                best = max(best, c[j]) if long else min(best, c[j])
                stop = max(stop, best - ex["trail_atr"] * a) if long else min(stop, best + ex["trail_atr"] * a)
            if channel is not None and ((c[j] < channel[0][j]) if long else (c[j] > channel[1][j])):
                exit_price, reason = c[j], "CANALE"
                break
        if exit_price is None:
            exit_price = c[j]
        if j > i:
            r_rest = (exit_price - entry) / entry * 100 * sg
            gross = r_rest if part is None else frac * (part - entry) / entry * 100 * sg + (1 - frac) * r_rest
            out.append((int(times[i]), gross - COST))
        loss_stop = reason == "STOP" and exit_price is not None and (exit_price - entry) * sg < 0
        i = max(j, i + 1) + (cooldown if loss_stop else 0)
    return out


def stats(rows, years, coins):
    if not rows:
        return None
    rows.sort()
    v = np.array([r for _, r in rows])
    eq = np.cumsum(v) / coins
    dd = float((eq - np.maximum.accumulate(eq)).min())
    first = [r for t, r in rows if t < SPLIT]
    second = [r for t, r in rows if t >= SPLIT]
    return {"n": len(v), "avg": v.mean(), "win": (v > 0).mean() * 100, "year": v.sum() / years / coins, "dd": dd,
            "t": v.mean() / (v.std(ddof=1) / np.sqrt(len(v))) if len(v) > 2 else 0,
            "h1": np.sum(first) / coins, "h2": np.sum(second) / coins}


VARIANTS = {"base": {}, "cool24h": {"cooldown_h": 24}, "cool72h": {"cooldown_h": 72},
            "tp1R_50": {"tp1_r": 1.0}, "tp1.5R_50": {"tp1_r": 1.5}, "cool24h+tp1R": {"cooldown_h": 24, "tp1_r": 1.0}}


def main():
    t0 = time.time()
    data = {}
    for tf in ("1d", "4h"):
        for s in TRADE_ASSETS:
            data[(s, tf)] = va.download_history(s, tf, START * 1000 - lab.WARMUP * int(TF_DELTA[tf].total_seconds()) * 1000, now_ms=END * 1000)
            print(f"scaricato {s} {tf}: {0 if data[(s, tf)] is None else len(data[(s, tf)])} candele ({time.time() - t0:.0f}s)", flush=True)
    years = (END - START) / (365.25 * 86400)
    agg = {v: [] for v in VARIANTS}
    lines = []
    for tf in ("1d", "4h"):
        dfs = {s: data[(s, tf)] for s in TRADE_ASSETS if data[(s, tf)] is not None}
        peers = lab.peer_table(dfs)
        xs = {s: lab.indicators(df, s, peers, None) for s, df in dfs.items()}
        bars_h = TF_DELTA[tf].total_seconds() / 3600
        for name, spec in lab_strategies.STRATEGIES.items():
            if tf not in (spec.get("tfs") or ("1d", "4h", "1h")):
                continue
            res = {}
            for vname, v in VARIANTS.items():
                rows = []
                for s, df in dfs.items():
                    sig = np.asarray(spec["fn"](xs[s]))
                    rows += run(xs[s], sig, df, tf, s, spec["exit"], cooldown=int(round(v.get("cooldown_h", 0) / bars_h)), tp1_r=v.get("tp1_r"))
                res[vname] = stats(rows, years, len(dfs))
            if not res["base"] or res["base"]["n"] < 30:
                continue
            b = res["base"]
            for vname, r in res.items():
                agg[vname].append((f"{name}:{tf}", r, b))
            lines.append(f"{name}:{tf}".ljust(26) + " ".join(
                f"{vn}: {r['year']:+6.1f}%/a dd{r['dd']:6.0f} t{r['t']:+4.1f} [{r['h1']:+5.0f}|{r['h2']:+5.0f}]" for vn, r in res.items() if r))
    print("\n=== PER STRATEGIA (rendimento netto % per coin per anno, drawdown % per coin, t-stat, [prima metà | seconda metà]) ===")
    print("\n".join(lines))
    print("\n=== RIASSUNTO: rispetto alle uscite attuali ===")
    for vname, items in agg.items():
        if vname == "base":
            continue
        d_year = [r["year"] - b["year"] for _, r, b in items]
        d_dd = [r["dd"] - b["dd"] for _, r, b in items]
        better_both = sum(1 for _, r, b in items if r["h1"] > b["h1"] and r["h2"] > b["h2"])
        good = [(k, r, b) for k, r, b in items if b["year"] > 0 and b["t"] > 1]
        d_good = [r["year"] - b["year"] for _, r, b in good]
        print(f"{vname:14s} strategie {len(items)}: rendimento migliore in {sum(d > 0 for d in d_year)}, "
              f"mediana {np.median(d_year):+.2f} %/a; drawdown mediana {np.median(d_dd):+.1f}; migliore in entrambe le metà: {better_both}; "
              f"sulle {len(good)} con vantaggio (t>1): migliore in {sum(d > 0 for d in d_good)}, mediana {np.median(d_good) if d_good else 0:+.2f} %/a")


if __name__ == "__main__":
    main()
