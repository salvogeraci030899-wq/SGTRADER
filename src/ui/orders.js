// --- POSIZIONI → ORDINI: tutto ciò che è in attesa o è stato chiesto, in un posto solo ---
// Reale:    stop e target in attesa su Bitget (futures e spot, con ✕), avvisi di prezzo, ultimi comandi (✓/✗).
// Simulato: stop, target e regole dei trade simulati aperti, avvisi di prezzo.
// Gli ordini si creano dalla pagina Trade o con Chat/Voce; qui si vedono e si tolgono.
import { State } from '../core/state.js';
import { $, SYM, escapeHtml, fmtPrice } from '../utils/helpers.js';
import { isRealMode, realPositions } from './history.js';
import { getAutoState, priceAlerts, isRealOrderRemoving } from './automation.js';

const VIEW_KEY = 'sg_pos_view';
let view = 'open';
try { view = localStorage.getItem(VIEW_KEY) === 'orders' ? 'orders' : 'open'; } catch (e) {}

export function setPosView(v) {
    view = v === 'orders' ? 'orders' : 'open';
    try { localStorage.setItem(VIEW_KEY, view); } catch (e) {}
    applyView();
    if (view === 'orders') renderOrders();
}
export const ordersVisible = () => view === 'orders';

function applyView() {
    const open = $('activeTradesList'), dots = $('activeTradeDots'), orders = $('ordersView');
    if (!open || !orders) return;
    open.style.display = view === 'open' ? '' : 'none';
    if (dots) dots.style.display = view === 'open' ? '' : 'none';
    orders.style.display = view === 'orders' ? '' : 'none';
    $('btn-pos-open')?.classList.toggle('active', view === 'open');
    $('btn-pos-orders')?.classList.toggle('active', view === 'orders');
}

const when = iso => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
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

function realOrders() {
    const rows = [];
    for (const p of realPositions()) {
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

function alertRows() {
    return priceAlerts().map(a => row(`${SYM(a.symbol)} ${a.side === 'above' ? '≥' : '≤'} ${fmtPrice(a.price)}`, 'avviso su Telegram, nessun ordine',
        `<button type="button" class="ord-x" title="Togli" onclick="removePriceAlert('${escapeHtml(a.id)}')">✕</button>`));
}

function commandRows() {
    const live = getAutoState().live;
    const ev = ((live && live.events) || []).filter(e => e && e.kind === 'manual').slice(-15).reverse();
    return ev.map(e => {
        const ok = e.ok !== false;
        const mkt = e.side === 'spot' ? 'spot' : e.side ? String(e.side).toUpperCase() : '';
        return `<div class="ord-row ord-log"><span class="ord-ok ${ok ? 'text-accent' : 'text-danger'}">${ok ? '✓' : '✗'}</span><div class="ord-main"><b>${escapeHtml(SYM(e.symbol || ''))} ${escapeHtml(mkt)} · ${escapeHtml(e.action || '')}</b><small>${escapeHtml(when(e.at))} · ${escapeHtml(e.msg || '')}</small></div></div>`;
    });
}

export function renderOrders() {
    const box = $('ordersView');
    if (!box || view !== 'orders') return;
    const real = isRealMode();
    const html = real
        ? section('In attesa su Bitget', realOrders(), 'Nessuno stop o target in attesa.')
          + section('Avvisi di prezzo', alertRows(), 'Nessun avviso. Chiedilo all\'assistente: «avvisami se BTC arriva a 75.000».')
          + section('Ultimi comandi', commandRows(), 'Ancora nessun comando dall\'app.')
        : section('Livelli dei trade simulati', simOrders(), 'Nessun trade simulato aperto.')
          + section('Avvisi di prezzo', alertRows(), 'Nessun avviso. Chiedilo all\'assistente: «avvisami se BTC arriva a 75.000».');
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
