import { State } from '../core/state.js';
import { $, SYM, fetchT, calcPnl, escapeHtml, fmtIt, fmtPrice, fetchData } from '../utils/helpers.js';
import { aggregateCellSignals } from './signals.js';
import { bitgetAccountText, isRemovingAlert } from './automation.js';
import { updateModePills, tradingMode } from './account.js';
import { liveUpl, hasLiveMarks } from './trade.js';

// --- HOME: panoramica ---
// Ordine di lettura: mercato → conto simulato → automazione → stato → grafici.
// Ogni blocco ha una sola fonte:
//   mercato        ticker spot Bitget (ogni 10 s, solo con la Home aperta); di riserva dashboard.json
//   conto simulato State.simState (posizioni aperte a mano dall'app)
//   automazione    automation.json, paper_trades.json, live_trades.json pubblicati dal bot (ogni 30 s)
//   stato          ora dell'ultimo giro del bot (dashboard.json) e consenso tecnico della pagina Segnali

const COINS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const MARKET_EVERY_MS = 10_000;
const BOT_FILES_EVERY_MS = 30_000;
// Il bot parte ogni 15 minuti (Cloudflare): verde fino a 30 min, giallo fino a 2 h (soglia del
// controllo di salute), poi rosso.
const BOT_OK_MIN = 30, BOT_LATE_MIN = 120;

const market = {};          // symbol -> { px, chg } (chg in %, null se non nota)
let bot = null;             // { cfg, ledger, live }
let lastMarketAt = 0, lastBotAt = 0, marketInFlight = false, botInFlight = false;

const isActive = () => { const p = $('page-home'); return !!(p && p.classList.contains('active')); };

export function initHome() {
    setInterval(updateHome, 5000);
}

export function updateHome() {
    if (!isActive()) return;
    const now = Date.now();
    if (now - lastMarketAt >= MARKET_EVERY_MS) { lastMarketAt = now; refreshMarket(); }
    if (now - lastBotAt >= BOT_FILES_EVERY_MS) { lastBotAt = now; refreshBotFiles(); }
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

const fmtPx = v => '$' + Number(v).toLocaleString('en-US', v >= 1000 ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderMarket() {
    document.querySelectorAll('#homeMarket .home-tile').forEach(tile => {
        const sym = tile.dataset.symbol;
        const fallback = State.allData && State.allData[`${sym}_1d`];
        const m = market[sym] || (fallback ? { px: fallback.current_price, chg: null } : null);
        const pxEl = tile.querySelector('.home-tile-px'), chgEl = tile.querySelector('.home-tile-chg');
        pxEl.textContent = m && isFinite(m.px) ? fmtPx(m.px) : '—';
        if (m && m.chg != null) {
            chgEl.textContent = `${m.chg >= 0 ? '+' : ''}${fmtIt(m.chg)}% 24h`;
            chgEl.className = 'home-tile-chg ' + (m.chg > 0 ? 'up' : m.chg < 0 ? 'down' : '');
        } else {
            chgEl.textContent = m ? 'dal bot' : '—';
            chgEl.className = 'home-tile-chg';
        }
    });
}

// ---------- Conto simulato ----------
const signed = v => (v > 0 ? '+' : '') + Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tone = v => (v > 0 ? ' safe' : v < 0 ? ' danger' : '');

// In modalità Reale la scheda mostra il conto Bitget (letto dal bot ogni 15 minuti), in Simulato
// le posizioni aperte a mano nell'app. Il titolo dice sempre quale dei due si sta guardando.
function renderAccount() {
    const set = (id, text, cls) => { const el = $(id); if (el) { el.textContent = text; el.className = 'home-kpi-value' + (cls || ''); } };
    const label = (id, text) => { const el = $(id); if (el) el.textContent = text; };
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
        set('homeOpenCount', String(acc.positions || 0));
        // PnL aperto al prezzo mark attuale (stima tra un giro del bot e l'altro)
        const upl = (acc.positions_detail || []).reduce((s, p) => s + (liveUpl(p) || 0), 0) || acc.upl || 0;
        set('homeOpenPnl', acc.positions ? signed(upl) : '—', acc.positions ? tone(upl) : '');
        const lbl = $('homeOpenPnlLabel');
        if (lbl) lbl.textContent = acc.positions && hasLiveMarks() ? 'PnL live' : 'PnL aperto';
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
        const [cfg, ledger, live, alerts, quick] = await Promise.all([getJson('automation.json'), getJson('paper_trades.json'), getJson('live_trades.json'), getJson('alerts_state.json'), getJson('quick_state.json')]);
        bot = { cfg, ledger, live, fired: [...((alerts && alerts._price_alerts_fired) || []), ...((quick && quick._price_alerts_fired) || [])] };
    } finally { botInFlight = false; }
    renderAutomationCard();
    renderAccount();
}

function setLine(id, text, cls = '') {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = cls;
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

function renderStatus() {
    const last = lastBotUpdate();
    const dot = $('homeBotDot');
    if (last) {
        const min = (Date.now() - last) / 60000;
        setLine('homeLastUpdate', `ultimo giro ${ago(min)}`);
        if (dot) dot.className = 'home-dot ' + (min <= BOT_OK_MIN ? 'good' : min <= BOT_LATE_MIN ? 'warn' : 'bad');
    } else {
        setLine('homeLastUpdate', State.allData ? 'nessun dato' : 'in caricamento');
        if (dot) dot.className = 'home-dot';
    }

    const sig = topSignal();
    const asset = $('homeTopSignalAsset'), badge = $('homeTopSignalBadge');
    if (asset) asset.textContent = sig ? `${SYM(sig.asset)} ${sig.tf}` : 'nessuno';
    if (badge) {
        badge.style.display = sig ? '' : 'none';
        if (sig) {
            badge.textContent = `${sig.agg.consensus} ${sig.agg.agreement}/4`;
            badge.className = `sc-badge ${escapeHtml(sig.agg.consensus.toLowerCase())}`;
            badge.title = 'Non validato: indicazione tecnica, non un segnale provato sullo storico';
        }
    }
}
