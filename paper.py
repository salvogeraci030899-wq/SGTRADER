"""Prova su carta: i segnali delle strategie attivate in automation.json vengono seguiti dal vivo,
senza ordini e senza soldi, e registrati in paper_trades.json.

È il terzo cancello prima dei soldi veri (dopo ricerca e prova finale): dati che al momento della
scelta della strategia non esistevano ancora.

Come funziona: a ogni nuova candela chiusa si rigioca la strategia con lo STESSO motore del
laboratorio (strategy_lab.simulate) partendo sempre dalla stessa candela (paper_start). Così la
prova su carta non può divergere dalle regole provate sullo storico. I trade già chiusi restano
quelli registrati: se un ricalcolo desse un risultato diverso (dati Bitget corretti a posteriori)
il vecchio valore resta e il trade viene marcato "revised", senza riscrivere la storia.
"""
import json
import os
import tempfile
from datetime import datetime, timezone

import numpy as np

import events as event_log

import lab_strategies
import strategy_lab as lab
import validation as va
from kronos_core import TRADE_ASSETS, TF_DELTA

CONFIG_PATH = "automation.json"
LEDGER_PATH = "paper_trades.json"
MODES = ("off", "paper", "live")


def load_config(path=CONFIG_PATH):
    if not os.path.exists(path):
        return {"paper_start": None, "strategies": {}}
    with open(path) as f:
        return json.load(f)


def confirmed_keys(summary_path=lab.SUMMARY_PATH):
    try:
        with open(summary_path) as f:
            return set(json.load(f).get("confirmed", []))
    except Exception:
        return set()


def lab_result(key, summary_path=lab.SUMMARY_PATH):
    try:
        with open(summary_path) as f:
            return (json.load(f).get("results") or {}).get(key)
    except Exception:
        return None


MIN_COMPARE = 10      # trade chiusi su carta prima di confrontarli con lo storico


def vs_backtest(nets, ref):
    """La carta si comporta come lo storico? Confronta il netto medio per trade su carta con quello del
    laboratorio. La variabilità del singolo trade si ricava dall'intervallo al 95% della media storica
    (ampiezza / 3,92 * radice di n). z = differenza / (variabilità / radice dei trade su carta).
    |z| < 2: in linea; z <= -2: sotto lo storico (la strategia potrebbe aver smesso di funzionare);
    z >= 2: sopra (bene, ma probabilmente fortuna)."""
    if not ref or not ref.get("avg_net_ci") or not ref.get("n") or ref.get("avg_net_pct") is None:
        return None
    n = len(nets)
    out = {"bt_avg": round(ref["avg_net_pct"], 3), "bt_n": ref["n"], "n": n}
    if n < MIN_COMPARE:
        out["verdict"] = "pochi_trade"
        return out
    lo, hi = ref["avg_net_ci"]
    sd = (hi - lo) / 3.92 * np.sqrt(ref["n"])
    if not sd > 0:
        return None
    z = (float(np.mean(nets)) - ref["avg_net_pct"]) / (sd / np.sqrt(n))
    out.update(z=round(float(z), 2), verdict="in_linea" if abs(z) < 2 else ("sotto" if z < 0 else "sopra"))
    return out


def effective_mode(key, mode, confirmed):
    """'live' vale solo per strategie confermate dalla prova finale: altrimenti si resta su carta."""
    if mode not in MODES:
        return "off"
    if mode == "live" and key not in confirmed:
        return "paper"
    return mode


def replay(df, tf, symbol, spec, start_ts):
    """Trade della strategia dalla candela di partenza in poi: il motore parte sempre dalla stessa
    candela (con le WARMUP candele precedenti per gli indicatori), quindi il risultato è ripetibile."""
    times = np.array([int(t.timestamp()) for t in df["time"]])
    first = int(np.searchsorted(times, start_ts, side="left"))
    if first < lab.WARMUP:
        return None        # storico insufficiente prima della partenza
    if first >= len(df) - 1:
        return []          # ancora nessuna candela chiusa dopo la partenza: niente trade, ma è tutto regolare
    return lab.simulate(df.iloc[first - lab.WARMUP:].reset_index(drop=True), tf, symbol, spec)


def trade_id(key, t):
    return f"{key}:{t['symbol']}:{t['t']}"


def merge(old_trades, new_trades, key, now_iso):
    """Unisce il ricalcolo al registro: i trade chiusi già registrati non cambiano più."""
    old = {x["id"]: x for x in old_trades}
    out, events = [], []
    for t in sorted(new_trades, key=lambda t: (t["t"], t["symbol"])):
        tid = trade_id(key, t)
        row = {"id": tid, "symbol": t["symbol"], "t": t["t"], "t_entry": t["t_entry"], "t_exit": t["t_exit"], "dir": t["dir"], "entry": t["entry"], "exit": t["exit"],
               "stop": t["stop"], "bars": t["bars"], "reason": t["reason"], "open": t["open"], "gross": round(t["gross"], 4)}
        prev = old.pop(tid, None)
        if prev is None:
            row["first_seen"] = now_iso
            events.append(("open" if t["open"] else "closed", row))
        elif not prev["open"]:
            changed = abs(prev["gross"] - row["gross"]) > 1e-3 or prev["reason"] != row["reason"]
            row = dict(prev, revised=True) if changed else prev          # chiuso e registrato: non si riscrive
        else:
            row["first_seen"] = prev.get("first_seen", now_iso)
            if not t["open"]:
                row["closed_seen"] = now_iso
                events.append(("closed", row))
        out.append(row)
    for prev in old.values():      # registrato ma non più prodotto dal ricalcolo: resta, segnalato
        out.append(dict(prev, revised=True) if not prev["open"] else dict(prev, open=False, reason="ANNULLATO", revised=True))
    return sorted(out, key=lambda r: (r["t"], r["symbol"])), events


def stats(trades, funding, ref=None):
    closed = [t for t in trades if not t["open"]]
    nets = lab.net_returns(closed, lab.PRIMARY, funding)
    if not closed:
        out = {"n": 0, "open": sum(1 for t in trades if t["open"])}
        cmp = vs_backtest([], ref)
        if cmp:
            out["vs_backtest"] = cmp
        return out
    arr = np.array(nets)
    for t, v in zip(closed, nets):
        t["net"] = round(float(v), 4)
    out = {"n": len(closed), "open": sum(1 for t in trades if t["open"]), "win_rate": round(float((arr > 0).mean() * 100), 1),
           "avg_net_pct": round(float(arr.mean()), 3), "total_net_pct": round(float(arr.sum()), 2),
           "revised": sum(1 for t in trades if t.get("revised"))}
    cmp = vs_backtest(list(arr), ref)
    if cmp:
        out["vs_backtest"] = cmp
    return out


def _save(path, data):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=1)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def describe_event(kind, key, row):
    """Testo dell'avviso Telegram (senza caratteri che rompono il Markdown)."""
    name, tf = key.split(":")
    side = "LONG" if row["dir"] > 0 else "SHORT"
    coin = row["symbol"].replace("USDT", "")
    head = f"📝 PROVA SU CARTA (nessun ordine reale)\n{name.replace('_', ' ')} {tf.upper()} · {coin} {side}"
    if kind == "open":
        return f"{head}\nIngresso {row['entry']:,.2f} · stop {row['stop']:,.2f}"
    return f"{head}\nChiuso a {row['exit']:,.2f} ({row['reason']}): {row['gross']:+.2f}% lordo in {row['bars']} candele"


def update(last_candles, config_path=CONFIG_PATH, ledger_path=LEDGER_PATH, download=None, funding_fetch=None, notify=None, now=None):
    """last_candles: {"SYMBOL_tf": tempo di apertura dell'ultima candela chiusa}. Ricalcola solo le prove
    (strategia x timeframe) per cui è arrivata una candela nuova. Ritorna True se il registro è cambiato."""
    config = load_config(config_path)
    if not config.get("paper_start"):
        return False
    start_ts = lab._ts(config["paper_start"])
    confirmed = confirmed_keys()
    ledger = {"started": config["paper_start"], "strategies": {}}
    if os.path.exists(ledger_path):
        with open(ledger_path) as f:
            ledger = json.load(f)
    download = download or va.download_history
    now_iso = (now or datetime.now(timezone.utc)).isoformat(timespec="seconds")
    funding, changed = None, False

    # strategie spente dall'app (o dall'emergenza): restano nel registro con i loro trade, ma "off"
    active = config.get("strategies", {})
    for key, entry in ledger["strategies"].items():
        if key not in active and entry.get("mode") != "off":
            entry["mode"], changed = "off", True

    for key, mode in active.items():
        mode = effective_mode(key, mode, confirmed)
        name, tf = key.split(":")
        if key not in ledger["strategies"]:
            # Strategia nuova: la carta parte dall'ultima candela chiusa, non dall'inizio della prova su carta.
            # Ricostruire i giorni prima vorrebbe dire contare trade che nessuno ha seguito dal vivo, su dati
            # che il laboratorio aveva già usato per sceglierla.
            known = [v for k, v in last_candles.items() if k.endswith(f"_{tf}") and v]
            ledger["strategies"][key] = {"mode": mode, "trades": [], "last_candle": {}, "stats": {"n": 0, "open": 0},
                                         "since": max([start_ts] + known)}
            changed = changed or mode != "off"
        entry = ledger["strategies"][key]
        if entry.get("mode") == "off" and mode != "off" and not entry["trades"]:
            # riaccesa senza trade registrati: anche lei parte da adesso
            known = [v for k, v in last_candles.items() if k.endswith(f"_{tf}") and v]
            entry["since"], entry["last_candle"] = max([start_ts] + known), {}
        since = max(start_ts, int(entry.get("since") or start_ts))
        if entry.get("mode") != mode:
            entry["mode"], changed = mode, True
        if mode == "off" or name not in lab_strategies.STRATEGIES:
            continue
        symbols = [s for s in TRADE_ASSETS if last_candles.get(f"{s}_{tf}") and entry["last_candle"].get(s) != last_candles[f"{s}_{tf}"]]
        if not symbols:
            continue
        spec = lab_strategies.STRATEGIES[name]
        step_ms = int(TF_DELTA[tf].total_seconds()) * 1000
        fresh = [t for t in entry["trades"] if t["symbol"] not in symbols]     # coin senza candela nuova: restano come sono
        recomputed, done = [], []
        for symbol in symbols:
            df = download(symbol, tf, since * 1000 - (lab.WARMUP + 60) * step_ms)
            trades = None if df is None else replay(df, tf, symbol, spec, since)
            if trades is None:
                print(f"Prova su carta {key} {symbol}: storico non disponibile, riprovo al prossimo giro.")
                fresh += [t for t in entry["trades"] if t["symbol"] == symbol]
                continue
            recomputed += trades
            done.append(symbol)
        if not done:
            continue
        merged, events = merge([t for t in entry["trades"] if t["symbol"] in done], recomputed, key, now_iso)
        entry["trades"] = sorted(fresh + merged, key=lambda r: (r["t"], r["symbol"]))
        for symbol in done:
            entry["last_candle"][symbol] = last_candles[f"{symbol}_{tf}"]
        if funding is None:
            funding = {s: (funding_fetch or lab.fetch_funding_history)(s) for s in TRADE_ASSETS}
        entry["stats"] = stats(entry["trades"], funding, lab_result(key))
        changed = True
        for kind, row in events:
            print(f"Prova su carta {key}: {kind} {row['symbol']} {row['reason']}")
            event_log.record("carta", "aperto" if kind == "open" else "chiuso", describe_event(kind, key, row).replace("\n", " · "),
                             key=key, symbol=row["symbol"], net=row.get("net"))
            if notify:
                notify(describe_event(kind, key, row))
    if changed:
        ledger["updated_at"] = now_iso
        _save(ledger_path, ledger)
    return changed
