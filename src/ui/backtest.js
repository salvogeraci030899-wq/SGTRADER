import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { $, SYM, fetchT, calcEMA, analyzeTrend, buildRiskData, parseBitgetCandles, TF_MS } from '../utils/helpers.js';

function statsFromRets(rets) {
    const n = rets.length; const wins = rets.filter(r => r > 0), losses = rets.filter(r => r < 0);
    const gw = wins.reduce((a, r) => a + r, 0), gl = Math.abs(losses.reduce((a, r) => a + r, 0));
    return { n, wr: n ? (wins.length / n) * 100 : 0, pf: gl > 0 ? gw / gl : (gw > 0 ? 99 : 0), avg: n ? (rets.reduce((a, r) => a + r, 0) / n) * 100 : 0 };
}

function simulateTrade(candles, i, maxBars, slPct, tpPct, equity) {
    const entry = candles[i + 1].open;
    const entryTime = candles[i + 1].ts;
    const slPrice = entry * (1 - slPct), tpPrice = entry * (1 + tpPct);
    let exitPrice = null, exitReason = null, exitBar = null;
    for (let j = i + 1; j < Math.min(i + 1 + maxBars, candles.length); j++) {
        const c = candles[j];
        if (c.low <= slPrice) { exitPrice = slPrice; exitReason = 'SL'; exitBar = j; break; }
        if (c.high >= tpPrice) { exitPrice = tpPrice; exitReason = 'TP'; exitBar = j; break; }
    }
    if (!exitPrice) { exitBar = Math.min(i + maxBars, candles.length - 1); exitPrice = candles[exitBar].close; exitReason = 'TEMPO'; }
    const exitTime = candles[exitBar].ts;
    const size = equity / entry;
    const gross = (exitPrice - entry) * size;
    const fees = equity * CONFIG.FEE_RATE + (equity + gross) * CONFIG.FEE_RATE;
    const beforeTax = gross - fees;
    const net = beforeTax - (beforeTax > 0 ? beforeTax * CONFIG.TAX_RATE : 0);
    return { net, ret: net / equity, exitReason, exitBar, entryBar: i, entryPrice: entry, exitPrice, entryTime, exitTime };
}

const TARGET_CANDLES = 3000;
const PAGE_LIMIT = 1000;

// Storico Bitget a blocchi da 1000, andando indietro nel tempo. Ogni blocco chiede le candele
// precedenti alla più vecchia già ricevuta (qualunque sia l'ordine della risposta); ci si ferma
// quando non arrivano candele più vecchie. Solo candele chiuse, in ordine cronologico, senza doppioni.
async function fetchHistory(asset, tf, onProgress) {
    const gran = tf === '1d' ? '1day' : tf;
    const byTs = new Map();
    let endTime = Date.now();
    for (let page = 0; page < Math.ceil(TARGET_CANDLES / PAGE_LIMIT) + 1 && byTs.size < TARGET_CANDLES; page++) {
        const r = await fetchT(`https://api.bitget.com/api/v2/spot/market/candles?symbol=${asset}&granularity=${gran}&limit=${PAGE_LIMIT}&endTime=${endTime}`, 10000);
        if (!r.ok) throw new Error(`Bitget ha risposto ${r.status}`);
        const j = await r.json();
        if (j.code !== '00000' || !Array.isArray(j.data)) throw new Error(j.msg || 'Risposta Bitget non valida');
        const batch = parseBitgetCandles(j.data);
        const before = byTs.size;
        batch.forEach(c => byTs.set(c.ts, c));
        if (batch.length === 0 || byTs.size === before) break;     // niente di più vecchio
        endTime = batch[0].ts - 1;                                   // batch ordinato: [0] è la più vecchia
        if (onProgress) onProgress(byTs.size);
        await new Promise(res => setTimeout(res, 150));
    }
    const tfMs = TF_MS[tf];
    return [...byTs.values()].sort((a, b) => a.ts - b.ts).filter(c => c.ts + tfMs <= Date.now()).slice(-TARGET_CANDLES);
}

function isSignal(strategy, slice, price) {
    const closes = slice.map(c => c.close);
    const trend = analyzeTrend(slice, price);
    if (strategy === 'breakout') {
        const riskData = buildRiskData(slice.slice(0, -1), price);
        return trend.direction === 'bullish' && trend.duration >= 2 && riskData.breakoutPass && trend.volRatio >= 1.5 && trend.rsi >= 55 && riskData.macroPass;
    }
    if (strategy === 'mean_reversion') {
        return !!trend.rsi && trend.rsi < 35 && price > calcEMA(closes, 200) * 0.95;
    }
    if (strategy === 'ma_crossover') {
        const ema20 = calcEMA(closes, 20), ema50 = calcEMA(closes, 50), ema200 = calcEMA(closes, 200);
        return ema20 > ema50 && price > ema50 && ema50 > ema200;
    }
    return false;
}

const STRATEGY_LABEL = { breakout: 'Breakout', mean_reversion: 'Mean Rev.', ma_crossover: 'MA Cross' };
const fmtPct = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
const fmtDay = ts => new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });

export async function runBacktestSingle() {
    const btn = $('btnRunBt');
    const resultsDiv = $('btResults');
    const strategy = $('btStrategy').value;
    const asset = $('btAsset').value;
    const tf = $('btTF').value;
    const slPct = parseFloat($('btSL').value) / 100;
    const tpPct = parseFloat($('btTP').value) / 100;
    const timerH = parseFloat($('btTimer').value);
    if (!(slPct > 0) || !(tpPct > 0) || !(timerH > 0)) {
        resultsDiv.innerHTML = `<div class="bt-error">SL, TP e Timer devono essere maggiori di zero.</div>`;
        return;
    }
    btn.disabled = true;
    btn.textContent = 'Download dati...';
    State.lastBacktestData = null;

    try {
        const candles = await fetchHistory(asset, tf, n => { btn.textContent = `Download dati... ${n}`; });
        if (candles.length < 500) throw new Error(`Dati insufficienti (${candles.length} candele).`);
        btn.textContent = 'Analisi in corso...';
        await new Promise(res => setTimeout(res, 20)); // lascia aggiornare il testo del pulsante

        const mpc = { '1h': 60, '4h': 240, '1d': 1440 }[tf];
        const maxBars = Math.max(1, Math.round((timerH * 60) / mpc));
        const startIdx = 210;                        // servono ~200 candele per l'EMA200
        const startEquity = 1000;
        let equity = startEquity;
        const trades = [];

        // Segnale sulla chiusura della candela i, ingresso all'apertura della successiva
        for (let i = startIdx; i < candles.length - maxBars - 1; i++) {
            const slice = candles.slice(Math.max(0, i - 300), i + 1);
            if (!isSignal(strategy, slice, candles[i].close)) continue;
            const t = simulateTrade(candles, i, maxBars, slPct, tpPct, equity);
            equity += t.net;
            trades.push(t);
            i = t.exitBar;                           // un trade alla volta
        }

        const splitIdx = startIdx + Math.floor((candles.length - 1 - startIdx) * 0.7);
        const all = statsFromRets(trades.map(t => t.ret));
        const train = statsFromRets(trades.filter(t => t.entryBar < splitIdx).map(t => t.ret));
        const test = statsFromRets(trades.filter(t => t.entryBar >= splitIdx).map(t => t.ret));
        const bh = (candles[candles.length - 1].close / candles[startIdx].close - 1) * 100;
        const totRet = (equity / startEquity - 1) * 100;

        State.lastBacktestData = { trades, asset, tf, strategy, equity, splitIdx, slPct, tpPct, timerH, lastClose: candles[candles.length - 1].close };

        const row = (label, st) => `<tr><td>${label}</td><td>${st.n}</td><td>${st.n ? st.wr.toFixed(0) + '%' : '—'}</td>` +
            `<td class="${st.n ? (st.pf >= 1.2 ? 'text-accent' : 'text-danger') : ''}">${st.n ? st.pf.toFixed(2) : '—'}</td><td>${st.n ? fmtPct(st.avg, 2) : '—'}</td></tr>`;
        resultsDiv.innerHTML = `
            <div class="section-title">
                <span>Risultati</span>
                <span class="section-actions">
                    <button class="btn-link-secondary" onclick="applyBtParams()">Applica a Rischio</button>
                    <button class="btn-link-secondary" onclick="exportBacktestCSV()">CSV</button>
                </span>
            </div>
            <div class="bt-meta">${SYM(asset)} · ${tf.toUpperCase()} · ${STRATEGY_LABEL[strategy]} · ${candles.length} candele (${fmtDay(candles[0].ts)} – ${fmtDay(candles[candles.length - 1].ts)})</div>
            <div class="bt-tiles">
                <div class="bt-tile"><div class="s-label">Rendimento</div><div class="s-val ${totRet >= 0 ? 'text-accent' : 'text-danger'}">${fmtPct(totRet)}</div></div>
                <div class="bt-tile"><div class="s-label">Buy &amp; Hold</div><div class="s-val ${bh >= 0 ? 'text-accent' : 'text-danger'}">${fmtPct(bh)}</div></div>
                <div class="bt-tile"><div class="s-label">Trade</div><div class="s-val">${all.n}</div></div>
                <div class="bt-tile"><div class="s-label">Win rate</div><div class="s-val">${all.n ? all.wr.toFixed(0) + '%' : '—'}</div></div>
            </div>
            <table class="bt-table">
                <thead><tr><th>Periodo</th><th>N</th><th>WR</th><th>PF</th><th>Media</th></tr></thead>
                <tbody>${row('Totale', all)}${row('Train 70%', train)}${row('Test 30%', test)}</tbody>
            </table>
            ${all.n === 0 ? `<div class="bt-note">Nessun segnale in questo periodo: le condizioni di ${STRATEGY_LABEL[strategy]} non si sono mai verificate su ${SYM(asset)} ${tf.toUpperCase()}. Prova un altro timeframe o un'altra strategia.</div>` : ''}`;
    } catch (e) {
        resultsDiv.innerHTML = `<div class="bt-error">Errore: ${String(e.message || e).replace(/[<>&]/g, '')}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Esegui Backtest';
    }
}

export function exportBacktestCSV() {
    if (!State.lastBacktestData || !State.lastBacktestData.trades.length) { 
        if (window.showAlert) window.showAlert('Esporta CSV', 'Nessun trade simulato.'); 
        return; 
    }
    const { trades, asset, tf, strategy } = State.lastBacktestData;
    let csv = 'N,EntryTime,ExitTime,EntryPrice,ExitPrice,PnL_USDT,PnL_Pct,Reason\n';
    trades.forEach((t, idx) => { 
        csv += `${idx + 1},${new Date(t.entryTime).toISOString()},${new Date(t.exitTime).toISOString()},${t.entryPrice.toFixed(2)},${t.exitPrice.toFixed(2)},${t.net.toFixed(2)},${(t.ret * 100).toFixed(2)},${t.exitReason}\n`; 
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kronos_backtest_${asset}_${tf}_${strategy}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}

// Porta SL e TP del backtest nel calcolatore Rischio: entry al prezzo attuale (o all'ultima
// chiusura del backtest), LONG e Spot come nella simulazione.
export function applyBtParams() {
    const d = State.lastBacktestData;
    if (!d) return;
    const entry = State.livePx[d.asset] || d.lastClose;
    const nd = entry >= 10 ? 2 : 4;
    State.calcContext = { asset: d.asset, tf: d.tf };
    if (window.setMarket) window.setMarket('SPOT');
    window.setCalcDirection('LONG');
    $('calcEntry').value = entry.toFixed(nd);
    $('calcStop').value = (entry * (1 - d.slPct)).toFixed(nd);
    $('calcTarget').value = (entry * (1 + d.tpPct)).toFixed(nd);
    if (window.setCtxLabel) window.setCtxLabel();
    if (window.switchTab) window.switchTab('calculator');
    if (window.calc) window.calc();
    if (window.updateCalcHints) window.updateCalcHints();
}
