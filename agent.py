"""Agente gestore: lavora per te sul tool, dal laboratorio alla carta al reale (workflow "Agente").

Ogni giorno decide, ogni domenica rilancia anche il laboratorio sui dati nuovi. Tre impostazioni, dall'app
(Agente → Panoramica, Strategie e Rischio), salvate in automation.json → "agent":

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
OBSERVE_UP_TO = 4              # strategie accese in tutto, oltre le quali non se ne aggiungono in osservazione
OBSERVE_MIN_TRADES = 50        # storico minimo per l'osservazione


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
        # solo le candidate: quelle in osservazione non fanno la prova finale (ogni prova in più indebolisce le altre)
        if (mode == "paper" and key in results and key in (summary.get("candidates") or []) and not results[key].get("holdout")
                and _good_on_paper(_paper_stats(paper, key))):
            out.append(key)
    return out


def _went_live_at(cfg, key):
    """Momento (timestamp) dell'ultimo passaggio al reale della strategia, dal registro."""
    t = None
    for h in cfg.get("history", []):
        if h.get("cmd") == "set" and h.get("key") == key and h.get("to") == "live" and h.get("at"):
            try:
                t = datetime.fromisoformat(h["at"]).timestamp()
            except ValueError:
                pass
    return t


def strategy_drawdown(cfg, paper, key):
    """Perdita della strategia dal suo massimo da quando è reale, in % del patrimonio.
    La carta segue gli stessi segnali del reale: ogni trade chiuso vale R = netto / distanza dello stop,
    cioè quante volte il rischio per trade; in patrimonio R x rischio per trade (%). Ritorna (drawdown, trade)."""
    since = _went_live_at(cfg, key)
    risk = float((cfg.get("risk") or {}).get("risk_per_trade_pct") or automation.executor.DEFAULT_RISK["risk_per_trade_pct"])
    trades = ((paper.get("strategies") or {}).get(key) or {}).get("trades") or []
    closed = sorted((t for t in trades if not t.get("open") and t.get("net") is not None and t.get("entry") and t.get("stop")
                     and (since is None or (t.get("t_exit") or 0) >= since)), key=lambda t: t.get("t_exit") or 0)
    eq = peak = dd = 0.0
    for t in closed:
        stop_pct = abs(t["entry"] - t["stop"]) / t["entry"] * 100
        if stop_pct <= 0:
            continue
        eq += t["net"] / stop_pct * risk
        peak = max(peak, eq)
        dd = max(dd, peak - eq)
    return round(dd, 2), len(closed)


def paper_performance(cfg, paper):
    """Tutte le strategie su carta, in % del patrimonio con il rischio per trade attuale (come l'app):
    ritorna (rendimento, trade, calo massimo)."""
    risk = float(automation.executor.risk_config(cfg)["risk_per_trade_pct"])
    rs = []
    for e in (paper.get("strategies") or {}).values():
        for t in e.get("trades") or []:
            if not t.get("open") and t.get("net") is not None and t.get("entry") and t.get("stop"):
                stop_pct = abs(t["entry"] - t["stop"]) / t["entry"] * 100
                if stop_pct > 0:
                    rs.append((t.get("t_exit") or t.get("t") or 0, t["net"] / stop_pct))
    eq = peak = dd = 0.0
    for _, r in sorted(rs):
        eq += r * risk
        peak = max(peak, eq)
        dd = max(dd, peak - eq)
    return round(eq, 2), len(rs), round(dd, 2)


def capital_check(cfg, live, paper, price_fn=None, specs_fn=None):
    """Il capitale basta per i minimi di Bitget con il profilo attuale? Per ogni coin: capitale minimo perché
    la posizione calcolata dal rischio (rischio / distanza dello stop, entro la leva) superi la quantità minima.
    Distanza dello stop: mediana degli ultimi trade su carta (altrimenti 5%). Ritorna None se il conto non è letto."""
    acc = (live or {}).get("account") or {}
    equity = acc.get("equity")
    if not acc.get("connected") or not equity:
        return None
    price_fn = price_fn or _price
    specs_fn = specs_fn or automation.executor.contract_specs
    risk = automation.executor.risk_config(cfg)
    stops = sorted(abs(t["entry"] - t["stop"]) / t["entry"] * 100 for e in (paper.get("strategies") or {}).values()
                   for t in (e.get("trades") or [])[-30:] if t.get("entry") and t.get("stop"))
    stop_pct = stops[len(stops) // 2] if stops else 5.0
    out = {"equity": round(float(equity), 2), "stop_pct": round(stop_pct, 2), "risk_pct": risk["risk_per_trade_pct"], "symbols": {}}
    for sym in ("BTCUSDT", "ETHUSDT", "SOLUSDT"):
        specs, px = specs_fn(sym), price_fn(sym)
        if not specs or not px:
            continue
        min_usdt = specs["min_size"] * px
        need = max(min_usdt * stop_pct / risk["risk_per_trade_pct"], min_usdt / risk["max_leverage"])
        out["symbols"][sym] = {"min_usdt": round(min_usdt, 2), "needed": round(need, 2), "ok": equity >= need, "min_size": specs["min_size"]}
    # Realismo: degli ultimi trade su carta, quanti il conto vero avrebbe potuto aprire con capitale e profilo di
    # oggi (stessa regola di size_position dell'esecutore: rischio / distanza dello stop, entro la leva)
    recent = sorted((t for e in (paper.get("strategies") or {}).values() for t in (e.get("trades") or [])
                     if t.get("entry") and t.get("stop") and t.get("symbol") in out["symbols"]), key=lambda t: t.get("t") or 0)[-50:]
    ok = 0
    for t in recent:
        dist = abs(t["entry"] - t["stop"]) / t["entry"]
        if dist <= 0:
            continue
        notional = min(equity * risk["risk_per_trade_pct"] / 100 / dist, equity * risk["max_leverage"])
        ok += notional / t["entry"] >= out["symbols"][t["symbol"]]["min_size"]
    out["paper_feasible"] = [ok, len(recent)]
    return out


def _price(symbol):
    try:
        r = requests.get("https://api.bitget.com/api/v2/mix/market/ticker", params={"symbol": symbol, "productType": "USDT-FUTURES"}, timeout=10)
        return float(r.json()["data"][0]["lastPr"])
    except Exception:
        return None


def capital_facts(cap):
    if not cap or not cap["symbols"]:
        return []
    feas = cap.get("paper_feasible") or [0, 0]
    extra = (f" Degli ultimi {feas[1]} trade su carta, il conto vero ne avrebbe aperti {feas[0]}." if feas[1] else "")
    ok = [s.replace("USDT", "") for s, v in cap["symbols"].items() if v["ok"]]
    least = min(cap["symbols"].items(), key=lambda kv: kv[1]["needed"])
    head = f"Capitale {cap['equity']} USDT, rischio {cap['risk_pct']}% a trade, stop tipico {cap['stop_pct']}%"
    if not ok:
        return [f"{head}: troppo poco per i minimi di Bitget, ogni trade reale verrebbe saltato. "
                f"Servono almeno ~{least[1]['needed']:.0f} USDT ({least[0].replace('USDT', '')}), oppure un profilo con più rischio." + extra]
    if len(ok) < len(cap["symbols"]):
        return [f"{head}: si può operare solo su {', '.join(ok)}; le altre coin sono sotto i minimi di Bitget." + extra]
    return [f"Capitale sufficiente per tutte le coin.{extra}"] if feas[1] and feas[0] < feas[1] else []


def observable(key, r, tfs):
    """In osservazione: non candidata ma promettente sullo storico (abbastanza trade, sopra il mercato, stabile
    nelle due metà del periodo). Solo carta, per raccogliere dati dal vivo: niente prova finale né reale."""
    return (key.split(":")[1] in tfs and _usable(key) and (r.get("n") or 0) >= OBSERVE_MIN_TRADES
            and (r.get("excess_avg_pct") or 0) > 0 and bool(r.get("stable")) and not r.get("candidate"))


def decide(cfg, summary, paper, added, observing=frozenset()):
    """Solo regole, nessun effetto. Ritorna un dizionario di liste: off, on, promote, demote, proposals, notes."""
    ag = automation.agent_config(cfg)
    tfs = automation.STYLES[ag["style"]]
    results = summary.get("results") or {}
    confirmed = set(summary.get("confirmed") or [])
    candidates = [k for k in dict.fromkeys(sorted(confirmed) + list(summary.get("candidates") or [])) if k.split(":")[1] in tfs]
    active = {k: m for k, m in (cfg.get("strategies") or {}).items() if m != "off"}
    agent_live = automation.agent_live_keys(cfg)
    out = {"off": [], "on": [], "observe": [], "promote": [], "demote": [], "proposals": [], "notes": []}
    limit = float(automation.executor.risk_config(cfg)["max_strategy_dd_pct"])
    for key in sorted(k for k, m in active.items() if m == "live"):
        dd, n = strategy_drawdown(cfg, paper, key)
        if dd >= limit:
            out["demote"].append((key, f"perdita dal massimo {dd}% del patrimonio da quando è reale ({n} trade), oltre il limite di {limit:g}%"))
    if ag["autonomy"] == "off":
        out["notes"].append("Autonomia spenta: l'agente osserva e fa rapporto, senza cambiare nulla.")
        return out

    # 1) chi peggiora: dal reale torna su carta, dalla carta si spegne (solo le sue; per le tue una nota)
    limited = {k for k, _ in out["demote"]}
    for key in sorted(active):
        st = _paper_stats(paper, key)
        verdict = (st.get("vs_backtest") or {}).get("verdict")
        if key in limited:
            continue
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
        elif active[key] == "paper" and key in observing and key not in candidates:
            if not observable(key, results.get(key) or {}, tfs):
                out["off"].append((key, "non è più promettente sullo storico (osservazione finita)"))
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

    # 2b) posti liberi: le più promettenti non candidate, in osservazione su carta (più dati dal vivo, prima)
    room = min(free, OBSERVE_UP_TO - (len(active) - len(leaving) + len(out["on"])))
    pool = sorted(((k, r) for k, r in results.items() if k not in active and observable(k, r, tfs)),
                  key=lambda kv: (kv[1].get("excess_p") if kv[1].get("excess_p") is not None else 1, -(kv[1].get("excess_avg_pct") or 0)))
    for key, r in pool[:max(0, room)]:
        out["observe"].append((key, f"in osservazione: non candidata ma promettente sullo storico ({r.get('n')} trade, oltre il mercato {r.get('excess_avg_pct')}% a trade). Solo carta, non andrà al reale"))

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
    for k, why in d.get("observe", []):
        lines.append(f"Messa su carta {_label(k)} {why}.")
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
    ret, n, dd = paper_performance(cfg, paper)
    if n:
        lines.append(f"Su carta in totale: {ret:+.2f}% del patrimonio in {n} trade (calo massimo {dd:.2f}%), con il rischio per trade attuale.")
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
        state_path=STATE_PATH, ai=ai_report, now=None, full_report=False, live_path="live_trades.json", capital=capital_check):
    """full_report: rapporto completo su Telegram (domenica o avvio a mano); negli altri giorni il messaggio
    parte solo se l'agente ha cambiato qualcosa o ha una proposta nuova."""
    now = now or datetime.now(timezone.utc)
    cfg = automation.load(cfg_path)
    summary = _load(summary_path, {})
    paper = _load(paper_path, {})
    state = _load(state_path, {})
    added = set(state.get("added", []))
    observing = set(state.get("observing", []))
    ag = automation.agent_config(cfg)

    d = {"off": [], "on": [], "observe": [], "promote": [], "demote": [], "proposals": [], "notes": []}
    errors, changed = [], False
    if not summary.get("results"):
        d["notes"].append("Risultati del laboratorio non disponibili: nessuna modifica.")
    else:
        d = decide(cfg, summary, paper, added, observing)
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
        # spenta o diventata candidata: non più in osservazione
        observing -= {k for k, _ in d["off"]} | {k for k, _ in d["on"]} | set(summary.get("candidates") or [])
        d["observe"] = apply(d["observe"], "paper")
        added |= {k for k, _ in d["observe"]}
        observing |= {k for k, _ in d["observe"]}
        d["promote"] = apply(d["promote"], "live")

    cap = None
    try:
        cap = capital(cfg, _load(live_path, {}), paper)
    except Exception as e:
        print(f"Controllo del capitale non riuscito: {e}")
    facts = facts_text(cfg, paper, d, errors) + capital_facts(cap)
    acted = any(d[k] for k in ("off", "on", "observe", "promote", "demote")) or errors
    new_props = sorted(p["key"] for p in d["proposals"]) != sorted(p["key"] for p in state.get("proposals", []))
    cap_warn = bool(capital_facts(cap))
    if cap_warn and not state.get("capital_warned"):
        acted = True                    # la prima volta l'avviso parte subito, poi solo nel rapporto della domenica
    text, model = ai(facts) if (full_report or acted) else (None, None)
    if changed:
        automation.save(cfg, cfg_path)

    at = now.isoformat(timespec="seconds")
    events = [{"at": at, "kind": kind, "key": k, "why": why} for kind in ("demote", "off", "on", "observe", "promote") for k, why in d[kind]]
    import events as event_log
    WHAT = {"demote": "tornata su carta dal reale", "off": "spenta", "on": "messa su carta", "observe": "in osservazione su carta",
            "promote": "PORTATA AL REALE", "proposal": "proposta per il reale"}
    events += [{"at": at, "kind": "proposal", "key": p["key"], "why": f"{p['n']} trade su carta, netto medio {p['avg_net_pct']}%"} for p in d["proposals"]] if new_props else []
    for e in events:
        event_log.record("agente", e["kind"], f"Agente: {_label(e['key'])} {WHAT.get(e['kind'], e['kind'])} ({e['why']}).", at=at, key=e["key"])
    state.update(last_run=at, settings=ag, added=sorted(added), observing=sorted(observing & added), proposals=d["proposals"], facts=facts, capital=cap, capital_warned=cap_warn,
                 log=(state.get("log", []) + events)[-LOG_MAX:])
    if text or full_report:
        state.update(report=text, report_model=model, report_at=at)
    with open(state_path, "w") as f:
        json.dump(state, f, indent=1, ensure_ascii=False)

    if full_report or acted or (new_props and d["proposals"]):
        head = "🤖 AGENTE" + (" · rapporto" if full_report else "") + f" ({ag['autonomy']}, {ag['profile']}, {ag['style']})"
        msg = head + "\n\n" + (text or "\n".join(f"• {x}" for x in facts))
        if d["proposals"]:
            msg += "\n\n👉 " + "; ".join(f"{_label(p['key'])}: proposta per il reale" for p in d["proposals"]) + ". Conferma in app: Agente → Panoramica."
        if d["promote"]:
            msg += "\n\n⚠️ Ordini veri da ora per: " + ", ".join(_label(k) for k, _ in d["promote"]) + ". Per fermare: Agente → Panoramica → autonomia Simulato, oppure Emergenza."
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
