"""Statistiche della validazione storica di Kronos (nessun modello: solo numeri).

Legge le righe prodotte da validation.py (una per previsione, con dentro anche le candele
realmente uscite dopo) e misura:
- direzione: percentuale di direzioni giuste, confronto con "sempre su" e momentum;
- probabilità: Brier score contro la frequenza storica calcolata solo sul passato,
  calibrazione per fasce, copertura della fascia P10-P90;
- calibrazione walk-forward: la correzione delle probabilità è stimata solo su previsioni
  già concluse e applicata a quelle successive (nessuna informazione dal futuro);
- operatività al netto dei costi: piano di Kronos (stop/target) e strategie di confronto
  sugli stessi punti (momentum, sempre long, buy & hold).

Ogni media ha un intervallo di confidenza al 95% calcolato con bootstrap a blocchi di tempo:
previsioni vicine (e BTC/ETH/SOL nello stesso periodo) si muovono insieme, quindi si
ricampionano blocchi interi e non singole previsioni. Un vantaggio è "dimostrato" solo se
l'intero intervallo sta sopra lo zero.
"""
from datetime import datetime, timezone

import numpy as np

import track_record as tr
from kronos_core import (
    PRED_LEN, TF_DELTA, FEE_PCT, SLIPPAGE_PCT, TAX_RATE, LONG_THRESHOLD, SHORT_THRESHOLD,
    ATR_MULT, MIN_RR, RR_MAX, ALL_TIMEFRAMES, build_trade_plan,
)

N_BOOT = 2000
MIN_N = 30            # sotto questo numero di casi non si dà nessun giudizio
MIN_TRAIN_CAL = 100   # previsioni concluse necessarie prima di calibrare
REFIT_EVERY = 20      # la calibrazione walk-forward si ristima ogni N previsioni
MOMENTUM_LOOKBACK = PRED_LEN
COST_ROUND_TRIP = (FEE_PCT + SLIPPAGE_PCT) * 2
WEEK = 7 * 86400


def tf_seconds(tf):
    return int(TF_DELTA[tf].total_seconds())


def after_costs(gross_pct):
    """Rendimento lordo % -> (netto di commissioni e slippage, netto anche delle tasse)."""
    pre_tax = gross_pct - COST_ROUND_TRIP
    return pre_tax, pre_tax * (1 - TAX_RATE) if pre_tax > 0 else pre_tax


# =========================
# UNA RIGA -> ESITI
# =========================
def enrich(row):
    """Aggiunge a una previsione l'esito reale e il risultato di ogni strategia (None = nessun trade)."""
    ref = row["ref_close"]
    horizon = [{"open": c[0], "high": c[1], "low": c[2], "close": c[3]} for c in row["horizon"]]
    close_h = horizon[-1]["close"]
    hold_long = (close_h - ref) / ref * 100
    plan = build_trade_plan(ref, row["atr"], row["prob_up"], [{"close": c} for c in row["forecast"]])
    kronos_dir = 1 if plan["direction"] == "LONG" else -1
    momentum_dir = 1 if ref >= row["past_close"] else -1

    strategies = {
        "kronos_plan": None,                       # segnale operativo con stop e target (come il bot)
        "kronos_signal": None,                     # stesso segnale, tenuto fino a fine orizzonte
        "kronos_all": kronos_dir * hold_long,      # direzione di Kronos su ogni previsione
        "momentum": momentum_dir * hold_long,      # direzione delle ultime candele
        "always_long": hold_long,                  # sempre long
    }
    if plan["bias"] != "NEUTRO":
        strategies["kronos_signal"] = kronos_dir * hold_long
        if plan["tradeable"]:
            strategies["kronos_plan"] = tr.simulate_plan(plan, horizon)["gross_pct"]

    # Con le traiettorie salvate: il piano viene simulato su ognuna, ottenendo la probabilità che
    # chiuda in utile e il valore atteso netto SECONDO IL MODELLO, da confrontare con l'esito reale.
    p_profit = ev_net = plan_win = None
    strategies["plan_all"] = strategies["kronos_ev"] = None
    if row.get("paths"):
        model_net = path_plan_net(plan, row["paths"], ref)
        p_profit, ev_net = float((model_net > 0).mean()), float(model_net.mean())
        real_gross = tr.simulate_plan(plan, horizon)["gross_pct"]
        plan_win = 1.0 if after_costs(real_gross)[1] > 0 else 0.0
        strategies["plan_all"] = real_gross                      # il piano su ogni previsione, senza filtri
        if ev_net > 0:
            strategies["kronos_ev"] = real_gross                 # solo se il valore atteso netto del modello è positivo

    p10, p90 = row["p10"][-1], row["p90"][-1]
    return {
        "p_profit": p_profit, "ev_net": ev_net, "plan_win": plan_win,
        "symbol": row["symbol"], "tf": row["tf"], "t": row["candle_time"],
        "end": row["candle_time"] + (PRED_LEN + 1) * tf_seconds(row["tf"]),  # da qui l'esito è noto
        "p": row["prob_up"] / 100, "up": 1.0 if close_h > ref else 0.0,
        "kronos_dir": kronos_dir, "momentum_dir": momentum_dir,
        "in_band": 1.0 if p10 <= close_h <= p90 else 0.0,
        "ref": ref, "close_h": close_h, "gross": strategies,
    }


def path_plan_net(plan, paths_bps, ref):
    """Netto % (costi e tasse) del piano su ogni traiettoria simulata. Le traiettorie hanno solo le
    chiusure: stop e target si considerano toccati quando una chiusura li supera."""
    prices = ref * (1 + np.asarray(paths_bps, dtype=float) / 10000)
    entry, sl, tp = plan["entry"], plan["stop_loss"], plan["take_profit"]
    long = plan["direction"] == "LONG"
    hit_sl = prices <= sl if long else prices >= sl
    hit_tp = prices >= tp if long else prices <= tp
    n = prices.shape[1]
    first_sl = np.where(hit_sl.any(axis=1), hit_sl.argmax(axis=1), n)
    first_tp = np.where(hit_tp.any(axis=1), hit_tp.argmax(axis=1), n)
    exit_price = np.where(first_sl <= first_tp, sl, tp)          # a pari candela conta lo stop
    exit_price = np.where((first_sl == n) & (first_tp == n), prices[:, -1], exit_price)
    gross = (exit_price - entry) / entry * 100 * (1 if long else -1)
    pre_tax = gross - COST_ROUND_TRIP
    return np.where(pre_tax > 0, pre_tax * (1 - TAX_RATE), pre_tax)


# =========================
# INTERVALLI DI CONFIDENZA
# =========================
def cluster_ci(values, clusters, n_boot=N_BOOT, seed=20260101):
    """IC 95% della media con bootstrap a blocchi: si ricampionano i blocchi (clusters), non i singoli valori."""
    values = np.asarray(values, dtype=float)
    if len(values) == 0:
        return None
    _, inv = np.unique(np.asarray(clusters), return_inverse=True)
    sums = np.bincount(inv, weights=values)
    counts = np.bincount(inv).astype(float)
    g = len(sums)
    if g < 5:
        return None
    rng = np.random.default_rng(seed)
    means = np.empty(n_boot)
    chunk = max(1, 2_000_000 // g)
    for start in range(0, n_boot, chunk):
        idx = rng.integers(0, g, size=(min(chunk, n_boot - start), g))
        means[start:start + len(idx)] = sums[idx].sum(axis=1) / counts[idx].sum(axis=1)
    lo, hi = np.percentile(means, [2.5, 97.5])
    return [round(float(lo), 4), round(float(hi), 4)]


def verdict(ci, n):
    if n < MIN_N or ci is None:
        return "campione_insufficiente"
    if ci[0] > 0:
        return "positivo"
    if ci[1] < 0:
        return "negativo"
    return "non_dimostrato"


# =========================
# CALIBRAZIONE
# =========================
def isotonic_fit(x, y):
    """Regressione isotonica (pool adjacent violators). Ritorna (xs, ys) crescenti da usare con np.interp."""
    order = np.argsort(x, kind="stable")
    x, y = np.asarray(x, dtype=float)[order], np.asarray(y, dtype=float)[order]
    xs, first = np.unique(x, return_index=True)         # un punto per valore distinto di probabilità
    w = np.diff(np.append(first, len(x))).astype(float)
    m = np.add.reduceat(y, first) / w
    blocks = []                                          # [media, peso, quanti x copre]
    for mean, weight in zip(m, w):
        blocks.append([mean, weight, 1])
        while len(blocks) > 1 and blocks[-2][0] >= blocks[-1][0]:
            m2, w2, k2 = blocks.pop()
            m1, w1, k1 = blocks.pop()
            blocks.append([(m1 * w1 + m2 * w2) / (w1 + w2), w1 + w2, k1 + k2])
    ys = np.concatenate([[b[0]] * b[2] for b in blocks])
    return xs, ys


def walk_forward_calibration(points):
    """Per ogni previsione, la probabilità calibrata usando SOLO previsioni il cui esito era già
    noto in quel momento. Ritorna un array (NaN dove lo storico concluso è ancora troppo corto)."""
    order = sorted(range(len(points)), key=lambda i: points[i]["t"])
    by_end = sorted(order, key=lambda i: points[i]["end"])
    cal = np.full(len(points), np.nan)
    train_p, train_u, k, fitted_at, model = [], [], 0, -REFIT_EVERY, None
    for i in order:
        while k < len(by_end) and points[by_end[k]]["end"] <= points[i]["t"]:
            train_p.append(points[by_end[k]]["p"])
            train_u.append(points[by_end[k]]["up"])
            k += 1
        if len(train_p) < MIN_TRAIN_CAL:
            continue
        if len(train_p) - fitted_at >= REFIT_EVERY:
            model, fitted_at = isotonic_fit(train_p, train_u), len(train_p)
        cal[i] = float(np.clip(np.interp(points[i]["p"], *model), 0.02, 0.98))
    return cal


def walk_forward_base_rate(points, key="up"):
    """Frequenza dell'esito (di base: rialzo) osservata fino a quel momento (0.5 finché non c'è storico concluso)."""
    order = sorted(range(len(points)), key=lambda i: points[i]["t"])
    by_end = sorted(order, key=lambda i: points[i]["end"])
    out, ups, n, k = np.full(len(points), 0.5), 0.0, 0, 0
    for i in order:
        while k < len(by_end) and points[by_end[k]]["end"] <= points[i]["t"]:
            ups += points[by_end[k]][key]
            n += 1
            k += 1
        if n >= MIN_N:
            out[i] = ups / n
    return out


# =========================
# BLOCCHI DI STATISTICHE
# =========================
def _direction_stats(points, clusters):
    p = np.array([x["p"] for x in points])
    up = np.array([x["up"] for x in points])
    called = p != 0.5
    kronos_hit = ((p > 0.5) == (up == 1.0)).astype(float)
    momentum_hit = (np.array([x["momentum_dir"] for x in points]) > 0) == (up == 1.0)
    brier_i = (p - up) ** 2
    clim_i = (walk_forward_base_rate(points) - up) ** 2
    skill_ci = cluster_ci(clim_i - brier_i, clusters)

    bins = []
    for lo in range(0, 100, 10):
        q = np.round(p * 100, 1)
        sel = (q >= lo) & ((q < lo + 10) | ((lo == 90) & (q == 100)))
        if sel.any():
            bins.append({"range": f"{lo}-{lo + 10}", "n": int(sel.sum()),
                         "predicted_up_pct": round(float(p[sel].mean() * 100), 1),
                         "realized_up_pct": round(float(up[sel].mean() * 100), 1)})

    n_called = int(called.sum())
    hit = kronos_hit[called]
    hit_ci = cluster_ci(hit - 0.5, clusters[called])
    vs_mom_ci = cluster_ci(hit - momentum_hit[called], clusters[called])
    pct = lambda ci, shift=0.0: None if ci is None else [round((ci[0] + shift) * 100, 1), round((ci[1] + shift) * 100, 1)]
    return {
        "n": len(points),
        "n_called": n_called,
        "hit_rate": round(float(hit.mean() * 100), 1) if n_called else None,
        "hit_rate_ci": pct(hit_ci, 0.5),
        "base_rate_up_pct": round(float(up.mean() * 100), 1),
        "momentum_hit_rate": round(float(momentum_hit[called].mean() * 100), 1) if n_called else None,
        "hit_minus_momentum_ci": pct(vs_mom_ci),
        "brier": round(float(brier_i.mean()), 4),
        "brier_coin": 0.25,
        "brier_base_rate": round(float(clim_i.mean()), 4),
        "brier_skill_ci": skill_ci,
        "calibration": bins,
        "band_p10_p90_coverage_pct": round(float(np.mean([x["in_band"] for x in points]) * 100), 1),
        "verdict_direction": verdict(hit_ci, n_called),
        "verdict_probability": verdict(skill_ci, len(points)),
    }


def _calibration_stats(points, clusters):
    cal = walk_forward_calibration(points)
    test = ~np.isnan(cal)
    n = int(test.sum())
    if n < MIN_N:
        return {"n_test": n}
    p = np.array([x["p"] for x in points])[test]
    up = np.array([x["up"] for x in points])[test]
    base = walk_forward_base_rate(points)[test]
    raw_i, cal_i = (p - up) ** 2, (cal[test] - up) ** 2
    improve_ci = cluster_ci(raw_i - cal_i, clusters[test])
    skill_ci = cluster_ci((base - up) ** 2 - cal_i, clusters[test])
    xs, ys = isotonic_fit([x["p"] for x in points], [x["up"] for x in points])
    return {
        "n_test": n,
        "brier_raw": round(float(raw_i.mean()), 4),
        "brier_calibrated": round(float(cal_i.mean()), 4),
        "brier_base_rate": round(float(((base - up) ** 2).mean()), 4),
        "improvement_ci": improve_ci,          # (grezzo - calibrato): sopra zero = la calibrazione aiuta
        "calibrated_skill_ci": skill_ci,       # (frequenza storica - calibrato): sopra zero = c'è informazione
        "verdict_calibrated": verdict(skill_ci, n),
        # mappa stimata su tutti i dati (descrittiva): probabilità dichiarata -> frequenza reale
        "map": [[q, round(float(np.clip(np.interp(q / 100, xs, ys), 0, 1)) * 100, 1)] for q in range(0, 101, 10)],
    }


def _path_model_stats(points, clusters):
    """La probabilità di chiudere in utile calcolata dalle traiettorie è affidabile? (solo righe con traiettorie)"""
    idx = [i for i, x in enumerate(points) if x["p_profit"] is not None]
    if len(idx) < MIN_N:
        return {"n": len(idx)}
    sub_points = [points[i] for i in idx]
    p = np.array([x["p_profit"] for x in sub_points])
    win = np.array([x["plan_win"] for x in sub_points])
    ev = np.array([x["ev_net"] for x in sub_points])
    base = walk_forward_base_rate(sub_points, "plan_win")
    skill_ci = cluster_ci((base - win) ** 2 - (p - win) ** 2, clusters[idx])
    bins = []
    for lo in range(0, 100, 20):
        sel = (p * 100 >= lo) & ((p * 100 < lo + 20) | (lo == 80))
        if sel.any():
            bins.append({"range": f"{lo}-{lo + 20}", "n": int(sel.sum()),
                         "predicted_win_pct": round(float(p[sel].mean() * 100), 1),
                         "realized_win_pct": round(float(win[sel].mean() * 100), 1)})
    return {
        "n": len(idx),
        "realized_win_pct": round(float(win.mean() * 100), 1),
        "predicted_win_pct": round(float(p.mean() * 100), 1),
        "brier": round(float(((p - win) ** 2).mean()), 4),
        "brier_base_rate": round(float(((base - win) ** 2).mean()), 4),
        "brier_skill_ci": skill_ci,
        "positive_ev_share_pct": round(float((ev > 0).mean() * 100), 1),
        "calibration": bins,
        "verdict": verdict(skill_ci, len(idx)),
    }


def _strategy_stats(points, clusters, name):
    sel = [i for i, x in enumerate(points) if x["gross"][name] is not None]
    n = len(sel)
    if n == 0:
        return {"n": 0, "verdict": "campione_insufficiente"}
    sel.sort(key=lambda i: points[i]["t"])
    gross = np.array([points[i]["gross"][name] for i in sel])
    pre_tax = gross - COST_ROUND_TRIP
    net = np.where(pre_tax > 0, pre_tax * (1 - TAX_RATE), pre_tax)
    cl = clusters[sel]
    net_ci = cluster_ci(net, cl)
    stats = tr._trade_stats([float(v) for v in net])
    return {
        "n": n,
        "win_rate": stats["win_rate"],
        "avg_gross_pct": round(float(gross.mean()), 3),
        "avg_net_costs_pct": round(float(pre_tax.mean()), 3),
        "avg_net_costs_ci": cluster_ci(pre_tax, cl),
        "avg_net_pct": stats["avg_net_pct"],
        "avg_net_ci": net_ci,
        "total_net_pct": stats["total_net_pct"],
        "profit_factor": stats["profit_factor"],
        "max_drawdown_pct": stats["max_drawdown_pct"],
        "verdict": verdict(net_ci, n),
    }


def _buy_hold(points):
    """Comprare alla prima previsione e tenere fino alla fine dell'ultima, per ogni coppia (media tra coppie)."""
    per_pair = {}
    for x in points:
        per_pair.setdefault((x["symbol"], x["tf"]), []).append(x)
    gross, net = [], []
    for xs in per_pair.values():
        xs.sort(key=lambda x: x["t"])
        g = (xs[-1]["close_h"] / xs[0]["ref"] - 1) * 100
        gross.append(g)
        net.append(after_costs(g)[1])
    return {"gross_pct": round(float(np.mean(gross)), 2), "net_pct": round(float(np.mean(net)), 2)}


STRATEGIES = ["kronos_plan", "kronos_ev", "plan_all", "kronos_signal", "kronos_all", "momentum", "always_long"]


def block(points, cluster_seconds):
    """Tutte le statistiche di un gruppo di previsioni. cluster_seconds = durata dei blocchi del bootstrap."""
    if not points:
        return {"n": 0}
    points = sorted(points, key=lambda x: (x["t"], x["symbol"], x["tf"]))
    clusters = np.array([x["t"] // cluster_seconds for x in points])
    strategies = {name: _strategy_stats(points, clusters, name) for name in STRATEGIES}
    # confronto diretto sugli stessi punti: direzione di Kronos contro momentum, al lordo (i costi sono identici)
    diff = np.array([x["gross"]["kronos_all"] - x["gross"]["momentum"] for x in points])
    return {
        "n": len(points),
        "from": int(points[0]["t"]),
        "to": int(points[-1]["t"]),
        "direction": _direction_stats(points, clusters),
        "calibration_wf": _calibration_stats(points, clusters),
        "path_model": _path_model_stats(points, clusters),
        "strategies": strategies,
        "kronos_minus_momentum_ci": cluster_ci(diff, clusters),
        "buy_hold": _buy_hold(points),
        "verdict": strategies["kronos_plan"]["verdict"],
    }


def build_summary(rows):
    """rows: righe grezze di validation.py. Vale solo ciò che è successivo alla data dei pesi del modello."""
    oos_start = max((r["oos_start"] for r in rows), default=None)
    rows = [r for r in rows if r["candle_time"] >= oos_start]
    points = [enrich(r) for r in rows]
    pairs = sorted({(x["symbol"], x["tf"]) for x in points})
    meta = {}
    for r in rows:
        m = meta.setdefault(f"{r['symbol']}_{r['tf']}", {"n_samples": set(), "context_len": set()})
        m["n_samples"].add(r["n_samples"])
        m["context_len"].add(r["context_len"])

    by_pair = {}
    for symbol, tf in pairs:
        key = f"{symbol}_{tf}"
        by_pair[key] = block([x for x in points if (x["symbol"], x["tf"]) == (symbol, tf)], PRED_LEN * tf_seconds(tf))
        by_pair[key]["n_samples"] = sorted(meta[key]["n_samples"])
        by_pair[key]["context_len"] = sorted(meta[key]["context_len"])
    by_tf = {tf: block([x for x in points if x["tf"] == tf], PRED_LEN * tf_seconds(tf))
             for tf in ALL_TIMEFRAMES if any(x["tf"] == tf for x in points)}

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": sorted({r["model"] for r in rows}),
        "oos_start": oos_start,
        "oos_rule": "solo previsioni successive alla data di pubblicazione dei pesi del modello su Hugging Face",
        "horizon_candles": PRED_LEN,
        "costs": {"fee_pct_per_side": FEE_PCT, "slippage_pct_per_side": SLIPPAGE_PCT, "tax_rate": TAX_RATE},
        "params": {"long_threshold": LONG_THRESHOLD, "short_threshold": SHORT_THRESHOLD, "atr_mult": ATR_MULT,
                   "min_rr": MIN_RR, "rr_max": RR_MAX, "momentum_lookback": MOMENTUM_LOOKBACK},
        "confidence": {"level": 95, "method": "bootstrap a blocchi di tempo", "n_boot": N_BOOT, "min_n": MIN_N},
        "counts": {"total": len(points)},
        "overall": block(points, WEEK),
        "by_tf": by_tf,
        "by_pair": by_pair,
    }


# =========================
# REPORT LEGGIBILE
# =========================
VERDICT_TEXT = {
    "positivo": "vantaggio dimostrato",
    "negativo": "svantaggio dimostrato",
    "non_dimostrato": "vantaggio NON dimostrato",
    "campione_insufficiente": "campione insufficiente",
}


def _ci(ci, unit="%"):
    return "n/d" if ci is None else f"[{ci[0]:+.2f}{unit}, {ci[1]:+.2f}{unit}]"


def _day(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%d/%m/%Y")


def _block_md(title, b):
    if not b.get("n"):
        return [f"### {title}", "", "Nessuna previsione.", ""]
    d, c, s = b["direction"], b["calibration_wf"], b["strategies"]
    out = [f"### {title}", "",
           f"{b['n']} previsioni dal {_day(b['from'])} al {_day(b['to'])}. "
           f"**Segnali operativi: {VERDICT_TEXT[b['verdict']]}.**", "",
           "| Direzione e probabilità | Valore |", "|---|---|",
           f"| Direzioni giuste di Kronos | {d['hit_rate']}% (IC 95% {d['hit_rate_ci']}) |",
           f"| Momentum sugli stessi punti | {d['momentum_hit_rate']}% (differenza IC {d['hit_minus_momentum_ci']}) |",
           f"| Quante volte il prezzo è salito | {d['base_rate_up_pct']}% |",
           f"| Brier Kronos / frequenza storica / moneta | {d['brier']} / {d['brier_base_rate']} / 0.25 |",
           f"| Vantaggio sul Brier (sopra 0 = meglio) | {_ci(d['brier_skill_ci'], '')} → {VERDICT_TEXT[d['verdict_probability']]} |",
           f"| Prezzo finale dentro la fascia P10-P90 | {d['band_p10_p90_coverage_pct']}% (atteso 80%) |"]
    if c.get("n_test", 0) >= MIN_N:
        out.append(f"| Calibrazione walk-forward ({c['n_test']} casi) | Brier {c['brier_raw']} → {c['brier_calibrated']} "
                   f"(frequenza storica {c['brier_base_rate']}); dopo la calibrazione: {VERDICT_TEXT[c['verdict_calibrated']]} |")
    else:
        out.append(f"| Calibrazione walk-forward | storico concluso ancora troppo corto ({c.get('n_test', 0)} casi) |")
    out += ["", "| Fascia prob. rialzo | Casi | Prevista | Reale |", "|---|---|---|---|"]
    out += [f"| {x['range']}% | {x['n']} | {x['predicted_up_pct']}% | {x['realized_up_pct']}% |" for x in d["calibration"]]
    pm = b["path_model"]
    if pm.get("n", 0) >= MIN_N:
        out += ["", f"Probabilità di chiudere in utile calcolata dalle traiettorie ({pm['n']} casi): prevista {pm['predicted_win_pct']}%, "
                    f"reale {pm['realized_win_pct']}%; Brier {pm['brier']} contro {pm['brier_base_rate']} della frequenza storica "
                    f"→ {VERDICT_TEXT[pm['verdict']]}. Valore atteso netto positivo secondo il modello nel {pm['positive_ev_share_pct']}% dei casi.",
                "", "| Prob. di utile prevista | Casi | Prevista | Reale |", "|---|---|---|---|"]
        out += [f"| {x['range']}% | {x['n']} | {x['predicted_win_pct']}% | {x['realized_win_pct']}% |" for x in pm["calibration"]]
    names = {"kronos_ev": "Kronos: piano solo se valore atteso netto > 0", "plan_all": "Kronos: piano su ogni previsione",
             "kronos_plan": "Kronos: segnali operativi (stop e target)", "kronos_signal": "Kronos: segnali tenuti a fine orizzonte",
             "kronos_all": "Kronos: direzione su ogni previsione", "momentum": "Momentum", "always_long": "Sempre long"}
    out += ["", "| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |",
            "|---|---|---|---|---|---|---|---|"]
    for k in STRATEGIES:
        x = s[k]
        if not x["n"]:
            out.append(f"| {names[k]} | 0 | — | — | — | — | — | {VERDICT_TEXT[x['verdict']]} |")
            continue
        out.append(f"| {names[k]} | {x['n']} | {x['win_rate']}% | {x['avg_gross_pct']:+.3f}% | {x['avg_net_costs_pct']:+.3f}% | "
                   f"{x['avg_net_pct']:+.3f}% | {_ci(x['avg_net_ci'])} | {VERDICT_TEXT[x['verdict']]} |")
    out += ["", f"Kronos meno momentum, stessi punti, per trade: IC 95% {_ci(b['kronos_minus_momentum_ci'])}. "
                f"Buy & hold nello stesso periodo: {b['buy_hold']['gross_pct']:+.1f}% lordo, {b['buy_hold']['net_pct']:+.1f}% netto.", ""]
    return out


def to_markdown(s):
    c = s["costs"]
    out = ["# Validazione storica di Kronos", "",
           f"Generato il {s['generated_at']} · modello {', '.join(s['model'])} · orizzonte {s['horizon_candles']} candele.", "",
           f"- **Fuori campione**: {s['oos_rule']} ({_day(s['oos_start'])}).",
           f"- **Costi**: commissione {c['fee_pct_per_side']}% e slippage {c['slippage_pct_per_side']}% per lato, tasse {round(c['tax_rate'] * 100)}% sui trade in utile.",
           f"- **Intervalli di confidenza** al {s['confidence']['level']}% con {s['confidence']['method']}: un vantaggio è dimostrato solo se l'intero intervallo è sopra zero.",
           "- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.", ""]
    out += _block_md("Tutte le coppie", s["overall"])
    for tf, b in s["by_tf"].items():
        out += _block_md(f"Timeframe {tf}", b)
    for key, b in s["by_pair"].items():
        out += _block_md(key.replace("_", " "), b)
    return "\n".join(out) + "\n"
