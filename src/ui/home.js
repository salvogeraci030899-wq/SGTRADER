import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { $, SYM, fetchT, calcPnl, escapeHtml, fmtIt, fmtPrice, fetchData, getGhToken } from '../utils/helpers.js';
import { aggregateCellSignals } from './signals.js';
import { bitgetAccountText, isRemovingAlert, paperPerformance, priceAlerts, getAutoState } from './automation.js';
import { TRADE_SYMBOLS } from '../core/commands.js';
import { setHomeChartCoins } from './home-charts.js';
import { updateModePills, tradingMode } from './account.js';
import { liveUpl, hasLiveMarks } from './trade.js';
import { realPositions } from './history.js';

// --- HOME: panoramica ---
// Ordine di lettura: mercato → conto simulato → automazione → stato → grafici.
// Ogni blocco ha una sola fonte:
//   mercato        ticker spot Bitget (ogni 10 s, solo con la Home aperta); di riserva dashboard.json
//   conto simulato State.simState (posizioni aperte a mano dall'app)
//   automazione    automation.json, paper_trades.json, live_trades.json pubblicati dal bot (ogni 30 s)
//   stato          ultimo e prossimo giro di bot, controllo rapido e agente (API pubblica di GitHub, ogni 2 min;
//                  di riserva l'ora del dashboard.json per il bot) e consenso tecnico della pagina Segnali

// Le 3 coin in alto (e nei grafici sotto) tra le 8 delle strategie, scelte ogni minuto: prima quelle con una
// posizione aperta (vera, simulata o su carta), poi quelle con un avviso di prezzo vicino (entro il 3%), poi le
// altre per movimento delle 24 ore. Prezzi delle 8 coin ogni 15 secondi con la Home aperta.
const COINS = TRADE_SYMBOLS;
let shown = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], lastPickAt = 0;
const PICK_EVERY_MS = 60_000;
const MARKET_EVERY_MS = 15_000;
const BOT_FILES_EVERY_MS = 30_000;
// Lavori automatici: quando partono (orari del server Cloudflare, worker/wrangler.toml, e dell'agente,
// .github/workflows/agent.yml, in UTC) e oltre quanti minuti dall'ultimo giro il pallino diventa giallo o rosso.
// Bot e controllo rapido: rosso oltre le 2 ore, come il controllo di salute che avvisa su Telegram.
const JOBS = {
    bot: { file: 'bot.yml', minutes: [2, 17, 32, 47], ok: 30, late: 120 },
    quick: { file: 'quick.yml', minutes: [2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52, 57], ok: 15, late: 120 },
    agent: { file: 'agent.yml', daily: [18, 41], ok: 26 * 60, late: 50 * 60 }
};
const RUNS_EVERY_MS = 120_000, AGENT_EVERY_MS = 900_000;
const runs = {};            // job -> { latest, done } dalle esecuzioni di GitHub
let lastRunsAt = 0, lastAgentAt = 0, runsInFlight = false;

const market = {};          // symbol -> { px, chg } (chg in %, null se non nota)
let bot = null;             // { cfg, ledger, live }
let lastMarketAt = 0, lastBotAt = 0, marketInFlight = false, botInFlight = false;

const isActive = () => { const p = $('page-home'); return !!(p && p.classList.contains('active')); };

export function initHome() {
    setInterval(updateHome, 5000);
}

export function updateHome() {
    if (!isActive() || document.hidden) return;
    const now = Date.now();
    if (now - lastMarketAt >= MARKET_EVERY_MS) { lastMarketAt = now; refreshMarket(); }
    if (now - lastBotAt >= BOT_FILES_EVERY_MS) { lastBotAt = now; refreshBotFiles(); }
    if (now - lastRunsAt >= RUNS_EVERY_MS) { lastRunsAt = now; refreshRuns(); }
    if (now - lastPickAt >= PICK_EVERY_MS && Object.keys(market).length >= 3) { lastPickAt = now; pickCoins(); }
    renderMarket();
    renderAccount();
    renderAutomationCard();
    renderStatus();
    updateModePills();
}

// ---------- Mercato ----------
async function refreshMarket() {
    if (marketInFlight) return;
    marketInFlight = true;
    try {
        await Promise.all(COINS.map(async sym => {
            try {
                const r = await fetchT(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${sym}`);
                if (!r.ok) return;
                const j = await r.json();
                const d = j && j.code === '00000' && j.data && j.data[0];
                if (!d) return;
                const px = parseFloat(d.lastPr), chg = parseFloat(d.change24h);
                if (!isFinite(px)) return;
                market[sym] = { px, chg: isFinite(chg) ? chg * 100 : null };
                State.livePx[sym] = px;
            } catch (e) { /* rete: resta l'ultimo valore */ }
        }));
    } finally { marketInFlight = false; }
    renderMarket();
}

const fmtPx = v => '$' + Number(v).toLocaleString('en-US', v >= 1000 ? { maximumFractionDigits: 0 } : v >= 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { minimumFractionDigits: 4, maximumFractionDigits: 4 });

// Scrive nel DOM solo se il valore cambia: la Home si aggiorna ogni 5 secondi
const put = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
const putCls = (el, c) => { if (el && el.className !== c) el.className = c; };

function openSymbols() {
    const out = new Set();
    for (const p of realPositions()) out.add(p.symbol);
    for (const t of State.simState.activeTrades || []) out.add(t.symbol);
    const { ledger } = getAutoState();
    for (const e of Object.values((ledger && ledger.strategies) || {})) for (const t of e.trades || []) if (t.open) out.add(t.symbol);
    return out;
}
// Quanto conta una coin adesso per te: posizione aperta (3), avviso entro il 3% (2-3), movimento 24h (0-1).
// Lo usano la Home (3 coin in alto), il Mercato (coin all'apertura) e i Segnali (ordine delle pagine).
export function coinRelevance(sym, open = openSymbols()) {
    const m = market[sym], px = (m && m.px) || State.livePx[sym];
    let v = open.has(sym) ? 3 : 0;
    const near = px ? Math.min(...priceAlerts().filter(a => a.symbol === sym).map(a => Math.abs(a.price / px - 1)), Infinity) : Infinity;
    if (near <= 0.03) v += 2 + (1 - near / 0.03);
    return v + Math.min(1, Math.abs((m && m.chg) || 0) / 20);
}
export const topCoins = () => shown.slice();

export function pickCoins() {
    const open = openSymbols();
    const score = sym => coinRelevance(sym, open);
    const best = COINS.map(s => [s, score(s)]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
    // ordine stabile: le coin che restano tengono il loro posto, le nuove prendono quelli liberi
    const next = shown.filter(s => best.includes(s));
    for (const s of best) if (!next.includes(s)) next.push(s);
    if (next.join() === shown.join()) return;
    shown = next;
    const tiles = document.querySelectorAll('#homeMarket .home-tile');
    shown.forEach((sym, i) => {
        const t = tiles[i];
        if (!t) return;
        t.dataset.symbol = sym;
        put(t.querySelector('.home-tile-sym'), SYM(sym));
    });
    setHomeChartCoins(shown);
}

function renderMarket() {
    document.querySelectorAll('#homeMarket .home-tile').forEach(tile => {
        const sym = tile.dataset.symbol;
        const fallback = State.allData && State.allData[`${sym}_1d`];
        const m = market[sym] || (fallback ? { px: fallback.current_price, chg: null } : null);
        const pxEl = tile.querySelector('.home-tile-px'), chgEl = tile.querySelector('.home-tile-chg');
        put(pxEl, m && isFinite(m.px) ? fmtPx(m.px) : '—');
        if (m && m.chg != null) {
            put(chgEl, `${m.chg >= 0 ? '+' : ''}${fmtIt(m.chg)}% 24h`);
            putCls(chgEl, 'home-tile-chg ' + (m.chg > 0 ? 'up' : m.chg < 0 ? 'down' : ''));
        } else {
            put(chgEl, m ? 'dal bot' : '—');
            putCls(chgEl, 'home-tile-chg');
        }
    });
}

// ---------- Conto simulato ----------
const signed = v => (v > 0 ? '+' : '') + Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tone = v => (v > 0 ? ' safe' : v < 0 ? ' danger' : '');

// In modalità Reale la scheda mostra il conto Bitget (letto dal bot ogni 15 minuti), in Simulato
// le posizioni aperte a mano nell'app. Il titolo dice sempre quale dei due si sta guardando.
function renderAccount() {
    const set = (id, text, cls) => { const el = $(id); put(el, text); putCls(el, 'home-kpi-value' + (cls || '')); };
    const label = (id, text) => put($(id), text);
    if (tradingMode().mode === 'on') {
        const acc = bot && bot.live && bot.live.account;
        label('homeAccTitle', 'Conto Bitget · reale');
        label('homePnlLabel', 'Variazione oggi');
        if (!acc || !acc.connected) {
            set('homePnlToday', '—'); set('homeOpenCount', '—'); set('homeOpenPnl', '—');
            return;
        }
        const ch = acc.day_change != null ? acc.day_change : 0;
        set('homePnlToday', signed(ch), tone(ch));
        // posizioni futures e coin spot (BTC, ETH, SOL); PnL al prezzo attuale dove l'acquisto è noto
        const all = realPositions(), n = all.length;
        set('homeOpenCount', String(n));
        const upl = all.reduce((s, p) => s + (liveUpl(p) || 0), 0);
        set('homeOpenPnl', n ? signed(upl) : '—', n ? tone(upl) : '');
        const lbl = $('homeOpenPnlLabel');
        put(lbl, n && hasLiveMarks() ? 'PnL live' : 'PnL aperto');
        return;
    }
    label('homeAccTitle', 'Conto simulato');
    label('homeOpenPnlLabel', 'PnL aperto');
    label('homePnlLabel', 'PnL oggi');
    const today = new Date().toLocaleDateString('it-IT');
    const todayPnl = State.simState.history
        .filter(h => h.closedAt && new Date(h.closedAt).toLocaleDateString('it-IT') === today)
        .reduce((s, h) => s + h.pnl, 0);
    const open = State.simState.activeTrades;
    const floating = open.reduce((s, t) => s + calcPnl(t, t.currentPrice || t.entryPrice).net, 0);
    set('homePnlToday', signed(todayPnl), tone(todayPnl));
    set('homeOpenCount', String(open.length));
    set('homeOpenPnl', open.length ? signed(floating) : '—', open.length ? tone(floating) : '');
}

// ---------- Automazione ----------
async function getJson(name) {
    try {
        const r = await fetchData(name);
        return r.ok ? await r.json() : null;
    } catch (e) { return null; }
}

async function refreshBotFiles() {
    if (botInFlight) return;
    botInFlight = true;
    try {
        const [cfg, ledger, live, alerts, quick, agent] = await Promise.all([getJson('automation.json'), getJson('paper_trades.json'), getJson('live_trades.json'), getJson('alerts_state.json'), getJson('quick_state.json'), getJson('agent_state.json')]);
        bot = { cfg, ledger, live, agent, fired: [...((alerts && alerts._price_alerts_fired) || []), ...((quick && quick._price_alerts_fired) || [])] };
    } finally { botInFlight = false; }
    renderAutomationCard();
    renderAccount();
}

function setLine(id, text, cls = '') {
    const el = $(id);
    if (!el) return;
    put(el, text);
    putCls(el, cls);
}

function renderAutomationCard() {
    if (!bot) return;
    const { cfg, ledger, live } = bot;
    const modes = Object.values((cfg && cfg.strategies) || {});
    const paper = modes.filter(m => m === 'paper').length, real = modes.filter(m => m === 'live').length;
    const stats = Object.values((ledger && ledger.strategies) || {}).map(s => s.stats || {});
    const closed = stats.reduce((s, x) => s + (x.n || 0), 0), opened = stats.reduce((s, x) => s + (x.open || 0), 0);
    if (cfg && cfg.emergency) setLine('homeAutoStrategies', 'EMERGENZA: tutto bloccato', 'text-danger');
    else if (live && live.halted) setLine('homeAutoStrategies', 'esecutore bloccato', 'text-danger');
    else if (!paper && !real) setLine('homeAutoStrategies', 'nessuna attiva');
    else {
        const parts = [];
        if (real) parts.push(`${real} reale`);
        if (paper) parts.push(`${paper} su carta`);
        setLine('homeAutoStrategies', `${parts.join(' · ')} · ${opened} aperti, ${closed} chiusi`, 'text-ui');
    }
    const al = ((cfg && cfg.price_alerts) || []).filter(a => a && !bot.fired.includes(a.id) && !isRemovingAlert(a.id));
    const fmtA = a => `${a.symbol.replace('USDT', '')} ${a.side === 'above' ? '≥' : '≤'} ${fmtPrice(a.price >= 1000 ? Math.round(a.price) : a.price)}`;
    setLine('homeAlerts', al.length ? (al.length <= 2 ? al.map(fmtA).join(' · ') : `${al.length} attivi · ${fmtA(al[0])}…`) : 'nessuno', al.length ? 'text-ui' : '');
    // Agente: autonomia, rendimento della carta (in % del patrimonio, come in Agente → Panoramica), proposte
    const ag = { autonomy: 'paper', ...((cfg && cfg.agent) || {}) };
    const perf = paperPerformance(ledger, Number(cfg && cfg.risk && cfg.risk.risk_per_trade_pct) || 0.5);
    const props = ((bot.agent && bot.agent.proposals) || []).length;
    const agText = [{ off: 'spento', paper: 'simulato', live: 'REALE' }[ag.autonomy] || ag.autonomy,
        perf.n ? `carta ${perf.ret >= 0 ? '+' : ''}${fmtIt(perf.ret, 2)}% (${perf.n} trade)` : 'carta: ancora nessun trade chiuso',
        props ? `${props} ${props === 1 ? 'proposta' : 'proposte'}` : ''].filter(Boolean).join(' · ');
    setLine('homeAgent', agText, props || ag.autonomy === 'live' ? 'text-warning' : 'text-ui');
    const trading = !!(cfg && cfg.risk && cfg.risk.trading_enabled);
    setLine('homeAutoOrders', trading ? 'abilitati' : 'spenti', trading ? 'text-warning' : '');
    const acc = bitgetAccountText(live && live.account);
    setLine('homeAutoBitget', acc.text, acc.cls);
    setLine('homeAutoBitgetDetail', acc.detail || '—');
}

// ---------- Stato ----------
function lastBotUpdate() {
    if (!State.allData) return null;
    let last = 0;
    for (const v of Object.values(State.allData)) {
        const t = v && v.last_update ? Date.parse(v.last_update) : 0;
        if (t > last) last = t;
    }
    return last || null;
}

function ago(minutes) {
    if (minutes < 1) return 'adesso';
    if (minutes < 60) return `${Math.round(minutes)} min fa`;
    if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h fa`;
    return `${Math.floor(minutes / 1440)} giorni fa`;
}

function topSignal() {
    let best = null, bestScore = -1;
    for (const key in State.signalMatrix) {
        const [asset, tf] = key.split('_');
        const agg = aggregateCellSignals(asset, tf);
        if (!agg || agg.consensus === 'NEUTRAL') continue;
        const score = agg.agreement * 100 + agg.avgStrength;
        if (score > bestScore) { bestScore = score; best = { asset, tf, agg }; }
    }
    return best;
}

// Esecuzioni recenti dei workflow (repository pubblico: l'API non chiede chiavi; con il token del telefono
// il limite di richieste è più alto). Una richiesta ogni 2 minuti per bot e controllo rapido, una ogni
// 15 per l'agente, che gira una volta al giorno e non sta tra le ultime esecuzioni.
async function ghRuns(path) {
    const headers = { Accept: 'application/vnd.github+json' };
    const tok = getGhToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 8000);
    const r = await fetch(`https://api.github.com/repos/${CONFIG.GH_REPO}/actions/${path}`, { headers, cache: 'no-store', signal: ac.signal }).finally(() => clearTimeout(timer));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()).workflow_runs || [];
}
function pick(list, file) {
    const mine = list.filter(x => (x.path || '').endsWith('/' + file));
    return mine.length ? { latest: mine[0], done: mine.find(x => x.status === 'completed') || null } : null;
}
async function refreshRuns() {
    if (runsInFlight) return;
    runsInFlight = true;
    try {
        const list = await ghRuns('runs?per_page=40&exclude_pull_requests=true');
        for (const job of ['bot', 'quick']) { const p = pick(list, JOBS[job].file); if (p) runs[job] = p; }
        const a = pick(list, JOBS.agent.file);
        if (a) runs.agent = a;
        else if (Date.now() - lastAgentAt >= AGENT_EVERY_MS) {
            lastAgentAt = Date.now();
            const p = pick(await ghRuns(`workflows/${JOBS.agent.file}/runs?per_page=5`), JOBS.agent.file);
            if (p) runs.agent = p;
        }
    } catch (e) { /* GitHub non raggiungibile o limite di richieste: restano gli ultimi dati (e l'ora del dashboard per il bot) */ }
    finally { runsInFlight = false; renderStatus(); }
}

// Prossimo avvio previsto, in ora locale
function nextRun(job, now = new Date()) {
    const j = JOBS[job];
    if (j.daily) {
        const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), j.daily[0], j.daily[1]));
        if (t <= now) t.setUTCDate(t.getUTCDate() + 1);
        return t;
    }
    for (let k = 1; k <= 60; k++) {
        const t = new Date(now.getTime() + k * 60000);
        if (j.minutes.includes(t.getUTCMinutes())) { t.setSeconds(0, 0); return t; }
    }
    return null;
}
const hhmm = d => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
function whenText(d, now = new Date()) {
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(d) - day(now)) / 86400000);
    return diff === 0 ? hhmm(d) : diff === 1 ? `domani ${hhmm(d)}` : `${d.toLocaleDateString('it-IT', { weekday: 'short' })} ${hhmm(d)}`;
}

function renderJob(job, fallbackAt) {
    const j = JOBS[job], r = runs[job];
    const el = `homeJob${job[0].toUpperCase()}${job.slice(1)}`;
    const next = nextRun(job);
    const nextTxt = next ? ` · prossimo ${whenText(next)}` : '';
    if (r && r.latest && r.latest.status !== 'completed') {
        setLine(el, 'in corso adesso');
        putCls($(el + 'Dot'), 'home-dot good');
        return;
    }
    const doneAt = r && r.done ? Date.parse(r.done.updated_at || r.done.created_at) : fallbackAt;
    if (!doneAt) { setLine(el, `in attesa di dati${nextTxt}`); putCls($(el + 'Dot'), 'home-dot'); return; }
    const min = (Date.now() - doneAt) / 60000;
    const failed = r && r.done && r.done.conclusion && !['success', 'skipped', 'neutral'].includes(r.done.conclusion);
    setLine(el, `${failed ? 'non riuscito ' : ''}${ago(min)}${nextTxt}`);
    putCls($(el + 'Dot'), 'home-dot ' + (failed || min > j.late ? 'bad' : min > j.ok ? 'warn' : 'good'));
}

function renderStatus() {
    renderJob('bot', lastBotUpdate());
    renderJob('quick', null);
    renderJob('agent', null);

    const sig = topSignal();
    const asset = $('homeTopSignalAsset'), badge = $('homeTopSignalBadge');
    put(asset, sig ? `${SYM(sig.asset)} ${sig.tf}` : 'nessuno');
    if (badge) {
        badge.style.display = sig ? '' : 'none';
        if (sig) {
            put(badge, `${sig.agg.consensus} ${sig.agg.agreement}/4`);
            putCls(badge, `sc-badge ${escapeHtml(sig.agg.consensus.toLowerCase())}`);
            badge.title = 'Non validato: indicazione tecnica, non un segnale provato sullo storico';
        }
    }
}
