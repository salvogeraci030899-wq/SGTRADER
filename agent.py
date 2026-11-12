"""Agente selezionatore: ogni settimana (workflow "Agente"), dopo il laboratorio aggiornato.

Cosa fa da solo, senza soldi:
1. spegne le strategie che ha messo su carta quando la carta va peggio dello storico (verdetto "sotto"
   di paper.vs_backtest, almeno 10 trade) o quando il laboratorio non le considera più candidate;
2. mette su carta le candidate del laboratorio (quelle che reggono il controllo sulle prove multiple, FDR)
   e quelle confermate dalla prova finale, nei limiti di automation.py (massimo 6 accese, niente durante
   l'emergenza, niente strategie che usano dati non disponibili su carta).

Cosa NON fa: non passa mai una strategia al reale. Quando una strategia confermata va bene anche su carta
(PROMO_MIN_TRADES trade chiusi, netto medio positivo, in linea o sopra lo storico) scrive una PROPOSTA:
la vedi nell'app (Segnali → Auto) e su Telegram, e il passaggio al reale parte solo dal tuo tocco.

Le scelte seguono regole fisse e misurabili. Il modello AI (Groq, se c'è la chiave) scrive solo il rapporto
in italiano a partire dai fatti: non decide niente. Senza chiave il rapporto è il solo elenco dei fatti.
Stato e rapporto in agent_state.json; ogni modifica resta nel registro di automation.json con "by": "agent".
"""
import json
import os
import sys
from datetime import datetime, timezone

import requests

import automation
import lab_strategies

STATE_PATH = "agent_state.json"
PAPER_PATH = "paper_trades.json"
PROMO_MIN_TRADES = 20          # trade chiusi su carta prima di proporre il reale
LOG_MAX = 30


def _load(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def _label(key):
    name, tf = key.split(":", 1)
    return f"{name.replace('_', ' ')} {tf}"


def _paper_stats(paper, key):
    return ((paper.get("strategies") or {}).get(key) or {}).get("stats") or {}


def decide(cfg, summary, paper, added):
    """Solo regole, nessun effetto: ritorna (spegnere, accendere, proposte, note). Ordinato e ripetibile."""
    results = summary.get("results") or {}
    candidates = list(summary.get("candidates") or [])
    confirmed = set(summary.get("confirmed") or [])
    wanted = [k for k in dict.fromkeys(sorted(confirmed) + candidates)]
    active = {k: m for k, m in cfg.get("strategies", {}).items() if m != "off"}
    off, on, proposals, notes = [], [], [], []

    for key in sorted(active):
        if active[key] != "paper":
            continue
        st = _paper_stats(paper, key)
        verdict = (st.get("vs_backtest") or {}).get("verdict")
        if verdict == "sotto":
            if key in added:
                off.append((key, f"su carta va peggio dello storico ({st.get('n')} trade, netto medio {st.get('avg_net_pct')}%)"))
            else:
                notes.append(f"{_label(key)}: su carta va peggio dello storico. L'hai accesa tu: decidi tu se spegnerla.")
        elif key in added and key not in wanted:
            off.append((key, "il laboratorio aggiornato non la considera più candidata"))

    turning_off = {k for k, _ in off}
    free = automation.MAX_ACTIVE - (len(active) - len(turning_off))
    for key in wanted:
        if key in active and key not in turning_off:
            continue
        if key in turning_off:
            continue
        name = key.split(":", 1)[0]
        spec = lab_strategies.STRATEGIES.get(name) or {}
        if spec.get("family") in ("forza relativa", "funding"):
            notes.append(f"{_label(key)} è candidata ma usa dati che la carta non riceve ancora: resta fuori.")
            continue
        if free <= 0:
            notes.append(f"{_label(key)} è candidata, ma ci sono già {automation.MAX_ACTIVE} strategie accese.")
            continue
        r = results.get(key) or {}
        on.append((key, f"candidata del laboratorio ({r.get('n')} trade, oltre il mercato {r.get('excess_avg_pct')}% a trade)"))
        free -= 1

    for key in sorted(active):
        if active[key] != "paper" or key in turning_off:
            continue
        st = _paper_stats(paper, key)
        verdict = (st.get("vs_backtest") or {}).get("verdict")
        n, avg = st.get("n") or 0, st.get("avg_net_pct")
        good = n >= PROMO_MIN_TRADES and avg is not None and avg > 0 and verdict in ("in_linea", "sopra")
        if good and key in confirmed:
            proposals.append({"key": key, "n": n, "avg_net_pct": avg, "win_rate": st.get("win_rate"), "verdict": verdict})
        elif good:
            notes.append(f"{_label(key)} va bene su carta ({n} trade, netto medio {avg}%) ma non ha la prova finale: senza, il reale non è consentito.")
    return off, on, proposals, notes


def facts_text(cfg, paper, off, on, proposals, notes, applied_errors):
    lines = []
    for k, why in off:
        lines.append(f"Spenta {_label(k)}: {why}.")
    for k, why in on:
        lines.append(f"Messa su carta {_label(k)}: {why}.")
    for e in applied_errors:
        lines.append(f"Non applicato: {e}")
    for p in proposals:
        lines.append(f"PROPOSTA: {_label(p['key'])} al reale. Su carta {p['n']} trade, netto medio {p['avg_net_pct']}%, "
                     f"vincenti {p.get('win_rate')}%, in linea con lo storico. Parte solo se confermi nell'app.")
    lines += notes
    active = {k: m for k, m in cfg.get("strategies", {}).items() if m != "off"}
    for k in sorted(active):
        st = _paper_stats(paper, k)
        lines.append(f"Stato {_label(k)} ({'reale' if active[k] == 'live' else 'su carta'}): {st.get('n', 0)} trade chiusi, "
                     f"{st.get('open', 0)} aperti" + (f", netto medio {st['avg_net_pct']}%" if st.get("avg_net_pct") is not None else "") + ".")
    if not active:
        lines.append("Nessuna strategia accesa.")
    if cfg.get("emergency"):
        lines.insert(0, "Emergenza attiva: l'agente non ha cambiato nulla.")
    return lines


# ---------- Rapporto AI (facoltativo) ----------
MODEL_PREFERENCE = ["openai/gpt-oss-120b", "moonshotai/kimi-k2", "meta-llama/llama-4-maverick", "qwen/qwen3-32b",
                    "llama-3.3-70b", "meta-llama/llama-4-scout", "openai/gpt-oss-20b", "llama-3.1-8b"]
NOT_CHAT = ("whisper", "tts", "guard", "playai", "orpheus", "compound", "distil", "allam", "safeguard")


def _pick_model(ids):
    chat = [i for i in ids if isinstance(i, str) and not any(x in i.lower() for x in NOT_CHAT)]
    for pref in MODEL_PREFERENCE:
        for i in chat:
            if i == pref or i.startswith(pref):
                return i
    return chat[0] if chat else None


def ai_report(facts, key=None, post=requests.post, get=requests.get):
    """Riassunto in italiano dei fatti. Ritorna (testo, modello) o (None, None): mai decisioni."""
    key = key if key is not None else os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return None, None
    h = {"Authorization": f"Bearer {key}"}
    try:
        r = get("https://api.groq.com/openai/v1/models", headers=h, timeout=20)
        model = os.environ.get("GROQ_MODEL") or _pick_model([m.get("id") for m in (r.json().get("data") or []) if m.get("active") is not False])
        if not model:
            return None, None
        prompt = ("Fatti della settimana dell'agente di trading (non aggiungerne altri):\n- " + "\n- ".join(facts) +
                  "\n\nScrivi in italiano un rapporto di massimo 120 parole per il proprietario: cosa è cambiato, come vanno le "
                  "strategie, se c'è qualcosa da decidere. Tono sobrio. Niente promesse di guadagno, niente consigli finanziari, "
                  "niente numeri che non siano nei fatti, niente piani, intenzioni o previsioni: solo ciò che è scritto nei fatti. "
                  "Se non è cambiato niente, dillo in una o due frasi.")
        body = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2,
                "max_tokens": 1500 if any(x in model for x in ("gpt-oss", "qwen3")) else 500}
        if "gpt-oss" in model:
            body["reasoning_effort"] = "low"
        r = post("https://api.groq.com/openai/v1/chat/completions", headers=h, json=body, timeout=60)
        text = ((r.json().get("choices") or [{}])[0].get("message") or {}).get("content")
        return (text.strip(), model) if text else (None, None)
    except Exception as e:
        print(f"Rapporto AI non scritto: {e}")
        return None, None


def run(notify, cfg_path=automation.CONFIG_PATH, summary_path=automation.SUMMARY_PATH, paper_path=PAPER_PATH,
        state_path=STATE_PATH, ai=ai_report, now=None):
    now = now or datetime.now(timezone.utc)
    cfg = automation.load(cfg_path)
    summary = _load(summary_path, {})
    paper = _load(paper_path, {})
    state = _load(state_path, {})
    added = set(state.get("added", []))

    off, on, proposals, notes, errors, changed = [], [], [], [], [], False
    if not summary.get("results"):
        notes.append("Risultati del laboratorio non disponibili: nessuna modifica.")
    elif not cfg.get("emergency"):
        off, on, proposals, notes = decide(cfg, summary, paper, added)
        confirmed = automation.confirmed(summary_path)
        for key, why in off:
            try:
                automation.set_mode(cfg, key, "off", confirmed)
                cfg["history"][-1].update(by="agent", why=why)
                added.discard(key)
                changed = True
            except automation.CommandError as e:
                errors.append(f"{_label(key)}: {e}")
        for key, why in list(on):
            try:
                automation.set_mode(cfg, key, "paper", confirmed)
                cfg["history"][-1].update(by="agent", why=why)
                added.add(key)
                changed = True
            except automation.CommandError as e:
                errors.append(f"{_label(key)}: {e}")
                on.remove((key, why))

    facts = facts_text(cfg, paper, off, on, proposals, notes, errors)
    text, model = ai(facts)
    if changed:
        automation.save(cfg, cfg_path)

    run_log = {"at": now.isoformat(timespec="seconds"), "off": [k for k, _ in off], "on": [k for k, _ in on],
               "proposals": [p["key"] for p in proposals]}
    state.update(last_run=run_log["at"], added=sorted(added), proposals=proposals, facts=facts,
                 report=text, report_model=model, log=(state.get("log", []) + [run_log])[-LOG_MAX:])
    with open(state_path, "w") as f:
        json.dump(state, f, indent=1, ensure_ascii=False)

    msg = "🤖 Agente settimanale\n\n" + (text or "\n".join(f"• {x}" for x in facts))
    if proposals:
        msg += "\n\n👉 " + "; ".join(f"{_label(p['key'])}: proposta per il reale" for p in proposals) + ". Conferma in app: Segnali → Auto."
    msg += "\n\nNessun ordine vero è partito dall'agente."
    notify(msg)
    print(msg)
    return state


if __name__ == "__main__":
    import watchdog
    run(watchdog.send)
    sys.exit(0)
