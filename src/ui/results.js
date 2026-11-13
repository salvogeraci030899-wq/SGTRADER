// --- RISULTATI: quanto hai guadagnato o perso, per periodo e per fonte (ex Diario) ---
// Fonti, mai mescolate:
//   Reale:    conto Bitget. Totale del periodo dallo storico del patrimonio (equity_history.json, al netto di
//             versamenti e prelievi); se lo storico non copre il periodo, la somma dei trade chiusi.
//   Simulato: i trade simulati dell'app (al netto di commissioni e tasse simulate).
//   Carta:    le strategie su carta dell'agente, in % del patrimonio con il rischio per trade attuale.
// Periodi: oggi, settimana (da lunedì), mese, anno, tutto. Elenchi a scorrimento orizzontale.
// In Reale i trade si dividono in A mano e Agente: è dell'agente un trade chiuso su Bitget che corrisponde
// (coin, lato, apertura entro 10 minuti) a una posizione aperta dall'esecutore (live_trades.json).
import { State } from '../core/state.js';
import { $, SYM, escapeHtml, fmtIt, fetchData, markChosen, chosenRecently } from '../utils/helpers.js';
import { isRealMode, realHistory, realAccount } from './history.js';
import { getAutoState, loadAutomation } from './automation.js';

const SRC = { real: 'Bitget · reale', sim: 'Trade simulati dell\'app', paper: 'Strategie su carta' };
const PERIODS = { day: 'Oggi', week: 'Settimana', month: 'Mese', year: 'Anno', all: 'Tutto' };
const WHO = { all: 'Tutti', manual: 'A mano', agent: 'Agente' };
let src = null, period = 'month', who = 'all', equity = null, equityAt = 0;

// Strategia dell'esecutore che ha aperto questo trade reale, o null se aperto a mano
function agentKey(h) {
    const { live } = getAutoState();
    const opened = Number(h.entryTime) || 0;
    if (!opened || h.market === 'SPOT') return null;
    for (const p of Object.values((live && live.positions) || {})) {
        if (!p || !p.opened_at || p.status === 'skipped' || p.status === 'error' || p.symbol !== h.symbol) continue;
        if ((p.side === 'short' ? 'SHORT' : 'LONG') !== h.type) continue;
        if (Math.abs(Date.parse(p.opened_at) - opened) <= 10 * 60e3) return p.key || 'agente';
    }
    return null;
}

function periodStart(p, now = new Date()) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (p === 'day') return d;
    if (p === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
    if (p === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (p === 'year') return new Date(now.getFullYear(), 0, 1);
    return new Date(0);
}
const periodLabel = (p, now = new Date()) => p === 'month' ? now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    : p === 'year' ? String(now.getFullYear()) : p === 'week' ? 'Da lunedì' : p === 'day' ? 'Oggi' : 'Dall\'inizio';

async function loadEquity() {
    if (equity && Date.now() - equityAt < 5 * 60e3) return;
    try { const r = await fetchData('equity_history.json'); equity = r.ok ? await r.json() : null; } catch (e) { equity = null; }
    equityAt = Date.now();
}

// Trade chiusi della fonte, nello stesso formato: t (ms), symbol, pnl (USDT; in Carta: % del patrimonio), fees
function trades(source) {
    if (source === 'real') return realHistory().map(h => { const k = agentKey(h); return { t: h.closedAt, symbol: h.symbol, side: h.type, pnl: h.pnl, fees: h.fees || 0, entry: h.entry, exit: h.exit, market: h.market, by: k ? 'agent' : 'manual', key: k || undefined }; })
        .filter(x => who === 'all' || x.by === who);
    if (source === 'sim') return (State.simState.history || []).map(h => ({ t: h.closedAt || h.exitTime, symbol: h.symbol, side: h.type, pnl: Number(h.pnl) || 0, fees: (h.fees || 0) + (h.tax || 0), entry: h.entryPrice || h.entry, exit: h.exitPrice || h.exit, market: h.market, reason: h.reason }));
    const { ledger, cfg } = getAutoState();
    const risk = Number(cfg && cfg.risk && cfg.risk.risk_per_trade_pct) || 0.5;
    const out = [];
    for (const [key, e] of Object.entries((ledger && ledger.strategies) || {})) {
        for (const t of e.trades || []) {
            if (t.open || t.net == null || !t.entry || !t.stop) continue;
            const stop = Math.abs(t.entry - t.stop) / t.entry * 100;
            if (stop > 0) out.push({ t: (t.t_exit || t.t) * 1000, symbol: t.symbol, side: t.dir > 0 ? 'LONG' : 'SHORT', pnl: t.net / stop * risk, fees: 0, entry: t.entry, exit: t.exit, key });
        }
    }
    return out;
}

function summary(source, p) {
    const start = periodStart(p).getTime();
    const list = trades(source).filter(x => x.t && x.t >= start).sort((a, b) => a.t - b.t);
    let total = list.reduce((s, x) => s + x.pnl, 0), base = null, curve = [];
    let usedEquity = false;
    if (source === 'real' && who === 'all' && equity && equity.days) {
        const from = new Date(start).toISOString().slice(0, 10);
        const days = Object.entries(equity.days).filter(([d]) => d >= from).sort(([a], [b]) => a.localeCompare(b));
        if (days.length) {
            usedEquity = true;
            total = days.reduce((s, [, r]) => s + (r.pnl || 0), 0);
            base = days[0][1].open + (days[0][1].flows || 0);
            let c = 0;
            curve = days.map(([d, r]) => [Date.parse(d), (c += r.pnl || 0)]);
        }
    }
    if (!usedEquity) {
        let c = 0;
        curve = list.map(x => [x.t, (c += x.pnl)]);
        if (source === 'sim') base = State.simState.initialAccountBalance;
        if (source === 'real') { const acc = realAccount(); base = acc && acc.total_usdt ? acc.total_usdt - total : null; }
    }
    let peak = 0, dd = 0;
    for (const [, v] of curve) { peak = Math.max(peak, v); dd = Math.max(dd, peak - v); }
    const wins = list.filter(x => x.pnl > 0).length;
    const coins = {};
    for (const x of list) {
        const c = coins[x.symbol] || (coins[x.symbol] = { pnl: 0, n: 0 });
        c.pnl += x.pnl;
        c.n++;
    }
    return { list, total, base, curve, dd, wins, coins, fees: list.reduce((s, x) => s + (x.fees || 0), 0), usedEquity };
}

const money = (v, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtIt(Math.abs(v), d)}`;
const tone = v => (v > 0 ? 'text-accent' : v < 0 ? 'text-danger' : '');

function spark(curve) {
    if (curve.length < 2) return '<div class="res-chart-empty">Servono almeno due punti per la curva.</div>';
    const W = 300, H = 80, P = 4, xs = curve.map(c => c[0]), ys = [0, ...curve.map(c => c[1])];
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const X = x => P + (x1 > x0 ? (x - x0) / (x1 - x0) : 1) * (W - 2 * P), Y = y => H - P - (y1 > y0 ? (y - y0) / (y1 - y0) : 0.5) * (H - 2 * P);
    const pts = curve.map(c => `${X(c[0]).toFixed(1)},${Y(c[1]).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="agent-spark"><line x1="0" x2="${W}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" class="zero"/><polyline points="${pts}" class="${curve[curve.length - 1][1] >= 0 ? 'up' : 'down'}"/></svg>`;
}

export function setResultsSource(s) { markChosen('resSrc'); src = SRC[s] ? s : 'real'; renderResults(); }

// All'apertura della pagina (se non hai scelto tu negli ultimi 30 minuti): la fonte che ha dati nel periodo,
// nell'ordine Reale, Carta, Simulato; se nessuna ne ha, quella della modalità attiva
export function autoResultsSource() { if (!chosenRecently('resSrc')) src = null; }
function pickSource() {
    const start = periodStart(period).getTime();
    const has = s => trades(s).some(x => x.t && x.t >= start);
    const from = new Date(start).toISOString().slice(0, 10);
    const realDays = equity && equity.days && Object.entries(equity.days).some(([d, r]) => d >= from && r.pnl);
    if (realDays || has('real')) return 'real';
    if (has('paper')) return 'paper';
    if (has('sim')) return 'sim';
    return isRealMode() ? 'real' : 'sim';
}
export function setResultsPeriod(p) { period = PERIODS[p] ? p : 'month'; renderResults(); }
export function setResultsWho(w) { who = WHO[w] ? w : 'all'; renderResults(); }

export async function renderResults() {
    const box = $('resBody');
    if (!box || !$('page-journal').classList.contains('active')) return;
    if (!src) {
        box.innerHTML = '<div class="empty-hint">Caricamento…</div>';
        if (!getAutoState().loaded) await loadAutomation();
        await loadEquity();
        src = pickSource();
    }
    for (const k of Object.keys(SRC)) $(`res-src-${k}`).classList.toggle('active', k === src);
    for (const k of Object.keys(PERIODS)) $(`res-per-${k}`).classList.toggle('active', k === period);
    $('journalSubtitle').textContent = SRC[src];
    if (src === 'paper' && !getAutoState().loaded) { box.innerHTML = '<div class="empty-hint">Caricamento…</div>'; await loadAutomation(); }
    if (src === 'real') { if (!getAutoState().loaded) await loadAutomation(); await loadEquity(); }
    const s = summary(src, period);
    const paper = src === 'paper';
    const unit = paper ? '%' : ' USDT';
    const pct = !paper && s.base > 0 ? s.total / s.base * 100 : null;
    const ddTxt = paper ? `−${fmtIt(s.dd, 2)}%` : s.base > 0 ? `−${fmtIt(s.dd / s.base * 100, 1)}%` : `−${fmtIt(s.dd, 2)}`;
    const note = paper ? 'in % del patrimonio, rischio per trade attuale · simulato'
        : src === 'real' ? (who !== 'all' ? `solo trade ${who === 'agent' ? 'dell\'agente' : 'aperti a mano'}, somma dei chiusi` : s.usedEquity ? 'variazione del conto, al netto di versamenti e prelievi' : 'somma dei trade chiusi (storico del conto non ancora disponibile)')
        : 'al netto di commissioni e tasse simulate';
    const coinCards = Object.entries(s.coins).sort((a, b) => b[1].pnl - a[1].pnl)
        .map(([c, v]) => `<div class="res-mini"><b>${SYM(c)}</b><b class="${tone(v.pnl)}">${money(v.pnl)}${paper ? '%' : ''}</b><small>${v.n} trade</small></div>`).join('');
    const tradeCards = [...s.list].reverse().map(x => `<div class="res-trade"><div class="res-trade-h"><b>${SYM(x.symbol)} ${escapeHtml(x.side || '')}</b><small>${new Date(x.t).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</small></div>`
        + `<small>${x.entry ? fmtIt(x.entry, x.entry >= 1000 ? 0 : 2) : '—'} → ${x.exit ? fmtIt(x.exit, x.exit >= 1000 ? 0 : 2) : '—'}${x.by === 'manual' ? ' · a mano' : x.key ? ' · ' + (x.by === 'agent' ? 'agente ' : '') + escapeHtml(String(x.key).replace(/_/g, ' ')) : x.reason ? ' · ' + escapeHtml(String(x.reason).toLowerCase()) : ''}</small>`
        + `<b class="${tone(x.pnl)}">${money(x.pnl)}${unit}</b></div>`).join('');
    box.innerHTML = `
        <div class="card-box res-big"><small>${escapeHtml(periodLabel(period))} · ${escapeHtml(note)}</small>
            <b class="${tone(s.total)}">${money(s.total)}${unit}</b>${pct != null ? `<span class="${tone(s.total)}">${money(pct, 1)}%</span>` : ''}</div>
        <div class="card-box res-chart">${spark(s.curve)}</div>
        <div class="res-kpis"><div><small>Trade</small><b>${s.list.length}</b></div><div><small>Vincenti</small><b>${s.list.length ? fmtIt(s.wins / s.list.length * 100, 0) + '%' : '—'}</b></div>
            <div><small>Costi</small><b class="text-warning">${paper ? 'inclusi' : (s.fees ? '−' + fmtIt(s.fees, 2) : '0')}</b></div><div><small>Calo max</small><b class="${s.dd ? 'text-danger' : ''}">${s.dd ? ddTxt : '0'}</b></div></div>
        <div class="section-title"><span>Da dove viene</span></div>
        <div class="res-hlist">${coinCards || '<div class="empty-hint">Nessun trade chiuso nel periodo.</div>'}</div>
        <div class="section-title"><span>Trade chiusi <small class="auto-count">${s.list.length || ''}</small></span>
            <span class="section-actions">${src === 'real' ? Object.entries(WHO).map(([k, l]) => `<button class="btn-link-secondary${k === who ? ' on' : ''}" onclick="setResultsWho('${k}')">${l}</button>`).join('') : ''}${src === 'sim' ? '<button class="btn-link-secondary" onclick="exportCSV()">Esporta CSV</button><button class="btn-link-secondary btn-link-danger" onclick="confirmReset()">Reset</button>' : ''}</span></div>
        <div class="res-hlist res-trades">${tradeCards || '<div class="empty-hint">Nessun trade chiuso nel periodo.</div>'}</div>`;
}
