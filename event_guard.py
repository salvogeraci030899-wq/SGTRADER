"""Agente eventi: guardia DIFENSIVA sulle notizie crypto. Può solo mettere in pausa i nuovi ingressi reali.

Ogni ora (dal giro del bot) legge i titoli recenti di alcune fonti pubbliche (RSS) e chiede all'IA (Groq) se c'è
un evento in corso che rende rischioso aprire posizioni NUOVE: attacco o blocco di un exchange, coin sospesa o
in delisting, crollo improvviso di tutto il mercato, guasto di una blockchain, decisione di un governo che vieta.

Regole fisse, qualunque cosa risponda l'IA:
- l'unico effetto possibile è "pausa dei nuovi ingressi" dell'esecutore, per 1-24 ore; mai aprire, chiudere o
  spostare posizioni, mai toccare la prova su carta (le misure delle strategie restano pulite);
- la pausa deve citare un titolo che c'è davvero tra quelli letti (niente notizie inventate);
- se le fonti o l'IA non rispondono non succede nulla: si resta in "nessun controllo", senza pausa;
- ogni cambio arriva su Telegram e nel registro degli eventi.
Stato in guard_state.json (lo legge l'app: Agente → Rischio).
"""
import email.utils
import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

import requests

STATE_PATH = "guard_state.json"
FEEDS = [
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("Cointelegraph", "https://cointelegraph.com/rss"),
    ("Decrypt", "https://decrypt.co/feed"),
]
EVERY = timedelta(minutes=55)          # al massimo un controllo all'ora (il bot gira ogni 15 minuti)
WINDOW = timedelta(hours=6)            # titoli considerati: quelli delle ultime 6 ore
MAX_TITLES = 40
MAX_HOURS = 24
UA = {"User-Agent": "Mozilla/5.0 (compatible; feed reader)"}


def _parse_date(text):
    try:
        d = email.utils.parsedate_to_datetime(text)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        pass
    try:
        return datetime.fromisoformat(str(text).replace("Z", "+00:00"))
    except ValueError:
        return None


def parse_feed(xml_text, source):
    """Titoli di un feed RSS o Atom: [{"title", "at", "source"}]. Testo malformato: lista vuota."""
    out = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return out
    for item in root.iter():
        tag = item.tag.rsplit("}", 1)[-1]
        if tag not in ("item", "entry"):
            continue
        title = date = None
        for child in item:
            ctag = child.tag.rsplit("}", 1)[-1]
            if ctag == "title" and child.text:
                title = re.sub(r"\s+", " ", child.text).strip()
            elif ctag in ("pubDate", "published", "updated", "date") and child.text and not date:
                date = _parse_date(child.text.strip())
        if title and date:
            out.append({"title": title[:200], "at": date.astimezone(timezone.utc).isoformat(timespec="minutes"), "source": source})
    return out


def fetch_titles(now, get=requests.get):
    titles = []
    for source, url in FEEDS:
        try:
            r = get(url, headers=UA, timeout=15)
            if r.status_code == 200:
                titles += parse_feed(r.text, source)
        except Exception as e:      # noqa: BLE001 — una fonte giù non ferma le altre
            print(f"Agente eventi: {source} non raggiungibile ({type(e).__name__})")
    recent = [t for t in titles if now - datetime.fromisoformat(t["at"]) <= WINDOW]
    seen, out = set(), []
    for t in sorted(recent, key=lambda t: t["at"], reverse=True):
        k = t["title"].lower()
        if k not in seen:
            seen.add(k)
            out.append(t)
    return out[:MAX_TITLES]


PROMPT = """Sei una guardia di rischio per un piccolo conto di trading su futures crypto (BTC, ETH, SOL, XRP, DOGE, BNB, ADA, LINK).
Ti do i titoli delle notizie delle ultime ore. Devi dire se c'è un evento IN CORSO che rende pericoloso APRIRE posizioni nuove
nelle prossime ore. Esempi che giustificano la pausa: attacco hacker o blocco dei prelievi di un grande exchange (soprattutto Bitget),
una di quelle coin sospesa, in delisting o con la sua blockchain ferma, crollo improvviso di tutto il mercato in corso, divieto
improvviso di un governo importante. NON giustificano la pausa: opinioni, previsioni di prezzo, analisi, notizie normali di mercato,
movimenti ordinari, eventi già conclusi, notizie su altre coin.
Nel dubbio rispondi "normale". Rispondi SOLO con JSON:
{"level": "normale" oppure "pausa", "hours": numero da 1 a 24 (solo per pausa), "headline": "il titolo che lo giustifica, copiato esattamente", "reason": "motivo in italiano, massimo 20 parole"}

Titoli:
"""


def ask_ai(titles, key, post=requests.post, get=requests.get):
    """Risposta dell'IA già validata: {"level", "hours", "headline", "reason"} oppure None (IA non disponibile)."""
    from agent import _pick_model
    h = {"Authorization": f"Bearer {key}"}
    r = get("https://api.groq.com/openai/v1/models", headers=h, timeout=20)
    model = os.environ.get("GROQ_MODEL") or _pick_model([m.get("id") for m in (r.json().get("data") or []) if m.get("active") is not False])
    if not model:
        return None
    text = "\n".join(f"- [{t['source']}, {t['at'][11:16]} UTC] {t['title']}" for t in titles)
    body = {"model": model, "messages": [{"role": "user", "content": PROMPT + text}], "temperature": 0,
            "response_format": {"type": "json_object"},
            "max_tokens": 1200 if any(x in model for x in ("gpt-oss", "qwen3")) else 300}
    if "gpt-oss" in model:
        body["reasoning_effort"] = "low"
    r = post("https://api.groq.com/openai/v1/chat/completions", headers=h, json=body, timeout=60)
    content = ((r.json().get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    return validate(content, titles)


def validate(content, titles):
    """Solo "normale" o "pausa" con un titolo vero tra quelli letti; ore tra 1 e 24. Altrimenti "normale"."""
    try:
        a = json.loads(content)
    except (TypeError, ValueError):
        return None
    if not isinstance(a, dict) or a.get("level") != "pausa":
        return {"level": "normale"}
    headline = str(a.get("headline") or "").strip()
    match = next((t for t in titles if t["title"].lower() == headline.lower()), None)
    if not match:
        return {"level": "normale", "note": "pausa scartata: titolo non trovato tra quelli letti"}
    try:
        hours = int(round(float(a.get("hours"))))
    except (TypeError, ValueError):
        hours = 6
    return {"level": "pausa", "hours": max(1, min(MAX_HOURS, hours)), "headline": match["title"], "source": match["source"],
            "reason": str(a.get("reason") or "evento di rischio")[:160]}


def load(path=STATE_PATH):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def active_pause(now=None, path=STATE_PATH):
    """Pausa in corso (dizionario dello stato) o None. La legge l'esecutore prima di ogni nuovo ingresso."""
    s = load(path)
    until = s.get("pause_until")
    if not until:
        return None
    now = now or datetime.now(timezone.utc)
    return s if now < datetime.fromisoformat(until) else None


def run(now=None, path=STATE_PATH, notify=None, key=None, get=requests.get, post=requests.post, force=False):
    """Un controllo (al massimo ogni ora, salvo force). Ritorna True se lo stato è cambiato."""
    import events
    now = now or datetime.now(timezone.utc)
    key = key if key is not None else os.environ.get("GROQ_API_KEY", "").strip()
    state = load(path)
    before = json.dumps(state, sort_keys=True)
    last = state.get("checked_at")
    if not force and last and now - datetime.fromisoformat(last) < EVERY:
        return False
    if not key:
        state.update(checked_at=now.isoformat(timespec="seconds"), status="spento: manca GROQ_API_KEY")
        return _save(state, before, path)
    # pausa scaduta: si toglie e si avvisa (anche se le notizie non si leggono)
    if state.get("pause_until") and now >= datetime.fromisoformat(state["pause_until"]):
        for k in ("pause_until", "reason", "headline", "source"):
            state.pop(k, None)
        events.record("sistema", "pausa_eventi_finita", "Agente eventi: pausa dei nuovi ingressi finita.", at=now)
        if notify:
            notify("🛡️ AGENTE EVENTI\nPausa finita: l'esecutore può di nuovo aprire posizioni (se le altre regole lo permettono).")
    titles = fetch_titles(now, get)
    verdict = None
    if titles:
        try:
            verdict = ask_ai(titles, key, post, get)
        except Exception as e:      # noqa: BLE001 — IA non raggiungibile: nessuna pausa nuova
            print(f"Agente eventi: IA non disponibile ({type(e).__name__})")
    state["checked_at"] = now.isoformat(timespec="seconds")
    state["titles"] = len(titles)
    paused = bool(state.get("pause_until"))
    if verdict and verdict["level"] == "pausa":
        until = now + timedelta(hours=verdict["hours"])
        if not paused or until > datetime.fromisoformat(state["pause_until"]):   # una pausa nuova può solo allungarla
            state.update(pause_until=until.isoformat(timespec="seconds"), reason=verdict["reason"],
                         headline=verdict["headline"], source=verdict["source"])
        if not paused:
            msg = (f"Pausa dei nuovi ingressi reali fino alle {until:%H:%M} UTC: {verdict['reason']} "
                   f"(notizia: \"{verdict['headline']}\", {verdict['source']}). Le posizioni aperte restano con i loro stop.")
            events.record("sistema", "pausa_eventi", f"Agente eventi: {msg}", at=now)
            hist = state.setdefault("history", [])
            hist.insert(0, {"at": now.isoformat(timespec="seconds"), "hours": verdict["hours"], "reason": verdict["reason"],
                            "headline": verdict["headline"], "source": verdict["source"]})
            del hist[20:]
            if notify:
                notify(f"🛡️ AGENTE EVENTI\n{msg}")
    elif verdict and verdict.get("note"):
        print(f"Agente eventi: {verdict['note']}")
    state["status"] = ("pausa" if state.get("pause_until") else
                       "notizie non lette" if not titles else "IA non disponibile" if verdict is None else "normale")
    return _save(state, before, path)


def _save(state, before, path):
    if json.dumps(state, sort_keys=True) == before:
        return False
    with open(path, "w") as f:
        json.dump(state, f, indent=1, ensure_ascii=False)
    return True


if __name__ == "__main__":
    import watchdog
    run(notify=watchdog.send, force=True)
