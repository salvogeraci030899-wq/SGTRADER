import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { Logger } from '../core/logger.js';
import { $, SYM, fetchT, apiPost, escapeHtml, fmtDateTime, fmtUsdt, calcPnl, fmtPrice } from '../utils/helpers.js';
import * as Terminal from './terminal.js';
import * as Calculator from './calculator.js';
import * as AI from './ai.js';
import { tradingMode } from './account.js';
import { getAutoState, maybeRefreshAccount, isRealOrderRemoving, isRefreshingAccount } from './automation.js';
import { realPositions } from './history.js';
import { planAction, ruleHitPrice, ruleHitCandle } from '../core/rules.js';

export function initTrade() {
    // posizioni reali: prezzo mark dei futures ogni 5 secondi (solo in modalità Reale e con posizioni aperte)
    setInterval(pollMarks, 5000);
    // ritorno nell'app (per esempio dopo aver aperto una posizione nell'app Bitget): conto riletto subito
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && isReal()) maybeRefreshAccount(true); });
}
export function onOpenTrade() { if (isReal()) maybeRefreshAccount(true); }

// --- Posizioni reali "vive": il bot legge Bitget ogni 15 minuti; tra un giro e l'altro l'app stima
// PnL e prezzo con il mark price pubblico dei futures (stessa base che usa Bitget per il PnL aperto).
const markPx = {};
let marksInFlight = false;
const realList = () => realPositions();       // futures e coin spot (history.js)

async function pollMarks() {
    if (marksInFlight || !isReal()) return;
    maybeRefreshAccount();
    const symbols = [...new Set(realList().map(p => p.symbol))];
    if (!symbols.length) return;
    marksInFlight = true;
    try {
        await Promise.all(symbols.map(async sym => {
            try {
                const r = await fetchT(`https://api.bitget.com/api/v2/mix/market/ticker?symbol=${sym}&productType=USDT-FUTURES`);
                const j = await r.json();
                const d = j && j.code === '00000' && j.data && j.data[0];
                const m = d ? parseFloat(d.markPrice || d.lastPr) : NaN;
                if (isFinite(m) && m > 0) markPx[sym] = m;
            } catch (e) { /* rete: resta l'ultimo valore */ }
        }));
    } finally { marksInFlight = false; }
    updateRealLive();
    if (window.updateHome) window.updateHome();
}

// PnL aperto stimato al prezzo mark attuale; senza mark resta quello letto dal bot
export function liveUpl(p) {
    const m = markPx[p.symbol];
    if (!p.entry) return p.upl ?? null;           // coin spot senza prezzo d'acquisto noto
    return m ? (p.side === 'short' ? -1 : 1) * (m - p.entry) * p.size : p.upl;
}
export const hasLiveMarks = () => realList().some(p => markPx[p.symbol]);

function updateRealLive() {
    const el = document.getElementById('activeTradesList');
    if (!el) return;
    const n = (v, d = 2) => (v == null ? '—' : Number(v).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }));
    for (const p of realList()) {
        const card = el.querySelector(`.at-real[data-key="${p.key}"]`);
        const m = markPx[p.symbol];
        if (!card || !m) continue;
        const u = liveUpl(p);
        const val = card.querySelector('[data-f="value"]');
        if (val) val.textContent = n(m * p.size);
        if (u == null) { const mk0 = card.querySelector('[data-f="mark"]'); if (mk0) mk0.textContent = n(m); continue; }
        const mk = card.querySelector('[data-f="mark"]'), up = card.querySelector('[data-f="upl"]'), lbl = card.querySelector('[data-f="upl-lbl"]');
        if (mk) mk.textContent = n(m);
        if (up) { up.textContent = (u >= 0 ? '+' : '') + n(u); up.style.color = u >= 0 ? 'var(--accent)' : 'var(--danger)'; }
        if (lbl) lbl.textContent = 'PnL live (stima)';
    }
}

// In modalità Reale la pagina mostra il conto Bitget (letto dal bot): saldo non modificabile e
// posizioni vere in sola lettura. I trade simulati restano salvati e tornano visibili in Simulato.
export const isReal = () => tradingMode().mode === 'on';
const bitgetAccount = () => { const st = getAutoState(); return st.live && st.live.account; };

export function refreshCapitalUI() {
    const el = document.getElementById('simCapitalDisplay');
    const real = isReal(), acc = bitgetAccount();
    const total = acc && acc.connected ? (acc.total_usdt != null ? acc.total_usdt : acc.equity) : null;
    if (el) el.textContent = real ? (total != null ? fmtUsdt(total) : '—') : fmtUsdt(State.simState.freeBalance);
    const lbl = document.getElementById('capitalLabel'), btn = document.getElementById('capitalEditBtn'), sub = document.getElementById('tradeSubtitle');
    if (lbl) lbl.textContent = real ? 'Saldo Bitget' : 'Capitale Libero';
    if (btn) btn.style.display = real ? 'none' : '';
    if (sub) sub.textContent = real ? 'Bitget · reale' : 'Trade simulati';
    Calculator.syncCapital();
}

// Comandi attivi (regole, stop e target) in una striscia che scorre in orizzontale: una riga sola, qualunque numero
const rulesStrip = items => (items.length ? `<div class="at-rules${items.length > 1 ? ' many' : ''}">${items.join('')}</div>` : '');

// "Comandi attivi" di una posizione reale: TP e SL che stanno su Bitget (messi con Chat o Voce, o a mano
// nell'app Bitget), ciascuno con ✕ per toglierlo; sotto, l'esito dell'ultimo comando dato dall'app.
function realCommands(p, events) {
    const short = p.side === 'short';
    const row = (kind, price) => {
        const label = kind === 'tp' ? `Target Bitget ${short ? '≤' : '≥'} ${fmtPrice(price)}` : `Stop Bitget ${short ? '≥' : '≤'} ${fmtPrice(price)}`;
        return isRealOrderRemoving(`${p.market}:${p.symbol}`, kind)
            ? `<div class="at-rule"><span>${label} · in rimozione…</span></div>`
            : `<div class="at-rule"><span>${label}</span><button type="button" onclick="removeRealOrder('${p.symbol}','${p.side}','${kind}',${Number(price)},'${p.market}')" title="Togli">✕</button></div>`;
    };
    const rows = rulesStrip([p.sl ? row('sl', p.sl) : '', p.tp ? row('tp', p.tp) : ''].filter(Boolean));
    const ev = events.filter(e => e.symbol === p.symbol && e.side === (p.market === 'spot' ? 'spot' : p.side)).pop();
    const recent = ev && Date.now() - Date.parse(ev.at) < 24 * 3600e3;
    const last = recent ? `<div class="at-meta at-last">Ultimo comando ${new Date(ev.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}: <span class="${ev.ok === false ? 'text-danger' : 'text-accent'}">${ev.ok === false ? '✗' : '✓'}</span> ${escapeHtml(ev.msg || ev.action)}</div>` : '';
    const none = !p.sl && !p.tp ? `<div class="at-meta">Nessuno stop né target su Bitget: chiedili con Chat o Voce.</div>` : '';
    return rows + none + last;
}

export function requestAIAnalysisReal(key) {
    const p = realList().find(x => x.key === key || x.symbol === key);
    if (p) { const symbol = p.symbol; return analyzeReal(p, symbol); }
}
function analyzeReal(p, symbol) {
    if (!p) return;
    const trade = { symbol, type: p.side === 'short' ? 'SHORT' : 'LONG', entryPrice: p.entry, slPrice: p.sl || null, tpPrice: p.tp || null,
        leverage: p.leverage, size: p.size, currentPrice: markPx[symbol] || p.mark || p.entry, pnl: liveUpl(p) || 0, real: true };
    return AI.runAIAnalysis({ symbol, tf: '4h', trade });
}

function renderRealPositions(el) {
    const acc = bitgetAccount();
    const list = realList();
    const events = ((getAutoState().live || {}).events || []).filter(e => e && e.kind === 'manual');
    const lastEv = events[events.length - 1];
    const sig = `real|${acc && acc.checked_at}|${list.map(p => `${p.key}${p.tp}/${p.sl}/${isRealOrderRemoving(p.key, 'tp')}${isRealOrderRemoving(p.key, 'sl')}`).join()}|${lastEv && lastEv.at}|${isRefreshingAccount()}|${State.simState.activeTrades.length}`;
    if (sig === State.atSig) return;
    State.atSig = sig;
    const hidden = State.simState.activeTrades.length;
    const when = acc && acc.checked_at ? `, letto alle ${new Date(acc.checked_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : '';
    const note = `<div class="at-real-note">${isRefreshingAccount() ? '<span class="text-ui">Aggiorno da Bitget…</span> ' : ''}Da Bitget${when}. Ordini veri solo dopo la tua conferma.${hidden ? ` ${hidden} trade simulati nascosti: tornano in Simulato.` : ''}</div>`;
    if (!acc || !acc.connected) {
        el.classList.add('empty');
        el.innerHTML = `<div class="at-empty">Conto Bitget non letto.${note}</div>`;
    } else if (!list.length) {
        el.classList.add('empty');
        el.innerHTML = `<div class="at-empty">Nessuna posizione aperta su Bitget (futures) e nessuna coin spot.${note}</div>`;
    } else {
        el.classList.remove('empty');
        const n = (v, d = 2) => (v == null ? '—' : Number(v).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }));
        el.innerHTML = list.map(p => `
            <div class="active-trade-card at-real" data-symbol="${p.symbol}" data-key="${p.key}">
                <div class="at-header"><div class="at-title">
                    <span class="at-coin">${SYM(p.symbol)} ${p.market === 'spot' ? '' : String(p.side || '').toUpperCase()}</span>
                    ${p.market === 'spot' ? '<span class="at-market spot">SPOT</span>' : `<span class="at-market futures">FUTURES</span>${p.leverage ? `<span class="at-lev">${n(p.leverage, 0)}x</span>` : ''}`}
                </div></div>
                ${realCommands(p, events)}
                <div class="at-body">
                    <div class="at-item"><span class="at-lbl">${p.market === 'spot' ? 'Acquisto' : 'Entry'}</span><span class="at-val">${n(p.entry)}</span></div>
                    <div class="at-item"><span class="at-lbl">${p.market === 'spot' ? 'Prezzo' : 'Mark'}</span><span class="at-val" data-f="mark">${n(p.mark)}</span></div>
                    <div class="at-item"><span class="at-lbl">Quantità</span><span class="at-val">${n(p.size, 4)}</span></div>
                    ${p.market === 'spot'
                        ? `<div class="at-item"><span class="at-lbl">Valore</span><span class="at-val" data-f="value">${n(p.value)}</span></div>
                    <div class="at-item"><span class="at-lbl">Mercato</span><span class="at-val">spot, 1x</span></div>`
                        : `<div class="at-item"><span class="at-lbl">Margine</span><span class="at-val">${n(p.margin)}</span></div>
                    <div class="at-item"><span class="at-lbl">Liquidazione</span><span class="at-val red">${n(p.liq)}</span></div>`}
                    <div class="at-item"><span class="at-lbl" data-f="upl-lbl">PnL aperto</span><span class="at-val" data-f="upl" style="color:${(p.upl || 0) >= 0 ? 'var(--accent)' : 'var(--danger)'}">${p.upl == null ? '—' : (p.upl >= 0 ? '+' : '') + n(p.upl)}</span></div>
                    <div class="at-item"><span class="at-lbl">Take profit</span><span class="at-val green">${p.tp ? fmtPrice(p.tp) : '—'}</span></div>
                    <div class="at-item"><span class="at-lbl">Stop loss</span><span class="at-val red">${p.sl ? fmtPrice(p.sl) : '—'}</span></div>
                </div>
                <div class="at-actions at-actions-3">
                    <button class="btn-ai-analysis" onclick="requestAIAnalysisReal('${p.key}')" title="Analisi AI in tempo reale della posizione">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                        Analisi AI
                    </button>
                    <button class="btn-ai-analysis btn-ai-alt" onclick="openAssistantReal('${p.key}', false)" title="Chat con l'assistente (ordini veri su Bitget)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        Chat
                    </button>
                    <button class="btn-ai-analysis btn-ai-alt" onclick="openAssistantReal('${p.key}', true)" title="Parla con l'assistente (ordini veri su Bitget)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                        Voce
                    </button>
                </div>
                ${note}
            </div>`).join('');
        updateRealLive();
    }
    renderActiveTradeDots();
}

export function startTimer() {
    if (State.tradeTimerInterval) clearInterval(State.tradeTimerInterval);
    State.tradeTimerInterval = setInterval(() => {
        if (State.simState.activeTrades.length === 0) return;
        [...State.simState.activeTrades].forEach(t => {
            const rem = t.timerSeconds - Math.floor((Date.now() - t.entryTime) / 1000);
            if (rem <= 0) closeTrade(t.id, 'TEMPO');
        });
        renderActiveTrades();
    }, 1000);
}

export function checkAutoClose(id, price) {
    const t = State.simState.activeTrades.find(x => x.id === id);
    if (!t) return;
    const long = t.type === 'LONG';
    // ordine prudente: prima lo stop, poi le regole dell'assistente, poi il target
    if (long ? price <= t.slPrice : price >= t.slPrice) return closeTrade(id, 'SL', price);
    if ((t.rules || []).some(r => ruleHitPrice(r, price))) return closeTrade(id, 'REGOLA', price);
    if (long ? price >= t.tpPrice : price <= t.tpPrice) return closeTrade(id, 'TP', t.tpPrice);
}

// --- Assistente (chat / voce): piano calcolato da src/core/rules.js, applicato dopo conferma ---
export function planForTrade(id, action) {
    const t = State.simState.activeTrades.find(x => x.id === id);
    if (!t) return { ok: false, error: 'La posizione non è più aperta.' };
    return planAction(t, action, t.currentPrice || State.livePx[t.symbol] || t.entryPrice);
}

export function applyPlan(id, plan) {
    const t = State.simState.activeTrades.find(x => x.id === id);
    if (!t || !plan || !plan.ok) return false;
    if (plan.kind === 'close_now') { closeTrade(id, 'MANUALE', 0); return true; }
    if (plan.kind === 'rule') {
        t.rules = [...(t.rules || []), { id: Date.now().toString(36), ...plan.rule, createdAt: Date.now() }].slice(-5);
    } else if (plan.kind === 'clear_rules') {
        t.rules = [];
    } else if (plan.kind === 'set_stop') {
        t.slPrice = plan.price; t.slPct = Math.abs(t.entryPrice - plan.price) / t.entryPrice;
    } else if (plan.kind === 'set_target') {
        t.tpPrice = plan.price; t.tpPct = Math.abs(plan.price - t.entryPrice) / t.entryPrice;
    } else return false;
    // il recupero delle candele perse riparte da qui: i livelli nuovi non valgono per il passato
    t.modifiedAt = Date.now();
    State.saveState();
    State.atSig = null;
    renderActiveTrades();
    Terminal.updatePriceLines();
    return true;
}

export function removeRule(id, ruleId) {
    const t = State.simState.activeTrades.find(x => x.id === id);
    if (!t) return;
    t.rules = (t.rules || []).filter(r => r.id !== ruleId);
    State.saveState();
    State.atSig = null;
    renderActiveTrades();
}

export async function executeTradeOpen() {
    const p = State.pendingTradePayload;
    if (!p) return;
    const c = State.calcContext || { asset: State.currentAsset, tf: State.currentTF };
    const isLong = p.direction === 'LONG';
    const px = p.livePrice;
    const slPct = Math.abs(p.entry - p.stop) / p.entry;
    const tpPct = Math.abs(p.target - p.entry) / p.entry;
    const hours = { '1d': 168, '4h': 48, '1h': 24 }[c.tf] || 72;
    const lev = State.currentMarket === 'FUTURES' ? Math.max(1, Calculator.getVal('calcLev') || 1) : 1;

    const trade = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        symbol: c.asset, granularity: c.tf, type: p.direction,
        market: State.currentMarket, leverage: lev,
        // commissione per lato usata nel PnL: quella impostata nella pagina Rischio (futures o spot)
        feeRate: (Calculator.getVal(State.currentMarket === 'FUTURES' ? 'calcFee' : 'calcFeeSpot') || CONFIG.FEE_RATE * 100) / 100,
        entryPrice: px, currentPrice: px,
        size: p.size / px, capitalInvested: p.size, margin: p.margin,
        entryTime: Date.now(), timerSeconds: hours * 3600,
        slPrice: isLong ? px * (1 - slPct) : px * (1 + slPct),
        tpPrice: isLong ? px * (1 + tpPct) : px * (1 - tpPct),
        tpPct, slPct
    };

    State.simState.freeBalance -= p.margin;
    State.simState.activeTrades.push(trade);
    State.saveState();
    refreshCapitalUI();
    startTimer();
    Terminal.startPricePoll();
    Terminal.refreshMarkers();
    Terminal.updatePriceLines();
    renderActiveTrades();
    if (window.switchTab) window.switchTab('trade');
    if (window.showAlert) window.showAlert('Trade Aperto', `${p.direction} ${SYM(c.asset)} @ $${px.toFixed(2)}\n${State.currentMarket}${lev > 1 ? ' ' + lev + 'x' : ''} · Size: ${p.size.toFixed(2)} USDT · Margine: ${p.margin.toFixed(2)} USDT`);
    State.pendingTradePayload = null;
}

export function closeTrade(id, reason = 'MANUALE', exitPrice = 0, when = 0) {
    if (State.catching && !when && reason !== 'MANUALE') return;
    const index = State.simState.activeTrades.findIndex(t => t.id === id);
    if (index === -1) return;
    const trade = State.simState.activeTrades[index];
    let px = exitPrice;
    if (!(px > 0)) px = trade.currentPrice || trade.entryPrice;
    const ts = when || Date.now();
    const pnlData = calcPnl(trade, px);
    const margin = trade.margin != null ? trade.margin : trade.capitalInvested;
    State.simState.freeBalance += margin + pnlData.net;
    
    State.simState.history.unshift({
        id: trade.id, symbol: trade.symbol, granularity: trade.granularity || '--',
        type: trade.type, market: trade.market || (Math.abs((trade.margin ?? trade.capitalInvested) - trade.capitalInvested) > 0.01 ? 'FUTURES' : 'SPOT'),
        leverage: trade.leverage || (trade.margin > 0 ? Math.max(1, Math.round(trade.capitalInvested / trade.margin)) : 1),
        reason, time: new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        entry: trade.entryPrice, exit: px,
        pnl: pnlData.net, grossPnl: pnlData.gross, fees: pnlData.fees, tax: pnlData.tax,
        entryTime: trade.entryTime, closedAt: ts, exitTime: ts,
        size: trade.size, capitalInvested: trade.capitalInvested, margin,
        slPct: trade.slPct, tpPct: trade.tpPct
    });
    State.simState.activeTrades.splice(index, 1);
    State.saveState();
    refreshCapitalUI();
    if (window.renderHistory) window.renderHistory();
    if (window.renderStats) window.renderStats();
    Calculator.renderBreakEven();
    renderActiveTrades();
    if (State.simState.activeTrades.length === 0 && State.tradeTimerInterval) clearInterval(State.tradeTimerInterval);
    Terminal.refreshMarkers();
    Terminal.updatePriceLines();
}

export function renderActiveTrades() {
    const el = document.getElementById('activeTradesList');
    if (!el) return;
    if (isReal()) { renderRealPositions(el); return; }
    const sig = State.simState.activeTrades.map(t => `${t.id}|${t.granularity || ''}|${t.margin ?? ''}|${t.market || ''}|${t.leverage || ''}|${t.slPrice}|${t.tpPrice}|${(t.rules || []).map(r => r.id).join('.')}`).join(',');
    
    if (sig !== State.atSig) {
        State.atSig = sig;
        const prevScroll = el.scrollLeft;
        if (!State.simState.activeTrades.length) {
            el.classList.add('empty');
            el.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;text-align:center;">Nessuna posizione aperta.</div>';
            renderActiveTradeDots(); 
            return;
        }
        el.classList.remove('empty');
        el.innerHTML = State.simState.activeTrades.map(t => {
            const coinName = SYM(t.symbol);
            const tf = t.granularity || '--';
            const market = t.market || 'SPOT';
            const lev = t.leverage || 1;
            const marketClass = market.toLowerCase();
            const levBadge = lev > 1 ? `<span class="at-lev">${lev}x</span>` : '';
            return `
            <div class="active-trade-card" data-id="${t.id}">
                <div class="at-header">
                    <div class="at-title">
                        <span class="at-coin">${coinName} ${t.type}</span>
                        <span class="at-tf">${tf}</span>
                        <span class="at-market ${marketClass}">${market}</span>
                        ${levBadge}
                    </div>
                    <button class="close-btn" onclick="openCloseTradeModal('${t.id}')">CHIUDI</button>
                </div>
                <div class="at-meta">Aperto ${fmtDateTime(t.entryTime)}</div>
                ${rulesStrip((t.rules || []).map(r => `<div class="at-rule"><span>Chiude a ${r.side === 'above' ? '≥' : '≤'} ${fmtPrice(r.price)} · ${escapeHtml(r.label)}</span><button type="button" onclick="removeRule('${t.id}','${r.id}')" title="Togli la regola">✕</button></div>`))}
                <div class="at-body">
                    <div class="at-item"><span class="at-lbl">Entry</span><span class="at-val">${t.entryPrice.toFixed(2)}</span></div>
                    <div class="at-item"><span class="at-lbl">Corrente</span><span class="at-val" data-f="px">—</span></div>
                    <div class="at-item"><span class="at-lbl">Size</span><span class="at-val">${fmtUsdt(t.capitalInvested)}</span></div>
                    <div class="at-item"><span class="at-lbl">Stop Loss</span><span class="at-val red">${t.slPrice.toFixed(2)}</span></div>
                    <div class="at-item"><span class="at-lbl">Take Profit</span><span class="at-val green">${t.tpPrice.toFixed(2)}</span></div>
                    <div class="at-item"><span class="at-lbl">Timer</span><span class="at-val" data-f="timer" style="color:var(--warning);">—</span></div>
                </div>
                <div class="at-footer">
                    <div class="at-item" style="text-align:left; flex: 1;"><span class="at-lbl">PnL Lordo</span><span class="at-val" data-f="gross">—</span></div>
                    <div class="at-item" style="text-align:center; flex: 1;"><span class="at-lbl">Costi</span><span class="at-val" data-f="costs" style="color:var(--warning);">—</span></div>
                    <div class="at-item" style="text-align:right; flex: 1;"><span class="at-lbl">PnL Netto</span><span class="at-val" data-f="net" style="font-size:15px;">—</span></div>
                </div>
                <div class="at-actions at-actions-3">
                    <button class="btn-ai-analysis" onclick="requestAIAnalysis('${t.id}')" title="Analisi AI in tempo reale">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                        Analisi AI
                    </button>
                    <button class="btn-ai-analysis btn-ai-alt" onclick="openAssistant('${t.id}', false)" title="Chat con l'assistente">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        Chat
                    </button>
                    <button class="btn-ai-analysis btn-ai-alt" onclick="openAssistant('${t.id}', true)" title="Parla con l'assistente">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                        Voce
                    </button>
                </div>
            </div>`;
        }).join('');
        el.scrollLeft = prevScroll;
        renderActiveTradeDots(); 
    }

    State.simState.activeTrades.forEach(t => {
        const card = el.querySelector(`[data-id="${t.id}"]`);
        if (!card) return;
        const set = (f, txt, color) => {
            const n = card.querySelector(`[data-f="${f}"]`);
            if (n) { n.textContent = txt; if (color) n.style.color = color; }
        };
        const px = t.currentPrice || t.entryPrice;
        const p = calcPnl(t, px);
        const rem = t.timerSeconds - Math.floor((Date.now() - t.entryTime) / 1000);
        set('px', px.toFixed(2));
        set('timer', rem > 0 ? `${Math.floor(rem/3600)}h ${Math.floor((rem%3600)/60)}m` : 'Scaduto');
        set('gross', `${p.gross >= 0 ? '+' : ''}${fmtUsdt(p.gross)}`, p.gross >= 0 ? 'var(--accent)' : 'var(--danger)');
        set('costs', `-${fmtUsdt(p.fees + p.tax)}`, 'var(--warning)');
        set('net', `${p.net >= 0 ? '+' : ''}${fmtUsdt(p.net)}`, p.net >= 0 ? 'var(--accent)' : 'var(--danger)');
    });
}

export function openCloseTradeModal(id) { State.tradeToCloseId = id; document.getElementById('closeTradeModal').classList.add('active'); }
export function closeCloseTradeModal() { State.tradeToCloseId = null; document.getElementById('closeTradeModal').classList.remove('active'); }
export function executeCloseTrade() { if (State.tradeToCloseId) { closeTrade(State.tradeToCloseId, 'MANUALE', 0); closeCloseTradeModal(); } }

export function openCapitalModal() {
    if (isReal()) {
        if (window.showAlert) window.showAlert('Conto reale', 'In Reale il capitale è il saldo di Bitget: si cambia solo depositando o prelevando su Bitget.');
        return;
    }
    document.getElementById('capitalChangeInput').value = '';
    setCapitalSign('+');
    document.getElementById('capitalModal').classList.add('active');
    setTimeout(() => document.getElementById('capitalChangeInput').focus(), 150);
}

// Deposita (+) o preleva (−): l'importo si scrive sempre positivo con la tastiera numerica
export function setCapitalSign(sign) {
    document.getElementById('capitalSign').value = sign;
    document.querySelectorAll('#capitalSignToggle button').forEach(b => b.classList.toggle('active', b.dataset.sign === sign));
}
export function closeCapitalModal() { document.getElementById('capitalModal').classList.remove('active'); }

export function applyCapitalChange() {
    const amount = parseFloat(String(document.getElementById('capitalChangeInput').value).replace(',', '.'));
    const change = (document.getElementById('capitalSign').value === '-' ? -1 : 1) * Math.abs(amount);
    if (isNaN(change) || change === 0) { if (window.showAlert) window.showAlert('Errore', 'Importo non valido.'); return; }
    if (State.simState.freeBalance + change < 0) { if (window.showAlert) window.showAlert('Errore', 'Il capitale non può scendere sotto 0.'); return; }
    State.simState.initialAccountBalance += change;
    State.simState.freeBalance += change;
    State.saveState();
    refreshCapitalUI();
    if (window.renderStats) window.renderStats();
    Calculator.renderBreakEven();
    closeCapitalModal();
}

export function renderActiveTradeDots() {
    const dotsContainer = document.getElementById('activeTradeDots');
    const counter = document.getElementById('activeTradeCounter');
    if (!dotsContainer) return;
    const count = State.simState.activeTrades.length;
    if (count === 0) { dotsContainer.innerHTML = ''; if (counter) counter.textContent = ''; return; }
    const totalPages = Math.ceil(count / 2);
    const container = document.getElementById('activeTradesList');
    let activeIdx = 0;
    if (container && container.firstElementChild) { const itemWidth = container.firstElementChild.offsetWidth + 12; if (itemWidth > 0) activeIdx = Math.round(container.scrollLeft / itemWidth); }
    activeIdx = Math.max(0, Math.min(activeIdx, totalPages - 1));
    if (totalPages > 15) dotsContainer.innerHTML = '';
    else {
        let html = '';
        for (let i = 0; i < totalPages; i++) html += `<div class="info-dot${i === activeIdx ? ' active' : ''}" onclick="goToActiveTradePage(${i})"></div>`;
        dotsContainer.innerHTML = html;
    }
    if (counter) counter.textContent = `${activeIdx + 1} / ${totalPages}`;
}

export function goToActiveTradePage(idx) {
    const container = document.getElementById('activeTradesList');
    if (!container) return;
    container.scrollTo({ left: idx * container.clientWidth, behavior: 'smooth' });
}

export async function requestAIAnalysis(id) {
    const trade = State.simState.activeTrades.find(t => t.id === id);
    if (!trade) return;
    return AI.runAIAnalysis({ symbol: trade.symbol, tf: trade.granularity || '4h', trade });
}

export function closeAIAnalysisModal() { document.getElementById('aiAnalysisModal').classList.remove('active'); }

export async function catchUp() {
    for (const t of [...State.simState.activeTrades]) {
        try {
            const r = await fetchT(`https://api.bitget.com/api/v2/spot/market/candles?symbol=${t.symbol}&granularity=15min&startTime=${Math.floor(t.entryTime)}&limit=1000`, 10000);
            if (!r.ok) continue;
            const j = await r.json();
            if (j.code !== '00000' || !Array.isArray(j.data)) continue;
            // dopo una modifica di stop/target/regole si riparte dalla modifica (prima valevano i livelli vecchi)
            const from = Math.max(t.entryTime, t.modifiedAt || 0);
            const cs = j.data.map(c => ({ ts: +c[0], o: +c[1], h: +c[2], l: +c[3] }))
                .filter(c => isFinite(c.ts) && c.ts >= from)
                .sort((a, b) => a.ts - b.ts);
            const expiry = t.entryTime + t.timerSeconds * 1000;
            const long = t.type === 'LONG';
            for (const c of cs) {
                if (c.ts >= expiry) { closeTrade(t.id, 'TEMPO', c.o, c.ts); break; }
                const sl = long ? c.l <= t.slPrice : c.h >= t.slPrice;
                const tp = long ? c.h >= t.tpPrice : c.l <= t.tpPrice;
                if (sl) { closeTrade(t.id, 'SL', t.slPrice, c.ts); break; }
                const rule = (t.rules || []).find(r => ruleHitCandle(r, c.h, c.l));
                if (rule) { closeTrade(t.id, 'REGOLA', rule.price, c.ts); break; }
                if (tp) { closeTrade(t.id, 'TP', t.tpPrice, c.ts); break; }
            }
        } catch (e) {}
    }
}

export async function runCatchUp() {
    if (State.cuRunning) return;
    State.cuRunning = true;
    State.catching = true;
    try { await catchUp(); }
    finally { State.catching = false; State.cuRunning = false; }
    renderActiveTrades();
    Terminal.refreshMarkers();
    Terminal.updatePriceLines();
}
