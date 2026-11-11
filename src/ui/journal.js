import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { $, SYM, fmtDateTime, fmtUsdt, tradeMarket, tradeLeverage, fmtIt } from '../utils/helpers.js';
import * as Calculator from './calculator.js';
import * as Trade from './trade.js';

export function initJournal() {
    // Eventuali listener specifici del journal (se necessari)
}

export function renderHistory() {
    const el = document.getElementById('simHistory');
    if (!el) return;
    const prevScroll = el.scrollLeft;
    if (State.simState.history.length === 0) {
        el.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding:20px;width:100%;">Nessun trade registrato</div>';
        renderTradeLogDots();
        return;
    }
    el.innerHTML = '';
    State.simState.history.forEach(h => {
        const coinName = h.symbol ? h.symbol.replace('USDT', '') : 'UNK';
        const tf = h.granularity || '--';
        const market = tradeMarket(h);
        const lev = tradeLeverage(h);
        const marketClass = market.toLowerCase();
        const levBadge = lev > 1 ? `<span class="lg-lev">${lev}x</span>` : '';
        let pnlPerc = 0;
        if (h.type === 'LONG') pnlPerc = ((h.exit - h.entry) / h.entry) * 100;
        else pnlPerc = ((h.entry - h.exit) / h.entry) * 100;
        let durStr = '--';
        if (h.entryTime && h.closedAt) { 
            const durMin = Math.floor((h.closedAt - h.entryTime) / 60000); 
            durStr = durMin >= 60 ? `${Math.floor(durMin/60)}h ${durMin%60}m` : `${durMin}m`; 
        }
        const grossColor = h.grossPnl >= 0 ? 'var(--accent)' : 'var(--danger)';
        const grossSign = h.grossPnl >= 0 ? '+' : '';
        const div = document.createElement('div');
        div.className = 'log-item';
        div.innerHTML = `
        <div class="lg-header">
            <div class="lg-title">
                <span class="lg-coin">${coinName} ${h.type}</span>
                <span class="lg-tf">${tf}</span>
                <span class="lg-market ${marketClass}">${market}</span>
                ${levBadge}
                <span class="log-reason reason-${h.reason}">${h.reason}</span>
            </div>
            <div class="lg-actions">
                <button class="btn-delete" onclick="openDeleteModal('${h.id}')"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
            </div>
        </div>
        <div class="lg-meta">
            <span>Aperto ${fmtDateTime(h.entryTime)}</span><span class="arrow">→</span><span>Chiuso ${fmtDateTime(h.closedAt)}</span>
        </div>
        <div class="lg-body">
            <div class="lg-item"><span class="lg-lbl">Entry / Exit</span><span class="lg-val">${fmtIt(h.entry)} → ${fmtIt(h.exit)}</span></div>
            <div class="lg-item"><span class="lg-lbl">Size</span><span class="lg-val">${fmtUsdt(h.capitalInvested)}</span></div>
            <div class="lg-item"><span class="lg-lbl">Durata</span><span class="lg-val">${durStr}</span></div>
            <div class="lg-item"><span class="lg-lbl">PnL Lordo</span><span class="lg-val" style="color:${grossColor};">${grossSign}${fmtUsdt(h.grossPnl)}</span></div>
            <div class="lg-item"><span class="lg-lbl">Fee</span><span class="lg-val" style="color:var(--warning);">-${fmtUsdt(h.fees)}</span></div>
            <div class="lg-item"><span class="lg-lbl">Tasse</span><span class="lg-val" style="color:var(--warning);">-${fmtUsdt(h.tax)}</span></div>
        </div>
        <div class="lg-footer">
            <div class="lg-item" style="align-items: flex-end;">
                <span class="lg-lbl">PnL Netto</span>
                <div class="lg-pnl" style="color:${h.pnl >= 0 ? 'var(--accent)' : 'var(--danger)'};">
                    ${h.pnl >= 0 ? '+' : ''}${fmtUsdt(h.pnl)}
                    <span class="lg-pnl-perc" style="color:${h.pnl >= 0 ? 'var(--accent)' : 'var(--danger)'};">${pnlPerc >= 0 ? '+' : ''}${fmtIt(pnlPerc)}%</span>
                </div>
            </div>
        </div>`;
        el.appendChild(div);
    });
    el.scrollLeft = prevScroll;
    renderTradeLogDots();
}

export function renderStats() {
    const trades = State.simState.history;
    const statWinRate = document.getElementById('statWinRate'), statPF = document.getElementById('statPF'),
          statAvgWin = document.getElementById('statAvgWin'), statAvgLoss = document.getElementById('statAvgLoss'),
          statExp = document.getElementById('statExp'), statMaxDD = document.getElementById('statMaxDD');
    if (trades.length === 0) {
        [statWinRate, statPF, statAvgWin, statAvgLoss, statExp, statMaxDD].forEach(el => el.textContent = '—');
        return;
    }
    const wins = trades.filter(t => t.pnl > 0); const losses = trades.filter(t => t.pnl < 0);
    const wr = (wins.length / trades.length) * 100;
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
    const grossWins = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const pf = grossLosses > 0 ? grossWins / grossLosses : (grossWins > 0 ? 99 : 0);
    const exp = trades.reduce((s, t) => s + t.pnl, 0) / trades.length;
    let equity = State.simState.initialAccountBalance, peak = equity, maxDD = 0;
    [...trades].reverse().forEach(t => {
        equity += t.pnl;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
        if (dd > maxDD) maxDD = dd;
    });
    statWinRate.textContent = wr.toFixed(1) + '%';
    statPF.textContent = pf.toFixed(2);
    statAvgWin.textContent = '+' + fmtUsdt(avgWin);
    statAvgLoss.textContent = fmtUsdt(avgLoss);
    statExp.textContent = (exp >= 0 ? '+' : '') + fmtUsdt(exp);
    statExp.style.color = exp >= 0 ? 'var(--accent)' : 'var(--danger)';
    statMaxDD.textContent = '-' + maxDD.toFixed(1) + '%';
}

export function renderTradeLogDots() {
    const dotsContainer = document.getElementById('tradeLogDots');
    const counter = document.getElementById('tradeLogCounter');
    if (!dotsContainer) return;
    const count = State.simState.history.length;
    if (count === 0) { dotsContainer.innerHTML = ''; if (counter) counter.textContent = ''; return; }
    const container = document.getElementById('simHistory');
    let activeIdx = 0;
    if (container && container.firstElementChild) { 
        const itemWidth = container.firstElementChild.offsetWidth + 10; 
        if (itemWidth > 0) activeIdx = Math.round(container.scrollLeft / itemWidth); 
    }
    activeIdx = Math.max(0, Math.min(activeIdx, count - 1));
    if (count > 15) dotsContainer.innerHTML = '';
    else { 
        let html = ''; 
        for (let i = 0; i < count; i++) html += `<div class="info-dot${i === activeIdx ? ' active' : ''}" onclick="goToTradeSlide(${i})"></div>`; 
        dotsContainer.innerHTML = html; 
    }
    if (counter) counter.textContent = `${activeIdx + 1} / ${count}`;
}

export function goToTradeSlide(idx) {
    const container = document.getElementById('simHistory');
    if (!container) return;
    const items = container.querySelectorAll('.log-item');
    if (!items[idx]) return;
    items[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

export function updateTradeLogDots() {
    const container = document.getElementById('simHistory');
    if (!container) return;
    const items = container.querySelectorAll('.log-item');
    if (items.length === 0) return;
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    let activeIdx = 0, minDist = Infinity;
    items.forEach((item, i) => {
        const itemRect = item.getBoundingClientRect();
        const itemCenter = itemRect.left + itemRect.width / 2;
        const dist = Math.abs(itemCenter - containerCenter);
        if (dist < minDist) { minDist = dist; activeIdx = i; }
    });
    document.querySelectorAll('#tradeLogDots .info-dot').forEach((d, i) => d.classList.toggle('active', i === activeIdx));
    const counter = document.getElementById('tradeLogCounter');
    if (counter) counter.textContent = `${activeIdx + 1} / ${items.length}`;
}

export function exportCSV() {
    if (State.simState.history.length === 0) return;
    let csv = 'Data,Coin,TF,Mercato,Leva,Tipo,Motivo,Entry,Exit,Size,Gross_PnL,Fees,Tax,Net_PnL\n';
    [...State.simState.history].reverse().forEach(h => {
        const coin = h.symbol ? h.symbol.replace('USDT', '') : 'UNK';
        const dateStr = h.closedAt ? new Date(h.closedAt).toISOString() : h.time;
        const mkt = tradeMarket(h);
        const lev = tradeLeverage(h);
        csv += `${dateStr},${coin},${h.granularity},${mkt},${lev},${h.type},${h.reason},${h.entry},${h.exit},${h.capitalInvested},${h.grossPnl.toFixed(2)},${h.fees.toFixed(2)},${h.tax.toFixed(2)},${h.pnl.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kronos_trades_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}

export function confirmReset() { document.getElementById('resetModal').classList.add('active'); }
export function closeResetModal() { document.getElementById('resetModal').classList.remove('active'); }
export function executeReset() {
    State.simState = { initialAccountBalance: 2000, freeBalance: 2000, activeTrades: [], history: [] };
    State.capitalTouched = false;
    State.saveState();
    Trade.refreshCapitalUI();
    renderHistory();
    renderStats();
    Calculator.renderBreakEven();
    Trade.renderActiveTrades();
    if (window.refreshMarkers) window.refreshMarkers();
    if (window.updatePriceLines) window.updatePriceLines();
    if (State.tradeTimerInterval) clearInterval(State.tradeTimerInterval);
    closeResetModal();
}

export function openDeleteModal(id) { State.tradeToDeleteId = id; document.getElementById('deleteModal').classList.add('active'); }
export function closeModal() { State.tradeToDeleteId = null; document.getElementById('deleteModal').classList.remove('active'); }
export function confirmDelete() {
    if (State.tradeToDeleteId) {
        const i = State.simState.history.findIndex(h => h.id === State.tradeToDeleteId);
        if (i !== -1) {
            State.simState.history.splice(i, 1);
            const total = State.simState.history.reduce((s, h) => s + h.pnl, 0);
            const locked = State.simState.activeTrades.reduce((s, t) => s + (t.margin != null ? t.margin : t.capitalInvested), 0);
            State.simState.freeBalance = State.simState.initialAccountBalance + total - locked;
            State.saveState();
            Trade.refreshCapitalUI();
            renderHistory();
            renderStats();
            Calculator.renderBreakEven();
        }
        closeModal();
    }
}
