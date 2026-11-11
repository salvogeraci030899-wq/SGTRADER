"""Riepilogo giornaliero su Telegram, senza AI: sempre uguale, gratuito e verificabile.

Una volta al giorno (al primo giro del bot dopo REPORT_HOUR_UTC) riassume:
- prezzi e variazione delle ultime 24 ore (candela giornaliera);
- futures: funding e variazione dell'open interest;
- prova su carta: trade aperti e chiusi per strategia;
- esecutore: modalità, posizioni aperte, blocchi;
- automazione: emergenza, strategie attive, strategie confermate.
I dati sono quelli già scritti dal bot: niente chiamate esterne in più.
Il testo evita i caratteri speciali del Markdown di Telegram (trattino basso, asterisco).
"""
import json
import os
from datetime import datetime, timezone

REPORT_HOUR_UTC = 7          # circa le 8-9 in Italia
STATE_KEY = "_daily_report"  # data dell'ultimo riepilogo, salvata in alerts_state.json
COINS = ("BTCUSDT", "ETHUSDT", "SOLUSDT")


def _read(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def _clean(text):
    return text.replace("_", " ").replace("*", "")


def _pct(v, d=2):
    return "n/d" if v is None else f"{v:+.{d}f}%"


def build(frames, now, paths=None):
    """frames: {"SYMBOL_1d": DataFrame candele chiuse} del giro corrente (può mancare qualcosa)."""
    p = {"futures": "futures_data.json", "paper": "paper_trades.json", "live": "live_trades.json",
         "automation": "automation.json", "lab": "lab_summary.json", **(paths or {})}
    lines = [f"📊 RIEPILOGO {now:%d/%m/%Y}"]

    prices = []
    for s in COINS:
        df = frames.get(f"{s}_1d")
        if df is None or len(df) < 2:
            continue
        last, prev = float(df["close"].iloc[-1]), float(df["close"].iloc[-2])
        prices.append(f"{s.replace('USDT', '')} {last:,.2f} ({_pct((last / prev - 1) * 100)})")
    if prices:
        lines.append("Prezzi (chiusura di ieri): " + " · ".join(prices))

    fut = (_read(p["futures"]) or {}).get("symbols") or {}
    parts = []
    for s in COINS:
        f = fut.get(s)
        if f:
            oi = f.get("open_interest_change_24h_pct")
            parts.append(f"{s.replace('USDT', '')} funding {_pct(f.get('funding_rate_pct'), 4)}" + (f", OI 24h {_pct(oi, 1)}" if oi is not None else ""))
    if parts:
        lines.append("Futures: " + " · ".join(parts))

    auto = _read(p["automation"]) or {}
    active = {k: v for k, v in (auto.get("strategies") or {}).items() if v != "off"}
    if auto.get("emergency"):
        lines.append("⛔ EMERGENZA ATTIVA: automazione bloccata.")
    lines.append("Strategie attive: " + (", ".join(f"{k} ({'carta' if v == 'paper' else 'reale'})" for k, v in active.items()) or "nessuna"))

    paper = (_read(p["paper"]) or {}).get("strategies") or {}
    for key, e in paper.items():
        st = e.get("stats") or {}
        n, op = st.get("n", 0), st.get("open", 0)
        txt = f"Su carta {key}: {n} chiusi"
        if n:
            txt += f" (vincenti {st.get('win_rate', 0):.0f}%, netto medio {_pct(st.get('avg_net_pct'))})"
        txt += f", {op} aperti"
        lines.append(txt)

    live = _read(p["live"])
    if live:
        open_pos = [x for x in (live.get("positions") or {}).values() if x.get("status") == "open"]
        txt = f"Esecutore: modalità {live.get('mode', 'simulata')}, {len(open_pos)} posizioni aperte"
        if live.get("halted"):
            txt += ". ⚠️ BLOCCATO: controlla Bitget e sblocca dall'app"
        lines.append(txt)
    else:
        lines.append("Esecutore: nessuna attività (nessuna strategia in Reale).")

    lab = _read(p["lab"]) or {}
    confirmed = lab.get("confirmed") or []
    lines.append("Strategie confermate: " + (", ".join(confirmed) if confirmed else "nessuna (ordini veri non consentiti)"))
    return _clean("\n".join(lines))


def maybe_send(alerts_state, frames, notify, now=None, paths=None):
    """Manda il riepilogo se è l'ora e oggi non è ancora partito. Ritorna True se l'ha mandato."""
    now = now or datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    if now.hour < REPORT_HOUR_UTC or alerts_state.get(STATE_KEY) == today:
        return False
    text = build(frames, now, paths)
    if notify(text):
        alerts_state[STATE_KEY] = today
        return True
    return False
