import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { Logger } from '../core/logger.js';
import { $, SYM, fetchT, apiPost, fmtUsd, cleanData, analyzeTrend, buildRiskData, calcEMA, fmtDateTime, parseBitgetCandles } from '../utils/helpers.js';
import { createChart, setCandles, setForecast, setBands, setMarkers, setPriceLines } from './chart.js';

const chartContainer = document.getElementById('chart');
const mainChartContainer = document.getElementById('mainChartContainer');
let chartHandle = null;
let currentAtrPct = 0;
let techData = { trend: null, riskData: null, ema20: 0, ema50: 0, ema200: 0, price: 0 };

// --- TIMEFRAME HELPER ---
function getTFLabel(tf) {
    return ({ '1d': '1D', '4h': '4H', '1h': '1H' })[tf] || tf;
}

// --- INIZIALIZZAZIONE ---
export function initTerminal() {
    try { initChart(); } catch (e) { Logger.log('ERROR', 'TERMINAL', 'Errore chart init', e); }
    loadData();
    startPricePoll();
    setInterval(loadData, 120000);
    initRefreshState();
    loadTechData();
}

function initChart() {
    if (chartHandle) chartHandle.destroy();
    chartHandle = createChart(chartContainer, {
        bgColor: '#0a0a0a',
        textColor: '#8e8e93',
        gridColor: '#1c1c1e',
        showForecast: true,
        showBands: true,
        interactive: true
    });
    // Il grafico segue sempre la misura reale del contenitore (cambio tab, barra di Safari,
    // altezza dello schermo che si assesta all'avvio della PWA, pannelli che cambiano altezza)
    if (chartContainer && 'ResizeObserver' in window && !initChart.observer) {
        initChart.observer = new ResizeObserver(() => resizeChart());
        initChart.observer.observe(chartContainer);
    }
}

// --- CHART ACTIONS ---
export function toggleFullscreenChart() {
    const isFullscreen = mainChartContainer.classList.toggle('fullscreen');
    document.body.classList.toggle('chart-fullscreen', isFullscreen);
    const btn = document.getElementById('btnFullscreen');
    if (isFullscreen) btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`;
    else btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
    setTimeout(() => {
        if (chartHandle) {
            chartHandle.resize();
            chartHandle.fitContent();
        }
    }, 50);
}

export async function takeSnapshot(btn) {
    btn.style.opacity = '0.5';
    btn.disabled = true;
    document.body.classList.add('snapshot-mode');
    try {
        await new Promise(r => setTimeout(r, 300));
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        const targetEl = document.getElementById('page-terminal');
        const canvas = await html2canvas(targetEl, {
            backgroundColor: '#000000', scale: 3, useCORS: true, allowTaint: true, logging: false,
            onclone: (clonedDoc) => {
                clonedDoc.querySelectorAll('*').forEach(el => {
                    el.style.backdropFilter = 'none';
                    el.style.webkitBackdropFilter = 'none';
                    el.style.opacity = '1';
                });
            }
        });
        const imgData = canvas.toDataURL('image/png');
        const blob = await (await fetch(imgData)).blob();
        const fileName = `kronos_${new Date().toISOString().slice(0,19).replace(/[:T]/g, '-')}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Kronos Grafici',
                    text: `${State.currentAsset.replace('USDT','')} · ${getTFLabel(State.currentTF)}`
                });
                return;
            } catch (shareErr) { if (shareErr.name === 'AbortError') return; }
        }
        const link = document.createElement('a');
        link.href = imgData;
        link.download = fileName;
        link.click();
    } catch (err) {
        if (window.showAlert) window.showAlert("Errore", "Snapshot fallito: " + err.message);
    } finally {
        btn.style.opacity = '1';
        btn.disabled = false;
        document.body.classList.remove('snapshot-mode');
    }
}

// --- DATA FETCHING ---
// --- TRACK RECORD (affidabilità di Kronos, da track_record_summary.json scritto dal bot) ---
let trSummary = null;

async function loadTrackRecord() {
    try {
        const r = await fetch('./track_record_summary.json?t=' + Date.now());
        trSummary = r.ok ? await r.json() : null;
    } catch (e) { trSummary = null; }
    renderTrackRecord();
}

const TF_HOURS = { '1h': 1, '4h': 4, '1d': 24 };
const MIN_SAMPLE = 30; // sotto questa soglia le statistiche non dicono nulla
const fmtSigned = (v, d = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;

function trItem(label, value, cls) {
    return `<div class="filter-item ${cls}"><span class="f-label">${label}</span><span class="f-val">${value}</span></div>`;
}

// Mostra, per la coppia selezionata, quanto sono state affidabili le previsioni già verificate.
// Finché non ci sono previsioni chiuse lo dice chiaramente: nessun numero inventato.
export function renderTrackRecord() {
    const grid = document.getElementById('trGrid'), foot = document.getElementById('trFoot'), badge = document.getElementById('tr-badge');
    if (!grid || !foot || !badge) return;
    const key = `${State.currentAsset}_${State.currentTF}`;
    const pair = trSummary && trSummary.by_pair && trSummary.by_pair[key];
    const pred = pair && pair.predictions;
    const open = pair ? pair.open || 0 : 0;
    const horizonH = (trSummary ? trSummary.horizon_candles : 7) * (TF_HOURS[State.currentTF] || 1);
    if (!pred || !pred.n) {
        badge.textContent = 'In raccolta';
        grid.innerHTML = '';
        foot.textContent = trSummary
            ? `Nessuna previsione ${SYM(State.currentAsset)} ${State.currentTF.toUpperCase()} ancora verificata (${open} in attesa). Ogni previsione si verifica dopo ${horizonH >= 24 ? Math.round(horizonH / 24) + ' giorni' : horizonH + ' ore'}.`
            : 'Track record non ancora disponibile: verrà creato dal bot alle prossime esecuzioni.';
        return;
    }
    badge.textContent = `${pred.n} ${pred.n === 1 ? 'verificata' : 'verificate'}`;
    const trd = pair.tradeable_signals || { n: 0 };
    const hit = pred.direction_hit_rate;
    const brierOk = pred.brier < pred.brier_baseline;
    grid.innerHTML =
        trItem('Direzione', hit == null ? '—' : `${hit.toFixed(0)}%`, hit == null ? 'neutral' : (hit > 50 ? 'pass' : 'fail')) +
        trItem('Prob. vs caso', brierOk ? 'Meglio' : 'Peggio', brierOk ? 'pass' : 'fail') +
        trItem('Operativi', trd.n ? `${trd.n} · WR ${trd.win_rate.toFixed(0)}%` : '0', 'neutral') +
        trItem('Netto medio', trd.n ? fmtSigned(trd.avg_net_pct) : '—', !trd.n ? 'neutral' : (trd.avg_net_pct > 0 ? 'pass' : 'fail'));
    const since = trSummary.since ? new Date(trSummary.since).toLocaleDateString('it-IT') : '—';
    const small = pred.n < MIN_SAMPLE ? `Campione ancora piccolo (${pred.n}/${MIN_SAMPLE}): numeri non affidabili. ` : '';
    foot.textContent = `${small}Dal ${since} · ${open} in attesa · netto di commissioni, slippage e tasse · Brier ${pred.brier.toFixed(3)} (caso ${pred.brier_baseline.toFixed(3)})`;
    foot.classList.toggle('text-warning', !!small);
}

// --- VALIDAZIONE STORICA (validation_summary.json, scritto dal workflow "Validazione Kronos") ---
// Stesse misure del track record, ma su mesi di storico fuori campione e con intervalli di
// confidenza: un vantaggio è "dimostrato" solo se l'intero intervallo sta dalla parte giusta.
let valSummary = null;
let valLoaded = false;

async function loadValidation() {
    try {
        const r = await fetch('./validation_summary.json?t=' + Date.now());
        valSummary = r.ok ? await r.json() : null;
    } catch (e) { valSummary = null; }
    valLoaded = true;
    renderValidation();
}

const VERDICT_LABEL = { positivo: 'Vantaggio dimostrato', negativo: 'Svantaggio dimostrato', non_dimostrato: 'Vantaggio non dimostrato', campione_insufficiente: 'Campione insufficiente' };
const VERDICT_CLASS = { positivo: 'pass', negativo: 'fail', non_dimostrato: 'neutral', campione_insufficiente: 'neutral' };

export function renderValidation() {
    const grid = document.getElementById('valGrid'), foot = document.getElementById('valFoot'), badge = document.getElementById('val-badge');
    if (!grid || !foot || !badge) return;
    const pair = valSummary && valSummary.by_pair && valSummary.by_pair[`${State.currentAsset}_${State.currentTF}`];
    foot.classList.remove('text-warning');
    if (!pair || !pair.n) {
        badge.textContent = '—';
        grid.innerHTML = '';
        foot.textContent = !valLoaded ? 'Validazione in caricamento…'
            : `Validazione storica ${SYM(State.currentAsset)} ${State.currentTF.toUpperCase()} non ancora disponibile: va calcolata con il workflow "Validazione Kronos".`;
        return;
    }
    const d = pair.direction, plan = pair.strategies.kronos_plan;
    badge.textContent = `${pair.n} previsioni`;
    const range = ci => ci ? `${ci[0].toFixed(2)} / ${ci[1].toFixed(2)}%` : 'n/d';
    grid.innerHTML =
        trItem('Direzione', d.hit_rate == null ? '—' : `${d.hit_rate.toFixed(0)}%`, VERDICT_CLASS[d.verdict_direction]) +
        trItem('Prob. vs caso', { positivo: 'Meglio', negativo: 'Peggio' }[d.verdict_probability] || 'Incerto', VERDICT_CLASS[d.verdict_probability]) +
        trItem('Operativi', plan.n ? `${plan.n} · WR ${plan.win_rate.toFixed(0)}%` : '0', 'neutral') +
        trItem('Netto medio', plan.n ? fmtSigned(plan.avg_net_pct) : '—', VERDICT_CLASS[plan.verdict]);
    const from = new Date(pair.from * 1000).toLocaleDateString('it-IT');
    const mom = d.momentum_hit_rate == null ? '' : ` · momentum ${d.momentum_hit_rate.toFixed(0)}%`;
    foot.textContent = `${VERDICT_LABEL[pair.verdict]} · dal ${from}${mom} · netto costi e tasse, intervallo 95%: ${plan.n ? range(plan.avg_net_ci) : 'n/d'}`;
    foot.classList.toggle('text-warning', pair.verdict !== 'positivo');
}

// --- FUTURES (futures_data.json, scritto dal bot una volta per ora) ---
// Funding, open interest, long/short e premio dei futures USDT di Bitget per la coin selezionata.
// Solo informativi: non entrano ancora nei segnali, quindi nessun colore verde/rosso.
let futData = null;
let futLoaded = false;

async function loadFutures() {
    try {
        const r = await fetch('./futures_data.json?t=' + Date.now());
        futData = r.ok ? await r.json() : null;
    } catch (e) { futData = null; }
    futLoaded = true;
    renderFutures();
}

function fmtUsdCompact(v) {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    return `$${Math.round(v).toLocaleString('en-US')}`;
}

export function renderFutures() {
    const grid = document.getElementById('futGrid'), foot = document.getElementById('futFoot'), badge = document.getElementById('fut-badge');
    if (!grid || !foot || !badge) return;
    const f = futData && futData.symbols && futData.symbols[State.currentAsset];
    if (!f) {
        badge.textContent = '—';
        grid.innerHTML = '';
        foot.textContent = !futLoaded ? 'Dati futures in caricamento…'
            : `Dati futures ${SYM(State.currentAsset)} non ancora disponibili: il bot li raccoglie una volta per ora.`;
        return;
    }
    const has = v => v !== null && v !== undefined;
    badge.textContent = `${SYM(State.currentAsset)} perpetuo`;
    const every = has(f.funding_interval_h) ? ` ogni ${f.funding_interval_h} h` : '';
    grid.innerHTML =
        trItem('Funding', has(f.funding_rate_pct) ? fmtSigned(f.funding_rate_pct, 4) : '—', 'neutral') +
        trItem('Open int.', has(f.open_interest_usd) ? fmtUsdCompact(f.open_interest_usd) : '—', 'neutral') +
        trItem('Long/Short', has(f.long_pct) ? `${f.long_pct.toFixed(0)} / ${f.short_pct.toFixed(0)}%` : '—', 'neutral') +
        trItem('Premio', has(f.premium_pct) ? fmtSigned(f.premium_pct, 3) : '—', 'neutral');
    const when = new Date(f.t * 1000).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const oi = has(f.open_interest_change_24h_pct) ? ` · open interest 24 h ${fmtSigned(f.open_interest_change_24h_pct, 1)}` : '';
    foot.textContent = `Bitget, ${when} · funding${every}: positivo = i long pagano gli short${oi} · solo informativi, non usati nei segnali`;
}

export async function loadData() {
    try {
        const res = await fetch('./dashboard.json?t=' + Date.now());
        State.allData = await res.json();
        updateChart();
        loadTrackRecord();
        loadValidation();
        loadFutures();
        if (window.refreshKronosSignalsInMatrix) window.refreshKronosSignalsInMatrix();
    } catch (e) {
        State.lastHeaderPrice = null;
        document.getElementById('live-price').textContent = "Err";
        document.getElementById('last-update-footer').textContent = "Ultimo agg: Errore di rete";
    }
}

export function updateChart() {
    renderTrackRecord();
    renderValidation();
    renderFutures();
    if (!State.allData) return;
    const data = State.allData[`${State.currentAsset}_${State.currentTF}`];
    if (!data) {
        State.lastHeaderPrice = null;
        $('live-price').textContent = "N/D";
        $('ai-panel').style.display = 'none';
        State.currentAIPlan = null;
        $('last-update-footer').textContent = "Ultimo agg: N/D";
        if (chartHandle) {
            setCandles(chartHandle, []);
            setForecast(chartHandle, []);
            setBands(chartHandle, [], []);
        }
        State.candleTimes = [];
        updateCalcBtnUI();
        updatePriceLines();
        return;
    }

    setHeaderPrice(State.livePx[State.currentAsset] || data.current_price);
    if (data.last_update) {
        const d = new Date(data.last_update);
        $('last-update-footer').textContent = `Ultimo agg: ${d.toLocaleDateString('it-IT')} - ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
        const refreshTs = parseInt(localStorage.getItem('kronos_refresh_start_ts') || '0', 10);
        if (refreshTs > 0 && d.getTime() > refreshTs) {
            localStorage.removeItem('kronos_refresh_start_ts');
            const btn = $('btn-refresh');
            if (btn && btn.disabled) {
                if (State.refreshTimerInterval) clearInterval(State.refreshTimerInterval);
                btn.innerHTML = CONFIG.ICONS.CHECK;
                setTimeout(() => { if (btn.innerHTML === CONFIG.ICONS.CHECK) { btn.innerHTML = CONFIG.ICONS.REFRESH; btn.disabled = false; } }, 1500);
            }
        }
    }

    if (data.ai_plan && !data.ai_plan.error) {
        $('ai-panel').style.display = 'block';
        State.currentAIPlan = data.ai_plan;
        const aiBias = $('ai-bias');
        aiBias.textContent = (State.currentAIPlan.bias !== 'NEUTRO' && State.currentAIPlan.tradeable === false) ? `${State.currentAIPlan.bias} · R/R basso` : State.currentAIPlan.bias;
        aiBias.style.color = State.currentAIPlan.bias === 'LONG' ? 'var(--accent)' : (State.currentAIPlan.bias === 'SHORT' ? 'var(--danger)' : 'var(--warning)');
        $('ai-entry').textContent = State.currentAIPlan.entry ? fmtUsd(State.currentAIPlan.entry) : '-';
        $('ai-sl').textContent = State.currentAIPlan.stop_loss ? fmtUsd(State.currentAIPlan.stop_loss) : '-';
        $('ai-tp').textContent = State.currentAIPlan.take_profit ? fmtUsd(State.currentAIPlan.take_profit) : '-';
        $('ai-reason').textContent = State.currentAIPlan.reasoning || '-';
        if (State.currentAIPlan.min_rr) document.querySelectorAll('.min-rr').forEach(n => { n.textContent = State.currentAIPlan.min_rr; });
    } else {
        $('ai-panel').style.display = 'none';
        State.currentAIPlan = null;
    }

    updateCalcBtnUI();

    if (chartHandle) {
        const hist = cleanData(data.historical);
        setCandles(chartHandle, hist);
        setBands(chartHandle, cleanData(data.band_upper), cleanData(data.band_lower));
        setForecast(chartHandle, cleanData(data.forecast));
        State.candleTimes = hist.map(d => d.time);
        applyDefaultViewIfNeeded();
    }
    refreshMarkers();
    updatePriceLines();
}

// --- MARKERS & LINES ---
function snap(ts) {
    const s = Math.floor(ts / 1000);
    let lo = 0, hi = State.candleTimes.length - 1, r = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (State.candleTimes[m] <= s) { r = m; lo = m + 1; } else hi = m - 1; }
    return r >= 0 ? State.candleTimes[r] : null;
}

export function refreshMarkers() {
    if (!chartHandle) return;
    const out = [];
    const add = (ts, m) => { const t = snap(ts); if (t !== null) out.push(Object.assign({ time: t }, m)); };
    State.simState.history.filter(h => h.symbol === State.currentAsset).forEach(h => {
        if (h.entryTime) add(h.entryTime, { position: 'belowBar', color: '#30d158', shape: 'arrowUp', text: 'In' });
        if (h.exitTime) add(h.exitTime, { position: 'aboveBar', color: '#ff453a', shape: 'circle', text: 'Out' });
    });
    State.simState.activeTrades.filter(t => t.symbol === State.currentAsset).forEach(t => {
        if (t.entryTime) add(t.entryTime, { position: 'belowBar', color: '#0a84ff', shape: 'arrowUp', text: 'Open' });
    });
    out.sort((a, b) => a.time - b.time);
    setMarkers(chartHandle, out);
}

export function updatePriceLines() {
    if (!chartHandle) return;
    const lines = [];
    const activeTrade = State.simState.activeTrades.find(t => t.symbol === State.currentAsset);
    if (activeTrade) {
        lines.push({ price: activeTrade.entryPrice, color: 'rgba(255,255,255,0.4)', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'ENTRY' });
        lines.push({ price: activeTrade.slPrice, color: 'rgba(255,69,58,0.8)', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dotted, axisLabelVisible: true, title: 'SL' });
        lines.push({ price: activeTrade.tpPrice, color: 'rgba(48,209,88,0.8)', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dotted, axisLabelVisible: true, title: 'TP' });
    } else if (State.currentAIPlan && State.currentAIPlan.entry > 0 && State.currentAIPlan.stop_loss > 0 && State.currentAIPlan.take_profit > 0) {
        const isT = State.currentAIPlan.tradeable !== false;
        lines.push({ price: State.currentAIPlan.entry, color: isT ? 'rgba(10,132,255,0.9)' : 'rgba(10,132,255,0.3)', lineWidth: 1, lineStyle: isT ? LightweightCharts.LineStyle.Dashed : LightweightCharts.LineStyle.Dotted, axisLabelVisible: true, title: 'ENTRY' });
        lines.push({ price: State.currentAIPlan.stop_loss, color: isT ? 'rgba(255,69,58,0.9)' : 'rgba(255,69,58,0.3)', lineWidth: 1, lineStyle: isT ? LightweightCharts.LineStyle.Dashed : LightweightCharts.LineStyle.Dotted, axisLabelVisible: true, title: 'SL' });
        lines.push({ price: State.currentAIPlan.take_profit, color: isT ? 'rgba(48,209,88,0.9)' : 'rgba(48,209,88,0.3)', lineWidth: 1, lineStyle: isT ? LightweightCharts.LineStyle.Dashed : LightweightCharts.LineStyle.Dotted, axisLabelVisible: true, title: 'TP' });
    }
    setPriceLines(chartHandle, lines);
}

export function updateCalcBtnUI() {
    const btnCalc = $('btn-calc');
    if (!State.currentAIPlan) {
        btnCalc.disabled = true; btnCalc.style.background = ''; btnCalc.style.color = '';
        btnCalc.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Analizza Setup`;
        return;
    }
    btnCalc.disabled = false;
    if (State.currentAIPlan.tradeable === false) {
        btnCalc.style.background = 'var(--warning)'; btnCalc.style.color = '#000';
        btnCalc.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Analizza (R/R Basso)`;
    } else {
        btnCalc.style.background = ''; btnCalc.style.color = '';
        btnCalc.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Analizza Setup`;
    }
}

// --- PRICE POLLING ---
export function setHeaderPrice(px) {
    if (!isFinite(px)) return;
    const el = $('live-price');
    if (!el) return;
    const prev = State.lastHeaderPrice;
    if (prev != null && px !== prev) {
        const cls = px > prev ? 'flash-up' : 'flash-down';
        el.classList.remove('flash-up', 'flash-down');
        void el.offsetWidth;
        el.classList.add(cls);
    }
    el.textContent = fmtUsd(px);
    State.lastHeaderPrice = px;
}

export async function pollPrices() {
    if (State.pollInFlight) return;
    State.pollInFlight = true;
    try {
        const symbols = new Set([State.currentAsset]);
        State.simState.activeTrades.forEach(t => symbols.add(t.symbol));
        const results = await Promise.all([...symbols].map(async (sym) => {
            try {
                const r = await fetchT(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${sym}`);
                if (!r.ok) return null;
                const j = await r.json();
                if (j.code !== '00000' || !j.data[0]) return null;
                const px = parseFloat(j.data[0].lastPr);
                return isFinite(px) ? { sym, px } : null;
            } catch (e) { return null; }
        }));
        for (const res of results) {
            if (!res) continue;
            State.livePx[res.sym] = res.px;
            if (res.sym === State.currentAsset) setHeaderPrice(res.px);
        }
        if (State.simState.activeTrades.length > 0) {
            [...State.simState.activeTrades].forEach(t => {
                if (State.livePx[t.symbol] != null) {
                    t.currentPrice = State.livePx[t.symbol];
                    if (window.checkAutoClose) window.checkAutoClose(t.id, State.livePx[t.symbol]);
                }
            });
            if (window.renderActiveTrades) window.renderActiveTrades();
        }
    } finally { State.pollInFlight = false; }
}

export function startPricePoll() {
    if (State.pricePollInterval) { pollPrices(); return; }
    pollPrices();
    State.pricePollInterval = setInterval(pollPrices, 5000);
}

// --- ASSET / TF SWITCH ---
export function setAsset(asset) {
    State.currentAsset = asset;
    State.lastHeaderPrice = null;
    ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].forEach(a => document.getElementById(`btn-${a}`).classList.toggle('active', a === asset));
    document.getElementById('current-asset-label').textContent = `${asset.replace('USDT', '')} / USDT · ${getTFLabel(State.currentTF)}`;
    updateChart();
    pollPrices();
    loadTechData();
}

export function setTF(tf) {
    State.currentTF = tf;
    ['1d', '4h', '1h'].forEach(t => document.getElementById(`btn-${t}`).classList.toggle('active', t === tf));
    document.getElementById('current-asset-label').textContent = `${State.currentAsset.replace('USDT', '')} / USDT · ${getTFLabel(tf)}`;
    updateChart();
    loadTechData();
}

// --- TECH PANEL ---
export async function loadTechData() {
    try {
        const gran = State.currentTF === '1d' ? '1day' : State.currentTF;
        const r = await fetchT(`https://api.bitget.com/api/v2/spot/market/candles?symbol=${State.currentAsset}&granularity=${gran}&limit=300`);
        if (!r.ok) return;
        const j = await r.json();
        if (j.code !== '00000' || !j.data) return;
        const candles = parseBitgetCandles(j.data);
        if (candles.length === 0) return;
        const price = State.livePx[State.currentAsset] || candles[candles.length-1].close;
        const closes = candles.slice(0, -1).map(c => c.close);
        techData = {
            trend: analyzeTrend(candles, price),
            riskData: buildRiskData(candles.slice(0, -1), price),
            ema20: calcEMA(closes, 20), ema50: calcEMA(closes, 50), ema200: calcEMA(closes, 200), price
        };
        currentAtrPct = techData.riskData.atrPct;
        renderTechFilters();
        if (window.updateCalcHints) window.updateCalcHints();
    } catch(e) { Logger.log('ERROR', 'TERMINAL', 'Tech fetch error', e); }
}

export function renderTechFilters() {
    if (!techData.trend) return;
    const strategy = $('dashStrategy').value;
    const grid = $('filterGrid');
    const trendLabel = $('tech-trend-label');
    if (techData.trend.direction === 'bullish') { trendLabel.textContent = `${techData.trend.duration} verdi`; trendLabel.style.color = 'var(--accent)'; }
    else if (techData.trend.direction === 'bearish') { trendLabel.textContent = `${techData.trend.duration} rosse`; trendLabel.style.color = 'var(--danger)'; }
    else { trendLabel.textContent = 'Neutro'; trendLabel.style.color = 'var(--text-secondary)'; }

    const buildItem = (label, value, pass) => `<div class="filter-item ${pass ? 'pass' : 'fail'}"><span class="f-label">${label}</span><span class="f-val">${value}</span><span class="f-dot"></span></div>`;
    const html = [];

    if (strategy === 'breakout') {
        html.push(buildItem('Volumi', (techData.trend.volRatio * 100).toFixed(0) + '%', techData.trend.volRatio >= 1.5));
        html.push(buildItem('RSI (>55)', techData.trend.rsi ? techData.trend.rsi.toFixed(1) : '—', techData.trend.rsi >= 55));
        html.push(buildItem('Breakout 20', techData.riskData.breakoutPass ? 'SI' : 'NO', techData.riskData.breakoutPass));
        html.push(buildItem('Macro (EMA200)', techData.riskData.macroPass ? 'SI' : 'NO', techData.riskData.macroPass));
    } else if (strategy === 'mean_reversion') {
        html.push(buildItem('RSI (<35)', techData.trend.rsi ? techData.trend.rsi.toFixed(1) : '—', techData.trend.rsi < 35));
        html.push(buildItem('EMA200 * 0.95', techData.price > techData.ema200 * 0.95 ? 'OK' : 'NO', techData.price > techData.ema200 * 0.95));
        const distEma20 = Math.abs(techData.price - techData.ema20) / techData.ema20 * 100;
        html.push(buildItem('Dist. EMA20', distEma20.toFixed(1) + '%', distEma20 < 5));
        html.push(buildItem('Candela', techData.trend.direction === 'bearish' ? 'ROSSA' : 'VERDE', techData.trend.direction === 'bearish'));
    } else if (strategy === 'ma_crossover') {
        html.push(buildItem('EMA20 > EMA50', techData.ema20 > techData.ema50 ? 'SI' : 'NO', techData.ema20 > techData.ema50));
        html.push(buildItem('EMA50 > EMA200', techData.ema50 > techData.ema200 ? 'SI' : 'NO', techData.ema50 > techData.ema200));
        html.push(buildItem('Price > EMA50', techData.price > techData.ema50 ? 'SI' : 'NO', techData.price > techData.ema50));
        html.push(buildItem('Volumi', (techData.trend.volRatio * 100).toFixed(0) + '%', techData.trend.volRatio >= 1.0));
    }
    grid.innerHTML = html.join('');
}

// --- DASHBOARD CAROUSEL ---
export function goToDashboardSlide(idx) {
    const carousel = document.getElementById('dashboardCarousel');
    if (!carousel) return;
    carousel.scrollTo({ left: idx * carousel.clientWidth, behavior: 'smooth' });
}

export function updateDashboardDots() {
    const carousel = document.getElementById('dashboardCarousel');
    if (!carousel || carousel.clientWidth === 0) return;
    const idx = Math.round(carousel.scrollLeft / carousel.clientWidth);
    document.querySelectorAll('#dashboardDots .info-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}

// --- REFRESH BOT ---
export function startRefreshCountdown(remainingSeconds) {
    const btn = $('btn-refresh');
    if (State.refreshTimerInterval) clearInterval(State.refreshTimerInterval);
    let left = remainingSeconds;
    btn.disabled = true;
    const tick = () => {
        if (left <= 0) {
            clearInterval(State.refreshTimerInterval);
            localStorage.removeItem('kronos_refresh_start_ts');
            btn.innerHTML = CONFIG.ICONS.WARN; btn.disabled = false;
            setTimeout(() => { if (btn.innerHTML === CONFIG.ICONS.WARN) btn.innerHTML = CONFIG.ICONS.REFRESH; }, 2000);
            if (window.showAlert) window.showAlert('Timeout', "Aggiornamento troppo lungo.");
            return;
        }
        btn.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
        left--;
    };
    tick();
    State.refreshTimerInterval = setInterval(tick, 1000);
}

export function initRefreshState() {
    const startTs = localStorage.getItem('kronos_refresh_start_ts');
    if (!startTs) return;
    const elapsedSecs = Math.floor((Date.now() - parseInt(startTs, 10)) / 1000);
    if (elapsedSecs >= 0 && elapsedSecs < CONFIG.REFRESH_MAX_WAIT) startRefreshCountdown(CONFIG.REFRESH_MAX_WAIT - elapsedSecs);
    else localStorage.removeItem('kronos_refresh_start_ts');
}

export async function triggerRefresh() {
    const btn = $('btn-refresh');
    if (btn.disabled) return;
    localStorage.setItem('kronos_refresh_start_ts', Date.now());
    startRefreshCountdown(CONFIG.REFRESH_MAX_WAIT);
    const key = `${State.currentAsset}_${State.currentTF}`;
    const before = State.allData && State.allData[key] && State.allData[key].last_update;
    let poll = null;
    const done = (label, delay) => {
        if (State.refreshTimerInterval) clearInterval(State.refreshTimerInterval);
        if (poll) clearInterval(poll);
        localStorage.removeItem('kronos_refresh_start_ts');
        btn.innerHTML = label;
        setTimeout(() => { if (btn.innerHTML === label) { btn.innerHTML = CONFIG.ICONS.REFRESH; btn.disabled = false; } }, delay);
    };
    try {
        const r = await apiPost('/api/trigger', { symbol: State.currentAsset, timeframe: State.currentTF });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        poll = setInterval(async () => {
            try {
                const nd = await (await fetch('./dashboard.json?t=' + Date.now())).json();
                if (nd[key] && nd[key].last_update !== before) {
                    State.allData = nd;
                    updateChart();
                    if (window.refreshKronosSignalsInMatrix) window.refreshKronosSignalsInMatrix();
                    done(CONFIG.ICONS.CHECK, 1500);
                }
            } catch (e) {}
        }, 3000);
    } catch (e) {
        done(CONFIG.ICONS.WARN, 2000);
        if (window.showAlert) window.showAlert('Errore', "Impossibile avviare l'aggiornamento.");
    }
}

export function sendToCalculator() {
    if (!State.currentAIPlan) return;
    if (State.currentAIPlan.bias === 'NEUTRO' && !State.currentAIPlan.direction) {
        if (window.showAlert) window.showAlert('Piano neutro', 'Nessun setup direzionale.');
        return;
    }
    State.calcContext = { asset: State.currentAsset, tf: State.currentTF };
    $('calcDirection').value = State.currentAIPlan.direction || (State.currentAIPlan.bias === 'SHORT' ? 'SHORT' : 'LONG');
    $('calcEntry').value = State.currentAIPlan.entry;
    $('calcStop').value = State.currentAIPlan.stop_loss;
    $('calcTarget').value = State.currentAIPlan.take_profit;
    if (window.setCtxLabel) window.setCtxLabel();
    if (window.switchTab) window.switchTab('calculator');
    if (window.calc) window.calc();
}

// Inquadratura iniziale (ultime 60 candele) per l'asset/timeframe corrente. Va applicata solo quando
// il grafico ha una larghezza reale: all'avvio i dati arrivano con la pagina Grafici nascosta
// (larghezza 0) e la libreria calcolerebbe la spaziatura minima, con tutte le candele schiacciate.
// In quel caso resta in attesa e viene applicata al primo ridimensionamento con larghezza > 0.
function applyDefaultViewIfNeeded() {
    if (!chartHandle || !chartContainer || chartContainer.clientWidth === 0) return;
    const key = `${State.currentAsset}_${State.currentTF}`;
    const n = State.candleTimes.length;
    if (key === State.viewKey || n === 0) return;
    chartHandle.resize(); // la spaziatura si calcola sulla larghezza attuale del grafico
    State.viewKey = key;
    chartHandle.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 60), to: n + 8 });
}

export function resizeChart() {
    if (chartHandle) chartHandle.resize();
    applyDefaultViewIfNeeded();
}
