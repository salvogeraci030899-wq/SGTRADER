import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { $, SYM, fmtUsdt, calcPnl } from '../utils/helpers.js';
import { aggregateCellSignals } from './signals.js';

export function initHome() {
    // Aggiorna la home periodicamente per riflettere PnL flottante e timer
    setInterval(updateHome, 5000);
}

export function updateHome() {
    const pageHome = document.getElementById('page-home');
    if (!pageHome || !pageHome.classList.contains('active')) return;

    // 1. PnL Oggi
    const today = new Date().toLocaleDateString('it-IT');
    let todayPnl = 0;
    State.simState.history.forEach(h => {
        if (h.closedAt && new Date(h.closedAt).toLocaleDateString('it-IT') === today) {
            todayPnl += h.pnl;
        }
    });
    const pnlEl = $('homePnlToday');
    if (pnlEl) {
        pnlEl.textContent = (todayPnl > 0 ? '+' : '') + fmtUsdt(todayPnl);
        pnlEl.className = todayPnl > 0 ? 'home-card-value safe' : (todayPnl < 0 ? 'home-card-value danger' : 'home-card-value');
    }

    // 2. Posizioni Aperte
    const openTrades = State.simState.activeTrades;
    let floatingPnl = 0;
    openTrades.forEach(t => {
        const px = t.currentPrice || t.entryPrice;
        floatingPnl += calcPnl(t, px).net;
    });
    const openCountEl = $('homeOpenCount');
    if (openCountEl) openCountEl.textContent = openTrades.length;
    
    const openPnlEl = $('homeOpenPnl');
    if (openPnlEl) {
        openPnlEl.textContent = (floatingPnl > 0 ? '+' : '') + fmtUsdt(floatingPnl);
        openPnlEl.style.color = floatingPnl > 0 ? 'var(--accent)' : (floatingPnl < 0 ? 'var(--danger)' : 'var(--text-secondary)');
    }

    // 3. Segnale Top
    let topSignal = null;
    let bestScore = -1;
    for (const key in State.signalMatrix) {
        const [asset, tf] = key.split('_');
        const agg = aggregateCellSignals(asset, tf);
        if (agg && agg.consensus !== 'NEUTRAL') {
            const score = (agg.agreement * 100) + agg.avgStrength;
            if (score > bestScore) {
                bestScore = score;
                topSignal = { asset, tf, agg };
            }
        }
    }
    
    const topSigBadge = $('homeTopSignalBadge');
    const topSigAsset = $('homeTopSignalAsset');
    const topSigDesc = $('homeTopSignalDesc');
    
    if (topSignal) {
        if (topSigBadge) {
            topSigBadge.textContent = `${topSignal.agg.consensus} ${topSignal.agg.agreement}/4`;
            topSigBadge.className = `sc-badge ${topSignal.agg.consensus.toLowerCase()}`;
        }
        if (topSigAsset) topSigAsset.textContent = `${SYM(topSignal.asset)} ${topSignal.tf}`;
        if (topSigDesc) topSigDesc.textContent = `Strength ${topSignal.agg.avgStrength}%`;
    } else {
        if (topSigBadge) {
            topSigBadge.textContent = 'Nessuno';
            topSigBadge.className = `sc-badge neutral`;
        }
        if (topSigAsset) topSigAsset.textContent = '—';
        if (topSigDesc) topSigDesc.textContent = 'Attendi la prossima scansione';
    }

    // 4. Stato Sistema
    const lastUpdateEl = $('homeLastUpdate');
    const lastUpdateFooter = $('last-update-footer');
    if (lastUpdateEl && lastUpdateFooter) {
        lastUpdateEl.textContent = lastUpdateFooter.textContent.replace('Ultimo agg: ', '');
    }
    
    const scanStatusEl = $('homeScanStatus');
    const signalStatusEl = $('signalScanStatus');
    if (scanStatusEl && signalStatusEl) {
        scanStatusEl.textContent = signalStatusEl.textContent;
        scanStatusEl.style.color = signalStatusEl.className.includes('good') ? 'var(--accent)' : (signalStatusEl.className.includes('bad') ? 'var(--danger)' : 'var(--text-secondary)');
    }
}
