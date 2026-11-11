"""Laboratorio strategie: prova ogni strategia di lab_strategies.py sullo storico Bitget con lo
stesso metro, e dice quali meritano la prova finale. Nessun modello: pochi minuti.

    python strategy_lab.py                         # tutto lo storico, tutte le strategie
    python strategy_lab.py --unseal donchian20:1d  # prova finale (una sola volta) sui mesi sigillati

Come si evita di ingannarsi provando tante strategie:
1. RICERCA: si usa solo lo storico prima di HOLDOUT_START. Una strategia è "candidata" se
   - il netto medio per trade OLTRE IL MERCATO è positivo con un p-value che supera la correzione
     per prove multiple (Benjamini-Hochberg, falsi positivi attesi al 10%, contando TUTTE le prove mai
     fatte e registrate in lab_registry.json),
   - ed è stabile: positiva in entrambe le metà del periodo e su almeno 2 coin su 3.
2. PROVA FINALE: i mesi da HOLDOUT_START in poi restano sigillati. Si aprono per una strategia
   alla volta, a regole congelate; l'apertura viene registrata e non si può ripetere "meglio".
   È "confermata" solo se anche lì il netto è positivo in modo significativo.
"Oltre il mercato": a ogni trade si toglie quello che avrebbe reso la semplice esposizione, cioè
direzione x durata x rendimento medio per candela della coin nel periodo. In un mercato che sale
un long qualsiasi guadagna: così si misura la scelta dei momenti, non il rialzo del mercato.
Nemmeno una strategia confermata è una garanzia: è solo il requisito minimo per passare alla
prova dal vivo senza soldi.

Costi: lo scenario principale è "futures taker" (commissione 0,06% + slippage 0,05% per lato,
funding: reale negli ultimi mesi, ipotesi prudente prima), perché è quello di un bot che entra ed esce con
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
# Bitget pubblica solo gli ultimi ~3 mesi di funding. Per i trade più vecchi si usa un'ipotesi
# prudente: il long paga il tasso base (0,01% ogni 8 ore, circa 11% l'anno), lo short non riceve nulla.
FUNDING_ASSUMED_LONG_PCT = 0.01

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
def peer_table(dfs):
    """Chiusure di tutte le coin di un timeframe allineate per tempo (secondi): serve alle strategie
    di forza relativa, che confrontano una coin con le altre nello stesso istante."""
    cols = {s: pd.Series(df["close"].to_numpy(dtype=float), index=[int(t.timestamp()) for t in df["time"]]) for s, df in dfs.items()}
    return pd.DataFrame(cols).sort_index()


def indicators(df, symbol=None, peers=None):
    """Indicatori di una coppia. Le funzioni (ema, sma, ...) hanno memoria: ogni periodo si calcola una volta.
    peers (facoltativo): tabella di peer_table, per le strategie di forza relativa."""
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

    times = [int(t.timestamp()) for t in df["time"]]

    def rank_ret(p):
        """+1 se la coin ha il rendimento a p candele più alto delle tre, -1 se il più basso, 0 altrimenti.
        0 anche quando manca anche una sola coin in quell'istante (es. SOL prima del 2021)."""
        if peers is None or symbol not in peers.columns or peers.shape[1] < 3:
            return np.zeros(len(c), dtype=int)
        r = (peers / peers.shift(p) - 1).reindex(times)
        full = r.notna().all(axis=1).to_numpy()
        mine = r[symbol].to_numpy()
        best = (mine >= r.max(axis=1).to_numpy()) & full
        worst = (mine <= r.min(axis=1).to_numpy()) & full
        return np.where(best & ~worst, 1, np.where(worst & ~best, -1, 0))

    return {
        "rank_ret": lambda p: memo(("rank", p), lambda: rank_ret(p)),
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
def simulate(df, tf, symbol, spec, signal=None, peers=None):
    """Trade di una strategia su una coppia, uno alla volta. Ingresso alla chiusura della candela del
    segnale. A ogni candela successiva: prima lo stop (se la candela apre già oltre lo stop si esce
    all'apertura, cioè peggio dello stop), poi il target, poi si aggiorna lo stop che segue il prezzo
    usando la chiusura, infine l'uscita a canale (chiusura oltre il minimo/massimo delle N candele precedenti). Se lo storico ha un buco si esce all'ultima chiusura disponibile."""
    x = indicators(df, symbol, peers)
    sig = np.asarray(spec["fn"](x) if signal is None else signal)
    ex = spec["exit"]
    o, h, l, c, atr = x["open"], x["high"], x["low"], x["close"], x["atr"]
    times = np.array([int(t.timestamp()) for t in df["time"]])
    step = int(TF_DELTA[tf].total_seconds())
    n, trades, i = len(c), [], WARMUP
    channel = (x["low_min"](ex["channel_exit"]), x["high_max"](ex["channel_exit"])) if ex.get("channel_exit") else None
    while i < n - 1:
        s = int(sig[i])
        if s == 0 or not np.isfinite(atr[i]) or atr[i] <= 0 or times[i + 1] - times[i] != step:
            i += 1
            continue
        long = s > 0
        entry, a = c[i], atr[i]
        stop = entry - ex["stop_atr"] * a if long else entry + ex["stop_atr"] * a
        stop0 = stop                      # stop iniziale: serve al dimensionamento della posizione
        target = None if ex.get("target_atr") is None else (entry + ex["target_atr"] * a if long else entry - ex["target_atr"] * a)
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
            if ex.get("trail_atr") is not None:
                best = max(best, c[j]) if long else min(best, c[j])
                stop = max(stop, best - ex["trail_atr"] * a) if long else min(stop, best + ex["trail_atr"] * a)
            if channel is not None and ((c[j] < channel[0][j]) if long else (c[j] > channel[1][j])):
                exit_price, reason = c[j], "CANALE"      # chiusura oltre il canale opposto: si esce alla chiusura
                break
        # Lo storico è finito prima di una vera uscita: il trade è ancora aperto (serve alla prova su carta)
        still_open = exit_price is None and reason == "TEMPO" and j == n - 1 and j < i + ex["max_hold"]
        if exit_price is None:
            exit_price = c[j]
        if j > i or still_open:
            trades.append({"symbol": symbol, "tf": tf, "t": int(times[i]), "t_entry": int(times[i]) + step, "t_exit": int(times[j]) + step, "dir": 1 if long else -1,
                           "gross": float((exit_price - entry) / entry * 100 * (1 if long else -1)), "bars": j - i, "reason": reason,
                           "open": bool(still_open), "entry": float(entry), "exit": float(exit_price), "stop": float(stop), "stop0": float(stop0)})
        if still_open:
            break
        i = max(j, i + 1)      # alla chiusura della candela di uscita si può rientrare
    return trades


def annotate_drift(trades, df, holdout_ts):
    """Aggiunge a ogni trade "drift": quanto avrebbe reso la sola esposizione (direzione x durata x
    rendimento medio per candela della coin). Il rendimento medio è calcolato separatamente per il
    periodo di ricerca e per i mesi sigillati, così ogni periodo è confrontato con il proprio mercato."""
    times = np.array([int(t.timestamp()) for t in df["time"]])
    c = df["close"].to_numpy(dtype=float)
    bar_ret = np.diff(c) / c[:-1] * 100
    before = times[1:] < holdout_ts
    mu = {True: float(bar_ret[before].mean()) if before.any() else 0.0, False: float(bar_ret[~before].mean()) if (~before).any() else 0.0}
    for t in trades:
        t["drift"] = t["dir"] * t["bars"] * mu[t["t"] < holdout_ts]
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
    """Funding pagato (+) o ricevuto (-) dal trade, in % della posizione. Dove lo storico reale non arriva
    vale l'ipotesi prudente (il long paga il tasso base, lo short non riceve). Ritorna (costo, True se
    interamente da dati reali)."""
    ts, rates = funding if funding is not None else (np.array([]), np.array([]))
    start = trade.get("t_entry", trade["t"])      # si entra alla CHIUSURA della candela del segnale
    first = int(ts[0]) if len(ts) else None
    covered = first is not None and start >= first
    cost = 0.0
    if first is not None:
        lo, hi = np.searchsorted(ts, start, side="right"), np.searchsorted(ts, trade["t_exit"], side="right")
        cost = float(rates[lo:hi].sum()) * trade["dir"]
    if not covered:   # tutto o parte del trade è prima dell'inizio dello storico reale
        end = trade["t_exit"] if first is None else min(trade["t_exit"], first)
        missing = max(0, (end - start) // FUNDING_INTERVAL)
        cost += missing * FUNDING_ASSUMED_LONG_PCT if trade["dir"] > 0 else 0.0
    return cost, bool(covered)


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
# PORTAFOGLIO
# =========================
def portfolio(trades, nets, risk=None):
    """Simula la strategia come la userebbe l'esecutore, sulle tre coin insieme: stesso dimensionamento
    (rischio per trade sulla distanza dello stop iniziale, tagliato da leva ed esposizione totale),
    una posizione per coin, massimo di posizioni aperte. Patrimonio di partenza 100, nessun prelievo.
    Il patrimonio si aggiorna alla chiusura dei trade (niente valutazione intermedia: il drawdown vero
    dentro i trade può essere più profondo). Il limite di perdita giornaliera non è simulato."""
    import executor
    risk = {**executor.DEFAULT_RISK, **(risk or {})}
    exact = {"volume_place": 12, "min_size": 0.0}
    rows = sorted(((t, v) for t, v in zip(trades, nets) if v is not None), key=lambda r: (r[0].get("t_entry", r[0]["t"]), r[0]["symbol"]))
    if not rows:
        return {"n": 0}
    equity, peak, max_dd = 100.0, 100.0, 0.0
    open_pos, curve, taken, skipped = [], [], 0, 0

    def close_until(ts):
        nonlocal equity, peak, max_dd
        for p in sorted([p for p in open_pos if p["t_exit"] <= ts], key=lambda p: p["t_exit"]):
            open_pos.remove(p)
            equity += p["notional"] * p["net"] / 100
            peak = max(peak, equity)
            max_dd = min(max_dd, (equity / peak - 1) * 100)
            curve.append([p["t_exit"], round(equity, 3)])

    for t, net in rows:
        start = t.get("t_entry", t["t"])
        close_until(start)
        if equity <= 0:
            break
        if any(p["symbol"] == t["symbol"] for p in open_pos) or len(open_pos) >= risk["max_open_positions"]:
            skipped += 1
            continue
        stop = t.get("stop0", t.get("stop"))
        open_notional = sum(p["notional"] for p in open_pos)
        size, why = executor.size_position(equity, t["entry"], stop, risk, open_notional, exact) if stop else (0, "senza stop")
        if not size:
            skipped += 1
            continue
        open_pos.append({"symbol": t["symbol"], "t_exit": t["t_exit"], "notional": size * t["entry"], "net": net})
        taken += 1
    close_until(float("inf"))
    years = max((rows[-1][0]["t_exit"] - rows[0][0].get("t_entry", rows[0][0]["t"])) / (365.25 * 86400), 1e-9)
    total = equity / 100
    step = max(1, len(curve) // 200)
    return {
        "n": taken, "skipped": skipped,
        "final_equity": round(equity, 2),
        "total_return_pct": round((total - 1) * 100, 1),
        "annual_return_pct": round(((total ** (1 / years)) - 1) * 100, 1) if total > 0 else -100.0,
        "max_drawdown_pct": round(max_dd, 1),
        "years": round(years, 1),
        "curve": curve[::step] + ([curve[-1]] if curve and (len(curve) - 1) % step else []),
    }


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
    excess = net - np.array([t.get("drift", 0.0) for t, _ in rows])      # netto oltre la semplice esposizione al mercato
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
        "excess_avg_pct": round(float(excess.mean()), 3),
        "excess_ci": vs.cluster_ci(excess, clusters),
        "excess_p": cluster_p_value(excess, clusters),
        "excess_by_coin": {s: round(float(np.mean([e for (t, _), e in zip(rows, excess) if t["symbol"] == s])), 3) for s in coins},
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
        # stabilità misurata sul netto oltre il mercato
        halves = [[primary[i] - research[i].get("drift", 0.0) for i in order if (research[i]["t"] <= mid) == first and primary[i] is not None]
                  for first in (True, False)]
        out["halves"] = [{"n": len(hv), "excess_avg_pct": round(float(np.mean(hv)), 3) if hv else None} for hv in halves]
        out["stable"] = bool(all(hv["excess_avg_pct"] is not None and hv["excess_avg_pct"] > 0 for hv in out["halves"])
                             and sum(1 for v in out["excess_by_coin"].values() if v > 0) >= min(2, len(out["excess_by_coin"])))
        out["portfolio"] = portfolio(research, primary)
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
    significant = benjamini_hochberg({k: r.get("excess_p") for k, r in results.items()
                                      if r["n"] >= MIN_TRADES and r["excess_avg_pct"] > 0 and r["avg_net_pct"] > 0}, m)
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
        sealed_nets = net_returns(trades, PRIMARY, funding)
        d = describe(trades, sealed_nets, results[key]["block_seconds"])
        if d["n"]:
            d["portfolio"] = portfolio(trades, sealed_nets)
        p = d.get("excess_p")
        d["confirmed"] = bool(d["n"] >= MIN_TRADES and p is not None and p < 0.05 / n_unsealed and d["excess_avg_pct"] > 0 and d["avg_net_pct"] > 0)
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
        "descriptions": {name: spec["description"] for name, spec in lab_strategies.STRATEGIES.items()},
        "candidates": sorted(k for k, r in results.items() if r["candidate"]),
        "confirmed": sorted(k for k, r in results.items() if r.get("holdout", {}).get("confirmed")),
        "results": results,
    }


# =========================
# REPORT
# =========================
def _pf(r):
    pf = r.get("portfolio") or {}
    return f"{pf['annual_return_pct']:+.1f}% / {pf['max_drawdown_pct']:.1f}%" if pf.get("n") else "—"


def to_markdown(s):
    sc = s["scenarios"][s["primary_scenario"]]
    pending = [k for k in s["candidates"] if "holdout" not in s["results"][k]]
    failed = sorted(k for k, r in s["results"].items() if "holdout" in r and not r["holdout"]["confirmed"])
    out = ["# Laboratorio strategie", "",
           f"Generato il {s['generated_at']} · {len(s['results'])} prove in questa esecuzione, {s['trials_registered']} registrate in tutto.", "",
           f"- **Ricerca** solo sullo storico prima del {s['holdout_start']}; da lì in poi è **sigillato** per la prova finale.",
           f"- **Costi** (scenario principale: {sc['label'].lower()}): {sc['cost_pct_per_side']:.2f}% per lato più funding. \"Netto\" = dopo questi costi, tasse escluse.",
           f"- **Funding**: Bitget pubblica solo gli ultimi mesi. Per i trade più vecchi vale un'ipotesi prudente: il long paga {FUNDING_ASSUMED_LONG_PCT}% ogni 8 ore, lo short non riceve nulla.",
           "- **Oltre il mercato**: netto del trade meno quello che avrebbe reso la semplice esposizione (direzione x durata x rendimento medio "
           "della coin). Misura la scelta dei momenti, non il rialzo del mercato. Intervallo, p, metà e coin si riferiscono a questa misura.",
           f"- **Candidata** = netto positivo, e netto oltre il mercato che supera la correzione per prove multiple (falsi positivi attesi {round(s['fdr'] * 100)}%) "
           "**e** stabile (positivo in entrambe le metà del periodo e su almeno 2 coin su 3).",
           "- **Portafoglio**: la strategia sulle tre coin insieme con le regole dell'esecutore (rischio 0,5% a trade sullo stop iniziale, leva massima 3x, "
           "esposizione 1,5x, massimo 3 posizioni): rendimento annuo composto e drawdown massimo, misurati alla chiusura dei trade.",
           "- Una candidata non è un segnale valido: deve ancora superare la prova finale e poi la prova dal vivo senza soldi.",
           "- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.", "",
           f"**Candidate in attesa della prova finale: {', '.join(pending) if pending else 'nessuna'}.** "
           f"**Confermate: {', '.join(s['confirmed']) if s['confirmed'] else 'nessuna'}.** "
           f"**Non confermate: {', '.join(failed) if failed else 'nessuna'}.**", ""]
    for tf in ALL_TIMEFRAMES:
        rows = sorted((r for r in s["results"].values() if r["tf"] == tf and r["n"]), key=lambda r: -r["excess_avg_pct"])
        if not rows:
            continue
        out += [f"### Timeframe {tf}", "",
                "| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | Portafoglio: annuo / max DD | Oltre il mercato | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Esito |",
                "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
        for r in rows:
            p = "n/d" if r.get("excess_p") is None else f"{r['excess_p']:.4f}"
            halves = " / ".join("—" if hv["excess_avg_pct"] is None else f"{hv['excess_avg_pct']:+.2f}%" for hv in r["halves"])
            coins = " / ".join(f"{r['excess_by_coin'][c]:+.2f}%" if c in r["excess_by_coin"] else "—" for c in ALL_ASSETS)
            verdict = "**CANDIDATA**" if r["candidate"] else "significativa ma instabile" if r["significant"] else "campione piccolo" if r["n"] < MIN_TRADES else "no"
            out.append(f"| {r['strategy']} | {r['family']} | {r['n']} | {r['win_rate']}% | {r['avg_bars']} candele | {r['avg_net_pct']:+.3f}% | "
                       f"{_pf(r)} | {r['excess_avg_pct']:+.3f}% | {vs._ci(r['excess_ci'])} | {p} | {halves} | {coins} | {verdict} |")
        out.append("")
    opened = [r for r in s["results"].values() if "holdout" in r]
    if opened:
        out += ["### Prove finali sui mesi sigillati", "",
                "| Prova | Aperta il | Trade | Netto medio | Oltre il mercato | IC 95% | p | Esito |", "|---|---|---|---|---|---|---|---|"]
        for r in opened:
            hd = r["holdout"]
            if not hd["n"]:
                out.append(f"| {r['strategy']}:{r['tf']} | {hd['unsealed_on']} | 0 | — | — | — | — | nessun trade |")
                continue
            p = "n/d" if hd.get("excess_p") is None else f"{hd['excess_p']:.4f}"
            out.append(f"| {r['strategy']}:{r['tf']} | {hd['unsealed_on']} | {hd['n']} | {hd['avg_net_pct']:+.3f}% | {hd['excess_avg_pct']:+.3f}% | {vs._ci(hd['excess_ci'])} | {p} | "
                       f"{'**CONFERMATA**' if hd['confirmed'] else 'non confermata'} |")
        out.append("")
    out += ["### Le strategie", ""]
    for name, spec in lab_strategies.STRATEGIES.items():
        out.append(f"- **{name}** ({spec['family']}): {spec['description']}")
    return "\n".join(out) + "\n"


def main(start, symbols, tfs, unseal=(), save_registry=True):
    start_ms = _ts(start) * 1000
    registry = load_registry()
    holdout_ts = _ts(registry["holdout_start"])
    funding = {}
    for symbol in symbols:
        funding[symbol] = fetch_funding_history(symbol)
        ts = funding[symbol][0]
        print(f"Funding {symbol}: {len(ts)} valori" + (f" dal {datetime.fromtimestamp(ts[0], tz=timezone.utc):%d/%m/%Y}" if len(ts) else " (non disponibile)"))
    per_trial = {}
    for tf in tfs:
        dfs = {}
        for symbol in symbols:
            df = va.download_history(symbol, tf, start_ms)
            if df is None or len(df) < WARMUP + 200:
                print(f"{symbol} {tf}: storico insufficiente, salto.")
                continue
            print(f"{symbol} {tf}: {len(df)} candele dal {df['time'].iloc[0]:%d/%m/%Y}")
            dfs[symbol] = df
        peers = peer_table(dfs) if dfs else None
        for symbol, df in dfs.items():
            for name, spec in lab_strategies.STRATEGIES.items():
                if spec["tfs"] is None or tf in spec["tfs"]:
                    per_trial.setdefault((name, tf), []).extend(annotate_drift(simulate(df, tf, symbol, spec, peers=peers), df, holdout_ts))
    if not per_trial:
        raise SystemExit("Nessuno storico scaricato.")
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
