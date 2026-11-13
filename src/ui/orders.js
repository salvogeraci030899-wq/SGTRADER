// --- POSIZIONI → ORDINI: tutto ciò che è in attesa o è stato chiesto, in un posto solo ---
// Solo ciò che aspetta di scattare. Reale: stop e target in attesa su Bitget, futures e spot (con ✕).
// Simulato: stop, target e regole dei trade simulati aperti.
// Comandi inviati ed esiti stanno nel Registro; gli avvisi di prezzo in Mercato → Avvisi.
// Gli ordini si creano dalla pagina Trade o con l'assistente; qui si vedono e si tolgono.
import { State } from '../core/state.js';
import { $, SYM, escapeHtml, fmtPrice, markChosen } from '../utils/helpers.js';
import { isRealMode, realPositions } from './history.js';
import { isRealOrderRemoving } from './automation.js';

const VIEW_KEY = 'pt_pos_view';
let view = 'open';
try { view = localStorage.getItem(VIEW_KEY) === 'orders' ? 'orders' : 'open'; } catch (e) {}

export function setPosView(v, manual = true) {
    if (manual) markChosen('posView');
    view = v === 'orders' ? 'orders' : 'open';
    try { localStorage.setItem(VIEW_KEY, view); } catch (e) {}
    applyView();
    if (view === 'orders') renderOrders();
}

function applyView() {
    const open = $('activeTradesList'), dots = $('activeTradeDots'), orders = $('ordersView');
    if (!open || !orders) return;
    open.style.display = view === 'open' ? '' : 'none';
    if (dots) dots.style.display = view === 'open' ? '' : 'none';
    orders.style.display = view === 'orders' ? '' : 'none';
    $('btn-pos-open')?.classList.toggle('active', view === 'open');
    $('btn-pos-orders')?.classList.toggle('active', view === 'orders');
}

// Nessuno scroll verticale: ogni scheda ha i suoi elementi in fila, da scorrere in orizzontale
// Oltre allo scorrimento col dito, frecce ‹ › e posizione (1/4): su iPhone si scorre anche senza trascinare
const nav = n => n > 1 ? `<span class="ord-nav"><button type="button" aria-label="Precedente" onclick="ordStep(this,-1)">‹</button><span class="ord-pos">1/${n}</span><button type="button" aria-label="Successivo" onclick="ordStep(this,1)">›</button></span>` : '';
const section = (title, rows, empty) => `<div class="ord-sec"><div class="ord-title">${title}${rows.length > 1 ? ` <span class="ord-count">${rows.length}</span>` : ''}${nav(rows.length)}</div>`
    + `<div class="ord-list${rows.length > 1 ? ' many' : ''}" onscroll="ordSync(this)">${rows.length ? rows.join('') : `<div class="ord-empty">${empty}</div>`}</div></div>`;

const listIndex = list => {
    const rows = [...list.children], x = list.scrollLeft;
    let best = 0;
    rows.forEach((r, i) => { if (Math.abs(r.offsetLeft - x) < Math.abs(rows[best].offsetLeft - x)) best = i; });
    return list.scrollLeft + list.clientWidth >= list.scrollWidth - 2 ? rows.length - 1 : best;
};
export function ordSync(list) {
    const sec = list.closest('.ord-sec'), pos = sec && sec.querySelector('.ord-pos');
    if (!pos) return;
    const i = listIndex(list), n = list.children.length;
    pos.textContent = `${i + 1}/${n}`;
    const [prev, next] = sec.querySelectorAll('.ord-nav button');
    prev.disabled = i === 0; next.disabled = i === n - 1;
}
export function ordStep(btn, dir) {
    const list = btn.closest('.ord-sec')?.querySelector('.ord-list');
    if (!list) return;
    const rows = [...list.children], i = Math.max(0, Math.min(rows.length - 1, listIndex(list) + dir));
    list.scrollTo({ left: rows[i].offsetLeft, behavior: 'smooth' });
}
const row = (main, sub, action = '') => `<div class="ord-row"><div class="ord-main"><b>${main}</b>${sub ? `<small>${sub}</small>` : ''}</div>${action}</div>`;

function realOrders(market) {
    const rows = [];
    for (const p of realPositions().filter(x => (x.market === 'spot') === (market === 'spot'))) {
        const name = p.market === 'spot' ? `${SYM(p.symbol)} spot` : `${SYM(p.symbol)} ${String(p.side).toUpperCase()} futures`;
        const short = p.side === 'short';
        for (const [kind, price] of [['sl', p.sl], ['tp', p.tp]]) {
            if (!price) continue;
            const what = kind === 'sl' ? `Stop ${short ? '≥' : '≤'} ${fmtPrice(price)}` : `Target ${short ? '≤' : '≥'} ${fmtPrice(price)}`;
            const removing = isRealOrderRemoving(p.key, kind);
            rows.push(row(`${escapeHtml(name)} · ${what}`, kind === 'sl' ? 'chiude in perdita a mercato' : 'chiude in guadagno a mercato',
                removing ? '<span class="ord-tag">in rimozione…</span>'
                    : `<button type="button" class="ord-x" title="Togli" onclick="removeRealOrder('${p.symbol}','${p.side}','${kind}',${Number(price)},'${p.market}')">✕</button>`));
        }
        if (!p.sl) rows.push(row(`${escapeHtml(name)} · nessuno stop`, 'aggiungilo con Chat o Voce sulla posizione', '<span class="ord-tag warn">senza stop</span>'));
    }
    return rows;
}

function simOrders() {
    const rows = [];
    for (const t of State.simState.activeTrades) {
        const name = `${SYM(t.symbol)} ${t.type} simulato`;
        const short = t.type === 'SHORT';
        if (t.slPrice) rows.push(row(`${name} · Stop ${short ? '≥' : '≤'} ${fmtPrice(t.slPrice)}`, 'chiusura simulata'));
        if (t.tpPrice) rows.push(row(`${name} · Target ${short ? '≤' : '≥'} ${fmtPrice(t.tpPrice)}`, 'chiusura simulata'));
        for (const r of t.rules || []) {
            rows.push(row(`${name} · chiude a ${r.side === 'above' ? '≥' : '≤'} ${fmtPrice(r.price)}`, escapeHtml(r.label),
                `<button type="button" class="ord-x" title="Togli la regola" onclick="removeRule('${t.id}','${r.id}')">✕</button>`));
        }
    }
    return rows;
}



export function renderOrders() {
    const box = $('ordersView');
    if (!box || view !== 'orders') return;
    const real = isRealMode();
    const html = real
        ? section('Futures · in attesa su Bitget', realOrders('futures'), 'Nessuno stop o target in attesa sui futures.')
          + section('Spot · in attesa su Bitget', realOrders('spot'), 'Nessun ordine spot in attesa.')
        : section('Livelli dei trade simulati', simOrders(), 'Nessun trade simulato aperto.');
    // Viene chiamata a ogni aggiornamento dei prezzi: ridisegnare sempre riportava ogni lista al primo
    // elemento mentre la si scorreva. Si ridisegna solo se il contenuto cambia, e si tiene la posizione.
    if (html === lastHtml && box.childElementCount) return;
    const keep = [...box.querySelectorAll('.ord-list')].map(l => l.scrollLeft);
    lastHtml = html;
    box.innerHTML = html;
    box.querySelectorAll('.ord-list').forEach((l, i) => { if (keep[i]) l.scrollLeft = keep[i]; ordSync(l); });
}
let lastHtml = '';

export function initOrders() { applyView(); }
