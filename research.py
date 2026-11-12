"""Agente ricercatore: propone ogni settimana al massimo 2 varianti nuove da provare nel laboratorio.

Le varianti escono da una grammatica CHIUSA (modelli e valori ammessi elencati qui sotto): l'IA sceglie quali provare
e spiega perché, ma non scrive codice e non inventa regole. Ogni proposta:
- viene dichiarata (research.json, con data e motivo) PRIMA che il laboratorio la provi, e non si ritocca più;
- entra nel registro delle prove del laboratorio, quindi alza l'asticella per tutte le strategie (prove multiple):
  per questo sono poche (2 a settimana, 20 in tutto) e solo su candele da 1 giorno;
- segue lo stesso percorso di tutte le altre: candidata, carta, prova finale, reale.
Senza IA non propone nulla (nessuna scelta a caso). Lo lancia l'agente la domenica, prima del laboratorio.
"""
import json
import os
from datetime import datetime, timezone

import requests

PATH = "research.json"
PER_WEEK = 2
MAX_TOTAL = 20

# Modelli ammessi e valori per parametro. Nome della variante: r_<modello>_<valori> (deterministico).
TEMPLATES = {
    "breakout": {"desc": "rottura del massimo/minimo delle N candele precedenti, stop 2 ATR, stop che segue a T ATR",
                 "params": {"n": [10, 15, 30, 40, 80, 100], "trail": [2, 3, 4]}},
    "momentum": {"desc": "direzione del rendimento delle ultime P candele, tenuta H candele, stop 3 ATR",
                 "params": {"p": [10, 20, 45, 60, 90, 120], "hold": [3, 5, 10, 14]}},
    "ema_cross": {"desc": "media veloce F sopra/sotto la lenta S (long/short), stop 2 ATR, stop che segue a 3 ATR",
                  "params": {"f": [10, 20, 30], "s": [50, 100, 150, 200]}},
    "rsi_pullback": {"desc": "sopra la media a 200 long se RSI(R) < L, sotto short se RSI(R) > 100-L, tenuta 5 candele, stop 3 ATR",
                     "params": {"r": [2, 3, 4], "lv": [5, 10, 15, 20]}},
}


def name_of(template, params):
    t = TEMPLATES[template]["params"]
    return "r_" + template + "_" + "_".join(str(params[k]) for k in t)


def valid(template, params):
    t = TEMPLATES.get(template)
    if not t or not isinstance(params, dict) or set(params) != set(t["params"]):
        return False
    if any(params[k] not in t["params"][k] for k in t["params"]):
        return False
    return not (template == "ema_cross" and params["f"] >= params["s"])


def load(path=PATH):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"note": "Varianti proposte dall'agente ricercatore (research.py). Ognuna è una prova del laboratorio.", "proposals": []}


def lab_overview(summary, top=12):
    """I risultati del laboratorio che l'IA vede: le migliori e le peggiori per famiglia, solo numeri già pubblici."""
    rows = []
    for key, r in (summary.get("results") or {}).items():
        if r.get("n"):
            rows.append(f"{key} ({r.get('family')}): {r['n']} trade, oltre il mercato {r.get('excess_avg_pct')}% a trade, stabile: {r.get('stable')}")
    rows.sort(key=lambda s: -float(s.split("oltre il mercato ")[1].split("%")[0] or 0))
    return rows[:top] + rows[-4:]


PROMPT = """Sei il ricercatore di un laboratorio di strategie di trading su crypto (candele da 1 giorno, 8 coin).
Proponi al massimo {k} varianti nuove da provare, scegliendo SOLO tra questi modelli e valori ammessi:
{grammar}
Già provate o proposte (non ripeterle): {done}
Risultati attuali del laboratorio (rendimento oltre il mercato a trade, dopo i costi):
{overview}
Regole: ogni prova in più alza l'asticella per tutte (prove multiple), quindi proponi solo idee con una ragione economica
chiara (per esempio esplorare un orizzonte diverso di una famiglia che va bene), non varianti a caso. Puoi proporne zero.
Rispondi SOLO con JSON: {{"proposals": [{{"template": "...", "params": {{...}}, "why": "motivo in italiano, massimo 25 parole"}}]}}"""


def ask_ai(summary, done, key, post=requests.post, get=requests.get, k=PER_WEEK):
    from agent import _pick_model
    h = {"Authorization": f"Bearer {key}"}
    r = get("https://api.groq.com/openai/v1/models", headers=h, timeout=20)
    model = os.environ.get("GROQ_MODEL") or _pick_model([m.get("id") for m in (r.json().get("data") or []) if m.get("active") is not False])
    if not model:
        return []
    grammar = "\n".join(f"- {t}: {v['desc']}; valori {json.dumps(v['params'])}" for t, v in TEMPLATES.items())
    prompt = PROMPT.format(k=k, grammar=grammar, done=", ".join(sorted(done)) or "nessuna", overview="\n".join(lab_overview(summary)))
    body = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.3,
            "response_format": {"type": "json_object"}, "max_tokens": 1500 if any(x in model for x in ("gpt-oss", "qwen3")) else 500}
    if "gpt-oss" in model:
        body["reasoning_effort"] = "low"
    r = post("https://api.groq.com/openai/v1/chat/completions", headers=h, json=body, timeout=60)
    content = ((r.json().get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    try:
        return (json.loads(content) or {}).get("proposals") or []
    except ValueError:
        return []


def run(summary_path="lab_summary.json", path=PATH, key=None, now=None, notify=None, post=requests.post, get=requests.get):
    """Aggiunge le proposte valide di questa settimana. Ritorna l'elenco dei nomi aggiunti."""
    now = now or datetime.now(timezone.utc)
    key = key if key is not None else os.environ.get("GROQ_API_KEY", "").strip()
    data = load(path)
    props = data.setdefault("proposals", [])
    week = now.strftime("%G-W%V")
    room = min(PER_WEEK - sum(1 for p in props if p.get("week") == week), MAX_TOTAL - len(props))
    if room <= 0 or not key:
        return []
    try:
        with open(summary_path) as f:
            summary = json.load(f)
    except (OSError, ValueError):
        summary = {}
    import lab_strategies
    done = set(lab_strategies.STRATEGIES) | {p["name"] for p in props}
    added = []
    try:
        answer = ask_ai(summary, done, key, post, get, room)
    except Exception as e:      # noqa: BLE001 — IA non raggiungibile: nessuna proposta
        print(f"Ricercatore: IA non disponibile ({type(e).__name__})")
        answer = []
    for a in answer if isinstance(answer, list) else []:
        if len(added) >= room or not isinstance(a, dict):
            break
        template, params = a.get("template"), a.get("params")
        if not valid(template, params):
            print(f"Ricercatore: proposta scartata (fuori dalla grammatica): {a}")
            continue
        params = {k: params[k] for k in TEMPLATES[template]["params"]}
        name = name_of(template, params)
        if name in done:
            continue
        props.append({"name": name, "template": template, "params": params, "why": str(a.get("why") or "")[:200],
                      "declared_at": now.isoformat(timespec="seconds"), "week": week})
        done.add(name)
        added.append(name)
    if added:
        with open(path, "w") as f:
            json.dump(data, f, indent=1, ensure_ascii=False)
        import events
        for p in props[-len(added):]:
            events.record("strategie", "ricerca", f"Ricercatore: nuova variante da provare, {p['name']} ({p['why']}).", at=now, key=p["name"])
        if notify:
            notify("🔬 RICERCATORE\nVarianti nuove da provare nel laboratorio (contano come prove in più):\n"
                   + "\n".join(f"• {p['name']}: {p['why']}" for p in props[-len(added):]))
    return added


if __name__ == "__main__":
    import watchdog
    print("Proposte:", run(notify=watchdog.send) or "nessuna")
