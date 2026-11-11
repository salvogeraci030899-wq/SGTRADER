"""Riepilogo giornaliero su Telegram, senza AI: sempre uguale, gratuito e verificabile.

Una volta al giorno (al primo giro del bot dopo REPORT_HOUR_UTC) riassume:
- prezzi e variazione delle ultime 24 ore (candela giornaliera);
- futures: funding e variazione dell'open interest;
- prova su carta: trade aperti e chiusi per strategia;
- conto Bitget (sola lettura): saldo, variazione del giorno, posizioni;
- modalità ordini (Simulato/Reale), esecutore: posizioni aperte, blocchi;
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


def _it(v, d=2, sign=False):
    """Numero in formato italiano: 1.523,40 (punto per le migliaia, virgola per i decimali)."""
    txt = f"{v:+,.{d}f}" if sign else f"{v:,.{d}f}"
    return txt.replace(",", "§").replace(".", ",").replace("§", ".")


def _pct(v, d=2):
    return "n/d" if v is None else _it(v, d, sign=True) + "%"


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
        prices.append(f"{s.replace('USDT', '')} {_it(last)} ({_pct((last / prev - 1) * 100)})")
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

    real = bool((auto.get("risk") or {}).get("trading_enabled"))
    lines.append("Modalità ordini: " + ("REALE (ordini veri solo per strategie confermate)" if real else "simulato, nessun ordine vero"))

    paper = (_read(p["paper"]) or {}).get("strategies") or {}
    for key, e in paper.items():
        if e.get("mode") == "off" or key not in active:       # spenta: non fa più parte della prova
            continue
        st = e.get("stats") or {}
        n, op = st.get("n", 0), st.get("open", 0)
        txt = f"Su carta {key}: {n} chiusi"
        if n:
            txt += f" (vincenti {st.get('win_rate', 0):.0f}%, netto medio {_pct(st.get('avg_net_pct'))})"
        txt += f", {op} aperti"
        lines.append(txt)

    live = _read(p["live"])
    acc = (live or {}).get("account") or {}
    if acc.get("connected"):
        total = acc.get("total_usdt", acc.get("equity"))
        txt = f"Bitget ({'demo' if acc.get('demo') else 'reale'}): saldo {_it(total)} USDT"
        if acc.get("day_change") is not None:
            txt += f", variazione oggi {_it(acc['day_change'], sign=True)}"
        txt += f", {acc.get('positions', 0)} posizioni"
        if acc.get("positions"):
            txt += f" (PnL aperto {_it(acc.get('upl', 0), sign=True)})"
        lines.append(txt)
    elif acc.get("reason") and acc.get("reason") != "chiavi non impostate":
        lines.append(f"⚠️ Bitget: lettura del conto non riuscita ({acc['reason'][:80]}).")
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
