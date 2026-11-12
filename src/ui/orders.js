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
const section = (title, rows, empty) => `<div class="ord-sec"><div class="ord-title">${title}</div>${rows.length ? rows.join('') : `<div class="ord-empty">${empty}</div>`}</div>`;
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
    box.innerHTML = real
        ? section('In attesa su Bitget', realOrders(), 'Nessuno stop o target in attesa.')
          + section('Avvisi di prezzo', alertRows(), 'Nessun avviso. Chiedilo all\'assistente: «avvisami se BTC arriva a 75.000».')
          + section('Ultimi comandi', commandRows(), 'Ancora nessun comando dall\'app.')
        : section('Livelli dei trade simulati', simOrders(), 'Nessun trade simulato aperto.')
          + section('Avvisi di prezzo', alertRows(), 'Nessun avviso. Chiedilo all\'assistente: «avvisami se BTC arriva a 75.000».');
}

export function initOrders() { applyView(); }
