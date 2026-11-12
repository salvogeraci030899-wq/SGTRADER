import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { $, SYM, fetchT, calcEMA, analyzeTrend, buildRiskData, parseBitgetCandles, TF_MS, escapeHtml, fetchData } from '../utils/helpers.js';
import { LAB, LAB_ONLY, simulate as labSimulate, netPct } from '../core/labEngine.js';

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
// Candele già scaricate (stessa coin e timeframe) riusate per 10 minuti: la forza relativa ne chiede tre serie
const histCache = new Map();
async function fetchHistory(asset, tf, onProgress) {
    const key = `${asset}|${tf}`, hit = histCache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.candles;
    const candles = await fetchHistoryRaw(asset, tf, onProgress);
    histCache.set(key, { at: Date.now(), candles });
    return candles;
}
async function fetchHistoryRaw(asset, tf, onProgress) {
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
const APP_DESC = { breakout: 'Rottura a 20 candele con volume, RSI ed EMA200 (pagina Segnali).', mean_reversion: 'RSI sotto 35 vicino alla media a 200.', ma_crossover: 'EMA20 sopra EMA50 sopra EMA200.' };
const FAMILY_ORDER = ['trend', 'momentum', 'ritorno alla media', 'volatilità', 'forza relativa'];
const isLab = v => v.startsWith('lab:');
const labName = v => v.slice(4);
const stratLabel = v => (isLab(v) ? labName(v).replace(/_/g, ' ') : STRATEGY_LABEL[v] || v);

// --- Scelta della strategia: le 3 regole dell'app (SL/TP/Timer scelti da te) e tutte le strategie del
// laboratorio che l'app sa ricalcolare (uscite proprie, come nel Laboratorio). Elenco in una finestra.
let labSummary = null;
async function loadLabSummary() {
    if (labSummary) return labSummary;
    try { const r = await fetchData('lab_summary.json'); labSummary = r.ok ? await r.json() : null; } catch (e) { labSummary = null; }
    return labSummary;
}
function labLine(name, tf) {
    const r = labSummary && labSummary.results && labSummary.results[`${name}:${tf}`];
    if (!r || !(r.n > 0)) return 'non provata nel Laboratorio su questo timeframe';
    const tag = r.holdout ? (r.holdout.confirmed ? ' · confermata' : ' · bocciata alla prova finale') : (r.candidate ? ' · candidata' : '');
    return `Lab ${tf.toUpperCase()}, tutte le coin: ${r.n} trade, oltre il mercato ${r.excess_avg_pct >= 0 ? '+' : ''}${Number(r.excess_avg_pct).toFixed(2).replace('.', ',')}% a trade${tag}`;
}
export async function openBtStrategies() {
    $('btStratModal').classList.add('active');
    const box = $('btStratList'), cur = $('btStrategy').value, tf = $('btTF').value;
    const item = (v, title, sub) => `<button type="button" class="auto-add-item${v === cur ? ' bt-cur' : ''}" onclick="pickBtStrategy('${v}')"><span><b>${escapeHtml(title)}</b><br><small>${escapeHtml(sub)}</small></span><small>${v === cur ? 'scelta' : ''}</small></button>`;
    const render = () => {
        let html = '<div class="bt-group">Regole dell\'app · stop, target e durata li scegli tu</div>';
        html += Object.keys(STRATEGY_LABEL).map(k => item(k, STRATEGY_LABEL[k], APP_DESC[k])).join('');
        for (const fam of FAMILY_ORDER) {
            const names = Object.keys(LAB).filter(k => LAB[k].family === fam);
            if (!names.length) continue;
            html += `<div class="bt-group">Laboratorio · ${fam} · uscite proprie</div>`;
            html += names.map(k => item(`lab:${k}`, k.replace(/_/g, ' '), labLine(k, tf))).join('');
        }
        html += `<div class="bt-group">Solo nel Laboratorio (servono dati che l'app non ha)</div>`;
        html += Object.entries(LAB_ONLY).map(([k, why]) => `<div class="auto-add-item" aria-disabled="true" style="opacity:.45"><span><b>${escapeHtml(k.replace(/_/g, ' '))}</b><br><small>${escapeHtml(why)}</small></span></div>`).join('');
        box.innerHTML = html;
    };
    render();
    if (!labSummary) { await loadLabSummary(); render(); }
}
export function closeBtStrategies() { $('btStratModal').classList.remove('active'); }
export function pickBtStrategy(v) {
    if (!(STRATEGY_LABEL[v] || (isLab(v) && LAB[labName(v)]))) return;
    $('btStrategy').value = v;
    syncBtStrategy();
    closeBtStrategies();
}
export function syncBtStrategy() {
    const v = $('btStrategy').value, lab = isLab(v);
    $('btStrategyLabel').textContent = lab ? `${stratLabel(v)} · Laboratorio` : `${stratLabel(v)} · regola dell'app`;
    $('btParams').style.display = lab ? 'none' : '';
    const hint = $('btExitHint');
    hint.style.display = lab ? '' : 'none';
    if (lab) hint.textContent = LAB[labName(v)].desc;
}
const fmtPct = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
const fmtDay = ts => new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });

export async function runBacktestSingle() {
    if (isLab($('btStrategy').value)) return runLabBacktest();
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

// --- Strategia del laboratorio: stesso motore di strategy_lab.simulate, costi "futures taker" ---
async function runLabBacktest() {
    const btn = $('btnRunBt'), resultsDiv = $('btResults');
    const v = $('btStrategy').value, name = labName(v), spec = LAB[name];
    const asset = $('btAsset').value, tf = $('btTF').value, tfMs = TF_MS[tf];
    btn.disabled = true; btn.textContent = 'Download dati...';
    State.lastBacktestData = null;
    try {
        const candles = await fetchHistory(asset, tf, n => { btn.textContent = `Download dati... ${n}`; });
        if (candles.length < 600) throw new Error(`Dati insufficienti (${candles.length} candele): servono almeno 600 (300 per gli indicatori).`);
        // forza relativa: servono anche le altre due coin, sugli stessi tempi
        let ctx = {};
        if (spec.peers) {
            const peers = { [asset]: candles };
            for (const other of ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].filter(s2 => s2 !== asset)) {
                peers[other] = await fetchHistory(other, tf, n => { btn.textContent = `Download ${SYM(other)}... ${n}`; });
            }
            ctx = { symbol: asset, peers };
        }
        btn.textContent = 'Analisi in corso...';
        await new Promise(res => setTimeout(res, 20));
        await loadLabSummary();
        const raw = labSimulate(candles, tfMs, spec, ctx);
        // "oltre il mercato": a ogni trade si toglie quanto avrebbe reso la sola esposizione (come nel Laboratorio)
        const cl = candles.map(c => c.close);
        let mu = 0; for (let k = 301; k < cl.length; k++) mu += (cl[k] / cl[k - 1] - 1) * 100;
        mu /= Math.max(1, cl.length - 301);
        const trades = raw.map(t => ({ ...t, net: netPct(t, tfMs), excess: netPct(t, tfMs) - t.dir * t.bars * mu }));
        const startEquity = 1000;
        let equity = startEquity;
        trades.forEach(t => { equity *= 1 + t.net / 100; });
        const split = 300 + Math.floor((candles.length - 1 - 300) * 0.7);
        const st = list => statsFromRets(list.map(t => t.net / 100));
        const all = st(trades), train = st(trades.filter(t => t.i < split)), test = st(trades.filter(t => t.i >= split));
        const avgEx = trades.length ? trades.reduce((a, t) => a + t.excess, 0) / trades.length : 0;
        const bh = (cl[cl.length - 1] / cl[300] - 1) * 100;
        const totRet = (equity / startEquity - 1) * 100;
        const longs = trades.filter(t => t.dir > 0).length;
        State.lastBacktestData = { trades: trades.map(t => ({ entryTime: t.entryTime, exitTime: t.exitTime, entryPrice: t.entry, exitPrice: t.exit, net: t.net * 10, ret: t.net / 100, exitReason: t.reason, dir: t.dir })),
            asset, tf, strategy: name, lab: true };
        const row = (label, x) => `<tr><td>${label}</td><td>${x.n}</td><td>${x.n ? x.wr.toFixed(0) + '%' : '—'}</td>` +
            `<td class="${x.n ? (x.pf >= 1.2 ? 'text-accent' : 'text-danger') : ''}">${x.n ? x.pf.toFixed(2) : '—'}</td><td>${x.n ? fmtPct(x.avg, 2) : '—'}</td></tr>`;
        resultsDiv.innerHTML = `
            <div class="section-title">
                <span>Risultati</span>
                <span class="section-actions"><button class="btn-link-secondary" onclick="exportBacktestCSV()">CSV</button></span>
            </div>
            <div class="bt-meta">${SYM(asset)} · ${tf.toUpperCase()} · ${escapeHtml(stratLabel(v))} · ${candles.length} candele (${fmtDay(candles[0].ts)} – ${fmtDay(candles[candles.length - 1].ts)})</div>
            <div class="bt-tiles">
                <div class="bt-tile"><div class="s-label">Rendimento</div><div class="s-val ${totRet >= 0 ? 'text-accent' : 'text-danger'}">${fmtPct(totRet)}</div></div>
                <div class="bt-tile"><div class="s-label">Buy &amp; Hold</div><div class="s-val ${bh >= 0 ? 'text-accent' : 'text-danger'}">${fmtPct(bh)}</div></div>
                <div class="bt-tile"><div class="s-label">Trade</div><div class="s-val">${all.n}${all.n ? `<small> ${longs}L/${all.n - longs}S</small>` : ''}</div></div>
                <div class="bt-tile"><div class="s-label">Oltre mercato</div><div class="s-val ${avgEx >= 0 ? 'text-accent' : 'text-danger'}">${all.n ? fmtPct(avgEx, 2) : '—'}</div></div>
            </div>
            <table class="bt-table">
                <thead><tr><th>Periodo</th><th>N</th><th>WR</th><th>PF</th><th>Media</th></tr></thead>
                <tbody>${row('Totale', all)}${row('Train 70%', train)}${row('Test 30%', test)}</tbody>
            </table>
            <div class="bt-note lab-note">Netto per trade con i costi dei futures (0,11% per lato) e funding prudente sui long, uscite della strategia. ${escapeHtml(labLine(name, tf))}.</div>
            ${all.n === 0 ? `<div class="bt-note">Nessun trade: le condizioni non si sono verificate su ${SYM(asset)} ${tf.toUpperCase()}.</div>` : ''}`;
    } catch (e) {
        resultsDiv.innerHTML = `<div class="bt-error">Errore: ${String(e.message || e).replace(/[<>&]/g, '')}</div>`;
    } finally {
        btn.disabled = false; btn.textContent = 'Esegui Backtest';
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
    if (!d || d.lab) return;            // le strategie del laboratorio hanno uscite proprie (ATR), non SL/TP fissi
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
