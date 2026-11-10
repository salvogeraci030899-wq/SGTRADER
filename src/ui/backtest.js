import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { $, fetchT, calcEMA, analyzeTrend, buildRiskData } from '../utils/helpers.js';

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

export async function runBacktestSingle() {
    const btn = $('btnRunBt');
    const resultsDiv = $('btResults');
    const strategy = $('btStrategy').value;
    const asset = $('btAsset').value;
    const tf = $('btTF').value;
    const slPct = parseFloat($('btSL').value) / 100;
    const tpPct = parseFloat($('btTP').value) / 100;
    const timerH = parseFloat($('btTimer').value);
    btn.disabled = true;
    btn.textContent = 'Download dati...';
    resultsDiv.style.display = 'none';
    State.lastBacktestData = null;

    try {
        const gran = tf === '1d' ? '1day' : tf;
        let allCandles = [];
        let endTime = Date.now();
        for (let i=0; i<3; i++) {
            const r = await fetchT(`https://api.bitget.com/api/v2/spot/market/candles?symbol=${asset}&granularity=${gran}&limit=1000&endTime=${endTime}`);
            if (!r.ok) break;
            const j = await r.json();
            if (j.code !== '00000' || !j.data) break;
            const batch = j.data.reverse().map(c => ({ ts: parseInt(c[0]), open: parseFloat(c[1]), high: parseFloat(c[2]), low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5]) }));
            allCandles = batch.concat(allCandles);
            if (batch.length > 0) endTime = batch[0].ts - 1;
            await new Promise(r => setTimeout(r, 200));
        }
        if (allCandles.length < 500) throw new Error('Dati insufficienti.');
        btn.textContent = 'Analisi in corso...';
        const mpc = tf === '1h' ? 60 : (tf === '4h' ? 240 : 1440);
        const maxBars = Math.max(1, Math.round((timerH * 60) / mpc));
        const startIdx = 210;
        let equity = 1000;
        const trades = [];
        
        for (let i = startIdx; i < allCandles.length - maxBars - 1; i++) {
            const slice = allCandles.slice(Math.max(0, i - 300), i + 1);
            const price = allCandles[i].close;
            const closes = slice.map(c => c.close);
            const trend = analyzeTrend(slice, price);
            const riskData = buildRiskData(slice.slice(0, -1), price);
            let isSignal = false;
            if (strategy === 'breakout') {
                if (trend.direction === 'bullish' && trend.duration >= 2 && riskData.breakoutPass && trend.volRatio >= 1.5 && trend.rsi >= 55 && riskData.macroPass) isSignal = true;
            } else if (strategy === 'mean_reversion') {
                const ema200 = calcEMA(closes, 200);
                if (trend.rsi && trend.rsi < 35 && price > (ema200 * 0.95)) isSignal = true;
            } else if (strategy === 'ma_crossover') {
                const ema20 = calcEMA(closes, 20), ema50 = calcEMA(closes, 50), ema200 = calcEMA(closes, 200);
                if (ema20 > ema50 && price > ema50 && ema50 > ema200) isSignal = true;
            }
            if (isSignal) {
                const t = simulateTrade(allCandles, i, maxBars, slPct, tpPct, equity);
                equity += t.net;
                trades.push(t);
                i = t.exitBar;
            }
        }

        const splitIdx = startIdx + Math.floor((allCandles.length - 1 - startIdx) * 0.7);
        const trainRets = trades.filter(t => t.entryBar < splitIdx).map(t => t.ret);
        const testRets = trades.filter(t => t.entryBar >= splitIdx).map(t => t.ret);
        const statsAll = statsFromRets(trades.map(t => t.ret));
        const statsTrain = statsFromRets(trainRets);
        const statsTest = statsFromRets(testRets);
        const bh = (allCandles[allCandles.length-1].close / allCandles[startIdx].close - 1) * 100;
        
        State.lastBacktestData = { trades, asset, tf, strategy, equity, splitIdx };
        
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = `
            <div style="background:rgba(255,255,255,.03); padding:10px; border-radius:8px; margin-bottom:10px; border:1px solid var(--border);">
                <div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase; margin-bottom:6px;">Risultati su ${allCandles.length} candele</div>
                <div style="font-size:12px; color:var(--text); line-height:1.6;">
                    Capitale Finale: <b style="color:var(--accent);">${equity.toFixed(0)} USDT</b><br>
                    Trade Totali: <b>${statsAll.n}</b><br>
                    Buy & Hold: <b style="color:${bh >= 0 ? 'var(--accent)' : 'var(--danger)'};">${bh >= 0 ? '+' : ''}${bh.toFixed(1)}%</b>
                </div>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:center;">
                <thead><tr><th style="text-align:left; padding:6px; color:#8e8e93; font-size:10px;">Periodo</th><th style="padding:6px; color:#8e8e93; font-size:10px;">N</th><th style="padding:6px; color:#8e8e93; font-size:10px;">WR</th><th style="padding:6px; color:#8e8e93; font-size:10px;">PF</th><th style="padding:6px; color:#8e8e93; font-size:10px;">Media</th></tr></thead>
                <tbody>
                    <tr style="border-top:1px solid var(--border);"><td style="text-align:left; padding:8px;">Totale</td><td>${statsAll.n}</td><td>${statsAll.n ? statsAll.wr.toFixed(0)+'%' : '-'}</td><td style="color:${statsAll.pf>=1.2?'var(--accent)':'var(--danger)'};">${statsAll.pf.toFixed(2)}</td><td>${statsAll.avg.toFixed(2)}%</td></tr>
                    <tr style="border-top:1px solid var(--border);"><td style="text-align:left; padding:8px;">Train (70%)</td><td>${statsTrain.n}</td><td>${statsTrain.n ? statsTrain.wr.toFixed(0)+'%' : '-'}</td><td style="color:${statsTrain.pf>=1.2?'var(--accent)':'var(--danger)'};">${statsTrain.pf.toFixed(2)}</td><td>${statsTrain.avg.toFixed(2)}%</td></tr>
                    <tr style="border-top:1px solid var(--border);"><td style="text-align:left; padding:8px;">Test (30%)</td><td>${statsTest.n}</td><td>${statsTest.n ? statsTest.wr.toFixed(0)+'%' : '-'}</td><td style="color:${statsTest.pf>=1.2?'var(--accent)':'var(--danger)'};">${statsTest.pf.toFixed(2)}</td><td>${statsTest.avg.toFixed(2)}%</td></tr>
                </tbody>
            </table>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px;">
                <button style="background:var(--surface-hover); color:var(--text); border:none; padding:10px; border-radius:8px; width:100%; font-weight:700; font-size:12px; cursor:pointer;" onclick="applyBtParams(${slPct*100}, ${tpPct*100}, ${timerH})">Applica a Risk</button>
                <button style="background:var(--blue); color:#fff; border:none; padding:10px; border-radius:8px; width:100%; font-weight:700; font-size:12px; cursor:pointer;" onclick="exportBacktestCSV()">Esporta CSV</button>
            </div>
        `;
    } catch(e) {
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = `<div style="color:var(--danger); text-align:center; padding:10px;">Errore: ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Esegui Backtest (3000 candele)';
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

export function applyBtParams(sl, tp, timer) {
    if (window.switchTab) window.switchTab('calculator');
    if (window.showAlert) window.showAlert('Configurazione Backtest', `Usa SL: ${sl}%, TP: ${tp}%, Timer: ${timer}h.`);
}
