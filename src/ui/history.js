import { State } from '../core/state.js';
import { tradingMode } from './account.js';
import { getAutoState } from './automation.js';

// --- Trade chiusi della modalità attiva ---
// Simulato: lo storico dell'app (State.simState.history). Reale: le posizioni chiuse su Bitget, lette dal bot
// (live_trades.json → account.history), nello stesso formato. Le due liste non si mescolano mai: Diario,
// break-even e segni sul grafico usano sempre e solo questa funzione.
export const isRealMode = () => tradingMode().mode === 'on';

export function realAccount() {
    const live = getAutoState().live;
    return (live && live.account) || null;
}

export function realHistory() {
    const acc = realAccount();
    return ((acc && acc.history) || []).filter(h => h && h.symbol && h.entry > 0 && h.exit > 0).map(h => {
        const gross = Number(h.pnl) || 0, fees = Math.abs(Number(h.fees) || 0), funding = Number(h.funding) || 0;
        return {
            id: `bg-${h.id}`, real: true, symbol: h.symbol, type: h.side === 'short' ? 'SHORT' : 'LONG',
            granularity: '', market: 'FUTURES', entry: h.entry, exit: h.exit, size: h.size,
            capitalInvested: (h.size || 0) * h.entry, grossPnl: gross, fees, funding, tax: 0,
            pnl: h.net != null ? Number(h.net) : gross - fees + funding,
            entryTime: h.opened_at || null, closedAt: h.closed_at || null, exitTime: h.closed_at || null, reason: 'BITGET'
        };
    });
}

export const journalTrades = () => (isRealMode() ? realHistory() : State.simState.history);

// --- Posizioni reali della modalità Reale: futures (account.positions_detail) e coin spot (account.spot_detail) ---
// Stesso formato per entrambe, così pagina Posizioni, Home e assistente le trattano allo stesso modo.
// key distingue lo stesso simbolo nei due mercati (es. SOL short sui futures e SOL comprato in spot).
export function realPositions() {
    const acc = realAccount();
    if (!acc || !acc.connected) return [];
    const fut = (acc.positions_detail || []).map(p => ({ ...p, market: 'futures', key: `futures:${p.symbol}` }));
    const spot = (acc.spot_detail || []).map(d => ({
        symbol: d.symbol, side: 'long', size: d.qty, entry: d.entry || null, mark: d.price, leverage: 1, margin: d.usdt,
        liq: null, tp: d.tp || null, sl: d.sl || null, upl: d.entry ? (d.price - d.entry) * d.qty : null,
        value: d.usdt, market: 'spot', key: `spot:${d.symbol}`
    }));
    return [...fut, ...spot];
}
export const findRealPosition = key => realPositions().find(p => p.key === key) || null;
