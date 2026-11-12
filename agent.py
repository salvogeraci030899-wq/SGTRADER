"""Agente gestore: lavora per te sul tool, dal laboratorio alla carta al reale (workflow "Agente").

Ogni giorno decide, ogni domenica rilancia anche il laboratorio sui dati nuovi. Tre impostazioni, dall'app
(Segnali → Agente), salvate in automation.json → "agent":

- autonomia: "off" (solo rapporto, non tocca nulla), "paper" (sceglie e cambia le strategie su carta, propone
  il reale), "live" (porta da solo al reale le strategie che hanno superato tutto, e le riporta su carta se
  peggiorano). Il reale dell'agente parte solo se hai acceso anche l'interruttore degli ordini veri;
- profilo di rischio: prudente / bilanciato / aggressivo (automation.PROFILES: tutti i limiti dell'esecutore,
  compresi obiettivo e perdita massima del giorno);
- stile: swing (1d), giornaliero (4h e 1h), misto: i timeframe su cui sceglie.

Il percorso di ogni strategia, con regole fisse e misurabili:
1. CANDIDATA: il laboratorio la trova migliore del mercato dopo i costi e regge il controllo sulle prove
   multiple (FDR) → l'agente la mette su carta (max 6 accese, niente in emergenza);
2. SU CARTA: segue i segnali senza soldi. Se va peggio dello storico (verdetto "sotto" di paper.vs_backtest)
   o il laboratorio non la considera più candidata, la spegne (solo quelle messe da lui);
3. PROVA FINALE: con PROMO_MIN_TRADES trade su carta, netto medio positivo e in linea con lo storico, la
   domenica il laboratorio la prova sui mesi tenuti da parte (unseal_plan: una volta sola per strategia);
4. REALE: confermata dalla prova finale e buona su carta → proposta (autonomia "paper") o reale
   (autonomia "live"). Se poi su carta va peggio dello storico torna su carta da sola.

"Si addestra da solo" nel senso misurabile: ogni settimana rivaluta tutte le strategie sui dati nuovi,
promuove e retrocede. Non inventa strategie nuove e non cambia i parametri: ogni prova in più aumenta la
probabilità di trovare risultati buoni per caso.

Il modello AI (Groq, se c'è la chiave) scrive solo il rapporto in italiano a partire dai fatti: non decide.
Ogni cambio arriva subito su Telegram e resta nel registro di automation.json con "by": "agent";
stato, fatti e cronologia in agent_state.json (l'app li mostra).
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

import requests

import automation
import lab_strategies

STATE_PATH = "agent_state.json"
PAPER_PATH = "paper_trades.json"
PROMO_MIN_TRADES = 20          # trade chiusi su carta prima della prova finale e del reale
LOG_MAX = 60


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


def _good_on_paper(st):
    v = (st.get("vs_backtest") or {}).get("verdict")
    return (st.get("n") or 0) >= PROMO_MIN_TRADES and (st.get("avg_net_pct") or 0) > 0 and v in ("in_linea", "sopra")


def _usable(key):
    spec = lab_strategies.STRATEGIES.get(key.split(":", 1)[0]) or {}
    return spec.get("family") not in ("forza relativa", "funding")


def unseal_plan(cfg, summary, paper):
    """Strategie pronte per la prova finale: buone su carta, non ancora provate sui mesi tenuti da parte."""
    if automation.agent_config(cfg)["autonomy"] == "off":
        return []
    results = summary.get("results") or {}
    out = []
    for key, mode in sorted((cfg.get("strategies") or {}).items()):
        if mode == "paper" and key in results and not results[key].get("holdout") and _good_on_paper(_paper_stats(paper, key)):
            out.append(key)
    return out


def decide(cfg, summary, paper, added):
    """Solo regole, nessun effetto. Ritorna un dizionario di liste: off, on, promote, demote, proposals, notes."""
    ag = automation.agent_config(cfg)
    tfs = automation.STYLES[ag["style"]]
    results = summary.get("results") or {}
    confirmed = set(summary.get("confirmed") or [])
    candidates = [k for k in dict.fromkeys(sorted(confirmed) + list(summary.get("candidates") or [])) if k.split(":")[1] in tfs]
    active = {k: m for k, m in (cfg.get("strategies") or {}).items() if m != "off"}
    agent_live = automation.agent_live_keys(cfg)
    out = {"off": [], "on": [], "promote": [], "demote": [], "proposals": [], "notes": []}
    if ag["autonomy"] == "off":
        out["notes"].append("Autonomia spenta: l'agente osserva e fa rapporto, senza cambiare nulla.")
        return out

    # 1) chi peggiora: dal reale torna su carta, dalla carta si spegne (solo le sue; per le tue una nota)
    for key in sorted(active):
        st = _paper_stats(paper, key)
        verdict = (st.get("vs_backtest") or {}).get("verdict")
        if active[key] == "live" and verdict == "sotto":
            if key in agent_live or ag["autonomy"] == "live":
                out["demote"].append((key, f"su carta va peggio dello storico ({st.get('n')} trade, netto medio {st.get('avg_net_pct')}%)"))
            else:
                out["notes"].append(f"{_label(key)} è reale ma su carta va peggio dello storico: valuta di riportarla su carta.")
        elif active[key] == "paper" and verdict == "sotto":
            if key in added:
                out["off"].append((key, f"su carta va peggio dello storico ({st.get('n')} trade, netto medio {st.get('avg_net_pct')}%)"))
            else:
                out["notes"].append(f"{_label(key)}: su carta va peggio dello storico. L'hai accesa tu: decidi tu se spegnerla.")
        elif active[key] == "paper" and key in added and key not in candidates:
            out["off"].append((key, "non è più candidata (laboratorio aggiornato o stile cambiato)"))

    # 2) nuove candidate su carta, nei limiti
    leaving = {k for k, _ in out["off"]}
    free = automation.MAX_ACTIVE - (len(active) - len(leaving))
    if cfg.get("emergency"):
        free = 0
    for key in candidates:
        if key in active or key in leaving:
            continue
        if not _usable(key):
            out["notes"].append(f"{_label(key)} è candidata ma usa dati che la carta non riceve ancora: resta fuori.")
            continue
        if free <= 0:
            out["notes"].append(f"{_label(key)} è candidata, ma ci sono già {automation.MAX_ACTIVE} strategie accese.")
            continue
        r = results.get(key) or {}
        out["on"].append((key, f"candidata del laboratorio ({r.get('n')} trade, oltre il mercato {r.get('excess_avg_pct')}% a trade)"))
        free -= 1
    if not candidates:
        out["notes"].append(f"Nessuna strategia {('giornaliera' if ag['style'] == 'giornaliero' else ag['style'])} supera i controlli del laboratorio: l'agente non ne accende.")

    # 3) dalla carta al reale
    trading = bool((cfg.get("risk") or {}).get("trading_enabled"))
    for key in sorted(active):
        if active[key] != "paper" or key in leaving:
            continue
        st = _paper_stats(paper, key)
        if not _good_on_paper(st):
            continue
        if key not in confirmed:
            out["notes"].append(f"{_label(key)} va bene su carta ({st['n']} trade, netto medio {st['avg_net_pct']}%): domenica la prova finale.")
            continue
        info = {"key": key, "n": st["n"], "avg_net_pct": st["avg_net_pct"], "win_rate": st.get("win_rate"), "verdict": st["vs_backtest"]["verdict"]}
        if ag["autonomy"] == "live" and trading and not cfg.get("emergency"):
            out["promote"].append((key, f"confermata dalla prova finale e buona su carta ({st['n']} trade, netto medio {st['avg_net_pct']}%)"))
        else:
            out["proposals"].append(info)
            if ag["autonomy"] == "live" and not trading:
                out["notes"].append(f"{_label(key)} è pronta per il reale, ma l'interruttore degli ordini veri è spento (Account).")
    return out


def facts_text(cfg, paper, d, errors):
    lines = []
    for k, why in d["demote"]:
        lines.append(f"Tornata su carta dal reale {_label(k)}: {why}.")
    for k, why in d["off"]:
        lines.append(f"Spenta {_label(k)}: {why}.")
    for k, why in d["on"]:
        lines.append(f"Messa su carta {_label(k)}: {why}.")
    for k, why in d["promote"]:
        lines.append(f"PORTATA AL REALE {_label(k)}: {why}. Limiti del profilo attuale.")
    for e in errors:
        lines.append(f"Non applicato: {e}")
    for p in d["proposals"]:
        lines.append(f"PROPOSTA: {_label(p['key'])} al reale. Su carta {p['n']} trade, netto medio {p['avg_net_pct']}%, "
                     f"vincenti {p.get('win_rate')}%, in linea con lo storico. Parte solo se confermi nell'app.")
    lines += d["notes"]
    active = {k: m for k, m in (cfg.get("strategies") or {}).items() if m != "off"}
    for k in sorted(active):
        st = _paper_stats(paper, k)
        lines.append(f"Stato {_label(k)} ({'reale' if active[k] == 'live' else 'su carta'}): {st.get('n', 0)} trade chiusi, "
                     f"{st.get('open', 0)} aperti" + (f", netto medio {st['avg_net_pct']}%" if st.get("avg_net_pct") is not None else "") + ".")
    if not active:
        lines.append("Nessuna strategia accesa.")
    if cfg.get("emergency"):
        lines.insert(0, "Emergenza attiva: l'agente non accende nulla.")
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
        state_path=STATE_PATH, ai=ai_report, now=None, full_report=False):
    """full_report: rapporto completo su Telegram (domenica o avvio a mano); negli altri giorni il messaggio
    parte solo se l'agente ha cambiato qualcosa o ha una proposta nuova."""
    now = now or datetime.now(timezone.utc)
    cfg = automation.load(cfg_path)
    summary = _load(summary_path, {})
    paper = _load(paper_path, {})
    state = _load(state_path, {})
    added = set(state.get("added", []))
    ag = automation.agent_config(cfg)

    d = {"off": [], "on": [], "promote": [], "demote": [], "proposals": [], "notes": []}
    errors, changed = [], False
    if not summary.get("results"):
        d["notes"].append("Risultati del laboratorio non disponibili: nessuna modifica.")
    else:
        d = decide(cfg, summary, paper, added)
        confirmed = automation.confirmed(summary_path)

        def apply(items, mode):
            nonlocal changed
            done = []
            for key, why in items:
                try:
                    automation.set_mode(cfg, key, mode, confirmed)
                    cfg["history"][-1].update(by="agent", why=why)
                    changed = True
                    done.append((key, why))
                except automation.CommandError as e:
                    errors.append(f"{_label(key)}: {e}")
            return done

        d["demote"] = apply(d["demote"], "paper")
        d["off"] = apply(d["off"], "off")
        added -= {k for k, _ in d["off"]}
        d["on"] = apply(d["on"], "paper")
        added |= {k for k, _ in d["on"]}
        d["promote"] = apply(d["promote"], "live")

    facts = facts_text(cfg, paper, d, errors)
    acted = any(d[k] for k in ("off", "on", "promote", "demote")) or errors
    new_props = sorted(p["key"] for p in d["proposals"]) != sorted(p["key"] for p in state.get("proposals", []))
    text, model = ai(facts) if (full_report or acted) else (None, None)
    if changed:
        automation.save(cfg, cfg_path)

    at = now.isoformat(timespec="seconds")
    events = [{"at": at, "kind": kind, "key": k, "why": why} for kind in ("demote", "off", "on", "promote") for k, why in d[kind]]
    events += [{"at": at, "kind": "proposal", "key": p["key"], "why": f"{p['n']} trade su carta, netto medio {p['avg_net_pct']}%"} for p in d["proposals"]] if new_props else []
    state.update(last_run=at, settings=ag, added=sorted(added), proposals=d["proposals"], facts=facts,
                 log=(state.get("log", []) + events)[-LOG_MAX:])
    if text or full_report:
        state.update(report=text, report_model=model, report_at=at)
    with open(state_path, "w") as f:
        json.dump(state, f, indent=1, ensure_ascii=False)

    if full_report or acted or (new_props and d["proposals"]):
        head = "🤖 AGENTE" + (" · rapporto" if full_report else "") + f" ({ag['autonomy']}, {ag['profile']}, {ag['style']})"
        msg = head + "\n\n" + (text or "\n".join(f"• {x}" for x in facts))
        if d["proposals"]:
            msg += "\n\n👉 " + "; ".join(f"{_label(p['key'])}: proposta per il reale" for p in d["proposals"]) + ". Conferma in app: Segnali → Agente."
        if d["promote"]:
            msg += "\n\n⚠️ Ordini veri da ora per: " + ", ".join(_label(k) for k, _ in d["promote"]) + ". Per fermare: Segnali → Agente → autonomia Simulato, oppure Emergenza."
        notify(msg)
        print(msg)
    else:
        print("Nessun cambiamento: niente messaggio.")
    return state


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--unseal-plan", action="store_true", help="stampa le strategie pronte per la prova finale e basta")
    ap.add_argument("--full-report", action="store_true")
    args = ap.parse_args()
    if args.unseal_plan:
        cfg = automation.load()
        print(" ".join(unseal_plan(cfg, _load(automation.SUMMARY_PATH, {}), _load(PAPER_PATH, {}))))
        sys.exit(0)
    import watchdog
    run(watchdog.send, full_report=args.full_report)
    sys.exit(0)
