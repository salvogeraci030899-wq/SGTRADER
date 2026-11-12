import { CONFIG } from '../core/config.js';
import { trigger as ghTrigger, command as ghCommand } from '../core/commands.js';
import { isEncrypted, decryptText, aiProof } from '../core/datacrypt.js';

export const $ = id => document.getElementById(id);
export const SYM = s => (s || '').replace('USDT', '');

export const fetchT = (url, ms = 8000) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    return fetch(url, { signal: ac.signal }).finally(() => clearTimeout(t));
};

// Chiamata agli endpoint /api del server comandi, protetti da APP_SECRET.
// Il server è il sito stesso (Vercel) oppure quello indicato in Impostazioni → Server comandi
// (es. Cloudflare Workers): su GitHub Pages /api non esiste.
// La chiave viene chiesta una sola volta, al primo 401, e resta in localStorage su questo dispositivo.
const APP_KEY_STORAGE = 'kronos_app_key';
const API_BASE_STORAGE = 'kronos_api_base';
export function getApiBase() {
    try { return localStorage.getItem(API_BASE_STORAGE) || ''; } catch (e) { return ''; }
}
export function setApiBase(url) {
    try {
        if (url) localStorage.setItem(API_BASE_STORAGE, url.replace(/\/+$/, ''));
        else localStorage.removeItem(API_BASE_STORAGE);
    } catch (e) {}
}
export function clearAppKey() {
    try { localStorage.removeItem(APP_KEY_STORAGE); } catch (e) {}
}

// Alternativa al server, senza Cloudflare né APP_SECRET: un token GitHub (fine-grained, solo questo
// repository, permesso "Actions: Read and write") salvato su questo dispositivo. L'app avvia i
// workflow direttamente con la stessa logica e gli stessi controlli del server (api/_core.js).
// Il token può solo avviare workflow: non legge i segreti e non modifica il codice.
// Chiave dei dati: apre i file personali che il bot salva cifrati nel repository pubblico (tools/datacrypt.py).
// Resta solo su questo dispositivo; al server va solo una prova derivata (header x-sgt-proof).
const DATA_KEY_STORAGE = 'sgt_data_key';
export function getDataKey() {
    try { return localStorage.getItem(DATA_KEY_STORAGE) || ''; } catch (e) { return ''; }
}
export function setDataKey(key) {
    try {
        if (key) localStorage.setItem(DATA_KEY_STORAGE, key);
        else localStorage.removeItem(DATA_KEY_STORAGE);
    } catch (e) {}
}
const GH_TOKEN_STORAGE = 'kronos_gh_token';
export function getGhToken() {
    try { return localStorage.getItem(GH_TOKEN_STORAGE) || ''; } catch (e) { return ''; }
}
export function setGhToken(token) {
    try {
        if (token) localStorage.setItem(GH_TOKEN_STORAGE, token);
        else localStorage.removeItem(GH_TOKEN_STORAGE);
    } catch (e) {}
}
// Da dove partono i comandi: 'server' (indirizzo impostato a mano), 'github' (token sul dispositivo),
// 'site' (il sito stesso, solo su Vercel) oppure 'cloud' (il server Cloudflare del progetto: la scelta
// predefinita su GitHub Pages, così l'app non ha bisogno di Vercel). Chiede APP_SECRET al primo comando.
export function commandMode() {
    if (getApiBase()) return 'server';
    if (getGhToken()) return 'github';
    if (location.hostname.endsWith('vercel.app')) return 'site';
    return 'cloud';
}

// opts.silent: richiesta automatica (non chiesta dall'utente): con 401 non apre la richiesta della chiave
export async function apiPost(path, body, opts = {}) {
    if (commandMode() === 'github' && (path === '/api/command' || path === '/api/trigger')) {
        const fn = path === '/api/command' ? ghCommand : ghTrigger;
        const { status, body: out } = await fn(body, { GH_TOKEN: getGhToken() }, (u, o) => fetch(u, o));
        return new Response(JSON.stringify(out), { status, headers: { 'Content-Type': 'application/json' } });
    }
    // Analisi AI e comandi: senza un indirizzo impostato e fuori da Vercel si usa il server Cloudflare del
    // progetto (ha la chiave Groq, il token GitHub e APP_SECRET)
    const base = getApiBase() || (location.hostname.endsWith('vercel.app') ? '' : CONFIG.AI_SERVER);
    const url = base + path;
    const send = () => {
        let key = '';
        try { key = localStorage.getItem(APP_KEY_STORAGE) || ''; } catch (e) {}
        const headers = { 'Content-Type': 'application/json' };
        if (key) headers['x-app-key'] = key;
        if (proof) headers['x-sgt-proof'] = proof;
        return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    };
    const dataKey = getDataKey();
    const proof = dataKey ? await aiProof(dataKey).catch(() => '') : '';
    let res = await send();
    if (res.status === 401 && !opts.silent) {
        // server senza APP_SECRET: chiedere la chiave non servirebbe (i comandi sono spenti sul server)
        let msg = '';
        try { msg = (await res.clone().json()).error || ''; } catch (e) {}
        if (/non configurata/i.test(msg)) {
            if (window.showAlert) window.showAlert('Comandi spenti sul server', 'Il server Cloudflare non ha la chiave APP_SECRET. Aggiungi il segreto APP_SECRET nel repository GitHub (Settings → Secrets and variables → Actions) e rilancia il workflow "Pubblica server comandi".');
            return res;
        }
        const key = (window.prompt('Inserisci la chiave app (APP_SECRET del server comandi):') || '').trim();
        if (!key) return res;
        try { localStorage.setItem(APP_KEY_STORAGE, key); } catch (e) {}
        res = await send();
        if (res.status === 401) { try { localStorage.removeItem(APP_KEY_STORAGE); } catch (e) {} }
    }
    return res;
}

export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Candele Bitget -> [{ ts, open, high, low, close, volume }] in ordine cronologico, senza doppioni.
// Non si assume l'ordine della risposta: si ordina per data. Con tfMs scarta la candela ancora aperta.
export function parseBitgetCandles(data, tfMs = 0) {
    const byTs = new Map();
    for (const c of data || []) {
        const ts = parseInt(c[0], 10);
        if (!Number.isFinite(ts)) continue;
        byTs.set(ts, { ts, open: parseFloat(c[1]), high: parseFloat(c[2]), low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5]) });
    }
    let candles = [...byTs.values()].sort((a, b) => a.ts - b.ts);
    if (tfMs > 0) candles = candles.filter(c => c.ts + tfMs <= Date.now());
    return candles;
}

export const TF_MS = { '1h': 3600e3, '4h': 4 * 3600e3, '1d': 24 * 3600e3 };

export function fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fmtUsd = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Formato italiano con il punto delle migliaia sempre presente (Intl lo omette sotto 10.000)
export const fmtIt = (v, d = 2) => { const n = Number(v); const [i, f] = Math.abs(n).toFixed(d).split('.'); return (n < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d > 0 ? ',' + f : ''); };
export const fmtUsdt = v => fmtIt(v) + ' USDT';

// File di dati pubblicati dal bot. Su Vercel si leggono da GitHub (sempre aggiornati), altrove dal sito stesso;
// se la fonte non risponde si prova la successiva, per ultima la copia locale.
export async function fetchData(name) {
    const t = `?t=${Date.now()}`;
    const sources = location.hostname.endsWith('vercel.app') ? [...CONFIG.DATA_SOURCES, './'] : ['./'];
    let last = null;
    for (const base of sources) {
        try {
            const r = await fetch(base + name + t, { cache: 'no-store' });
            if (r.ok) return openData(await r.text());
            last = r;
        } catch (e) { /* rete o CORS: provo la fonte successiva */ }
    }
    return last || new Response('null', { status: 503 });
}

// File cifrato: si decifra con la chiave dei dati. Senza chiave (o con quella sbagliata) risponde 423 come
// se il file mancasse, e l'app avvisa una volta (evento "sgt-data-locked")
async function openData(text) {
    if (!isEncrypted(text)) return new Response(text, { status: 200 });
    const key = getDataKey();
    if (key) {
        try { return new Response(await decryptText(text, key), { status: 200 }); } catch (e) { /* chiave sbagliata */ }
    }
    window.dispatchEvent(new CustomEvent('sgt-data-locked', { detail: key ? 'wrong' : 'missing' }));
    return new Response('null', { status: 423 });
}
// prezzo all'italiana senza zeri inutili, separatore delle migliaia sempre (72.000 · 3.000,5 · 0,1234)
export const fmtPrice = v => fmtIt(v, Number(v) >= 1000 ? 1 : 4).replace(/,?0+$/, '');

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
    const rate = trade.feeRate > 0 ? trade.feeRate : CONFIG.FEE_RATE;      // posizioni vecchie: 0,1% per lato
    const fees = (entryNotional + exitNotional) * rate;
    const beforeTax = gross - fees;
    const tax = beforeTax > 0 ? beforeTax * CONFIG.TAX_RATE : 0;
    return { gross, fees, tax, net: beforeTax - tax };
}
