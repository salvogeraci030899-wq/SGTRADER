import { State } from '../core/state.js';
import { Logger } from '../core/logger.js';
import { createChart, setCandles, setVolume, relayout } from './chart.js';

// Coin dei grafici della Home: le 3 scelte dalla Home (home.js, setHomeChartCoins), all'inizio BTC, ETH, SOL
const coin = symbol => ({ symbol, label: `${symbol.replace('USDT', '')} / USDT` });
let COINS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map(coin);
const TF_MAP = { '1d': '1day', '4h': '4h', '1h': '1h' };

const ICON_EXPAND = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
const ICON_COLLAPSE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`;

const ICON_SHARE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`;
const ICON_BELL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;

const charts = {};
let initialized = false;

function createChartCard(coin) {
    const card = document.createElement('div');
    card.className = 'home-chart-item';
    card.dataset.symbol = coin.symbol;
    card.innerHTML = `
        <div class="home-chart-header">
            <button class="home-chart-fullscreen" data-symbol="${coin.symbol}" title="Schermo intero">
                ${ICON_EXPAND}
            </button>
            <span class="home-chart-symbol">${coin.label}</span>
            <div class="home-chart-tf-bar">
                <button class="home-tf-btn active" data-tf="1d">1D</button>
                <button class="home-tf-btn" data-tf="4h">4H</button>
                <button class="home-tf-btn" data-tf="1h">1H</button>
            </div>
        </div>
        <div class="home-chart-canvas" id="homeChart-${coin.symbol}"></div>
        <div class="chart-fs-tools">
            <button type="button" class="chart-tool" data-act="alert" title="Avviso di prezzo" aria-label="Avviso di prezzo">${ICON_BELL}</button>
            <button type="button" class="chart-tool" data-act="share" title="Condividi" aria-label="Condividi">${ICON_SHARE}</button>
        </div>
    `;
    return card;
}

function initChart(symbol) {
    if (charts[symbol]) return;
    const el = document.getElementById(`homeChart-${symbol}`);
    if (!el) return;

    try {
        const handle = createChart(el, {
            bgColor: 'transparent',
            showVolume: true,
            interactive: true
        });
        if (!handle) {
            Logger.log('WARN', 'HOME_CHARTS', `Impossibile creare chart per ${symbol}`);
            return;
        }
        charts[symbol] = { handle, tf: '1d', el };
    } catch (e) {
        Logger.log('ERROR', 'HOME_CHARTS', `Errore init chart ${symbol}: ${e.message}`);
    }
}

async function loadCandles(symbol) {
    const s = charts[symbol];
    if (!s) return;
    try {
        const gran = TF_MAP[s.tf];
        const url = `https://api.bitget.com/api/v2/spot/market/candles?symbol=${symbol}&granularity=${gran}&limit=200`;
        const res = await fetch(url);
        const json = await res.json();
        if (!json.data || !Array.isArray(json.data)) return;

        const seen = new Set();
        const candles = [];
        for (const d of json.data) {
            const t = Math.floor(parseInt(d[0]) / 1000);
            if (seen.has(t)) continue;
            seen.add(t);
            candles.push({
                time: t,
                open: parseFloat(d[1]), high: parseFloat(d[2]),
                low: parseFloat(d[3]), close: parseFloat(d[4]),
                volume: parseFloat(d[5])
            });
        }
        candles.sort((a, b) => a.time - b.time);
        if (candles.length) s.last = candles[candles.length - 1].close;

        setCandles(s.handle, candles.map(c => ({
            time: c.time, open: c.open, high: c.high, low: c.low, close: c.close
        })));
        setVolume(s.handle, candles.map(c => ({
            time: c.time, value: c.volume,
            color: c.close >= c.open ? 'rgba(48,209,88,0.35)' : 'rgba(255,69,58,0.35)'
        })));
        s.handle.fitContent();
    } catch (e) { /* silent */ }
}

export function toggleFullscreen(symbol) {
    const card = document.querySelector(`.home-chart-item[data-symbol="${symbol}"]`);
    if (!card) return;

    const isEntering = !card.classList.contains('fullscreen');
    const s0 = charts[symbol];
    relayout(s0 && s0.handle, s0 && s0.el, () => {
        card.classList.toggle('fullscreen', isEntering);
        document.body.classList.toggle('chart-fullscreen', isEntering);
        if (!isEntering) goToHomeChart(COINS.findIndex(c => c.symbol === symbol), 'instant');
    });

    const btn = card.querySelector('.home-chart-fullscreen');
    if (btn) {
        btn.innerHTML = isEntering ? ICON_COLLAPSE : ICON_EXPAND;
        btn.title = isEntering ? 'Chiudi' : 'Schermo intero';
    }

    // all'uscita il riquadro torna stretto: relayout rimisura il grafico sulla scheda (non sullo schermo)
    if (!isEntering) setTimeout(() => goToHomeChart(COINS.findIndex(c => c.symbol === symbol), 'instant'), 300);
}

export function goToHomeChart(idx, behavior = 'smooth') {
    const list = document.getElementById('homeChartsList');
    if (list && idx >= 0) list.scrollTo({ left: idx * list.clientWidth, behavior });
}

export function updateHomeChartDots() {
    const list = document.getElementById('homeChartsList');
    if (!list || list.clientWidth === 0) return;
    const idx = Math.round(list.scrollLeft / list.clientWidth);
    document.querySelectorAll('#homeChartDots .info-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
    // il riquadro del mercato evidenziato è la coin del grafico visibile
    document.querySelectorAll('#homeMarket .home-tile').forEach((t, i) => t.classList.toggle('active', i === idx));
}

export function refresh() {
    if (!initialized) {
        initHomeCharts();
        return;
    }
    COINS.forEach(c => {
        const s = charts[c.symbol];
        if (!s || !s.el) return;
        const w = s.el.clientWidth;
        const h = s.el.clientHeight;
        if (w > 0 && h > 0) s.handle.chart.applyOptions({ width: w, height: h });
    });
}

function wireCard(card) {
    const symbol = card.dataset.symbol;
    card.querySelectorAll('.home-tf-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            card.querySelectorAll('.home-tf-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (charts[symbol]) {
                charts[symbol].tf = btn.dataset.tf;
                loadCandles(symbol);
            }
        });
    });
    card.querySelector('[data-act="alert"]').addEventListener('click', e => {
        e.stopPropagation();
        window.openChartAlert(symbol, State.livePx[symbol] || (charts[symbol] && charts[symbol].last));
    });
    card.querySelector('[data-act="share"]').addEventListener('click', e => {
        e.stopPropagation();
        const tf = (charts[symbol] && charts[symbol].tf) || '1d';
        window.takeSnapshot(e.currentTarget, card, `${symbol.replace('USDT', '')} · ${tf.toUpperCase()}`);
    });
    const fsBtn = card.querySelector('.home-chart-fullscreen');
    if (fsBtn) {
        fsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFullscreen(symbol);
        });
    }
}

// Cambio delle coin mostrate: si tolgono i grafici delle coin uscite e si creano quelli delle nuove, nell'ordine dato
export function setHomeChartCoins(symbols) {
    const next = symbols.slice(0, 3);
    if (next.join() === COINS.map(c => c.symbol).join()) return;
    COINS = next.map(coin);
    const container = document.getElementById('homeChartsList');
    if (!initialized || !container) return;
    for (const sym of Object.keys(charts)) {
        if (!next.includes(sym)) {
            try { charts[sym].handle.destroy(); } catch (e) { /* già tolto */ }
            delete charts[sym];
        }
    }
    const old = Object.fromEntries([...container.querySelectorAll('.home-chart-item')].map(c => [c.dataset.symbol, c]));
    container.replaceChildren(...COINS.map(c => {
        if (old[c.symbol]) return old[c.symbol];
        const card = createChartCard(c);
        wireCard(card);
        return card;
    }));
    COINS.forEach(c => { if (!charts[c.symbol]) { initChart(c.symbol); loadCandles(c.symbol); } });
    container.scrollLeft = 0;
    updateHomeChartDots();
}

export function initHomeCharts() {
    if (initialized) { refresh(); return; }

    const container = document.getElementById('homeChartsList');
    if (!container) return;

    for (const coin of COINS) {
        container.appendChild(createChartCard(coin));
    }
    for (const coin of COINS) {
        initChart(coin.symbol);
    }

    container.querySelectorAll('.home-chart-item').forEach(wireCard);

    container.addEventListener('scroll', () => {
        clearTimeout(window._homeChartsScrollTimeout);
        window._homeChartsScrollTimeout = setTimeout(updateHomeChartDots, 50);
    });

    COINS.forEach(c => {
        loadCandles(c.symbol);
    });

    setInterval(() => {
        // solo con la Home in vista e l'app in primo piano
        if (document.hidden || !document.getElementById('page-home')?.classList.contains('active')) return;
        COINS.forEach(c => loadCandles(c.symbol));
    }, 60000);

    initialized = true;
}
