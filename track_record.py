"""Track record delle previsioni di Kronos: registro verificabile e misura dell'affidabilità.

Ogni volta che il bot calcola una nuova previsione (nuova candela chiusa), la registra in
track_record.jsonl, una riga per previsione. Quando l'orizzonte della previsione è passato, la
confronta con i prezzi reali:
- direzione: la chiusura dell'ultima candela prevista è sopra o sotto il prezzo di partenza?
  (serve a misurare la calibrazione: quando il modello dice 80%, sale davvero 8 volte su 10?)
- piano operativo (solo segnali LONG/SHORT): entry, stop e target simulati candela per candela,
  con commissioni, slippage e tasse.
Il riepilogo va in track_record_summary.json, letto dall'app.

Regole che rendono il registro affidabile:
- si registra la PRIMA previsione per ogni candela: un ricalcolo manuale (FORCE) non la sostituisce;
- le previsioni non vengono mai cancellate; cambia solo lo stato (open -> resolved / expired);
- il bot fa commit a ogni aggiornamento, quindi la cronologia git mostra quando è stata registrata
  ogni previsione e che non è stata modificata dopo.
"""
import json
import os
import tempfile
from datetime import datetime, timezone

from kronos_core import PRED_LEN, TF_DELTA, FEE_PCT, SLIPPAGE_PCT, TAX_RATE

LEDGER_PATH = "track_record.jsonl"
SUMMARY_PATH = "track_record_summary.json"


def _tf_seconds(tf):
    return int(TF_DELTA[tf].total_seconds())


# =========================
# REGISTRO
# =========================
def load_ledger(path=LEDGER_PATH):
    if not os.path.exists(path):
        return []
    entries = []
    with open(path, "r") as f:
        for n, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError as e:
                # Un registro illeggibile non va sovrascritto: fermo tutto
                raise SystemExit(f"ERRORE: {path} riga {n} non leggibile ({e}). Interrompo per non perdere il track record.")
    return entries


def save_ledger(entries, path=LEDGER_PATH):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            for e in entries:
                f.write(json.dumps(e, separators=(",", ":"), sort_keys=True) + "\n")
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def record_prediction(entries, symbol, tf, payload):
    """Aggiunge la previsione appena calcolata. Ritorna True se è nuova."""
    candle_time = int(payload["last_candle_time"])
    entry_id = f"{symbol}_{tf}_{candle_time}"
    if any(e["id"] == entry_id for e in entries):
        return False  # già registrata: vale la prima
    plan = payload["ai_plan"]
    entries.append({
        "id": entry_id,
        "symbol": symbol,
        "tf": tf,
        "candle_time": candle_time,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": payload.get("model"),
        "n_samples": payload.get("n_samples"),
        "ref_close": float(payload["last_close"]),
        "prob_up": float(payload["prob_up"]),
        # La previsione copre PRED_LEN candele dopo quella di riferimento: l'ultima chiude qui
        "horizon_end": candle_time + (PRED_LEN + 1) * _tf_seconds(tf),
        "plan": {
            "bias": plan["bias"],
            "direction": plan["direction"],
            "entry": plan["entry"],
            "stop_loss": plan["stop_loss"],
            "take_profit": plan["take_profit"],
            "rr": plan["rr"],
            "tradeable": bool(plan.get("tradeable", False)),
        },
        "status": "open",
    })
    return True


# =========================
# ESITO
# =========================
def simulate_plan(plan, candles):
    """candles: lista di dict (open/high/low/close) delle candele dell'orizzonte, in ordine.
    Stop e target controllati candela per candela; se nella stessa candela si toccano entrambi
    conta lo stop (ipotesi prudente). Senza tocchi si esce alla chiusura dell'ultima candela."""
    entry, sl, tp = plan["entry"], plan["stop_loss"], plan["take_profit"]
    long = plan["direction"] == "LONG"
    exit_price, reason = None, "TEMPO"
    for c in candles:
        if long:
            if c["low"] <= sl:
                exit_price, reason = sl, "SL"
                break
            if c["high"] >= tp:
                exit_price, reason = tp, "TP"
                break
        else:
            if c["high"] >= sl:
                exit_price, reason = sl, "SL"
                break
            if c["low"] <= tp:
                exit_price, reason = tp, "TP"
                break
    if exit_price is None:
        exit_price = candles[-1]["close"]
    gross = (exit_price - entry) / entry * 100 * (1 if long else -1)
    net = gross - (FEE_PCT + SLIPPAGE_PCT) * 2
    if net > 0:
        net *= (1 - TAX_RATE)
    return {"exit_reason": reason, "exit_price": round(exit_price, 6), "gross_pct": round(gross, 4), "net_pct": round(net, 4)}


def resolve(entries, frames, now_ts=None):
    """Chiude le previsioni con orizzonte passato usando le candele già scaricate dal bot.
    frames: {"SYMBOL_tf": DataFrame di candele chiuse con colonne time/open/high/low/close}.
    Ritorna il numero di previsioni chiuse."""
    now_ts = now_ts or int(datetime.now(timezone.utc).timestamp())
    changed = 0
    for e in entries:
        if e["status"] != "open" or now_ts < e["horizon_end"]:
            continue
        df = frames.get(f"{e['symbol']}_{e['tf']}")
        if df is None or df.empty:
            continue
        step = _tf_seconds(e["tf"])
        times = [int(ts.timestamp()) for ts in df["time"]]
        wanted = [e["candle_time"] + k * step for k in range(1, PRED_LEN + 1)]
        if wanted[0] < times[0]:
            # Candele dell'orizzonte non più disponibili (bot fermo troppo a lungo)
            e["status"] = "expired"
            changed += 1
            continue
        pos = {t: i for i, t in enumerate(times)}
        if not all(t in pos for t in wanted):
            continue  # dati non ancora completi: si riprova al prossimo giro
        rows = [df.iloc[pos[t]] for t in wanted]
        horizon = [{"open": float(r["open"]), "high": float(r["high"]), "low": float(r["low"]), "close": float(r["close"])} for r in rows]
        close_h = horizon[-1]["close"]
        outcome = {"close_at_horizon": close_h, "up": bool(close_h > e["ref_close"])}
        if e["plan"]["bias"] in ("LONG", "SHORT"):
            outcome["trade"] = simulate_plan(e["plan"], horizon)
        e["outcome"] = outcome
        e["status"] = "resolved"
        e["resolved_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        changed += 1
    return changed


# =========================
# RIEPILOGO
# =========================
def _trade_stats(rets):
    n = len(rets)
    if n == 0:
        return {"n": 0}
    wins = [r for r in rets if r > 0]
    losses = [r for r in rets if r <= 0]
    gl = abs(sum(losses))
    equity, peak, max_dd = 0.0, 0.0, 0.0
    for r in rets:  # drawdown sulla somma dei rendimenti, in ordine cronologico
        equity += r
        peak = max(peak, equity)
        max_dd = min(max_dd, equity - peak)
    return {
        "n": n,
        "win_rate": round(len(wins) / n * 100, 1),
        "avg_net_pct": round(sum(rets) / n, 3),
        "total_net_pct": round(sum(rets), 2),
        "profit_factor": round(sum(wins) / gl, 2) if gl > 0 else None,
        "max_drawdown_pct": round(max_dd, 2),
    }


def _prediction_stats(resolved):
    n = len(resolved)
    if n == 0:
        return {"n": 0}
    probs = [e["prob_up"] / 100 for e in resolved]
    ups = [1.0 if e["outcome"]["up"] else 0.0 for e in resolved]
    brier = sum((p - u) ** 2 for p, u in zip(probs, ups)) / n
    base = sum(ups) / n
    brier_base = sum((base - u) ** 2 for u in ups) / n  # prevedere sempre la frequenza osservata
    called = [(p, u) for p, u in zip(probs, ups) if p != 0.5]
    hit = sum(1 for p, u in called if (p > 0.5) == (u == 1.0))
    bins = []
    for lo in range(0, 100, 10):
        hi = lo + 10
        sel = [(p, u) for p, u in zip(probs, ups) if lo <= p * 100 < hi or (hi == 100 and p == 1.0)]
        if sel:
            bins.append({"range": f"{lo}-{hi}", "n": len(sel),
                         "predicted_up_pct": round(sum(p for p, _ in sel) / len(sel) * 100, 1),
                         "realized_up_pct": round(sum(u for _, u in sel) / len(sel) * 100, 1)})
    return {
        "n": n,
        "direction_hit_rate": round(hit / len(called) * 100, 1) if called else None,
        "base_rate_up_pct": round(base * 100, 1),
        "brier": round(brier, 4),
        "brier_baseline": round(brier_base, 4),
        "calibration": bins,
    }


def build_summary(entries):
    resolved = sorted([e for e in entries if e["status"] == "resolved"], key=lambda e: e["horizon_end"])
    directional = [e for e in resolved if "trade" in e.get("outcome", {})]
    tradeable = [e for e in directional if e["plan"]["tradeable"]]

    def block(sel_pred, sel_dir, sel_trd):
        return {
            "predictions": _prediction_stats(sel_pred),
            "directional_signals": _trade_stats([e["outcome"]["trade"]["net_pct"] for e in sel_dir]),
            "tradeable_signals": _trade_stats([e["outcome"]["trade"]["net_pct"] for e in sel_trd]),
        }

    pairs = sorted({f"{e['symbol']}_{e['tf']}" for e in entries})
    by_pair = {}
    for key in pairs:
        f = lambda xs: [e for e in xs if f"{e['symbol']}_{e['tf']}" == key]
        by_pair[key] = block(f(resolved), f(directional), f(tradeable))
        by_pair[key]["open"] = sum(1 for e in entries if f"{e['symbol']}_{e['tf']}" == key and e["status"] == "open")

    created = [e["created_at"] for e in entries]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "since": min(created) if created else None,
        "counts": {
            "total": len(entries),
            "open": sum(1 for e in entries if e["status"] == "open"),
            "resolved": len(resolved),
            "expired": sum(1 for e in entries if e["status"] == "expired"),
        },
        "costs": {"fee_pct_per_side": FEE_PCT, "slippage_pct_per_side": SLIPPAGE_PCT, "tax_rate": TAX_RATE},
        "horizon_candles": PRED_LEN,
        "overall": block(resolved, directional, tradeable),
        "by_pair": by_pair,
    }


def save_summary(summary, path=SUMMARY_PATH):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(summary, f, indent=1)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
