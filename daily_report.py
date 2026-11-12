"""Riepilogo giornaliero su Telegram, senza AI: sempre uguale, gratuito e verificabile.

Una volta al giorno (al primo giro del bot dopo REPORT_HOUR_UTC) riassume:
- prezzi e variazione delle ultime 24 ore (candela giornaliera);
- futures: funding e variazione dell'open interest;
- prova su carta: trade aperti e chiusi per strategia;
- conto Bitget (sola lettura): saldo, variazione del giorno, posizioni;
- modalità ordini (Simulato/Reale), esecutore: posizioni aperte, blocchi;
- automazione: emergenza, strategie attive, strategie confermate;
- agente: autonomia, profilo, stile, rendimento della carta in % del patrimonio, proposte per il reale.
I dati sono quelli già scritti dal bot: niente chiamate esterne in più.
Il testo evita i caratteri speciali del Markdown di Telegram (trattino basso, asterisco).
"""
import json
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


def _paper_return(paper, risk_pct):
    """Rendimento della carta in % del patrimonio, come nell'app e nell'agente (R x rischio per trade)."""
    eq, n = 0.0, 0
    for e in (paper.get("strategies") or {}).values():
        for t in e.get("trades") or []:
            if not t.get("open") and t.get("net") is not None and t.get("entry") and t.get("stop"):
                stop_pct = abs(t["entry"] - t["stop"]) / t["entry"] * 100
                if stop_pct > 0:
                    eq += t["net"] / stop_pct * float(risk_pct)
                    n += 1
    return eq, n


def build(frames, now, paths=None):
    """frames: {"SYMBOL_1d": DataFrame candele chiuse} del giro corrente (può mancare qualcosa)."""
    p = {"futures": "futures_data.json", "paper": "paper_trades.json", "live": "live_trades.json",
         "automation": "automation.json", "lab": "lab_summary.json", "agent": "agent_state.json", **(paths or {})}
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

    ag = {"autonomy": "paper", "profile": "bilanciato", "style": "swing", **(auto.get("agent") or {})}
    ag_state = _read(p["agent"]) or {}
    txt = f"Agente: autonomia {dict(off='spenta', paper='simulato', live='REALE').get(ag['autonomy'], ag['autonomy'])}, profilo {ag['profile']}, stile {ag['style']}"
    ret, n = _paper_return(_read(p["paper"]) or {}, (auto.get("risk") or {}).get("risk_per_trade_pct") or 0.5)
    if n:
        txt += f" · carta in totale {_pct(ret)} in {n} trade"
    props = [x.get("key") for x in ag_state.get("proposals") or [] if x.get("key")]
    if props:
        txt += " · 👉 proposta per il reale: " + ", ".join(props) + " (conferma in app)"
    lines.append(txt)

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
        v = st.get("vs_backtest") or {}
        if v.get("verdict") in ("in_linea", "sotto", "sopra"):
            txt += {"in_linea": " · in linea con lo storico", "sotto": " · ⚠️ SOTTO LO STORICO: la strategia potrebbe non funzionare più",
                    "sopra": " · sopra lo storico (in parte fortuna)"}[v["verdict"]]
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
        # posizioni reali chiuse nelle ultime 24 ore (storico di Bitget)
        since = now.timestamp() * 1000 - 24 * 3600e3
        closed = [h for h in acc.get("history") or [] if (h.get("closed_at") or 0) >= since]
        if closed:
            net = sum((h.get("net") if h.get("net") is not None else 0) for h in closed)
            wins = sum(1 for h in closed if (h.get("net") or 0) > 0)
            lines.append(f"Trade reali chiusi nelle ultime 24 ore: {len(closed)} ({wins} in utile), netto {_it(net, sign=True)} USDT")
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
