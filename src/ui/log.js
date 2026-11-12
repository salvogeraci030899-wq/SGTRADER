// --- REGISTRO: tutto quello che succede nel tool, in ordine di tempo (events/AAAA-MM.jsonl, scritti da events.py) ---
// Filtri per tipo, un giorno per pagina (‹ ›), eventi a colonne che continuano di lato (niente scroll verticale).
import { $, escapeHtml, fetchData } from '../utils/helpers.js';

const FILTERS = { all: 'Tutto', ordini: 'Ordini', posizioni: 'Posizioni', agente: 'Agente', carta: 'Carta', avvisi: 'Avvisi', sistema: 'Sistema' };
// "sistema" raccoglie anche comandi sulle strategie e movimenti del conto
const GROUP = { strategie: 'sistema', conto: 'sistema' };
let events = null, loadedAt = 0, filter = 'all', dayIdx = 0;

const monthKey = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

async function load(force = false) {
    if (events && !force && Date.now() - loadedAt < 60e3) return;
    const now = new Date(), prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const seen = new Set(), out = [];
    for (const m of [monthKey(prev), monthKey(now)]) {
        try {
            const r = await fetchData(`events/${m}.jsonl`);
            if (!r.ok) continue;
            for (const line of (await r.text()).split('\n')) {
                if (!line.trim()) continue;
                try {
                    const e = JSON.parse(line);
                    if (!e.id || seen.has(e.id)) continue;      // doppioni da salvataggi uniti
                    seen.add(e.id);
                    out.push(e);
                } catch (err) { /* riga rotta: si salta */ }
            }
        } catch (err) { /* mese non ancora presente */ }
    }
    events = out.sort((a, b) => b.at.localeCompare(a.at));
    loadedAt = Date.now();
}

function look(e) {
    if (e.kind === 'ordini') return e.ok === false ? ['✗ Ordine', 'text-danger'] : e.action === 'esecutore' ? ['🤖 Esecutore', 'text-ui'] : ['✓ Ordine', 'text-accent'];
    if (e.kind === 'posizioni') return [(e.net || 0) >= 0 ? '✅ Posizione chiusa' : '❌ Posizione chiusa', (e.net || 0) >= 0 ? 'text-accent' : 'text-danger'];
    if (e.kind === 'agente') return [e.action === 'promote' ? '▲ Agente' : e.action === 'demote' ? '▼ Agente' : '◎ Agente', e.action === 'promote' ? 'text-warning' : 'text-ui'];
    if (e.kind === 'carta') return ['🧪 Carta', ''];
    if (e.kind === 'avvisi') return ['🔔 Avviso', ''];
    if (e.kind === 'conto') return ['💶 Conto', 'text-warning'];
    if (e.kind === 'strategie') return ['⚙️ Strategie', ''];
    return ['⚙️ Sistema', e.action === 'emergency' ? 'text-danger' : ''];
}

const localDay = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function dayLabel(key) {
    const today = localDay(new Date().toISOString()), y = new Date(); y.setDate(y.getDate() - 1);
    const d = new Date(key + 'T12:00:00');
    const name = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    return key === today ? `Oggi · ${name}` : key === localDay(y.toISOString()) ? `Ieri · ${name}` : name.charAt(0).toUpperCase() + name.slice(1);
}

export function setLogFilter(f) { filter = FILTERS[f] ? f : 'all'; dayIdx = 0; renderLog(); }
export function logDay(step) { dayIdx = Math.max(0, dayIdx + step); renderLog(); }

export async function renderLog(force = false) {
    const box = $('logBody');
    if (!box || !$('page-log').classList.contains('active')) return;
    $('logFilters').innerHTML = Object.entries(FILTERS).map(([k, l]) => `<button type="button" class="${k === filter ? 'on' : ''}" onclick="setLogFilter('${k}')">${l}</button>`).join('');
    if (!events) box.innerHTML = '<div class="empty-hint">Caricamento…</div>';
    await load(force);
    const list = events.filter(e => filter === 'all' || (GROUP[e.kind] || e.kind) === filter);
    const days = [...new Set(list.map(e => localDay(e.at)))];
    if (!days.length) {
        $('logDay').innerHTML = '';
        box.innerHTML = `<div class="empty-hint">${filter === 'all' ? 'Ancora nessun evento registrato. Il registro è partito il 12/11: da allora ordini, chiusure, decisioni dell\'agente, avvisi e comandi finiscono qui.' : 'Nessun evento di questo tipo.'}</div>`;
        return;
    }
    dayIdx = Math.min(dayIdx, days.length - 1);
    const key = days[dayIdx], todays = list.filter(e => localDay(e.at) === key);
    $('logDay').innerHTML = `<button type="button" ${dayIdx >= days.length - 1 ? 'disabled' : ''} onclick="logDay(1)" aria-label="Giorno prima">‹</button>`
        + `<b>${escapeHtml(dayLabel(key))}</b><small>${todays.length} ${todays.length === 1 ? 'evento' : 'eventi'}</small>`
        + `<button type="button" ${dayIdx === 0 ? 'disabled' : ''} onclick="logDay(-1)" aria-label="Giorno dopo">›</button>`;
    box.innerHTML = `<div class="log-cols">${todays.map(e => {
        const [title, cls] = look(e);
        const time = new Date(e.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        return `<div class="log-ev"><div class="log-ev-h"><b class="${cls}">${title}</b><small>${time}</small></div><span>${escapeHtml(e.text || '')}</span></div>`;
    }).join('')}</div>`;
    box.querySelector('.log-cols').scrollLeft = 0;
}
