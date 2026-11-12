"""Comandi dell'automazione: modificano automation.json in modo controllato.

Li usa il workflow "Automazione" (avviato dall'app tramite il server comandi) e si possono usare
anche a mano:

    python automation.py set big_candle_trail:1d paper
    python automation.py emergency        # tutto spento subito, automazione bloccata
    python automation.py resume           # sblocca (le strategie restano spente: vanno riaccese una a una)
    python automation.py risk risk_per_trade_pct 0.5    # limiti di rischio dell'esecutore
    python automation.py trading on       # interruttore generale degli ordini veri (servono anche le chiavi Bitget)
    python automation.py agent autonomy live    # agente: off | paper | live (vedi agent.py)
    python automation.py agent profile prudente # profilo di rischio: imposta tutti i limiti insieme
    python automation.py agent style giornaliero    # timeframe su cui l'agente sceglie: swing | giornaliero | misto

Regole che il codice fa rispettare, qualunque cosa arrivi dall'app:
- si possono attivare solo strategie che esistono nel laboratorio, su timeframe su cui sono state provate;
- "live" (ordini reali) solo per strategie confermate dalla prova finale (lab_summary.json);
- durante l'emergenza non si può accendere nulla;
- al massimo MAX_ACTIVE (6) strategie accese insieme;
- ogni comando resta nel registro "history" di automation.json, con data e ora.
"""
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

import executor
import price_alerts
import lab_strategies

CONFIG_PATH = "automation.json"
SUMMARY_PATH = "lab_summary.json"
ALERTS_STATE_PATH = "alerts_state.json"
MODES = ("off", "paper", "live")
HISTORY_MAX = 200
MAX_ACTIVE = 6          # strategie accese insieme (su carta o reali): più prove = più risultati "buoni" per caso


class CommandError(ValueError):
    """Comando rifiutato: il messaggio spiega perché (finisce nel log del workflow e nell'app)."""


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load(path=CONFIG_PATH):
    if not os.path.exists(path):
        return {"paper_start": None, "emergency": False, "strategies": {}, "history": []}
    with open(path) as f:
        cfg = json.load(f)
    cfg.setdefault("emergency", False)
    cfg.setdefault("strategies", {})
    cfg.setdefault("history", [])
    return cfg


def save(cfg, path=CONFIG_PATH):
    cfg["history"] = cfg["history"][-HISTORY_MAX:]
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(cfg, f, indent=1, ensure_ascii=False)
            f.write("\n")
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def confirmed(summary_path=SUMMARY_PATH):
    try:
        with open(summary_path) as f:
            return set(json.load(f).get("confirmed", []))
    except Exception:
        return set()


def set_mode(cfg, key, mode, confirmed_keys, today=None):
    if mode not in MODES:
        raise CommandError(f"Stato sconosciuto: {mode}. Ammessi: {', '.join(MODES)}.")
    if ":" not in key:
        raise CommandError(f"Strategia non valida: {key} (formato nome:timeframe).")
    name, tf = key.split(":", 1)
    spec = lab_strategies.STRATEGIES.get(name)
    if spec is None:
        raise CommandError(f"Strategia sconosciuta: {name}.")
    if tf not in ("1d", "4h", "1h") or (spec["tfs"] is not None and tf not in spec["tfs"]):
        raise CommandError(f"{name} non è stata provata sul timeframe {tf}.")
    if spec.get("family") in ("forza relativa", "funding") and mode != "off":
        raise CommandError(f"{name} usa dati che la prova su carta non riceve ancora (altre coin o archivio futures).")
    if mode != "off" and cfg["emergency"]:
        raise CommandError("Emergenza attiva: prima va sbloccata.")
    active = [k for k, m in cfg["strategies"].items() if m != "off"]
    if mode != "off" and key not in active and len(active) >= MAX_ACTIVE:
        raise CommandError(f"Al massimo {MAX_ACTIVE} strategie accese insieme: spegnine una prima di aggiungerne un'altra.")
    if mode == "live" and key not in confirmed_keys:
        raise CommandError(f"{key} non è confermata dalla prova finale: il reale non è consentito.")
    before = cfg["strategies"].get(key, "off")
    if mode == "off":
        cfg["strategies"].pop(key, None)
    else:
        cfg["strategies"][key] = mode
    if mode != "off" and not cfg.get("paper_start"):
        cfg["paper_start"] = today or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cfg["history"].append({"at": _now(), "cmd": "set", "key": key, "from": before, "to": mode})
    return f"{key}: {before} -> {mode}"


def emergency(cfg):
    turned_off = sorted(cfg["strategies"])
    cfg["strategies"] = {}
    cfg["emergency"] = True
    cfg.setdefault("risk", {})["trading_enabled"] = False      # anche l'interruttore degli ordini veri torna spento
    cfg["history"].append({"at": _now(), "cmd": "emergency", "turned_off": turned_off})
    return f"Emergenza: spente {len(turned_off)} strategie, automazione bloccata."


def resume(cfg, state_path=executor.STATE_PATH):
    """Sblocca l'automazione e, se l'esecutore si era fermato (emergenza o posizioni diverse dal
    previsto su Bitget), sblocca anche lui. Le strategie restano spente."""
    halted = False
    if os.path.exists(state_path):
        with open(state_path) as f:
            halted = bool(json.load(f).get("halted"))
    if not cfg["emergency"] and not halted:
        raise CommandError("L'automazione non è bloccata.")
    cfg["emergency"] = False
    if halted:
        executor.unhalt(state_path)
    cfg["history"].append({"at": _now(), "cmd": "resume", "executor_unhalted": halted})
    return "Automazione sbloccata. Le strategie restano spente finché non le riaccendi."


def set_risk(cfg, field, value):
    if field not in executor.RISK_BOUNDS:
        raise CommandError(f"Limite sconosciuto: {field}.")
    try:
        v = float(value)
    except ValueError:
        raise CommandError(f"Valore non numerico: {value}.")
    lo, hi = executor.RISK_BOUNDS[field]
    if not lo <= v <= hi:
        raise CommandError(f"{field} deve essere tra {lo:g} e {hi:g}.")
    if field in ("max_leverage", "max_open_positions"):
        if v != int(v):
            raise CommandError(f"{field} deve essere un numero intero.")
        v = int(v)
    risk = cfg.setdefault("risk", {})
    before = executor.risk_config(cfg)[field]
    risk[field] = v
    cfg["history"].append({"at": _now(), "cmd": "risk", "field": field, "from": before, "to": v})
    return f"{field}: {before} -> {v}"


def set_trading(cfg, value):
    if value not in ("on", "off"):
        raise CommandError("Valore ammesso: on oppure off.")
    if value == "on" and cfg["emergency"]:
        raise CommandError("Emergenza attiva: prima va sbloccata.")
    cfg.setdefault("risk", {})["trading_enabled"] = value == "on"
    cfg["history"].append({"at": _now(), "cmd": "trading", "to": value})
    return ("Ordini veri ABILITATI: partono solo per strategie confermate in modalità Reale e con le chiavi Bitget impostate."
            if value == "on" else "Ordini veri disabilitati: l'esecutore resta in simulazione.")


# --- Agente (agent.py): autonomia, profilo di rischio, stile ---
AGENT_DEFAULT = {"autonomy": "paper", "profile": "bilanciato", "style": "swing"}
AUTONOMY = ("off", "paper", "live")
# Ogni profilo imposta tutti i limiti dell'esecutore insieme (restano modificabili uno per uno)
PROFILES = {
    "prudente":   {"risk_per_trade_pct": 0.25, "max_leverage": 2, "max_exposure_x": 1.0, "max_open_positions": 2, "max_daily_loss_pct": 2.0, "daily_target_pct": 1.0},
    "bilanciato": {"risk_per_trade_pct": 0.5,  "max_leverage": 3, "max_exposure_x": 1.5, "max_open_positions": 3, "max_daily_loss_pct": 3.0, "daily_target_pct": 2.0},
    "aggressivo": {"risk_per_trade_pct": 1.0,  "max_leverage": 5, "max_exposure_x": 2.5, "max_open_positions": 4, "max_daily_loss_pct": 5.0, "daily_target_pct": 3.0},
}
STYLES = {"swing": ("1d",), "giornaliero": ("4h", "1h"), "misto": ("1d", "4h", "1h")}


def agent_config(cfg):
    return {**AGENT_DEFAULT, **(cfg.get("agent") or {})}


def agent_live_keys(cfg):
    """Strategie che l'agente ha portato al reale (dal registro) e che sono ancora reali."""
    keys = set()
    for h in cfg.get("history", []):
        if h.get("cmd") == "set" and h.get("by") == "agent":
            if h.get("to") == "live":
                keys.add(h["key"])
            elif h.get("from") == "live":
                keys.discard(h["key"])
    return {k for k in keys if cfg.get("strategies", {}).get(k) == "live"}


def set_agent(cfg, field, value):
    ag = agent_config(cfg)
    if field == "autonomy":
        if value not in AUTONOMY:
            raise CommandError(f"Autonomia ammessa: {', '.join(AUTONOMY)}.")
        if value == "live" and cfg["emergency"]:
            raise CommandError("Emergenza attiva: prima va sbloccata.")
        extra = ""
        if value != "live":
            # niente più soldi veri decisi dall'agente: le strategie che lui aveva portato al reale tornano su carta
            back = sorted(agent_live_keys(cfg))
            for k in back:
                cfg["strategies"][k] = "paper"
                cfg["history"].append({"at": _now(), "cmd": "set", "key": k, "from": "live", "to": "paper", "by": "agent", "why": "autonomia ridotta"})
            if back:
                extra = f" Tornate su carta: {', '.join(back)}."
    elif field == "profile":
        if value not in PROFILES:
            raise CommandError(f"Profilo ammesso: {', '.join(PROFILES)}.")
        cfg.setdefault("risk", {}).update(PROFILES[value])
        extra = " Limiti: " + ", ".join(f"{k} {v}" for k, v in PROFILES[value].items()) + "."
    elif field == "style":
        if value not in STYLES:
            raise CommandError(f"Stile ammesso: {', '.join(STYLES)}.")
        extra = ""
    else:
        raise CommandError(f"Impostazione dell'agente sconosciuta: {field}.")
    before = ag[field]
    cfg["agent"] = {**ag, field: value}
    cfg["history"].append({"at": _now(), "cmd": "agent", "field": field, "from": before, "to": value})
    return f"Agente, {field}: {before} -> {value}.{extra}"


def alert(cfg, op, arg, alerts_state_path=ALERTS_STATE_PATH):
    """Avvisi di prezzo (price_alerts.py): add BTCUSDT:above:75000 | del <id> | clear"""
    # avvisi già scattati: quelli del controllo rapido (quick_state.json) e quelli di prima (alerts_state.json)
    fired = []
    for path in (alerts_state_path, os.path.join(os.path.dirname(alerts_state_path) or ".", "quick_state.json")):
        try:
            with open(path) as f:
                fired += json.load(f).get(price_alerts.FIRED_KEY, [])
        except (OSError, ValueError, AttributeError):
            pass
    fired_state = {price_alerts.FIRED_KEY: fired}
    try:
        if op == "add":
            msg = price_alerts.add(cfg, arg, fired_state)
        elif op == "del":
            msg = price_alerts.remove(cfg, arg, fired_state)
        elif op == "clear":
            msg = price_alerts.clear(cfg)
        else:
            raise CommandError(f"Operazione sugli avvisi non valida: {op}")
    except price_alerts.AlertError as e:
        raise CommandError(str(e))
    cfg["history"].append({"at": _now(), "cmd": "alert", "op": op, "arg": arg})
    return msg


def run(argv, path=CONFIG_PATH, summary_path=SUMMARY_PATH, state_path=executor.STATE_PATH, alerts_state_path=ALERTS_STATE_PATH):
    if not argv:
        raise CommandError("Comando mancante: set, emergency, resume, risk, trading o alert.")
    cfg = load(path)
    cmd = argv[0]
    if cmd == "set" and len(argv) == 3:
        msg = set_mode(cfg, argv[1], argv[2], confirmed(summary_path))
    elif cmd == "emergency" and len(argv) == 1:
        msg = emergency(cfg)
    elif cmd == "resume" and len(argv) == 1:
        msg = resume(cfg, state_path)
    elif cmd == "risk" and len(argv) == 3:
        msg = set_risk(cfg, argv[1], argv[2])
    elif cmd == "trading" and len(argv) == 2:
        msg = set_trading(cfg, argv[1])
    elif cmd == "agent" and len(argv) == 3:
        msg = set_agent(cfg, argv[1], argv[2])
    elif cmd == "alert" and len(argv) >= 2:
        msg = alert(cfg, argv[1], argv[2] if len(argv) > 2 else "", alerts_state_path)
    else:
        raise CommandError(f"Comando non valido: {' '.join(argv)}")
    save(cfg, path)
    return msg


if __name__ == "__main__":
    try:
        print(run(sys.argv[1:]))
    except CommandError as e:
        sys.exit(f"Comando rifiutato: {e}")
