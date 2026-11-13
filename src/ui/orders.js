// --- POSIZIONI → ORDINI e BOT SU CARTA ---
// Ordini: tutto ciò che è in attesa o è stato chiesto, in un posto solo.
// Bot su carta: i trade aperti dalle strategie del bot in prova su carta (paper_trades.json, nessun ordine reale),
// con il risultato del momento ai prezzi Bitget. I chiusi stanno in Risultati → Strategie su carta.
// Solo ciò che aspetta di scattare. Reale: stop e target in attesa su Bitget, futures e spot (con ✕).
// Simulato: stop, target e regole dei trade simulati aperti.
// Comandi inviati ed esiti stanno nel Registro; gli avvisi di prezzo in Mercato → Avvisi.
// Gli ordini si creano dalla pagina Trade o con l'assistente; qui si vedono e si tolgono.
import { State } from '../core/state.js';
import { $, SYM, escapeHtml, fmtPrice, markChosen, fetchData, fetchT } from '../utils/helpers.js';
import { isRealMode, realPositions } from './history.js';
import { isRealOrderRemoving } from './automation.js';

const VIEW_KEY = 'pt_pos_view';
let view = 'open';
const VIEWS = ['open', 'orders', 'bot'];
try { const v = localStorage.getItem(VIEW_KEY); if (VIEWS.includes(v)) view = v; } catch (e) {}

export function setPosView(v, manual = true) {
    if (manual) markChosen('posView');
    view = VIEWS.includes(v) ? v : 'open';
    try { localStorage.setItem(VIEW_KEY, view); } catch (e) {}
    applyView();
    if (view !== 'open') renderOrders();
    if (view === 'bot') loadPaper().then(renderOrders);
}

// Vista scelta da sola all'apertura della pagina: le posizioni dell'app se ce ne sono (o in Reale),
// altrimenti i trade del bot su carta se ce ne sono aperti.
export async function autoPosView() {
    if (isRealMode() || State.simState.activeTrades.length) { setPosView('open', false); return; }
    setPosView(paperOpen().length ? 'bot' : 'open', false);
    await loadPaper();
    if (!isRealMode() && !State.simState.activeTrades.length && paperOpen().length && view === 'open') setPosView('bot', false);
}

function applyView() {
    const open = $('activeTradesList'), dots = $('activeTradeDots'), orders = $('ordersView');
    if (!open || !orders) return;
    open.style.display = view === 'open' ? '' : 'none';
    if (dots) dots.style.display = view === 'open' ? '' : 'none';
    orders.style.display = view === 'open' ? 'none' : '';
    VIEWS.forEach(v => $('btn-pos-' + v)?.classList.toggle('active', view === v));
}

// Nessuno scroll verticale: ogni scheda ha i suoi elementi in fila, da scorrere in orizzontale
// Oltre allo scorrimento col dito, frecce ‹ › e posizione (1/4): su iPhone si scorre anche senza trascinare
const nav = n => n > 1 ? `<span class="ord-nav"><button type="button" aria-label="Precedente" onclick="ordStep(this,-1)">‹</button><span class="ord-pos">1/${n}</span><button type="button" aria-label="Successivo" onclick="ordStep(this,1)">›</button></span>` : '';
const section = (title, rows, empty, count = rows.length) => `<div class="ord-sec"><div class="ord-title">${title}${count > 1 ? ` <span class="ord-count">${count}</span>` : ''}${nav(rows.length)}</div>`
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



// --- Bot su carta ---
let paper = null, paperAt = 0;
const prices = {};
const paperOpen = () => {
    const out = [];
    for (const [key, e] of Object.entries((paper && paper.strategies) || {})) {
        for (const t of (e && e.trades) || []) if (t.open) out.push({ ...t, key });
    }
    return out.sort((a, b) => (b.t_entry || b.t || 0) - (a.t_entry || a.t || 0));
};
async function loadPaper() {
    if (paper && Date.now() - paperAt < 60000) return;
    try { const r = await fetchData('paper_trades.json'); if (r.ok) paper = await r.json(); } catch (e) {}
    paperAt = Date.now();
    const syms = [...new Set(paperOpen().map(t => t.symbol))];
    await Promise.all(syms.map(async s => {
        try {
            const r = await fetchT(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${s}`);
            const p = Number((await r.json())?.data?.[0]?.lastPr);
            if (p > 0) prices[s] = p;
        } catch (e) {}
    }));
}
const stratName = key => { const [name, tf] = String(key).split(':'); return `${name.replace(/_/g, ' ')}${tf ? ' ' + tf.toUpperCase() : ''}`; };
const day = ts => (ts ? new Date(ts * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '—');
function botRows() {
    return paperOpen().map(t => {
        const side = t.dir > 0 ? 'LONG' : 'SHORT', now = prices[t.symbol];
        const pnl = now && t.entry ? (t.dir > 0 ? 1 : -1) * (now - t.entry) / t.entry * 100 : null;
        const res = pnl == null ? '' : ` · <span class="${pnl >= 0 ? 'text-accent' : 'text-danger'}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2).replace('.', ',')}%</span>`;
        return row(`${escapeHtml(SYM(t.symbol))} ${side}${res}`,
            `${escapeHtml(stratName(t.key))} · dal ${day(t.t_entry || t.t)}<br>ingresso ${fmtPrice(t.entry)} · stop ${fmtPrice(t.stop)}`);
    });
}
// Tanti trade: a pagine, ognuna piena di righe fino in fondo allo schermo, da scorrere di lato
let perPage = 5;
const botHtml = () => {
    const rows = botRows(), pages = [];
    for (let i = 0; i < rows.length; i += perPage) pages.push(`<div class="ord-page">${rows.slice(i, i + perPage).join('')}</div>`);
    return section('Bot su carta · nessun ordine reale', pages, paper ? 'Nessun trade su carta aperto: le strategie aprono solo quando arriva un segnale.' : 'Caricamento…', rows.length);
};
// righe che stanno in una pagina, misurate sullo schermo (una volta disegnata la prima)
function fitPerPage(box) {
    const sec = box.querySelector('.ord-sec'), list = sec && sec.querySelector('.ord-list'), r = list && list.querySelector('.ord-row');
    if (!r) return false;
    const free = box.clientHeight - (sec.offsetHeight - list.offsetHeight) - 4;
    const n = Math.max(1, Math.floor((free + 8) / (r.offsetHeight + 8)));
    if (n === perPage) return false;
    perPage = n;
    return true;
}

export function renderOrders() {
    const box = $('ordersView');
    if (!box || view === 'open') return;
    const real = isRealMode();
    const html = view === 'bot'
        ? botHtml()
        : real
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
    if (view === 'bot' && fitPerPage(box)) renderOrders();
}
let lastHtml = '';

export function initOrders() { applyView(); if (view === 'bot') loadPaper().then(renderOrders); }
