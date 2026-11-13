// --- Trade simulati: esportazione CSV e azzeramento (tasti della pagina Risultati, fonte Simulato) ---
// L'elenco e le statistiche stanno in results.js; qui restano solo le due azioni sui dati simulati dell'app.
import { State } from '../core/state.js';
import { tradeMarket, tradeLeverage } from '../utils/helpers.js';
import * as Calculator from './calculator.js';
import * as Trade from './trade.js';

const n2 = v => (Number(v) || 0).toFixed(2);

// Sempre i trade simulati: il tasto compare solo con la fonte Simulato, anche quando l'app è in modalità Reale
export function exportCSV() {
    const trades = State.simState.history || [];
    if (trades.length === 0) { if (window.showAlert) window.showAlert('Niente da esportare', 'Nessun trade simulato chiuso.'); return; }
    let csv = 'Data,Coin,TF,Mercato,Leva,Tipo,Motivo,Entry,Exit,Size,Gross_PnL,Fees,Tax,Net_PnL\n';
    [...trades].reverse().forEach(h => {
        const coin = h.symbol ? h.symbol.replace('USDT', '') : '';
        const when = h.closedAt ? new Date(h.closedAt).toISOString() : (h.time || '');
        csv += `${when},${coin},${h.granularity || ''},${tradeMarket(h)},${tradeLeverage(h)},${h.type},${h.reason || ''},${h.entry},${h.exit},${h.capitalInvested},${n2(h.grossPnl)},${n2(h.fees)},${n2(h.tax)},${n2(h.pnl)}\n`;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `pinschertrade_simulato_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function confirmReset() { document.getElementById('resetModal').classList.add('active'); }
export function closeResetModal() { document.getElementById('resetModal').classList.remove('active'); }
export function executeReset() {
    State.simState = { initialAccountBalance: 2000, freeBalance: 2000, activeTrades: [], history: [] };
    State.capitalTouched = false;
    State.saveState();
    Trade.refreshCapitalUI();
    if (window.renderHistory) window.renderHistory();      // pagina Risultati
    Calculator.renderBreakEven();
    Trade.renderActiveTrades();
    if (window.refreshMarkers) window.refreshMarkers();
    if (window.updatePriceLines) window.updatePriceLines();
    if (State.tradeTimerInterval) clearInterval(State.tradeTimerInterval);
    closeResetModal();
}
