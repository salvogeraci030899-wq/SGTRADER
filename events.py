"""Registro unico di tutto quello che succede nel tool (letto dall'app: pagina Registro).

Un file al mese, una riga JSON per evento: events/AAAA-MM.jsonl. Lo scrivono tutti i pezzi del tool
(esecutore, prova su carta, avvisi, comandi dall'app, chiusure su Bitget, agente), ognuno nel proprio workflow.
I .jsonl si uniscono riga per riga quando due workflow salvano insieme (.gitattributes, merge=union);
ogni evento ha un id ricavato dal contenuto, così l'app scarta gli eventuali doppioni.

Si scrive solo se la variabile d'ambiente SGT_EVENTS_DIR è impostata (la impostano i workflow): i test e
le prove a mano non sporcano il registro vero.

Campi: at (ISO, UTC), kind (ordini | posizioni | agente | carta | avvisi | strategie | sistema | conto),
action (breve, per i filtri), text (frase in italiano, quella che si legge), più dati facoltativi
(symbol, side, key, ok, net...). Mai chiavi, token o altri segreti.
"""
import hashlib
import json
import os
from datetime import datetime, timezone

KINDS = ("ordini", "posizioni", "agente", "carta", "avvisi", "strategie", "sistema", "conto")


def _dir():
    return os.environ.get("SGT_EVENTS_DIR", "").strip()


def record(kind, action, text, at=None, **data):
    """Aggiunge un evento al registro del mese. Ritorna l'evento scritto, o None se il registro è spento.
    Non solleva mai eccezioni: un registro che non si scrive non deve fermare un ordine o un avviso."""
    folder = _dir()
    if not folder or kind not in KINDS:
        return None
    try:
        when = at if isinstance(at, datetime) else (datetime.fromisoformat(at.replace("Z", "+00:00")) if at else datetime.now(timezone.utc))
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        iso = when.astimezone(timezone.utc).isoformat(timespec="seconds")
        clean = {k: v for k, v in data.items() if v is not None}
        ev = {"at": iso, "kind": kind, "action": action, "text": str(text)[:400], **clean}
        ev["id"] = hashlib.sha1(json.dumps(ev, sort_keys=True, default=str).encode()).hexdigest()[:12]
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, f"{iso[:7]}.jsonl"), "a") as f:
            f.write(json.dumps(ev, ensure_ascii=False, separators=(",", ":"), default=str) + "\n")
        return ev
    except Exception as e:      # noqa: BLE001
        print(f"Registro degli eventi non scritto: {e}")
        return None


def read(month, folder=None):
    """Eventi di un mese (AAAA-MM), senza doppioni, in ordine di tempo."""
    path = os.path.join(folder or _dir() or "events", f"{month}.jsonl")
    out, seen = [], set()
    try:
        with open(path) as f:
            for line in f:
                try:
                    ev = json.loads(line)
                except ValueError:
                    continue
                if ev.get("id") in seen:
                    continue
                seen.add(ev.get("id"))
                out.append(ev)
    except OSError:
        return []
    return sorted(out, key=lambda e: e.get("at", ""))
