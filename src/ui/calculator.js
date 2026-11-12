import { State } from '../core/state.js';
import { tradingMode } from './account.js';
import { getAutoState, openAutoConfirm, riskCfg, loadAutomation } from './automation.js';
import { journalTrades } from './history.js';
import { CONFIG } from '../core/config.js';
import { Logger } from '../core/logger.js';
import { $, SYM, fetchT, fmtUsd, fmtUsdt, apiPost, fetchData } from '../utils/helpers.js';
import { findOutcome } from './assistant.js';
import * as Terminal from './terminal.js';

export function initCalculator() {
    ['calcCapital', 'calcEntry', 'calcStop', 'calcTarget', 'calcRisk', 'calcLev', 'calcSlippage', 'calcFee', 'calcSlippageSpot', 'calcFeeSpot'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calc);
    });
    // Commissione futures: finché non la cambi a mano segue la commissione taker reale di Bitget
    const feeInput = document.getElementById('calcFee');
    if (feeInput) feeInput.addEventListener('input', () => { futFeeTouched = true; });

    ['calcEntry', 'calcStop', 'calcTarget'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', renderBreakEven);
    });

    const capInput = $('calcCapital');
    if (capInput) capInput.addEventListener('input', () => { State.capitalTouched = true; });

    initCalcAutoFit();
}

let futFeeTouched = false;
const TF_HOURS = { '1h': 1, '4h': 4, '1d': 24 };
const HORIZON_CANDLES = 7;        // durata di un segnale Kronos, in candele
const PRUDENT_MAX_LEV = 5;       // tetto prudenziale (lo stesso dell'esecutore automatico, executor.RISK_BOUNDS)
const FALLBACK_MMR = 0.005;       // margine di mantenimento usato se le fasce di Bitget non sono disponibili

const calcCtx = () => State.calcContext || { asset: State.currentAsset, tf: State.currentTF };
const fmtPrice = p => p.toLocaleString('en-US', { minimumFractionDigits: p >= 10 ? 2 : 4, maximumFractionDigits: p >= 10 ? 2 : 4 });

// Direzione a tasti (niente menu a tendina): aggiorna il campo nascosto e il tasto evidenziato
export function setCalcDirection(dir) {
    const input = document.getElementById('calcDirection');
    if (!input) return;
    input.value = dir === 'SHORT' ? 'SHORT' : 'LONG';
    document.querySelectorAll('.option-toggle[data-target="calcDirection"] button')
        .forEach(b => b.classList.toggle('active', b.dataset.value === input.value));
}

function applyFuturesFee() {
    const fut = Terminal.getFutures(calcCtx().asset);
    const feeInput = document.getElementById('calcFee');
    if (!futFeeTouched && feeInput && fut && typeof fut.taker_fee_pct === 'number') feeInput.value = fut.taker_fee_pct;
}

// Chiamata quando arrivano (o si aggiornano) i dati futures del bot
export function onFuturesData() {
    applyFuturesFee();
    if (State.currentMarket === 'FUTURES') calc();
}

export function setMarket(market) {
    State.currentMarket = market;
    document.getElementById('btn-market-spot').classList.toggle('active', market === 'SPOT');
    document.getElementById('btn-market-fut').classList.toggle('active', market === 'FUTURES');
    if (market === 'FUTURES') { document.getElementById('lev-grid').style.display = 'grid'; document.getElementById('spot-grid').style.display = 'none'; }
    else { document.getElementById('lev-grid').style.display = 'none'; document.getElementById('spot-grid').style.display = 'grid'; }
    document.querySelectorAll('#page-calculator .fut-only').forEach(el => { el.style.display = market === 'FUTURES' ? '' : 'none'; });
    if (market === 'FUTURES') applyFuturesFee();
    calc();
    if (marketReady) { State.capitalTouched = false; syncTradeMode(); }
}
let marketReady = true;

export function setCtxLabel() {
    const el = document.getElementById('calcCtx');
    if (!el) return;
    const c = State.calcContext || { asset: State.currentAsset, tf: State.currentTF };
    el.textContent = `${SYM(c.asset)} · ${c.tf}`;
}

export function syncCapital() {
    if (State.capitalTouched) return;
    const capInput = $('calcCapital');
    if (!capInput) return;
    // in Reale il capitale di partenza è il conto futures di Bitget (gli ordini usano solo quello)
    const st = getAutoState(), acc = st.live && st.live.account;
    const real = tradingMode().mode === 'on' && acc && acc.connected;
    const spotUsdt = () => { const u = (acc.spot_coins || []).find(c => c.coin === 'USDT'); return u ? u.qty : 0; };
    const cap = !real ? State.simState.freeBalance
        : State.currentMarket === 'SPOT' ? spotUsdt()
        : ((acc.accounts_usdt && acc.accounts_usdt.futures != null) ? acc.accounts_usdt.futures : acc.equity);
    capInput.value = Math.round(cap * 100) / 100;
    calc();
}

export function getVal(id) {
    let val = document.getElementById(id).value;
    if (!val) return 0;
    val = val.replace(',', '.');
    return parseFloat(val) || 0;
}

export function numFromText(id) {
    const el = document.getElementById(id);
    if (!el) return NaN;
    const v = parseFloat(String(el.textContent).replace(',', '.'));
    return isFinite(v) ? v : NaN;
}

export function calc() {
    const capital = getVal('calcCapital');
    const direction = document.getElementById('calcDirection').value;
    const entry = getVal('calcEntry');
    const stop = getVal('calcStop');
    const target = getVal('calcTarget');
    const riskPct = getVal('calcRisk');
    let leverage = 1, slippagePct = 0, feePct = 0;

    if (State.currentMarket === 'FUTURES') { 
        leverage = Math.max(1, getVal('calcLev') || 1); 
        slippagePct = getVal('calcSlippage') / 100; 
        feePct = getVal('calcFee') / 100; 
    } else { 
        slippagePct = getVal('calcSlippageSpot') / 100; 
        feePct = getVal('calcFeeSpot') / 100; 
    }

    const resRR = document.getElementById('resRR'), resMargin = document.getElementById('resMargin'), resSize = document.getElementById('resSize'),
          resRiskEur = document.getElementById('resRiskEur'), resGross = document.getElementById('resGross'), resCosts = document.getElementById('resCosts'),
          resTax = document.getElementById('resTax'), resNet = document.getElementById('resNet'),
          resLiq = document.getElementById('resLiq'), resLevMin = document.getElementById('resLevMin'), resLevMax = document.getElementById('resLevMax'), resFunding = document.getElementById('resFunding'), resFundingLabel = document.getElementById('resFundingLabel'),
          calcWarning = document.getElementById('calcWarning'), calcError = document.getElementById('calcError');

    resTax.previousElementSibling.textContent = `Tasse (${Math.round(CONFIG.TAX_RATE * 100)}%)`;
    calcWarning.style.display = 'none';
    calcError.style.display = 'none';

    const clearAll = () => {
        resRR.textContent = resMargin.textContent = resSize.textContent = resRiskEur.textContent =
        resGross.textContent = resCosts.textContent = resTax.textContent = resNet.textContent = resLiq.textContent = resFunding.textContent = '—';
        if (resLevMin) resLevMin.textContent = resLevMax.textContent = '—';
    };
    const fail = (msg) => { calcError.textContent = msg; calcError.style.display = 'block'; clearAll(); };

    if (![entry, stop, target, capital, riskPct].every(isFinite) || entry <= 0 || stop <= 0 || target <= 0 || capital <= 0 || riskPct <= 0) { 
        clearAll(); updateCalcHints(); return; 
    }

    const isLong = direction === 'LONG';
    if (State.currentMarket === 'SPOT' && !isLong) return fail('In Spot non si può andare SHORT.');
    if (isLong && (stop >= entry || target <= entry)) return fail('In un LONG, Stop Loss < Entry < Target.');
    if (!isLong && (stop <= entry || target >= entry)) return fail('In uno SHORT, Target < Entry < Stop Loss.');

    const stopDistPct = Math.abs(entry - stop) / entry;
    const targetDistPct = Math.abs(target - entry) / entry;
    const rr = targetDistPct / stopDistPct;
    const lossPct = stopDistPct + slippagePct + 2 * feePct;
    const maxSize = capital / (1 / leverage + feePct);
    const sizeByRisk = (capital * (riskPct / 100)) / lossPct;
    const sizeNominal = Math.min(sizeByRisk, maxSize);
    const capped = sizeByRisk > maxSize;
    const marginRequired = sizeNominal / leverage;
    const realRisk = sizeNominal * lossPct;
    const realRiskPct = (realRisk / capital) * 100;
    const grossProfit = sizeNominal * targetDistPct;
    const exitNotional = isLong ? sizeNominal + grossProfit : sizeNominal - grossProfit;
    const totalFees = sizeNominal * feePct + exitNotional * feePct;

    // Futures: liquidazione (margine isolato) e funding, con le regole reali del contratto Bitget
    // quando il bot le ha salvate. Sono stime: il funding cambia a ogni scadenza.
    let liqPrice = null, liqDistPct = null, fundingCost = 0, fundingKnown = false, holdHours = 0, levMin = null, levMaxSafe = null;
    if (State.currentMarket === 'FUTURES') {
        const ctx = calcCtx();
        const fut = Terminal.getFutures(ctx.asset);
        const tiers = fut && Array.isArray(fut.tiers) && fut.tiers.length ? fut.tiers : null;
        const tier = tiers ? (tiers.find(t => sizeNominal <= t.up_to_usdt) || tiers[tiers.length - 1]) : null;
        // Leva: la size viene dal rischio, non dalla leva. La leva decide solo il margine bloccato e
        // dove sta la liquidazione. Minima = quella che serve perché il margine stia nel capitale
        // (size per rischio / capitale). Massima sicura = la più alta con la liquidazione oltre lo stop
        // di almeno il 25% (stessa soglia dell'avviso qui sotto), entro il limite di Bitget e mai oltre 5x.
        const mmr = tier ? tier.mmr_pct / 100 : FALLBACK_MMR;
        levMin = Math.max(1, sizeByRisk / capital);
        levMaxSafe = Math.max(1, Math.floor(1 / (stopDistPct / 0.8 + mmr)));
        if (tier) levMaxSafe = Math.min(levMaxSafe, tier.max_leverage);
        levMaxSafe = Math.min(levMaxSafe, PRUDENT_MAX_LEV);
        if (tier && leverage > tier.max_leverage) return fail(`Per una posizione di ${Math.round(sizeNominal)} USDT su ${SYM(ctx.asset)} Bitget concede al massimo leva ${tier.max_leverage}x.`);
        liqDistPct = 1 / leverage - (tier ? tier.mmr_pct / 100 : FALLBACK_MMR);
        liqPrice = isLong ? entry * (1 - liqDistPct) : entry * (1 + liqDistPct);
        if (stopDistPct >= liqDistPct) return fail(`Con leva ${leverage}x la liquidazione stimata (${fmtPrice(Math.max(liqPrice, 0))}) arriva prima dello stop: perderesti tutto il margine. Riduci la leva o avvicina lo stop.`);
        holdHours = HORIZON_CANDLES * (TF_HOURS[ctx.tf] || 1);
        if (fut && typeof fut.funding_rate_pct === 'number') {
            fundingKnown = true;
            // positivo = lo paghi (long con funding positivo, short con funding negativo)
            fundingCost = sizeNominal * (fut.funding_rate_pct / 100) * (holdHours / (fut.funding_interval_h || 8)) * (isLong ? 1 : -1);
        }
    }

    const taxes = Math.max(0, grossProfit - totalFees - fundingCost) * CONFIG.TAX_RATE;
    const netProfit = grossProfit - totalFees - fundingCost - taxes;

    const notes = [];
    if (capped) notes.push(`<b>Size al massimo consentito dal capitale.</b><br>Con stop del ${(stopDistPct * 100).toFixed(2)}% il rischio massimo è <b>${realRiskPct.toFixed(2)}%</b>, non ${riskPct}%.`);
    if (liqDistPct !== null && leverage > 1 && stopDistPct >= liqDistPct * 0.8) {
        notes.push(`Lo stop è vicino alla liquidazione stimata (${fmtPrice(liqPrice)}, a ${(liqDistPct * 100).toFixed(1)}% dall'entry): basta poco slippage per perdere tutto il margine.`);
    }
    if (rr < 1.5) notes.push('R:R inferiore a 1.5. Trade sconsigliato.');
    
    if (notes.length) { calcWarning.innerHTML = notes.join('<br><br>'); calcWarning.style.display = 'block'; }

    // importi piccoli (conti di poche decine di USDT) con i centesimi, quelli grandi arrotondati
    const usd = v => (Math.abs(v) < 100 ? v.toFixed(2).replace('.', ',') : String(Math.round(v)));
    State.lastCalc = { entry, stop, target, direction, leverage, sizeNominal, marginRequired, realRisk, rr };
    resRR.textContent = rr.toFixed(2);
    resRiskEur.textContent = `${usd(realRisk)} USDT (${realRiskPct.toFixed(2)}%)`;
    resMargin.textContent = `${usd(marginRequired)} USDT`;
    resSize.textContent = `${usd(sizeNominal)} USDT`;
    resGross.textContent = `+${usd(grossProfit)} USDT`;
    resCosts.textContent = `-${usd(totalFees)} USDT`;
    resTax.textContent = `-${usd(taxes)} USDT`;
    // Il netto in USDT non dipende dalla leva (la size viene dal rischio); dipende dalla leva il
    // margine bloccato, quindi il rendimento sul margine: lo mostro accanto in futures
    const onMargin = State.currentMarket === 'FUTURES' && marginRequired > 0 ? ` (${netProfit > 0 ? '+' : ''}${Math.round(netProfit / marginRequired * 100)}% sul margine)` : '';
    resNet.textContent = `${netProfit > 0 ? '+' : ''}${usd(netProfit)} USDT${onMargin}`;
    if (levMin !== null && resLevMin) {
        const x = v => `${(Math.ceil(v * 10) / 10).toLocaleString('it-IT')}x`;
        resLevMin.textContent = levMin <= 1 ? '1x (basta il capitale)' : x(levMin);
        resLevMin.className = 'res-val' + (leverage < levMin - 1e-9 ? ' tax' : '');
        resLevMax.textContent = `${levMaxSafe}x`;
        resLevMax.className = 'res-val' + (leverage > levMaxSafe ? ' danger' : ' safe');
    }
    if (liqPrice !== null) {
        resLiq.textContent = liqPrice > 0 ? `${fmtPrice(liqPrice)} (${isLong ? '-' : '+'}${(liqDistPct * 100).toFixed(1)}%)` : 'Nessuna';
        resFundingLabel.textContent = `Funding stimato (${holdHours >= 48 ? Math.round(holdHours / 24) + ' giorni' : holdHours + ' h'})`;
        resFunding.textContent = fundingKnown ? `${fundingCost > 0 ? '-' : '+'}${Math.abs(fundingCost).toFixed(2)} USDT` : '—';
    }

    resRR.className = rr < 1.5 ? 'res-val danger' : (rr < 2.0 ? 'res-val tax' : 'res-val safe');
    resNet.className = netProfit >= 0 ? 'res-val safe' : 'res-val danger';
    updateCalcHints();
}

export function updateCalcHints() {
    const entry = getVal('calcEntry');
    const stop = getVal('calcStop');
    const target = getVal('calcTarget');
    const slHint = $('slHint');

    if (State.currentAtrPct > 0 && entry > 0 && stop > 0) {
        const slPct = Math.abs(entry - stop) / entry;
        if (slPct < State.currentAtrPct * 0.005) { 
            slHint.style.display = 'block'; 
            slHint.innerHTML = `SL stretto: ATR attuale ${(State.currentAtrPct).toFixed(2)}%. Rischio stop prematuro.`; 
        }
        else slHint.style.display = 'none';
    } else slHint.style.display = 'none';

    const beHint = $('beHint');
    if (entry > 0 && stop > 0 && target > 0) {
        const slPctVal = Math.abs(entry - stop) / entry;
        const tpPctVal = Math.abs(target - entry) / entry;
        const cap = 1000;
        const winGross = cap * tpPctVal; const winFees = cap * CONFIG.FEE_RATE + (cap + winGross) * CONFIG.FEE_RATE;
        const winBeforeTax = winGross - winFees; const winTax = winBeforeTax > 0 ? winBeforeTax * CONFIG.TAX_RATE : 0;
        const winNetPct = (winBeforeTax - winTax) / cap; const lossGross = -cap * slPctVal;
        const lossFees = cap * CONFIG.FEE_RATE + (cap + lossGross) * CONFIG.FEE_RATE; const lossNetPct = (lossGross - lossFees) / cap;
        const breakEven = Math.abs(lossNetPct) / (winNetPct + Math.abs(lossNetPct));
        const bePct = breakEven * 100;
        beHint.innerHTML = `Break-even: <b style="color:var(--text);">${bePct.toFixed(1)}%</b> - Servono ~${Math.ceil(bePct / 10)} vittorie su 10 per non perdere soldi.`;
        beHint.style.display = 'block';
    } else beHint.style.display = 'none';
}

// Break-even (win rate minimo per non perdere): dai trade chiusi del Diario quando ci sono sia vinti sia
// persi (perdita media / (guadagno medio + perdita media), già netti di costi e tasse); altrimenti dal
// setup della pagina Rischio (entry, stop, target). Il win rate reale si mostra sempre.
function setupBreakEven() {
    const entry = getVal('calcEntry');
    if (!entry) return null;
    const slPct = Math.abs(entry - getVal('calcStop')) / entry;
    const tpPct = Math.abs(getVal('calcTarget') - entry) / entry;
    if (!(slPct > 0) || !(tpPct > 0)) return null;
    const cap = 1000;
    const winGross = cap * tpPct; const winFees = cap * CONFIG.FEE_RATE + (cap + winGross) * CONFIG.FEE_RATE;
    const winBeforeTax = winGross - winFees; const winTax = winBeforeTax > 0 ? winBeforeTax * CONFIG.TAX_RATE : 0;
    const winNetPct = (winBeforeTax - winTax) / cap; const lossGross = -cap * slPct;
    const lossFees = cap * CONFIG.FEE_RATE + (cap + lossGross) * CONFIG.FEE_RATE; const lossNetPct = (lossGross - lossFees) / cap;
    return Math.abs(lossNetPct) / (winNetPct + Math.abs(lossNetPct)) * 100;
}

export function renderBreakEven() {
    const el = id => document.getElementById(id);
    if (!el('beValue')) return;
    const trades = journalTrades();
    const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl < 0);
    let bePct = null, source = '';
    if (wins.length && losses.length) {
        const avgW = wins.reduce((s, t) => s + t.pnl, 0) / wins.length;
        const avgL = Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length);
        bePct = avgL / (avgW + avgL) * 100; source = 'dai tuoi trade';
    } else {
        bePct = setupBreakEven(); source = bePct != null ? 'dal setup Trade' : '';
    }
    el('beValue').textContent = bePct != null ? bePct.toFixed(1) + '%' : '—';
    el('beSource').textContent = bePct != null ? `win rate min · ${source}` : 'win rate min';
    el('beMarker').style.display = bePct != null ? '' : 'none';
    if (bePct != null) el('beMarker').style.left = Math.min(100, Math.max(0, bePct)) + '%';

    if (!trades.length) {
        el('beActualWr').textContent = '—'; el('beActualWr').style.color = '';
        el('beDelta').textContent = '—'; el('beDelta').style.color = '';
        el('beDot').style.display = 'none';
        el('beBadge').textContent = 'In attesa'; el('beBadge').className = 'be-badge neutral';
        return;
    }
    const wrPct = wins.length / trades.length * 100;
    el('beActualWr').textContent = wrPct.toFixed(1) + '%';
    const dot = el('beDot');
    dot.style.display = 'block'; dot.style.left = Math.min(100, Math.max(0, wrPct)) + '%';
    if (bePct == null) {
        el('beActualWr').style.color = '';
        el('beDelta').textContent = '—'; el('beDelta').style.color = '';
        el('beBadge').textContent = 'Pochi dati'; el('beBadge').className = 'be-badge neutral';
        return;
    }
    const delta = wrPct - bePct;
    const color = delta >= 0 ? 'var(--accent)' : 'var(--danger)';
    el('beActualWr').style.color = color;
    el('beDelta').textContent = (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%';
    el('beDelta').style.color = color;
    // con pochi trade il risultato è soprattutto caso: lo dico invece di dare un verdetto
    if (trades.length < 20) { el('beBadge').textContent = `${trades.length} trade: pochi`; el('beBadge').className = 'be-badge neutral'; }
    else if (delta >= 5) { el('beBadge').textContent = 'Profittevole'; el('beBadge').className = 'be-badge good'; }
    else if (delta >= 0) { el('beBadge').textContent = 'Marginale'; el('beBadge').className = 'be-badge warn'; }
    else { el('beBadge').textContent = 'In perdita'; el('beBadge').className = 'be-badge bad'; }
}

export function sendToCalculator() {
    if (!State.currentAIPlan) return;
    if (State.currentAIPlan.bias === 'NEUTRO' && !State.currentAIPlan.direction) { 
        if (window.showAlert) window.showAlert('Piano neutro', 'Nessun setup direzionale.'); 
        return; 
    }
    State.calcContext = { asset: State.currentAsset, tf: State.currentTF };
    setCalcDirection(State.currentAIPlan.direction || (State.currentAIPlan.bias === 'SHORT' ? 'SHORT' : 'LONG'));
    $('calcEntry').value = State.currentAIPlan.entry;
    $('calcStop').value = State.currentAIPlan.stop_loss;
    $('calcTarget').value = State.currentAIPlan.take_profit;
    setCtxLabel();
    if (window.switchTab) window.switchTab('calculator');
    calc();
}

// --- Modalità della pagina Trade: Simulato (trade dell'app) o Reale (ordini veri sui futures di Bitget) ---
const isRealMode = () => tradingMode().mode === 'on';
export function syncTradeMode() {
    const real = isRealMode();
    const lbl = $('calcModeLbl');
    if (lbl) { lbl.textContent = real ? 'Reale · Bitget' : 'Simulato'; lbl.className = real ? 'text-warning' : ''; }
    // Spot in Reale: si compra soltanto (niente short né leva)
    const spotReal = real && State.currentMarket === 'SPOT';
    const shortBtn = document.querySelector('.option-toggle[data-target="calcDirection"] [data-value="SHORT"]');
    if (shortBtn) shortBtn.style.display = spotReal ? 'none' : '';
    if (spotReal && $('calcDirection').value === 'SHORT') { setCalcDirection('LONG'); calc(); }
    const btn = $('calcOpenBtn');
    if (btn && !btn.disabled) {
        btn.classList.toggle('btn-real', real);
        $('calcOpenLbl').textContent = !real ? 'Apri Trade Simulato' : spotReal ? 'Compra su Bitget (spot)' : 'Invia ordine su Bitget (futures)';
    }
    // cambiando modalità il capitale riparte dal conto giusto (app o futures di Bitget)
    if (real !== lastReal) { lastReal = real; State.capitalTouched = false; }
    syncCapital();
}
let lastReal = null;

// Quantità, passo e minimo dei contratti futures (API pubblica), una volta per coin
const specsCache = {};
async function futuresSpecs(symbol) {
    if (specsCache[symbol]) return specsCache[symbol];
    const r = await fetchT(`https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES&symbol=${symbol}`);
    const c = (await r.json()).data[0];
    return (specsCache[symbol] = { step: Number(c.volumePlace), min: Number(c.minTradeNum), pricePlace: Number(c.pricePlace) });
}
async function futuresMark(symbol) {
    const r = await fetchT(`https://api.bitget.com/api/v2/mix/market/ticker?symbol=${symbol}&productType=USDT-FUTURES`);
    const d = (await r.json()).data[0];
    return parseFloat(d.markPrice || d.lastPr);
}
const it = (v, d = 2) => Number(v).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });

// Ordine VERO: a mercato sui futures di Bitget, margine isolato, stop obbligatorio e target facoltativo già
// sull'exchange. Riepilogo e conferma prima; il server e position_cmd.py ricontrollano tutto.
async function spotRules(symbol) {
    const key = `spot:${symbol}`;
    if (specsCache[key]) return specsCache[key];
    const r = await fetchT(`https://api.bitget.com/api/v2/spot/public/symbols?symbol=${symbol}`);
    const d = (await r.json()).data[0];
    return (specsCache[key] = { qtyPlace: Number(d.quantityPrecision), pricePlace: Number(d.pricePrecision), minUsdt: Number(d.minTradeUSDT || 1) });
}
async function spotPrice(symbol) {
    const r = await fetchT(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${symbol}`);
    return parseFloat((await r.json()).data[0].lastPr);
}

async function openRealOrder() {
    if (State.currentMarket === 'SPOT') return openSpotOrder();
    const status = $('orderStatus');
    const say = (t, cls = '') => { if (status) { status.textContent = t; status.className = 'order-status ' + cls; } };
    const L = State.lastCalc, c = calcCtx(), symbol = c.asset;
    const long = $('calcDirection').value !== 'SHORT', side = long ? 'long' : 'short';
    const stop = getVal('calcStop'), target = getVal('calcTarget'), lev = Math.round(getVal('calcLev') || 1);
    const risk = riskCfg();
    if (!L || !(L.sizeNominal > 0)) { say('Compila entry, stop e rischio: la size non è calcolata.', 'text-danger'); return; }
    if (!(stop > 0)) { say('Lo stop loss è obbligatorio per un ordine vero.', 'text-danger'); return; }
    if (lev < 1 || lev > risk.max_leverage) { say(`Leva tra 1 e ${risk.max_leverage}x (Impostazioni → Limiti di rischio).`, 'text-danger'); return; }
    say('Leggo prezzo e regole del contratto…');
    let mark, specs;
    try { [mark, specs] = await Promise.all([futuresMark(symbol), futuresSpecs(symbol)]); }
    catch (e) { say('Bitget non risponde: riprova fra poco.', 'text-danger'); return; }
    if (long ? stop >= mark : stop <= mark) { say(`Lo stop di un ${long ? 'LONG va sotto' : 'SHORT va sopra'} il prezzo attuale (${it(mark, specs.pricePlace)}).`, 'text-danger'); return; }
    if (target > 0 && (long ? target <= mark : target >= mark)) { say(`Il target di un ${long ? 'LONG va sopra' : 'SHORT va sotto'} il prezzo attuale (${it(mark, specs.pricePlace)}).`, 'text-danger'); return; }
    const f = 10 ** specs.step;
    const qty = Math.floor(L.sizeNominal / mark * f + 1e-9) / f;
    if (qty < specs.min) {
        say(`Quantità ${qty} sotto il minimo di Bitget per ${SYM(symbol)} (${specs.min}, circa ${it(specs.min * mark)} USDT): aumenta il rischio o allarga lo stop.`, 'text-danger');
        return;
    }
    const margin = qty * mark / lev, loss = qty * Math.abs(mark - stop) + qty * mark * 0.0012;
    say('');
    const msg = `ORDINE VERO su Bitget: ${side.toUpperCase()} ${SYM(symbol)} ${qty} a mercato (circa ${it(mark, specs.pricePlace)}), leva ${lev}x, margine isolato circa ${it(margin)} USDT. `
        + `Stop ${it(stop, specs.pricePlace)}: allo stop perdi circa ${it(loss)} USDT. ` + (target > 0 ? `Target ${it(target, specs.pricePlace)}.` : 'Nessun target.');
    openAutoConfirm('Conferma ordine vero', msg, 'Invia ordine', () => sendOrder({ type: 'position', action: 'open', symbol, side, price: String(stop), size: String(qty), leverage: String(lev), tp: target > 0 ? String(target) : '' }, say));
}

// Invio dell'ordine confermato ed esito vero (evento con lo stesso codice in live_trades.json)
async function sendOrder(payload, say) {
        const req = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        say('Invio a Bitget…');
        let res;
        try {
            res = await apiPost('/api/command', { ...payload, req });
        } catch (e) { say('Server non raggiungibile: ordine NON inviato.', 'text-danger'); return; }
        let out = {};
        try { out = await res.json(); } catch (e) {}
        if (!res.ok) { say(`Ordine NON inviato: ${out.error || 'errore ' + res.status}`, 'text-danger'); return; }
        say('Inviato ✓ Attendo la conferma di Bitget (1-3 minuti)…', 'text-ui');
        const started = Date.now();
        const tick = async () => {
            let live = null;
            try { const r = await fetchData('live_trades.json'); live = r.ok ? await r.json() : null; } catch (e) {}
            const o = findOutcome(live, req);
            if (o) { say(`${o.ok ? '✓' : '✗'} ${o.msg}`, o.ok ? 'text-accent' : 'text-danger'); loadAutomation(); return; }
            if (Date.now() - started > 5 * 60_000) { say('Inviato, ma la conferma non è arrivata: controlla Telegram o la pagina Posizioni.'); return; }
            setTimeout(tick, 15_000);
        };
        setTimeout(tick, 15_000);
}

// Acquisto spot VERO: ordine limite "esegui subito o annulla" con un tetto di prezzo +0,5%, poi stop (obbligatorio)
// e target come ordini a scatto di vendita sull'exchange. Il server e position_cmd.py ricontrollano tutto.
async function openSpotOrder() {
    const status = $('orderStatus');
    const say = (t, cls = '') => { if (status) { status.textContent = t; status.className = 'order-status ' + cls; } };
    const L = State.lastCalc, symbol = calcCtx().asset;
    const stop = getVal('calcStop'), target = getVal('calcTarget');
    if (!L || !(L.sizeNominal > 0)) { say('Compila entry, stop e rischio: la size non è calcolata.', 'text-danger'); return; }
    if (!(stop > 0)) { say('Lo stop loss è obbligatorio per un ordine vero.', 'text-danger'); return; }
    say('Leggo prezzo e regole della coppia…');
    let px, rules;
    try { [px, rules] = await Promise.all([spotPrice(symbol), spotRules(symbol)]); }
    catch (e) { say('Bitget non risponde: riprova fra poco.', 'text-danger'); return; }
    if (stop >= px) { say(`Lo stop va sotto il prezzo attuale (${it(px, rules.pricePlace)}).`, 'text-danger'); return; }
    if (target > 0 && target <= px) { say(`Il target va sopra il prezzo attuale (${it(px, rules.pricePlace)}).`, 'text-danger'); return; }
    const f = 10 ** rules.qtyPlace;
    const qty = Math.floor(L.sizeNominal / px * f + 1e-9) / f;
    if (!(qty > 0) || qty * px < rules.minUsdt) { say(`Importo troppo piccolo: su Bitget spot servono almeno ${it(rules.minUsdt)} USDT.`, 'text-danger'); return; }
    const cost = qty * px, loss = qty * (px - stop) + cost * 0.002;
    say('');
    const msg = `ORDINE VERO su Bitget (spot): compro ${qty} ${SYM(symbol)} a circa ${it(px, rules.pricePlace)} (al massimo +0,5%), spesa circa ${it(cost)} USDT dal conto spot. `
        + `Stop ${it(stop, rules.pricePlace)}: allo stop perdi circa ${it(loss)} USDT. ` + (target > 0 ? `Target ${it(target, rules.pricePlace)}.` : 'Nessun target.');
    openAutoConfirm('Conferma acquisto vero', msg, 'Compra', () => sendOrder({ type: 'position', action: 'open', market: 'spot', symbol, side: 'long', price: String(stop), size: String(qty), leverage: '1', tp: target > 0 ? String(target) : '' }, say));
}

export async function openTradeFromCalculator() {
    if (isRealMode()) return openRealOrder();
    const entry = getVal('calcEntry');
    const stop = getVal('calcStop');
    const target = getVal('calcTarget');
    const direction = document.getElementById('calcDirection').value;
    const size = numFromText('resSize');
    const margin = numFromText('resMargin');

    if (!entry || !stop || !target) { if (window.showAlert) window.showAlert("Errore", "Compila tutti i campi."); return; }
    if (!(size > 0) || !(margin > 0)) { if (window.showAlert) window.showAlert("Errore", "Size non valida."); return; }
    if (margin > State.simState.freeBalance) { if (window.showAlert) window.showAlert("Errore", `Capitale insufficiente. Hai ${State.simState.freeBalance.toFixed(2)} USDT.`); return; }

    const c = State.calcContext || { asset: State.currentAsset, tf: State.currentTF };
    State.pendingTradePayload = { entry, stop, target, direction, size, margin };

    // FIX: Cerca il bottone giusto (btn-cta-primary) e previene crash se non esiste
    const btn = document.getElementById('calcOpenBtn');
    let originalText = '';
    if (btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = "Verifica...";
        btn.disabled = true;
    }

    try {
        const res = await fetchT(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${c.asset}`);
        const json = await res.json();
        if (json.code !== "00000" || !json.data[0]) throw new Error("Prezzo live non disponibile");
        const livePrice = parseFloat(json.data[0].lastPr);
        State.pendingTradePayload.livePrice = livePrice;

        const higher = { '1h': ['4h', '1d'], '4h': ['1d'], '1d': [] }[c.tf] || [];
        let blockReason = null;
        for (const tf of higher) {
            const d = State.allData && State.allData[`${c.asset}_${tf}`];
            if (!d || typeof d.prob_up !== 'number') continue;
            const sig = d.prob_up >= 80 ? 'LONG' : (d.prob_up <= 20 ? 'SHORT' : 'NEUTRO');
            if (sig !== 'NEUTRO' && sig !== direction) { blockReason = `Conflitto ${tf}: dice ${sig} (${d.prob_up}%), ma stai aprendo ${direction}.`; break; }
        }
        
        const rr = Math.abs(target - entry) / Math.abs(entry - stop);
        const need = (State.allData && State.allData[`${c.asset}_${c.tf}`]?.ai_plan?.min_rr) || 1.5;
        if (!blockReason && rr < need) blockReason = `R:R ${rr.toFixed(2)} è sotto ${need}.`;
        if (!blockReason && State.simState.activeTrades.some(t => t.symbol === c.asset)) blockReason = `Hai già una posizione su ${SYM(c.asset)}.`;
        
        const dist = Math.abs(livePrice - entry) / entry * 100;
        if (!blockReason && dist > 0.5) blockReason = `Prezzo ${dist.toFixed(2)}% lontano dall'entry (max 0.5%).`;

        if (blockReason) { 
            document.getElementById('forceTradeReason').textContent = blockReason; 
            document.getElementById('forceTradeModal').classList.add('active'); 
            return; 
        }

        if (window.executeTradeOpen) await window.executeTradeOpen();
    } catch (e) { 
        if (window.showAlert) window.showAlert("Errore", "Impossibile aprire il trade: " + e.message); 
    }
    finally { 
        if (btn) {
            btn.innerHTML = originalText; 
            btn.disabled = false; 
        }
    }
}

export function closeForceTradeModal() { document.getElementById('forceTradeModal').classList.remove('active'); State.pendingTradePayload = null; }
export async function confirmForceTrade() {
    document.getElementById('forceTradeModal').classList.remove('active');
    if (!State.pendingTradePayload || !State.pendingTradePayload.livePrice) return;
    if (window.executeTradeOpen) await window.executeTradeOpen();
}

// --- Pagina Rischio sempre senza scroll ---
// Se la scheda non entra nello spazio disponibile (schermi bassi, avvisi e suggerimenti visibili),
// viene rimpicciolita con CSS zoom quanto basta. Si ricalcola quando cambia la misura della pagina
// (rotazione, cambio tab, navbar) o il contenuto della scheda (risultati, avvisi, Spot/Futures).
// Sotto MIN_CALC_ZOOM non si rimpicciolisce oltre: resta lo scroll come ultima risorsa.
const MIN_CALC_ZOOM = 0.6;

// Quanto la pagina scende oltre la parte di schermo davvero visibile: in Safari mobile il contenitore
// dell'app può essere più alto dell'area visibile (barra degli strumenti) e il fondo finisce sotto la
// navbar. Calcolato dal layout (offsetHeight, scrollTop) e non da getBoundingClientRect della pagina,
// così l'animazione di apertura della tab (translateY) non falsa la misura.
function calcPageOvershoot(page) {
    const main = page.closest('main');
    if (!main) return 0;
    const pageBottom = main.getBoundingClientRect().top - main.scrollTop + page.offsetTop - main.offsetTop + page.offsetHeight;
    let limit = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const nav = document.querySelector('.nav-bar');
    // getClientRects vuoto = navbar nascosta (es. grafico a schermo intero); offsetParent non va bene: è null per gli elementi fixed
    if (nav && nav.getClientRects().length > 0) limit = Math.min(limit, nav.getBoundingClientRect().top);
    return Math.max(0, Math.ceil(pageBottom - limit));
}

function fitCalcCard() {
    const page = document.getElementById('page-calculator');
    const card = page && page.querySelector('.calc-card');
    if (!page || !card || !page.classList.contains('active')) return;

    // 1) margine in fondo pari alla parte di pagina non visibile (non cambia l'altezza della pagina:
    //    nessun ciclo con il ResizeObserver)
    page.style.setProperty('--calc-extra-bottom', calcPageOvershoot(page) + 'px');

    // 2) se il contenuto deborda ancora, rimpicciolisco la scheda quanto basta
    page.style.setProperty('--calc-zoom', '1');
    if (page.scrollHeight <= page.clientHeight + 1) return;

    const cs = getComputedStyle(page);
    // spazio per la scheda: dall'inizio della scheda (sotto l'intestazione della pagina) al margine in fondo
    const available = page.clientHeight - (card.offsetTop - page.offsetTop) - parseFloat(cs.paddingBottom);
    let zoom = Math.max(MIN_CALC_ZOOM, Math.min(1, Math.floor((available / card.offsetHeight) * 100) / 100));
    page.style.setProperty('--calc-zoom', String(zoom));
    // Arrotondamenti e testi che vanno a capo: stringo a piccoli passi finché entra
    while (page.scrollHeight > page.clientHeight + 1 && zoom > MIN_CALC_ZOOM) {
        zoom = Math.max(MIN_CALC_ZOOM, Math.round((zoom - 0.02) * 100) / 100);
        page.style.setProperty('--calc-zoom', String(zoom));
    }
}

let fitScheduled = false;
function scheduleFit() {
    if (fitScheduled) return;
    fitScheduled = true;
    requestAnimationFrame(() => { fitScheduled = false; fitCalcCard(); });
}

function initCalcAutoFit() {
    const page = document.getElementById('page-calculator');
    const card = page && page.querySelector('.calc-card');
    if (!page || !card) return;
    // Lo zoom sta in una variabile su page: la scheda osservata non cambia attributi, niente loop
    if ('ResizeObserver' in window) new ResizeObserver(scheduleFit).observe(page);
    new MutationObserver(scheduleFit).observe(card, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('resize', scheduleFit);
    window.addEventListener('orientationchange', scheduleFit);
    // Safari mobile: la barra degli strumenti che compare/sparisce cambia l'area visibile
    if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleFit);
    scheduleFit();
}
