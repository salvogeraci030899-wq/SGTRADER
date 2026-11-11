import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { Logger } from '../core/logger.js';
import { $, SYM, fetchT, apiPost, escapeHtml, fmtDateTime, fmtUsdt, calcPnl } from '../utils/helpers.js';
import * as Terminal from './terminal.js';
import * as Calculator from './calculator.js';
import * as AI from './ai.js';

export function initTrade() {
    // Inizializzazione modali, listener locali se ci saranno
}

export function refreshCapitalUI() {
    const el = document.getElementById('simCapitalDisplay');
    if (el) el.textContent = fmtUsdt(State.simState.freeBalance);
    Calculator.syncCapital();
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
    let reason = null;
    if (t.type === 'LONG') { if (price <= t.slPrice) reason = 'SL'; else if (price >= t.tpPrice) reason = 'TP'; }
    else { if (price >= t.slPrice) reason = 'SL'; else if (price <= t.tpPrice) reason = 'TP'; }
    if (reason) closeTrade(id, reason, reason === 'TP' ? t.tpPrice : price);
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
    const sig = State.simState.activeTrades.map(t => `${t.id}|${t.granularity || ''}|${t.margin ?? ''}|${t.market || ''}|${t.leverage || ''}`).join(',');
    
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
                <div class="at-actions">
                    <button class="btn-ai-analysis" onclick="requestAIAnalysis('${t.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                        Analisi AI in tempo reale
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

export function openCapitalModal() { document.getElementById('capitalChangeInput').value = ''; document.getElementById('capitalModal').classList.add('active'); }
export function closeCapitalModal() { document.getElementById('capitalModal').classList.remove('active'); }

export function applyCapitalChange() {
    const change = parseFloat(document.getElementById('capitalChangeInput').value);
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
            const cs = j.data.map(c => ({ ts: +c[0], o: +c[1], h: +c[2], l: +c[3] }))
                .filter(c => isFinite(c.ts) && c.ts >= t.entryTime)
                .sort((a, b) => a.ts - b.ts);
            const expiry = t.entryTime + t.timerSeconds * 1000;
            const long = t.type === 'LONG';
            for (const c of cs) {
                if (c.ts >= expiry) { closeTrade(t.id, 'TEMPO', c.o, c.ts); break; }
                const sl = long ? c.l <= t.slPrice : c.h >= t.slPrice;
                const tp = long ? c.h >= t.tpPrice : c.l <= t.tpPrice;
                if (sl) { closeTrade(t.id, 'SL', t.slPrice, c.ts); break; }
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
