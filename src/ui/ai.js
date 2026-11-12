import { State } from '../core/state.js';
import { $, SYM, fetchT, apiPost, escapeHtml, calcPnl, parseBitgetCandles } from '../utils/helpers.js';
import { aggregateCellSignals } from './signals.js';
import * as Terminal from './terminal.js';

// --- ANALISI AI IN TEMPO REALE ---
// Al tocco raccoglie i dati del momento: prezzo live, candele 1d/4h/1h da Bitget, funding e open
// interest dei futures, consenso delle regole tecniche e piano Kronos. Il server (src/core/commands.js)
// calcola gli indicatori e chiede a un modello Groq un'analisi strutturata. È un'opinione: nessuno
// di questi dati ha un vantaggio dimostrato, e il testo lo dice.

const GRAN = { '1d': '1day', '4h': '4h', '1h': '1h' };

async function candles(symbol, tf) {
    try {
        const r = await fetchT(`https://api.bitget.com/api/v2/spot/market/candles?symbol=${symbol}&granularity=${GRAN[tf]}&limit=220`, 10000);
        if (!r.ok) return [];
        const j = await r.json();
        return parseBitgetCandles(j.data).map(c => [c.ts, c.open, c.high, c.low, c.close, c.volume]);
    } catch (e) { return []; }
}

async function livePrice(symbol) {
    try {
        const r = await fetchT(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${symbol}`);
        const j = await r.json();
        const px = parseFloat(j && j.data && j.data[0] && j.data[0].lastPr);
        if (isFinite(px)) { State.livePx[symbol] = px; return px; }
    } catch (e) { /* si usa l'ultimo noto */ }
    return State.livePx[symbol] || null;
}

function openModal(title) {
    $('aiAnalysisTitle').textContent = title;
    const badge = $('aiAnalysisBadge');
    badge.textContent = 'Raccolta dati…';
    badge.className = 'be-badge warn';
    $('aiAnalysisBody').innerHTML = `<div class="ai-loading"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span>Prezzi live, candele 1d/4h/1h, futures…</span></div>`;
    $('aiAnalysisModal').classList.add('active');
}

// Titoli in maiuscolo ("QUADRO:") in grassetto, il resto come testo
function render(text, model, at) {
    const html = escapeHtml(text)
        .replace(/^(QUADRO|LIVELLI|MOMENTUM E RISCHIO|SCENARI|AZIONE):/gm, '<b class="ai-h">$1</b>')
        .replace(/\n/g, '<br>');
    return `${html}<div class="ai-foot">Dati delle ${at} · modello ${escapeHtml(model || '—')} · opinione non validata, non un consiglio finanziario</div>`;
}

// Raccolta dei dati e richiesta al server: usata dalla finestra di analisi (Grafici) e dall'assistente.
// onStep(testo) segnala l'avanzamento. Ritorna { analysis, model, at } oppure lancia un errore.
export async function fetchAnalysis({ symbol, tf, trade = null }, onStep = () => {}) {
    const [price, d1, h4, h1] = await Promise.all([livePrice(symbol), candles(symbol, '1d'), candles(symbol, '4h'), candles(symbol, '1h')]);
    if (!d1.length && !h4.length && !h1.length) throw new Error('Bitget non risponde: impossibile leggere le candele live.');
    const fut = Terminal.getFutures ? Terminal.getFutures(symbol) : null;
    const agg = aggregateCellSignals(symbol, tf);
    const kronos = State.allData && State.allData[`${symbol}_${tf}`];
    const px = price || (trade && (trade.currentPrice || trade.entryPrice));
    const payload = {
        symbol, timeframe: tf, type: trade ? trade.type : 'NONE', currentPrice: px,
        candles: { '1d': d1, '4h': h4, '1h': h1 },
        futures: fut ? { funding_rate_pct: fut.funding_rate_pct, oi_change_24h_pct: fut.open_interest_change_24h_pct, long_positions_pct: fut.long_positions_pct } : {},
        consensus: agg ? { direction: agg.consensus, agreement: agg.agreement } : {},
        ai_plan: kronos && kronos.ai_plan ? { bias: kronos.ai_plan.bias, prob_up: kronos.prob_up } : {}
    };
    if (trade) Object.assign(payload, {
        entry: trade.entryPrice, stop: trade.slPrice, take: trade.tpPrice, leverage: trade.leverage || 1,
        // posizione reale: PnL di Bitget al prezzo mark (stima live), senza tasse; ora di apertura non nota
        pnl: Number((trade.real ? trade.pnl : calcPnl(trade, px || trade.entryPrice).net).toFixed(2)),
        hours_open: trade.entryTime ? Number(((Date.now() - trade.entryTime) / 3600e3).toFixed(1)) : null,
        ...(trade.real ? { real: true } : {})
    });
    onStep('L\'IA sta analizzando…');
    const res = await apiPost('/api/analyze', payload);
    const raw = await res.text();
    let out;
    try { out = JSON.parse(raw); } catch (e) { throw new Error(`Risposta non valida dal server (HTTP ${res.status}).`); }
    if (!res.ok) throw new Error(out.error || 'Errore durante l\'analisi');
    return { analysis: out.analysis, model: out.model, at: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) };
}
export const renderAnalysis = out => render(out.analysis, out.model, out.at);

export async function runAIAnalysis({ symbol, tf, trade = null }) {
    openModal(`Analisi AI: ${SYM(symbol)} ${trade ? trade.type : tf.toUpperCase()}`);
    const badge = $('aiAnalysisBadge');
    try {
        const out = await fetchAnalysis({ symbol, tf, trade }, t => { badge.textContent = t; });
        badge.textContent = 'Completata';
        badge.className = 'be-badge good';
        $('aiAnalysisBody').innerHTML = renderAnalysis(out);
    } catch (err) {
        badge.textContent = 'Errore';
        badge.className = 'be-badge bad';
        $('aiAnalysisBody').innerHTML = `<div class="text-danger"><b>Impossibile completare:</b><br>${escapeHtml(err.message)}</div>`;
    }
}

// Dai Grafici: coin e timeframe mostrati, senza posizione
export function requestMarketAnalysis() {
    return runAIAnalysis({ symbol: State.currentAsset, tf: State.currentTF });
}
