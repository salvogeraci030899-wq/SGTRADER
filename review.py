"""Agente revisore: confronta ciò che l'esecutore ha fatto con i soldi veri con la prova su carta.

Un vantaggio che esiste sulla carta può sparire nell'esecuzione: prezzi d'ingresso peggiori (slippage), commissioni
e funding più alti, ordini saltati. Il revisore lo misura, senza decidere nulla:
- ingressi saltati negli ultimi 30 giorni, per motivo (capitale sotto il minimo, limite del giorno, pausa per eventi...);
- aperture fallite;
- per ogni trade reale chiuso su Bitget e ritrovato (coin, lato, apertura entro 10 minuti): prezzo d'ingresso e
  risultato netto veri contro quelli della carta.
Lo chiama l'agente ogni giorno: i fatti finiscono nel suo rapporto e in agent_state.json ("review", Agente → Panoramica).
"""
from datetime import datetime, timedelta, timezone

WINDOW = timedelta(days=30)
MATCH_MS = 10 * 60 * 1000
GAP_ALERT_PCT = 0.5        # oltre questo scarto medio a trade (netto reale peggiore della carta) arriva un avviso


def _ts_from_id(tid):
    try:
        return int(str(tid).rsplit(":", 1)[1])
    except (IndexError, ValueError):
        return None


def _reason(text):
    """Motivo senza i dettagli tra parentesi: "pausa dell'agente eventi (Bitget...)" -> "pausa dell'agente eventi"."""
    return str(text or "altro").split(" (")[0].strip() or "altro"


def _paper_trade(paper, tid):
    for entry in (paper.get("strategies") or {}).values():
        for t in entry.get("trades") or []:
            if t.get("id") == tid:
                return t
    return None


def review(live, paper, now=None):
    now = now or datetime.now(timezone.utc)
    since = (now - WINDOW).timestamp()
    positions = (live or {}).get("positions") or {}
    history = ((live or {}).get("account") or {}).get("history") or []
    out = {"window_days": WINDOW.days, "skipped": {}, "errors": 0, "opened": 0, "matched": 0, "rows": []}
    slips, gaps = [], []
    for tid, p in positions.items():
        status = p.get("status")
        when = _ts_from_id(tid)
        if p.get("opened_at"):
            when = datetime.fromisoformat(p["opened_at"]).timestamp()
        if when is None or when < since:
            continue
        if status == "skipped":
            r = _reason(p.get("reason"))
            out["skipped"][r] = out["skipped"].get(r, 0) + 1
            continue
        if status == "error":
            out["errors"] += 1
            continue
        if status not in ("open", "closed"):
            continue
        out["opened"] += 1
        opened_ms = when * 1000
        h = next((h for h in history if h.get("symbol") == p.get("symbol") and h.get("side") == p.get("side")
                  and h.get("opened_at") and abs(h["opened_at"] - opened_ms) <= MATCH_MS and h.get("market", "futures") != "spot"), None)
        pt = _paper_trade(paper, tid)
        if not h or not pt or not pt.get("entry") or not h.get("entry") or pt.get("open"):
            continue
        sign = 1 if p.get("side") == "long" else -1
        slip = (h["entry"] / pt["entry"] - 1) * 100 * sign          # positivo = ingresso peggiore della carta
        notional = (h.get("size") or 0) * h["entry"]
        real_pct = (h.get("net") or 0) / notional * 100 if notional else None
        paper_pct = pt.get("net")
        gap = paper_pct - real_pct if real_pct is not None and paper_pct is not None else None   # positivo = reale peggio
        out["matched"] += 1
        slips.append(slip)
        if gap is not None:
            gaps.append(gap)
        out["rows"].append({"id": tid, "symbol": p.get("symbol"), "side": p.get("side"), "entry_slip_pct": round(slip, 3),
                            "real_net_pct": None if real_pct is None else round(real_pct, 3),
                            "paper_net_pct": None if paper_pct is None else round(paper_pct, 3), "gap_pct": None if gap is None else round(gap, 3)})
    out["rows"] = out["rows"][-10:]
    out["avg_entry_slip_pct"] = round(sum(slips) / len(slips), 3) if slips else None
    out["avg_gap_pct"] = round(sum(gaps) / len(gaps), 3) if gaps else None
    out["alert"] = bool(gaps) and len(gaps) >= 3 and out["avg_gap_pct"] > GAP_ALERT_PCT
    return out


def _n(v, d=2, sign=True):
    s = f"{abs(v):.{d}f}".replace(".", ",")
    return (("+" if v > 0 else "-" if v < 0 else "") if sign else "") + s


def facts(r):
    """Frasi per il rapporto dell'agente (solo fatti)."""
    if not r:
        return []
    lines = []
    if r["skipped"]:
        parts = ", ".join(f"{why}: {n}" for why, n in sorted(r["skipped"].items(), key=lambda kv: -kv[1]))
        lines.append(f"Ingressi dell'esecutore saltati negli ultimi {r['window_days']} giorni: {sum(r['skipped'].values())} ({parts}).")
    if r["errors"]:
        lines.append(f"Aperture fallite su Bitget negli ultimi {r['window_days']} giorni: {r['errors']}.")
    if r["matched"]:
        txt = f"Esecuzione reale contro carta ({r['matched']} trade): ingresso {_n(r['avg_entry_slip_pct'], 3)}% in media"
        if r["avg_gap_pct"] is not None:
            txt += f", risultato netto {_n(-r['avg_gap_pct'])}% a trade rispetto alla carta"
        lines.append(txt + ".")
        if r["alert"]:
            lines.append(f"Attenzione: il reale rende in media {_n(r['avg_gap_pct'], 2, False)}% a trade meno della carta: "
                         "costi o slippage stanno mangiando il vantaggio.")
    return lines


def summary_text(r):
    """Riga breve per l'app."""
    if not r:
        return "in attesa del primo controllo"
    if r["matched"]:
        gap = r["avg_gap_pct"]
        return f"{r['matched']} trade reali · ingresso {_n(r['avg_entry_slip_pct'], 2)}%" + (f" · {_n(-gap)}% vs carta" if gap is not None else "")
    skipped = sum(r["skipped"].values())
    if skipped or r["errors"]:
        return f"nessun trade reale · {skipped} ingressi saltati" + (f" · {r['errors']} falliti" if r["errors"] else "")
    return "nessun trade reale da confrontare"
