import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { Logger } from '../core/logger.js';
import { $, SYM, fetchT, fmtUsd, fmtUsdt } from '../utils/helpers.js';
import * as Terminal from './terminal.js';

export function initCalculator() {
    ['calcCapital', 'calcEntry', 'calcStop', 'calcTarget', 'calcRisk', 'calcLev', 'calcSlippage', 'calcFee', 'calcSlippageSpot', 'calcFeeSpot'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calc);
    });
    const dirEl = document.getElementById('calcDirection');
    if (dirEl) dirEl.addEventListener('change', calc);

    ['calcEntry', 'calcStop', 'calcTarget'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', renderBreakEven);
    });

    const capInput = $('calcCapital');
    if (capInput) capInput.addEventListener('input', () => { State.capitalTouched = true; });

    initCalcAutoFit();

    const hdr = document.querySelector('#page-calculator .calc-header span');
    if (hdr) {
        const lbl = document.createElement('small');
        lbl.id = 'calcCtx';
        hdr.appendChild(lbl);
    }
}

export function setMarket(market) {
    State.currentMarket = market;
    document.getElementById('btn-market-spot').classList.toggle('active', market === 'SPOT');
    document.getElementById('btn-market-fut').classList.toggle('active', market === 'FUTURES');
    if (market === 'FUTURES') { document.getElementById('lev-grid').style.display = 'grid'; document.getElementById('spot-grid').style.display = 'none'; }
    else { document.getElementById('lev-grid').style.display = 'none'; document.getElementById('spot-grid').style.display = 'grid'; }
    calc();
}

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
    capInput.value = Math.round(State.simState.freeBalance * 100) / 100;
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
          calcWarning = document.getElementById('calcWarning'), calcError = document.getElementById('calcError');

    resTax.previousElementSibling.textContent = `Tasse (${Math.round(CONFIG.TAX_RATE * 100)}%)`;
    calcWarning.style.display = 'none';
    calcError.style.display = 'none';

    const clearAll = () => {
        resRR.textContent = resMargin.textContent = resSize.textContent = resRiskEur.textContent =
        resGross.textContent = resCosts.textContent = resTax.textContent = resNet.textContent = '—';
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
    const taxes = Math.max(0, grossProfit - totalFees) * CONFIG.TAX_RATE;
    const netProfit = grossProfit - totalFees - taxes;

    const notes = [];
    if (capped) notes.push(`<b>Size al massimo consentito dal capitale.</b><br>Con stop del ${(stopDistPct * 100).toFixed(2)}% il rischio massimo è <b>${realRiskPct.toFixed(2)}%</b>, non ${riskPct}%.`);
    if (State.currentMarket === 'FUTURES' && leverage > 1) {
        const liqDistPct = 1 / leverage;
        if (stopDistPct >= liqDistPct * 0.8) notes.push(`Con leva ${leverage}x la liquidazione è a ~${(liqDistPct * 100).toFixed(1)}%.`);
    }
    if (rr < 1.5) notes.push('R:R inferiore a 1.5. Trade sconsigliato.');
    
    if (notes.length) { calcWarning.innerHTML = notes.join('<br><br>'); calcWarning.style.display = 'block'; }

    resRR.textContent = rr.toFixed(2);
    resRiskEur.textContent = `${Math.round(realRisk)} USDT (${realRiskPct.toFixed(2)}%)`;
    resMargin.textContent = `${Math.round(marginRequired)} USDT`;
    resSize.textContent = `${Math.round(sizeNominal)} USDT`;
    resGross.textContent = `+${Math.round(grossProfit)} USDT`;
    resCosts.textContent = `-${Math.round(totalFees)} USDT`;
    resTax.textContent = `-${Math.round(taxes)} USDT`;
    resNet.textContent = `${netProfit > 0 ? '+' : ''}${Math.round(netProfit)} USDT`;

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

export function renderBreakEven() {
    const slIn = document.getElementById('calcStop');
    const tpIn = document.getElementById('calcTarget');
    if(!slIn || !tpIn) return;
    const entry = getVal('calcEntry');
    if (!entry) return;
    const slPct = Math.abs(entry - getVal('calcStop')) / entry;
    const tpPct = Math.abs(getVal('calcTarget') - entry) / entry;
    if(slPct === 0 || tpPct === 0) return;

    const cap = 1000;
    const winGross = cap * tpPct; const winFees = cap * CONFIG.FEE_RATE + (cap + winGross) * CONFIG.FEE_RATE;
    const winBeforeTax = winGross - winFees; const winTax = winBeforeTax > 0 ? winBeforeTax * CONFIG.TAX_RATE : 0;
    const winNetPct = (winBeforeTax - winTax) / cap; const lossGross = -cap * slPct;
    const lossFees = cap * CONFIG.FEE_RATE + (cap + lossGross) * CONFIG.FEE_RATE; const lossNetPct = (lossGross - lossFees) / cap;
    const breakEven = Math.abs(lossNetPct) / (winNetPct + Math.abs(lossNetPct));
    const bePct = breakEven * 100;

    document.getElementById('beValue').textContent = bePct.toFixed(1) + '%';
    document.getElementById('beMarker').style.left = Math.min(100, Math.max(0, bePct)) + '%';
    
    const trades = State.simState.history;
    if (trades.length === 0) {
        document.getElementById('beActualWr').textContent = '—';
        document.getElementById('beDelta').textContent = '—';
        document.getElementById('beDot').style.display = 'none';
        document.getElementById('beBadge').textContent = 'In attesa';
        document.getElementById('beBadge').className = 'be-badge neutral';
        return;
    }
    const wins = trades.filter(t => t.pnl > 0);
    const wrPct = (wins.length / trades.length) * 100;
    const delta = wrPct - bePct;
    document.getElementById('beActualWr').textContent = wrPct.toFixed(1) + '%';
    document.getElementById('beActualWr').style.color = delta >= 0 ? 'var(--accent)' : 'var(--danger)';
    document.getElementById('beDelta').textContent = (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%';
    document.getElementById('beDelta').style.color = delta >= 0 ? 'var(--accent)' : 'var(--danger)';
    const dot = document.getElementById('beDot');
    dot.style.display = 'block'; dot.style.left = Math.min(100, Math.max(0, wrPct)) + '%';
    if (delta >= 5) { document.getElementById('beBadge').textContent = 'Profittevole'; document.getElementById('beBadge').className = 'be-badge good'; }
    else if (delta >= 0) { document.getElementById('beBadge').textContent = 'Marginale'; document.getElementById('beBadge').className = 'be-badge warn'; }
    else { document.getElementById('beBadge').textContent = 'In perdita'; document.getElementById('beBadge').className = 'be-badge bad'; }
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
    setCtxLabel();
    if (window.switchTab) window.switchTab('calculator');
    calc();
}

export async function openTradeFromCalculator() {
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
    const btn = document.querySelector('#page-calculator .btn-cta-primary');
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
    const available = page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
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
