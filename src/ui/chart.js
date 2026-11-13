// src/ui/chart.js
// Factory unica per i grafici dell'app (Kronos e candele).
// Usata da ui/terminal.js (candele + forecast + bande + markers + priceLines)
// e da ui/home-charts.js (candele + volume).

import { Logger } from '../core/logger.js';
import { cssVar } from '../core/theme.js';

// Grafici creati: al cambio di tema (evento "pt-theme") prendono i colori nuovi
const ALL = new Set();
function themeColors(transparent) {
    return {
        bg: transparent ? 'transparent' : (cssVar('--chart-bg') || '#0a0a0a'),
        text: cssVar('--chart-text') || '#8e8e93',
        grid: cssVar('--chart-grid') || '#1c1c1e'
    };
}
function paint(handle) {
    const c = themeColors(handle.transparent);
    handle.chart.applyOptions({
        layout: { background: { type: 'solid', color: c.bg }, textColor: c.text },
        grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
        rightPriceScale: { borderColor: c.grid },
        timeScale: { borderColor: c.grid }
    });
}
window.addEventListener('pt-theme', () => ALL.forEach(h => { try { paint(h); } catch (e) {} }));

const DEFAULTS = {
    bgColor: '#0a0a0a',
    textColor: '#8e8e93',
    gridColor: '#1c1c1e',
    upColor: '#30d158',
    downColor: '#ff453a',
    showVolume: false,
    showForecast: false,
    showBands: false,
    interactive: true
};

/**
 * Crea un chart handle. Restituisce null se la libreria non è disponibile.
 * @param {HTMLElement} el - contenitore (deve avere dimensioni > 0)
 * @param {object} opts - override dei DEFAULTS
 * @returns {object|null}
 */
export function createChart(el, opts = {}) {
    if (!el) {
        Logger.log('WARN', 'CHART', 'Elemento contenitore non trovato');
        return null;
    }
    if (typeof LightweightCharts === 'undefined') {
        Logger.log('WARN', 'CHART', 'LightweightCharts non disponibile');
        return null;
    }

    const cfg = { ...DEFAULTS, ...opts };
    const theme = themeColors(cfg.bgColor === 'transparent');
    cfg.bgColor = theme.bg; cfg.textColor = theme.text; cfg.gridColor = theme.grid;

    const chart = LightweightCharts.createChart(el, {
        // lingua fissa: date in italiano, e niente errori se il sistema ha una lingua che il browser non riconosce
        localization: { locale: 'it-IT' },
        layout: {
            background: { type: 'solid', color: cfg.bgColor },
            textColor: cfg.textColor,
            fontSize: 10
        },
        grid: {
            vertLines: { color: cfg.gridColor },
            horzLines: { color: cfg.gridColor }
        },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: {
            borderColor: cfg.gridColor,
            scaleMargins: { top: 0.1, bottom: cfg.showVolume ? 0.25 : 0.1 }
        },
        timeScale: {
            borderColor: cfg.gridColor,
            timeVisible: true,
            secondsVisible: false
        },
        handleScroll: cfg.interactive
            ? { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true }
            : { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
        handleScale: cfg.interactive
            ? { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
            : { axisPressedMouseMove: false, mouseWheel: false, pinch: false }
    });

    const candleSeries = chart.addCandlestickSeries({
        upColor: cfg.upColor,
        downColor: cfg.downColor,
        borderVisible: false,
        wickUpColor: cfg.upColor,
        wickDownColor: cfg.downColor
    });

    let ro = null;

    const handle = {
        chart,
        candleSeries,
        volumeSeries: null,
        forecastSeries: null,
        upperSeries: null,
        lowerSeries: null,
        priceLines: [],

        transparent: opts.bgColor === 'transparent',
        destroy: () => {
            ALL.delete(handle);
            try { if (ro) ro.disconnect(); } catch (e) {}
            try { chart.remove(); } catch (e) {}
            handle.priceLines = [];
        },

        resize: () => {
            const w = el.clientWidth;
            const h = el.clientHeight;
            if (w > 0 && h > 0) chart.applyOptions({ width: w, height: h });
        },

        fitContent: () => {
            try { chart.timeScale().fitContent(); } catch (e) {}
        }
    };

    if (cfg.showVolume) {
        handle.volumeSeries = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: ''
        });
        handle.volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    }
    if (cfg.showForecast) {
        handle.forecastSeries = chart.addCandlestickSeries({
            upColor: 'rgba(255, 159, 10, 0.6)',
            downColor: 'rgba(255, 159, 10, 0.6)',
            borderVisible: false
        });
    }
    if (cfg.showBands) {
        handle.upperSeries = chart.addLineSeries({
            color: '#8e8e93',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            crosshairMarkerVisible: false
        });
        handle.lowerSeries = chart.addLineSeries({
            color: '#8e8e93',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            crosshairMarkerVisible: false
        });
    }

    ro = new ResizeObserver(() => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (w > 0 && h > 0) chart.applyOptions({ width: w, height: h });
    });
    ro.observe(el);
    ALL.add(handle);

    return handle;
}

// Apertura/chiusura dello schermo intero senza sfarfallio: il grafico sparisce per due fotogrammi mentre la pagina
// cambia misura, poi ricompare con la stessa porzione di storico (niente "adatta tutto", che faceva saltare lo zoom).
// Un secondo assestamento a 300 ms serve a iOS, che a volte aggiorna le misure in ritardo.
export function relayout(handle, el, change) {
    if (!handle || !el) { change(); return; }
    const ts = handle.chart.timeScale();
    let range = null;
    try { range = ts.getVisibleLogicalRange(); } catch (e) {}
    const restore = () => { handle.resize(); if (range) { try { ts.setVisibleLogicalRange(range); } catch (e) {} } };
    el.style.transition = 'none';
    el.style.opacity = '0';
    change();
    requestAnimationFrame(() => requestAnimationFrame(() => {
        restore();
        el.style.transition = 'opacity 0.15s ease-out';
        el.style.opacity = '1';
    }));
    setTimeout(restore, 300);
}

// ---------- Helpers di set ----------

export function setCandles(handle, candles) {
    if (!handle) return;
    try { handle.candleSeries.setData(candles || []); } catch (e) { /* silent */ }
}

export function setVolume(handle, data) {
    if (!handle || !handle.volumeSeries) return;
    try { handle.volumeSeries.setData(data || []); } catch (e) { /* silent */ }
}

export function setForecast(handle, data) {
    if (!handle || !handle.forecastSeries) return;
    try { handle.forecastSeries.setData(data || []); } catch (e) { /* silent */ }
}

export function setBands(handle, upper, lower) {
    if (!handle) return;
    if (handle.upperSeries) { try { handle.upperSeries.setData(upper || []); } catch (e) {} }
    if (handle.lowerSeries) { try { handle.lowerSeries.setData(lower || []); } catch (e) {} }
}

export function setMarkers(handle, markers) {
    if (!handle) return;
    try { handle.candleSeries.setMarkers(markers || []); } catch (e) { /* silent */ }
}

export function setPriceLines(handle, lines) {
    if (!handle) return;
    if (handle.priceLines && handle.priceLines.length) {
        handle.priceLines.forEach(line => {
            try { handle.candleSeries.removePriceLine(line); } catch (e) {}
        });
        handle.priceLines = [];
    }
    if (!lines || !lines.length) return;
    lines.forEach(line => {
        try { handle.priceLines.push(handle.candleSeries.createPriceLine(line)); } catch (e) {}
    });
}
