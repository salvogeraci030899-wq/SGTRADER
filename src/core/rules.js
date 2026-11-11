// --- REGOLE SULLE POSIZIONI (assistente in chat / voce) ---
// L'assistente IA propone un'azione strutturata; qui la si valida e la si trasforma in qualcosa di
// deterministico: un livello di prezzo che, se toccato, chiude la posizione, oppure un nuovo stop o
// target. L'IA non esegue mai nulla: le regole le controlla l'app, a ogni prezzo e nel recupero
// delle candele perse (stessa logica di stop e target).
// Modulo puro (nessun DOM): usato dall'app e dai test (tests/test_rules.mjs).

export const TAX_RATE = 0.33;
export const DEFAULT_FEE = 0.001;

const fin = v => typeof v === 'number' && Number.isFinite(v);
const dir = t => (t.type === 'SHORT' ? -1 : 1);
const feeOf = t => (t.feeRate > 0 ? t.feeRate : DEFAULT_FEE);

// PnL netto (fee di entrata e uscita, tasse solo sul guadagno) come in helpers.calcPnl
export function netPnlAt(t, price) {
    const gross = dir(t) * (price - t.entryPrice) * t.size;
    const before = gross - (t.entryPrice + price) * t.size * feeOf(t);
    return before > 0 ? before * (1 - TAX_RATE) : before;
}

// Prezzo al quale il PnL netto vale esattamente `target` USDT
export function priceForNetPnl(t, target) {
    const before = target > 0 ? target / (1 - TAX_RATE) : target;
    const f = feeOf(t), s = t.size, e = t.entryPrice;
    return t.type === 'SHORT'
        ? (e * (1 - f) - before / s) / (1 + f)
        : (before / s + e * (1 + f)) / (1 - f);
}

const round = (p, ref) => {
    const d = ref >= 1000 ? 1 : ref >= 10 ? 2 : 4;
    return Math.round(p * 10 ** d) / 10 ** d;
};

// Azioni ammesse dall'assistente (tutto il resto viene scartato)
const TYPES = ['close_at_pnl', 'close_at_price', 'set_stop', 'stop_breakeven', 'set_target', 'close_now', 'clear_rules'];

export function sanitizeAction(a) {
    if (!a || typeof a !== 'object' || !TYPES.includes(a.type)) return null;
    const out = { type: a.type };
    if (a.type === 'close_at_pnl') {
        const v = Number(a.value);
        if (!fin(v) || v === 0) return null;
        out.value = v;
        out.unit = a.unit === 'pct' ? 'pct' : 'usdt';
    }
    if (['close_at_price', 'set_stop', 'set_target'].includes(a.type)) {
        const p = Number(a.price);
        if (!fin(p) || p <= 0) return null;
        out.price = p;
    }
    return out;
}

const fmt = v => Number(v).toLocaleString('it-IT', { maximumFractionDigits: v >= 1000 ? 1 : 4 });
const signed = v => `${v > 0 ? '+' : ''}${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Traduce un'azione in una modifica concreta, con controlli di senso. Non modifica il trade.
// Ritorna { ok, error } oppure { ok: true, kind, ..., summary } da mostrare per la conferma.
export function planAction(t, action, price) {
    const a = sanitizeAction(action);
    if (!a) return { ok: false, error: 'Richiesta non riconosciuta.' };
    const long = t.type !== 'SHORT';
    const px = fin(price) && price > 0 ? price : t.entryPrice;
    const name = `${(t.symbol || '').replace('USDT', '')} ${t.type}`;
    switch (a.type) {
        case 'close_now':
            return { ok: true, kind: 'close_now', summary: `Chiudo subito ${name} al prezzo di mercato (PnL netto ora ${signed(netPnlAt(t, px))} USDT).` };
        case 'clear_rules':
            return (t.rules || []).length
                ? { ok: true, kind: 'clear_rules', summary: `Tolgo ${t.rules.length === 1 ? 'la regola attiva' : `le ${t.rules.length} regole attive`} su ${name}.` }
                : { ok: false, error: 'Su questa posizione non ci sono regole attive.' };
        case 'close_at_pnl': {
            const capital = t.margin > 0 ? t.margin : t.capitalInvested;
            const usdt = a.unit === 'pct' ? capital * a.value / 100 : a.value;
            if (!fin(usdt) || usdt === 0) return { ok: false, error: 'Importo non valido.' };
            const level = round(priceForNetPnl(t, usdt), px);
            if (!(level > 0)) return { ok: false, error: 'Con questa posizione quel risultato non è raggiungibile.' };
            const side = (usdt > 0) === long ? 'above' : 'below';
            const now = netPnlAt(t, px);
            if ((usdt > 0 && now >= usdt) || (usdt < 0 && now <= usdt)) {
                return { ok: false, error: `Il PnL netto è già ${signed(now)} USDT: se vuoi chiudere ora, chiedi di chiudere subito.` };
            }
            const what = a.unit === 'pct' ? `${signed(a.value)}% del capitale (${signed(usdt)} USDT)` : `${signed(usdt)} USDT`;
            return { ok: true, kind: 'rule', rule: { price: level, side, label: `PnL netto ${what}` },
                summary: `Chiudo ${name} quando il PnL netto arriva a ${what}: prezzo ${side === 'above' ? '≥' : '≤'} ${fmt(level)}.` };
        }
        case 'close_at_price': {
            const side = a.price >= px ? 'above' : 'below';
            return { ok: true, kind: 'rule', rule: { price: a.price, side, label: `prezzo ${side === 'above' ? '≥' : '≤'} ${fmt(a.price)}` },
                summary: `Chiudo ${name} quando il prezzo ${side === 'above' ? 'sale a' : 'scende a'} ${fmt(a.price)} (PnL netto lì: ${signed(netPnlAt(t, a.price))} USDT).` };
        }
        case 'set_stop':
        case 'stop_breakeven': {
            const stop = a.type === 'stop_breakeven' ? round(priceForNetPnl(t, 0), px) : a.price;
            if (long ? stop >= px : stop <= px) {
                return { ok: false, error: a.type === 'stop_breakeven'
                    ? `Il prezzo non ha ancora superato il pareggio (${fmt(stop)}, commissioni comprese): lo stop lì chiuderebbe subito.`
                    : `Uno stop ${long ? 'di un LONG va sotto' : 'di uno SHORT va sopra'} il prezzo attuale (${fmt(px)}).` };
            }
            return { ok: true, kind: 'set_stop', price: stop,
                summary: `Sposto lo stop di ${name} da ${fmt(t.slPrice)} a ${fmt(stop)}${a.type === 'stop_breakeven' ? ' (pareggio, commissioni comprese)' : ''}: lì il PnL netto sarebbe ${signed(netPnlAt(t, stop))} USDT.` };
        }
        case 'set_target': {
            if (long ? a.price <= px : a.price >= px) {
                return { ok: false, error: `Il target ${long ? 'di un LONG va sopra' : 'di uno SHORT va sotto'} il prezzo attuale (${fmt(px)}).` };
            }
            return { ok: true, kind: 'set_target', price: a.price,
                summary: `Sposto il target di ${name} da ${fmt(t.tpPrice)} a ${fmt(a.price)}: lì il PnL netto sarebbe ${signed(netPnlAt(t, a.price))} USDT.` };
        }
    }
    return { ok: false, error: 'Richiesta non riconosciuta.' };
}

// Una regola è toccata da un prezzo (tick) o da una candela (massimo/minimo)
export const ruleHitPrice = (rule, price) => (rule.side === 'above' ? price >= rule.price : price <= rule.price);
export const ruleHitCandle = (rule, high, low) => (rule.side === 'above' ? high >= rule.price : low <= rule.price);
