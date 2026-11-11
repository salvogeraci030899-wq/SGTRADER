"""Laboratorio strategie: prova ogni strategia di lab_strategies.py sullo storico Bitget con lo
stesso metro, e dice quali meritano la prova finale. Nessun modello: pochi minuti.

    python strategy_lab.py                         # tutto lo storico, tutte le strategie
    python strategy_lab.py --unseal donchian20:1d  # prova finale (una sola volta) sui mesi sigillati

Come si evita di ingannarsi provando tante strategie:
1. RICERCA: si usa solo lo storico prima di HOLDOUT_START. Una strategia è "candidata" se
   - il netto medio per trade è positivo con un p-value che supera la correzione per prove
     multiple (Benjamini-Hochberg, falsi positivi attesi al 10%, contando TUTTE le prove mai
     fatte e registrate in lab_registry.json),
   - ed è stabile: positiva in entrambe le metà del periodo e su almeno 2 coin su 3.
2. PROVA FINALE: i mesi da HOLDOUT_START in poi restano sigillati. Si aprono per una strategia
   alla volta, a regole congelate; l'apertura viene registrata e non si può ripetere "meglio".
   È "confermata" solo se anche lì il netto è positivo in modo significativo.
Nemmeno una strategia confermata è una garanzia: è solo il requisito minimo per passare alla
prova dal vivo senza soldi.

Costi: lo scenario principale è "futures taker" (commissione 0,06% + slippage 0,05% per lato,
funding reale di Bitget quando disponibile), perché è quello di un bot che entra ed esce con
ordini a mercato e stop sull'exchange. Gli altri scenari sono mostrati per confronto.
"""
import argparse
import json
import math
import os
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import requests

import lab_strategies
import strategies_validation as sv
import validation as va
import validation_stats as vs
from kronos_core import ALL_ASSETS, ALL_TIMEFRAMES, ATR_PERIOD, FEE_PCT, SLIPPAGE_PCT, TAX_RATE, TF_DELTA

HOLDOUT_START = "2025-11-11"     # da qui in poi lo storico è sigillato (deciso l'11/11/2026: ultimi 12 mesi)
DEFAULT_START = "2018-01-01"
WARMUP = 300                      # candele iniziali senza segnali (servono agli indicatori più lunghi)
FDR = 0.10                        # quota attesa di falsi positivi tra le candidate
MIN_TRADES = 30
SUMMARY_PATH = "lab_summary.json"
REGISTRY_PATH = "lab_registry.json"
REPORT_PATH = os.path.join(va.OUT_DIR, "LABORATORIO.md")
FUNDING_URL = "https://api.bitget.com/api/v2/mix/market/history-fund-rate"
FUNDING_INTERVAL = 8 * 3600

# Costi per lato in % (commissione + slippage) e se lo scenario ammette short e funding
SCENARIOS = {
    "futures_taker": {"label": "Futures, ordini a mercato", "cost": 0.06 + 0.05, "shorts": True, "funding": True},
    "futures_maker": {"label": "Futures, ordini limite (ottimistico: l'ordine deve essere eseguito)", "cost": 0.02, "shorts": True, "funding": True},
    "spot": {"label": "Spot (solo long)", "cost": FEE_PCT + SLIPPAGE_PCT, "shorts": False, "funding": False},
}
PRIMARY = "futures_taker"


def _ts(date):
    return int(datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())


# =========================
# INDICATORI
# =========================
def indicators(df):
    """Indicatori di una coppia. Le funzioni (ema, sma, ...) hanno memoria: ogni periodo si calcola una volta."""
    o, h, l, c, v = (df[k].to_numpy(dtype=float) for k in ("open", "high", "low", "close", "volume"))
    cs, hs, ls = pd.Series(c), pd.Series(h), pd.Series(l)
    prev_close = cs.shift(1)
    true_range = pd.concat([hs - ls, (hs - prev_close).abs(), (ls - prev_close).abs()], axis=1).max(axis=1)
    atr = true_range.rolling(ATR_PERIOD).mean().to_numpy()
    cache = {}

    def memo(key, make):
        if key not in cache:
            cache[key] = make()
        return cache[key]

    def rsi(p):
        d = cs.diff()
        gain = d.clip(lower=0).ewm(alpha=1 / p, adjust=False, min_periods=p).mean()
        loss = (-d.clip(upper=0)).ewm(alpha=1 / p, adjust=False, min_periods=p).mean()
        return (100 - 100 / (1 + gain / loss.replace(0, np.nan))).fillna(100).where(gain.notna()).to_numpy()

    def app(name):
        idx, signals, _ = sv.compute_signals(df)
        out = np.zeros(len(c), dtype=int)
        out[idx] = signals[name]
        return out

    return {
        "open": o, "high": h, "low": l, "close": c, "volume": v, "atr": atr, "atr_pct": atr / c * 100,
        "ema": lambda p: memo(("ema", p), lambda: cs.ewm(span=p, adjust=False, min_periods=p).mean().to_numpy()),
        "sma": lambda p: memo(("sma", p), lambda: cs.rolling(p).mean().to_numpy()),
        "std": lambda p: memo(("std", p), lambda: cs.rolling(p).std(ddof=0).to_numpy()),
        "ret": lambda p: memo(("ret", p), lambda: (cs / cs.shift(p) - 1).fillna(0).to_numpy()),
        "rsi": lambda p: memo(("rsi", p), lambda: rsi(p)),
        # massimo/minimo delle p candele PRECEDENTI (quella corrente esclusa)
        "high_max": lambda p: memo(("hh", p), lambda: hs.rolling(p).max().shift(1).to_numpy()),
        "low_min": lambda p: memo(("ll", p), lambda: ls.rolling(p).min().shift(1).to_numpy()),
        "median": lambda arr, p: pd.Series(arr).rolling(p).median().to_numpy(),
        "app": lambda name: memo(("app", name), lambda: app(name)),
    }


# =========================
# MOTORE
# =========================
def simulate(df, tf, symbol, spec, signal=None):
    """Trade di una strategia su una coppia, uno alla volta. Ingresso alla chiusura della candela del
    segnale. A ogni candela successiva: prima lo stop (se la candela apre già oltre lo stop si esce
    all'apertura, cioè peggio dello stop), poi il target, poi si aggiorna lo stop che segue il prezzo
    usando la chiusura. Se lo storico ha un buco si esce all'ultima chiusura disponibile."""
    x = indicators(df)
    sig = np.asarray(spec["fn"](x) if signal is None else signal)
    ex = spec["exit"]
    o, h, l, c, atr = x["open"], x["high"], x["low"], x["close"], x["atr"]
    times = np.array([int(t.timestamp()) for t in df["time"]])
    step = int(TF_DELTA[tf].total_seconds())
    n, trades, i = len(c), [], WARMUP
    while i < n - 1:
        s = int(sig[i])
        if s == 0 or not np.isfinite(atr[i]) or atr[i] <= 0 or times[i + 1] - times[i] != step:
            i += 1
            continue
        long = s > 0
        entry, a = c[i], atr[i]
        stop = entry - ex["stop_atr"] * a if long else entry + ex["stop_atr"] * a
        target = None if ex["target_atr"] is None else (entry + ex["target_atr"] * a if long else entry - ex["target_atr"] * a)
        best, exit_price, reason, j = entry, None, "TEMPO", i
        last = min(i + ex["max_hold"], n - 1)
        while j < last:
            if times[j + 1] - times[j] != step:
                reason = "BUCO"
                break
            j += 1
            if (l[j] <= stop) if long else (h[j] >= stop):
                exit_price, reason = (min(stop, o[j]) if long else max(stop, o[j])), "STOP"
                break
            if target is not None and ((h[j] >= target) if long else (l[j] <= target)):
                exit_price, reason = target, "TARGET"
                break
            if ex["trail_atr"] is not None:
                best = max(best, c[j]) if long else min(best, c[j])
                stop = max(stop, best - ex["trail_atr"] * a) if long else min(stop, best + ex["trail_atr"] * a)
        if exit_price is None:
            exit_price = c[j]
        if j > i:
            trades.append({"symbol": symbol, "tf": tf, "t": int(times[i]), "t_exit": int(times[j]) + step, "dir": 1 if long else -1,
                           "gross": float((exit_price - entry) / entry * 100 * (1 if long else -1)), "bars": j - i, "reason": reason})
        i = max(j, i + 1)      # alla chiusura della candela di uscita si può rientrare
    return trades


# =========================
# FUNDING
# =========================
def fetch_funding_history(symbol, max_pages=400, pause=0.12):
    """Storico del funding dei perpetui USDT: (tempi in secondi, tassi in %) in ordine cronologico. Vuoto se non disponibile."""
    rows = {}
    for page in range(1, max_pages + 1):
        try:
            r = requests.get(FUNDING_URL, params={"symbol": symbol, "productType": "USDT-FUTURES", "pageSize": 100, "pageNo": page}, timeout=20)
            r.raise_for_status()
            data = r.json().get("data") or []
        except Exception as e:
            print(f"  funding {symbol} pagina {page}: {e}")
            break
        new = 0
        for d in data:
            t = int(float(d["fundingTime"])) // 1000
            if t not in rows:
                rows[t] = float(d["fundingRate"]) * 100
                new += 1
        if new == 0:
            break
        time.sleep(pause)
    ts = np.array(sorted(rows), dtype=np.int64)
    return ts, np.array([rows[t] for t in ts])


def funding_cost(trade, funding):
    """Funding pagato (+) o ricevuto (-) dal trade, in % della posizione. Dove lo storico non arriva si
    usa il tasso medio osservato. Ritorna (costo, True se interamente da dati reali)."""
    ts, rates = funding if funding is not None else (np.array([]), np.array([]))
    if len(ts) == 0:
        return 0.0, False
    lo, hi = np.searchsorted(ts, trade["t"], side="right"), np.searchsorted(ts, trade["t_exit"], side="right")
    paid = float(rates[lo:hi].sum())
    covered = trade["t"] >= ts[0]
    if not covered:   # parte del trade è prima dell'inizio dello storico del funding
        missing = max(0, (min(trade["t_exit"], int(ts[0])) - trade["t"]) // FUNDING_INTERVAL)
        paid += missing * float(rates.mean())
    return paid * trade["dir"], bool(covered)


def net_returns(trades, scenario, funding_by_symbol):
    """Netto % di ogni trade nello scenario di costo; None per i trade non ammessi (short in spot)."""
    sc = SCENARIOS[scenario]
    out = []
    for t in trades:
        if t["dir"] < 0 and not sc["shorts"]:
            out.append(None)
            continue
        f = funding_cost(t, funding_by_symbol.get(t["symbol"]))[0] if sc["funding"] else 0.0
        out.append(t["gross"] - 2 * sc["cost"] - f)
    return out


# =========================
# STATISTICHE
# =========================
def cluster_p_value(values, clusters):
    """p-value a una coda per "media > 0", con errore standard robusto ai blocchi di tempo."""
    values = np.asarray(values, dtype=float)
    _, inv = np.unique(np.asarray(clusters), return_inverse=True)
    sums, counts = np.bincount(inv, weights=values), np.bincount(inv).astype(float)
    g = len(sums)
    if g < 10:
        return None
    mean = sums.sum() / counts.sum()
    se = math.sqrt(g / (g - 1) * float(((sums - mean * counts) ** 2).sum())) / counts.sum()
    if se == 0:
        return None
    return 0.5 * math.erfc(mean / se / math.sqrt(2))


def benjamini_hochberg(p_values, m, q=FDR):
    """p_values: {chiave: p}. m = numero totale di prove (anche quelle non più presenti). Ritorna le chiavi che passano."""
    ranked = sorted((p, k) for k, p in p_values.items() if p is not None)
    passed, cut = set(), 0
    for rank, (p, _) in enumerate(ranked, start=1):
        if p <= q * rank / m:
            cut = rank
    for p, k in ranked[:cut]:
        passed.add(k)
    return passed


def describe(trades, nets, block_seconds):
    """Statistiche dei trade con netto non nullo."""
    rows = [(t, v) for t, v in zip(trades, nets) if v is not None]
    if not rows:
        return {"n": 0}
    rows.sort(key=lambda r: r[0]["t"])
    net = np.array([v for _, v in rows])
    clusters = np.array([t["t"] // block_seconds for t, _ in rows])
    years = max((rows[-1][0]["t_exit"] - rows[0][0]["t"]) / (365.25 * 86400), 1e-9)
    coins = sorted({t["symbol"] for t, _ in rows})
    total = float(net.sum())
    return {
        "n": len(rows),
        "win_rate": round(float((net > 0).mean() * 100), 1),
        "avg_gross_pct": round(float(np.mean([t["gross"] for t, _ in rows])), 3),
        "avg_net_pct": round(float(net.mean()), 3),
        "avg_net_ci": vs.cluster_ci(net, clusters),
        "p_value": cluster_p_value(net, clusters),
        "avg_bars": round(float(np.mean([t["bars"] for t, _ in rows])), 1),
        # somma dei netti per anno e per coin: rendimento annuo indicativo, senza leva e senza reinvestire
        "net_per_year_per_coin_pct": round(total / years / len(coins), 1),
        "after_tax_per_year_per_coin_pct": round((total * (1 - TAX_RATE) if total > 0 else total) / years / len(coins), 1),
        "by_coin": {s: round(float(np.mean([v for t, v in rows if t["symbol"] == s])), 3) for s in coins},
    }


def evaluate(trades, funding, block_seconds, holdout_ts):
    """Una prova (strategia x timeframe): ricerca prima di holdout_ts, più i trade sigillati tenuti da parte."""
    research = [t for t in trades if t["t_exit"] <= holdout_ts]
    sealed = [t for t in trades if t["t"] >= holdout_ts]
    primary = net_returns(research, PRIMARY, funding)
    out = describe(research, primary, block_seconds)
    if out["n"]:
        order = sorted(range(len(research)), key=lambda i: research[i]["t"])
        mid = (research[order[0]]["t"] + research[order[-1]]["t"]) / 2
        halves = [[primary[i] for i in order if (research[i]["t"] <= mid) == first and primary[i] is not None] for first in (True, False)]
        out["halves"] = [{"n": len(hv), "avg_net_pct": round(float(np.mean(hv)), 3) if hv else None} for hv in halves]
        out["stable"] = bool(all(hv["avg_net_pct"] is not None and hv["avg_net_pct"] > 0 for hv in out["halves"])
                             and sum(1 for v in out["by_coin"].values() if v > 0) >= min(2, len(out["by_coin"])))
        out["funding_real_share_pct"] = round(float(np.mean([funding_cost(t, funding.get(t["symbol"]))[1] for t in research]) * 100), 0)
        out["other_scenarios"] = {}
        for name in SCENARIOS:
            if name != PRIMARY:
                d = describe(research, net_returns(research, name, funding), block_seconds)
                out["other_scenarios"][name] = {k: d.get(k) for k in ("n", "avg_net_pct", "avg_net_ci", "net_per_year_per_coin_pct")}
    return out, sealed


def load_registry(path=REGISTRY_PATH):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {"holdout_start": HOLDOUT_START, "trials": {}, "unsealed": {}}


def build_summary(per_trial, funding, registry, unseal=(), today=None):
    """per_trial: {(strategia, tf): [trade di tutte le coin]}. Aggiorna il registro (prove e aperture) e ritorna il riepilogo."""
    today = today or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    holdout_ts = _ts(registry["holdout_start"])
    results, sealed = {}, {}
    for (name, tf), trades in per_trial.items():
        key = f"{name}:{tf}"
        spec = lab_strategies.STRATEGIES[name]
        block = max(7 * 86400, spec["exit"]["max_hold"] * int(TF_DELTA[tf].total_seconds()))
        results[key], sealed[key] = evaluate(trades, funding, block, holdout_ts)
        results[key].update({"strategy": name, "tf": tf, "family": spec["family"], "block_seconds": block})
        registry["trials"].setdefault(key, {"first_tested": today, "description": spec["description"]})

    m = len(registry["trials"])     # tutte le prove mai fatte, anche di strategie poi tolte dal codice
    significant = benjamini_hochberg({k: r.get("p_value") for k, r in results.items() if r["n"] >= MIN_TRADES and r["avg_net_pct"] > 0}, m)
    for key, r in results.items():
        r["significant"] = key in significant
        r["candidate"] = bool(key in significant and r.get("stable"))

    for key in unseal:
        if key not in results:
            raise SystemExit(f"Prova sconosciuta: {key}")
        registry["unsealed"].setdefault(key, today)
    n_unsealed = len(registry["unsealed"])
    for key in registry["unsealed"]:
        if key not in results:
            continue
        trades = sealed[key]
        d = describe(trades, net_returns(trades, PRIMARY, funding), results[key]["block_seconds"])
        p = d.get("p_value")
        d["confirmed"] = bool(d["n"] >= MIN_TRADES and p is not None and p < 0.05 / n_unsealed and d["avg_net_pct"] > 0)
        d["unsealed_on"] = registry["unsealed"][key]
        results[key]["holdout"] = d

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "holdout_start": registry["holdout_start"],
        "trials_registered": m,
        "fdr": FDR,
        "primary_scenario": PRIMARY,
        "scenarios": {k: {"label": v["label"], "cost_pct_per_side": v["cost"], "funding": v["funding"]} for k, v in SCENARIOS.items()},
        "tax_rate": TAX_RATE,
        "candidates": sorted(k for k, r in results.items() if r["candidate"]),
        "confirmed": sorted(k for k, r in results.items() if r.get("holdout", {}).get("confirmed")),
        "results": results,
    }


# =========================
# REPORT
# =========================
def to_markdown(s):
    sc = s["scenarios"][s["primary_scenario"]]
    out = ["# Laboratorio strategie", "",
           f"Generato il {s['generated_at']} · {len(s['results'])} prove in questa esecuzione, {s['trials_registered']} registrate in tutto.", "",
           f"- **Ricerca** solo sullo storico prima del {s['holdout_start']}; da lì in poi è **sigillato** per la prova finale.",
           f"- **Costi** (scenario principale: {sc['label'].lower()}): {sc['cost_pct_per_side']:.2f}% per lato più funding reale. \"Netto\" = dopo questi costi, tasse escluse.",
           f"- **Candidata** = netto positivo che supera la correzione per prove multiple (falsi positivi attesi {round(s['fdr'] * 100)}%) "
           "**e** stabile (positiva in entrambe le metà del periodo e su almeno 2 coin su 3).",
           "- **Netto annuo per coin**: somma dei netti divisa per anni e coin, senza leva e senza reinvestire. Indicativo.",
           "- Una candidata non è un segnale valido: deve ancora superare la prova finale e poi la prova dal vivo senza soldi.",
           "- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.", "",
           f"**Candidate: {', '.join(s['candidates']) if s['candidates'] else 'nessuna'}.** "
           f"**Confermate dalla prova finale: {', '.join(s['confirmed']) if s['confirmed'] else 'nessuna'}.**", ""]
    for tf in ALL_TIMEFRAMES:
        rows = sorted((r for r in s["results"].values() if r["tf"] == tf and r["n"]), key=lambda r: -r["avg_net_pct"])
        if not rows:
            continue
        out += [f"### Timeframe {tf}", "",
                "| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Netto annuo per coin | Esito |",
                "|---|---|---|---|---|---|---|---|---|---|---|---|"]
        for r in rows:
            p = "n/d" if r.get("p_value") is None else f"{r['p_value']:.4f}"
            halves = " / ".join("—" if hv["avg_net_pct"] is None else f"{hv['avg_net_pct']:+.2f}%" for hv in r["halves"])
            coins = " / ".join(f"{r['by_coin'][c]:+.2f}%" if c in r["by_coin"] else "—" for c in ALL_ASSETS)
            verdict = "**CANDIDATA**" if r["candidate"] else "significativa ma instabile" if r["significant"] else "campione piccolo" if r["n"] < MIN_TRADES else "no"
            out.append(f"| {r['strategy']} | {r['family']} | {r['n']} | {r['win_rate']}% | {r['avg_bars']} candele | {r['avg_net_pct']:+.3f}% | "
                       f"{vs._ci(r['avg_net_ci'])} | {p} | {halves} | {coins} | {r['net_per_year_per_coin_pct']:+.1f}% | {verdict} |")
        out.append("")
    opened = [r for r in s["results"].values() if "holdout" in r]
    if opened:
        out += ["### Prove finali sui mesi sigillati", "",
                "| Prova | Aperta il | Trade | Netto medio | IC 95% | p | Esito |", "|---|---|---|---|---|---|---|"]
        for r in opened:
            hd = r["holdout"]
            if not hd["n"]:
                out.append(f"| {r['strategy']}:{r['tf']} | {hd['unsealed_on']} | 0 | — | — | — | nessun trade |")
                continue
            p = "n/d" if hd.get("p_value") is None else f"{hd['p_value']:.4f}"
            out.append(f"| {r['strategy']}:{r['tf']} | {hd['unsealed_on']} | {hd['n']} | {hd['avg_net_pct']:+.3f}% | {vs._ci(hd['avg_net_ci'])} | {p} | "
                       f"{'**CONFERMATA**' if hd['confirmed'] else 'non confermata'} |")
        out.append("")
    out += ["### Le strategie", ""]
    for name, spec in lab_strategies.STRATEGIES.items():
        out.append(f"- **{name}** ({spec['family']}): {spec['description']}")
    return "\n".join(out) + "\n"


def main(start, symbols, tfs, unseal=(), save_registry=True):
    start_ms = _ts(start) * 1000
    funding = {}
    for symbol in symbols:
        funding[symbol] = fetch_funding_history(symbol)
        ts = funding[symbol][0]
        print(f"Funding {symbol}: {len(ts)} valori" + (f" dal {datetime.fromtimestamp(ts[0], tz=timezone.utc):%d/%m/%Y}" if len(ts) else " (non disponibile)"))
    per_trial = {}
    for symbol in symbols:
        for tf in tfs:
            df = va.download_history(symbol, tf, start_ms)
            if df is None or len(df) < WARMUP + 200:
                print(f"{symbol} {tf}: storico insufficiente, salto.")
                continue
            print(f"{symbol} {tf}: {len(df)} candele dal {df['time'].iloc[0]:%d/%m/%Y}")
            for name, spec in lab_strategies.STRATEGIES.items():
                per_trial.setdefault((name, tf), []).extend(simulate(df, tf, symbol, spec))
    if not per_trial:
        raise SystemExit("Nessuno storico scaricato.")
    registry = load_registry()
    summary = build_summary(per_trial, funding, registry, unseal)
    with open(SUMMARY_PATH, "w") as f:
        json.dump(summary, f, indent=1)
    os.makedirs(os.path.dirname(os.path.abspath(REPORT_PATH)), exist_ok=True)
    with open(REPORT_PATH, "w") as f:
        f.write(to_markdown(summary))
    if save_registry:
        with open(REGISTRY_PATH, "w") as f:
            json.dump(registry, f, indent=1, sort_keys=True)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", default=DEFAULT_START)
    parser.add_argument("--symbols", nargs="*", default=ALL_ASSETS, choices=ALL_ASSETS)
    parser.add_argument("--tfs", nargs="*", default=ALL_TIMEFRAMES, choices=ALL_TIMEFRAMES)
    parser.add_argument("--unseal", nargs="*", default=[], help="prove da aprire sui mesi sigillati, es. donchian20:1d (registrato, una volta sola)")
    parser.add_argument("--no-registry", action="store_true", help="non aggiorna lab_registry.json (prove tecniche)")
    args = parser.parse_args()
    main(args.start, args.symbols, args.tfs, [u for u in args.unseal if u], save_registry=not args.no_registry)
    print(open(REPORT_PATH).read())
