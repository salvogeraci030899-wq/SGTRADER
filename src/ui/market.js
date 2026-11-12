// --- MERCATO: schede Grafici · Segnali · Avvisi (la griglia dei segnali tecnici e gli avvisi di prezzo
// stanno qui, accanto ai grafici: sono modi di guardare il mercato) ---
import { State } from '../core/state.js';
import { $, escapeHtml, fmtPrice } from '../utils/helpers.js';
import { priceAlerts, firedPriceAlerts, loadAutomation, getAutoState } from './automation.js';

const VIEWS = { chart: 'mktChart', sig: 'mktSig', alerts: 'mktAlerts' };
const SUB = { sig: 'Segnali tecnici', alerts: 'Avvisi di prezzo' };
let view = 'chart';

export function setMarketView(v) {
    view = VIEWS[v] ? v : 'chart';
    for (const [k, id] of Object.entries(VIEWS)) {
        $(id).style.display = k === view ? '' : 'none';
        $(`mkt-tab-${k}`).classList.toggle('active', k === view);
    }
    // sottotitolo: coin e timeframe nei grafici, il nome della scheda altrove
    $('current-asset-label').style.display = view === 'chart' ? '' : 'none';
    $('mktSub').style.display = view === 'chart' ? 'none' : '';
    $('mktSub').textContent = SUB[view] || '';
    if (view === 'chart' && window.resizeChart) requestAnimationFrame(window.resizeChart);
    if (view === 'alerts') { renderMarketAlerts(); if (!getAutoState().loaded) loadAutomation(); }
}
export const marketView = () => view;

const day = iso => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '—');
const coin = s => String(s || '').replace('USDT', '');

export function renderMarketAlerts() {
    const box = $('mktAlertsBody');
    if (!box || view !== 'alerts') return;
    if (!getAutoState().loaded) { box.innerHTML = '<div class="empty-hint">Caricamento…</div>'; return; }
    const card = (a, fired) => {
        const px = State.livePx[a.symbol];
        const dist = px ? ` · ora ${fmtPrice(px)} (${((a.price / px - 1) * 100 >= 0 ? '+' : '')}${((a.price / px - 1) * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%)` : '';
        return `<div class="ord-row"><div class="ord-main"><b>${fired ? '🔔 ' : ''}${coin(a.symbol)} ${a.side === 'above' ? '≥' : '≤'} ${fmtPrice(a.price)}</b>`
            + `<small>${fired ? 'scattato: messaggio inviato su Telegram' : `${a.side === 'above' ? 'in salita' : 'in discesa'} · dal ${escapeHtml(day(a.created_at))}${dist}`}</small></div>`
            + `<button type="button" class="ord-x" title="Togli" onclick="removePriceAlert('${escapeHtml(a.id)}')">✕</button></div>`;
    };
    const active = priceAlerts(), fired = firedPriceAlerts().slice(-6).reverse();
    const section = (title, rows, empty) => `<div class="ord-sec"><div class="ord-title">${title}${rows.length > 1 ? ` <span class="ord-count">${rows.length}</span>` : ''}</div>`
        + `<div class="ord-list${rows.length > 1 ? ' many' : ''}">${rows.length ? rows.join('') : `<div class="ord-empty">${empty}</div>`}</div></div>`;
    box.innerHTML = section('Attivi', active.map(a => card(a, false)), 'Nessun avviso attivo. Crealo qui sotto, dal grafico (campanella a schermo intero) o dall\'assistente.')
        + (fired.length ? section('Scattati di recente', fired.map(a => card(a, true)), '') : '');
}

// Nuovo avviso: sulla coin mostrata nei grafici (la finestra permette di cambiarla)
export function newPriceAlert() {
    const sym = State.currentAsset || 'BTCUSDT';
    window.openChartAlert(sym, State.livePx[sym]);
}
