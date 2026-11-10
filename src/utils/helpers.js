import { CONFIG } from '../core/config.js';

export const $ = id => document.getElementById(id);
export const SYM = s => (s || '').replace('USDT', '');

export const fetchT = (url, ms = 8000) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    return fetch(url, { signal: ac.signal }).finally(() => clearTimeout(t));
};

// Chiamata agli endpoint /api protetti da APP_SECRET (variabile d'ambiente su Vercel).
// La chiave viene chiesta una sola volta, al primo 401, e resta in localStorage su questo dispositivo.
const APP_KEY_STORAGE = 'kronos_app_key';
export async function apiPost(path, body) {
    const send = () => {
        let key = '';
        try { key = localStorage.getItem(APP_KEY_STORAGE) || ''; } catch (e) {}
        const headers = { 'Content-Type': 'application/json' };
        if (key) headers['x-app-key'] = key;
        return fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
    };
    let res = await send();
    if (res.status === 401) {
        const key = (window.prompt('Inserisci la chiave app (APP_SECRET impostata su Vercel):') || '').trim();
        if (!key) return res;
        try { localStorage.setItem(APP_KEY_STORAGE, key); } catch (e) {}
        res = await send();
        if (res.status === 401) { try { localStorage.removeItem(APP_KEY_STORAGE); } catch (e) {} }
    }
    return res;
}

export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fmtUsd = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtUsdt = v => Number(v).toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' USDT';

export function calcEMA(closes, period) { 
    if (closes.length < period) return closes[closes.length - 1]; 
    const k = 2 / (period + 1); 
    let ema = closes.slice(0, period).reduce((s, v) => s + v, 0) / period; 
    for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k); 
    return ema; 
}

export function calcATR(candles, period = 14) { 
    if (candles.length < period + 1) return 0; 
    let sum = 0; 
    for (let i = candles.length - period; i < candles.length; i++) { 
        const c = candles[i], prev = candles[i - 1]; 
        const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)); 
        sum += tr; 
    } 
    return sum / period; 
}

export function calculateRSI(candles, period = 14) {
    if (candles.length < period + 1) return null; 
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) { 
        const d = candles[i].close - candles[i - 1].close; 
        if (d >= 0) gains += d; else losses -= d; 
    }
    let ag = gains / period, al = losses / period; 
    let rs = al === 0 ? 100 : ag / al; 
    let rsi = 100 - (100 / (1 + rs));
    for (let i = period + 1; i < candles.length; i++) { 
        const d = candles[i].close - candles[i - 1].close; 
        const g = d > 0 ? d : 0, l = d < 0 ? -d : 0; 
        ag = (ag * (period - 1) + g) / period; 
        al = (al * (period - 1) + l) / period; 
        rs = al === 0 ? 100 : ag / al; 
        rsi = 100 - (100 / (1 + rs)); 
    }
    return rsi;
}

export function analyzeTrend(candles, livePrice) {
    const neutral = { direction: 'neutral', duration: 0, startTime: null, totalChange: 0, strength: 0, rsi: null, volRatio: 1 };
    const sorted = [...candles].sort((a, b) => a.ts - b.ts); 
    const closed = sorted.slice(0, -1); 
    if (closed.length === 0) return neutral;
    const last = closed[closed.length - 1]; 
    const isG = last.close > last.open, isR = last.close < last.open; 
    if (!isG && !isR) return neutral;
    const direction = isG ? 'bullish' : 'bearish'; 
    let count = 1, firstOpen = last.open, startTime = last.ts;
    for (let i = closed.length - 2; i >= 0; i--) { 
        const c = closed[i]; 
        const same = direction === 'bullish' ? c.close > c.open : c.close < c.open; 
        if (!same) break; 
        count++; firstOpen = c.open; startTime = c.ts; 
    }
    const totalChange = ((livePrice - firstOpen) / firstOpen) * 100; 
    const strength = totalChange / count; 
    const rsi = calculateRSI(closed, 14);
    const trendCandles = closed.slice(-count); 
    const avgTrendVol = trendCandles.reduce((s, c) => s + c.volume, 0) / count; 
    const lastN = closed.slice(-24); 
    const avg24Vol = lastN.reduce((s, c) => s + c.volume, 0) / lastN.length;
    const volRatio = avg24Vol > 0 ? avgTrendVol / avg24Vol : 1;
    return { direction, duration: count, startTime: new Date(startTime), totalChange, strength, rsi, volRatio };
}

export function buildRiskData(closed, price) {
    const ema200 = calcEMA(closed.map(c => c.close), 200);
    const atr = calcATR(closed, 14);
    const atrPct = price > 0 ? (atr / price) * 100 : 0;
    let hh = 0; 
    for (const c of closed.slice(-20)) if (c.high > hh) hh = c.high;
    return { atrPct, macroPass: price > ema200, breakoutPass: price > hh };
}

export function cleanData(arr) {
    if (!arr) return [];
    return arr.filter(d => typeof d.time === 'number' && typeof d.close === 'number' && !isNaN(d.close));
}

export function tradeMarket(t) {
    if (t.market === 'FUTURES' || t.market === 'SPOT') return t.market;
    if (t.margin != null && t.capitalInvested != null && Math.abs(t.margin - t.capitalInvested) > 0.01) return 'FUTURES';
    return 'SPOT';
}

export function tradeLeverage(t) {
    if (t.leverage && t.leverage > 0) return t.leverage;
    if (t.margin > 0 && t.capitalInvested > 0) return Math.max(1, Math.round(t.capitalInvested / t.margin));
    return 1;
}

export function calcPnl(trade, price) {
    const gross = (trade.type === 'LONG' ? price - trade.entryPrice : trade.entryPrice - price) * trade.size;
    const entryNotional = trade.size * trade.entryPrice;
    const exitNotional = trade.size * price;
    const fees = entryNotional * CONFIG.FEE_RATE + exitNotional * CONFIG.FEE_RATE;
    const beforeTax = gross - fees;
    const tax = beforeTax > 0 ? beforeTax * CONFIG.TAX_RATE : 0;
    return { gross, fees, tax, net: beforeTax - tax };
}
