import { State } from '../core/state.js';
import { $, SYM, apiPost, escapeHtml, calcPnl, fmtPrice, fetchData } from '../utils/helpers.js';
import * as Trade from './trade.js';
import * as Auto from './automation.js';
import { tradingMode } from './account.js';
import { planAction } from '../core/rules.js';
import * as AI from './ai.js';
import { findRealPosition, realPositions } from './history.js';

// --- ASSISTENTE SULLA POSIZIONE: chat di testo e chat vocale ---
// Testo o voce → il server (src/core/commands.js, Groq gratuito) risponde e propone al massimo UNA
// azione da un elenco chiuso → l'app la traduce in una modifica precisa (src/core/rules.js) e la
// mostra con "Conferma". Niente viene eseguito senza il tuo tocco su Conferma.
// Voce: registrazione nel telefono (MediaRecorder) → trascrizione Whisper su Groq; le risposte le
// legge la sintesi vocale di iOS.

let tradeId = null, realSymbol = null, general = false, history = [], speak = false, rec = null, chunks = [], recTimer = null, busy = false;
const MAX_REC_MS = 30000;

const trade = () => State.simState.activeTrades.find(t => t.id === tradeId);

// La chat scorre di lato: ogni tua domanda apre una nuova schermata (CSS: break-before), le risposte lunghe
// continuano nella schermata a destra. Si vede sempre l'ultima; i puntini dicono quante ce ne sono.
function addMsg(role, html) {
    const log = $('assistLog');
    const div = document.createElement('div');
    div.className = `assist-msg ${role}`;
    div.innerHTML = html;
    log.appendChild(div);
    requestAnimationFrame(() => { log.scrollLeft = log.scrollWidth; updateDots(); });
    return div;
}
function updateDots() {
    const log = $('assistLog'), dots = $('assistDots');
    if (!log || !dots) return;
    const page = log.clientWidth + 32, pages = Math.max(1, Math.ceil((log.scrollWidth - 2) / page)), at = Math.round(log.scrollLeft / page);
    dots.innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => `<span class="${i === at ? 'on' : ''}"></span>`).join('') : '';
}
document.addEventListener('DOMContentLoaded', () => { const l = $('assistLog'); if (l) l.addEventListener('scroll', updateDots, { passive: true }); });

function status(text) { const el = $('assistStatus'); if (el) el.textContent = text || ''; }

function say(text) {
    if (!speak || !('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'it-IT';
        window.speechSynthesis.speak(u);
    } catch (e) { /* sintesi non disponibile */ }
}

function context(t) {
    const px = t.currentPrice || State.livePx[t.symbol] || t.entryPrice;
    return {
        symbol: t.symbol, type: t.type, market: t.market || 'SPOT', leverage: t.leverage || 1, timeframe: t.granularity,
        entry: t.entryPrice, price: px, stop: t.slPrice, take: t.tpPrice, size: t.size,
        capital: t.margin != null ? t.margin : t.capitalInvested,
        pnl: Number(calcPnl(t, px).net.toFixed(2)),
        hours_open: Number(((Date.now() - t.entryTime) / 3600e3).toFixed(1)),
        rules: (t.rules || []).map(r => `chiude a ${r.side === 'above' ? '≥' : '≤'} ${r.price} (${r.label})`)
    };
}

// --- Posizioni REALI su Bitget: stesse regole, ma l'azione confermata diventa un comando a Bitget
// (workflow "Posizione Bitget": chiusura a mercato, take profit, stop loss, rimozione TP/SL). ---
// realSymbol contiene la chiave "mercato:simbolo" (futures:SOLUSDT, spot:SOLUSDT): history.realPositions
function realPos() {
    return realSymbol ? findRealPosition(realSymbol.includes(':') ? realSymbol : `futures:${realSymbol}`) : null;
}
function realTrade(p) {
    const mark = State.livePx[p.symbol] || p.mark || p.entry;   // prezzo live se c'è (più fresco del mark letto dal bot)
    return { symbol: p.symbol, type: p.side === 'short' ? 'SHORT' : 'LONG', entryPrice: p.entry, size: p.size, feeRate: 0.0006, noTax: true,
        margin: p.margin, capitalInvested: p.size * (p.entry || mark), slPrice: p.sl || null, tpPrice: p.tp || null, currentPrice: mark, leverage: p.leverage, rules: [],
        ...(p.entry ? {} : { entryPrice: mark }) };
}

export function openAssistantReal(symbol, voice) {
    realSymbol = symbol;
    const p = realPos();
    if (!p) { realSymbol = null; return; }
    openAssistant(null, voice, p);
}

export function openAssistant(id, voice, real) {
    if (!real) realSymbol = null;
    general = !id && !real;
    const t = general || real ? null : State.simState.activeTrades.find(x => x.id === id);
    if (!general && !real && !t) return;
    tradeId = general || real ? null : id; history = []; speak = !!voice;
    const realMode = tradingMode().mode === 'on';
    $('assistTitle').textContent = general ? 'Assistente' : real
        ? `${SYM(real.symbol)} ${real.market === 'spot' ? 'spot' : real.side.toUpperCase()}` : `${SYM(t.symbol)} ${t.type}`;
    const sub = $('assistSub');
    sub.textContent = general ? (realMode ? 'Conto Bitget · reale' : 'Conto simulato') : real ? `Bitget ${real.market === 'spot' ? 'spot' : 'futures'} · ORDINI VERI` : 'Posizione simulata';
    sub.className = (real || (general && realMode)) ? 'real' : '';
    renderCtx(real, t);
    renderQuick(!!real);
    $('assistLog').innerHTML = '';
    updateDots();
    addMsg('bot', real
        ? 'Dimmi cosa fare con questa posizione, scrivendo o con il microfono, oppure usa un comando rapido qui sotto. Diventa un ordine vero su Bitget solo dopo la tua conferma.'
        : general
        ? 'Chiedimi del conto, delle posizioni o del tool, oppure usa un comando rapido qui sotto: puoi chiudere più posizioni insieme. Ogni azione la confermi tu.'
        : 'Dimmi cosa fare con questa posizione, scrivendo o con il microfono, oppure usa un comando rapido qui sotto. Ogni azione la confermi tu.');
    $('assistInput').value = '';
    $('assistSpeak').classList.toggle('active', speak);
    status('');
    $('assistFoot').textContent = real ? 'Ordini veri su Bitget solo dopo «Conferma». Esito qui, in Posizioni → Ordini e su Telegram.' : 'Ogni azione parte solo dopo «Conferma».';
    $('assistModal').classList.add('active');
    if (general && !Auto.getAutoState().loaded) Auto.loadAutomation();
    if (voice) toggleRecording();
    else setTimeout(() => $('assistInput').focus(), 200);
}

// Riquadro con i dati principali della posizione (o del conto, nella chat generale)
function renderCtx(real, t) {
    const box = $('assistCtx');
    const it = v => (v == null || !isFinite(v) ? '—' : fmtPrice(v));
    const pnlTxt = v => (v == null || !isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2).replace('.', ',')}`);
    const cell = (k, v, cls = '') => `<div><small>${k}</small><b class="${cls}">${v}</b></div>`;
    if (real) {
        const u = Trade.liveUpl(real);
        box.innerHTML = cell('Prezzo', it(State.livePx[real.symbol] || real.mark)) + cell('PnL', pnlTxt(u), u > 0 ? 'text-accent' : u < 0 ? 'text-danger' : '')
            + cell('Stop', it(real.sl), real.sl ? '' : 'text-warning') + cell('Target', it(real.tp));
    } else if (t) {
        const px = State.livePx[t.symbol] || t.currentPrice || t.entryPrice, n = calcPnl(t, px).net;
        box.innerHTML = cell('Prezzo', it(px)) + cell('PnL netto', pnlTxt(n), n > 0 ? 'text-accent' : n < 0 ? 'text-danger' : '') + cell('Stop', it(t.slPrice)) + cell('Target', it(t.tpPrice));
    } else {
        const list = allOpen();
        const tot = list.reduce((a, x) => a + (x.pnl || 0), 0);
        box.innerHTML = cell('Aperte', String(list.length)) + cell('Profitto', String(list.filter(x => x.pnl > 0).length), 'text-accent')
            + cell('Perdita', String(list.filter(x => x.pnl < 0).length), 'text-danger') + cell('PnL', pnlTxt(tot), tot > 0 ? 'text-accent' : tot < 0 ? 'text-danger' : '');
    }
}

// Comandi rapidi: le azioni più usate senza scrivere. Quelli "ask" fanno una domanda all'IA.
const QUICK_POSITION = real => [
    { label: 'Analisi AI', analysis: true, cls: 'ask' },
    { label: 'Stop a pareggio', action: { type: 'stop_breakeven' } },
    { label: 'Chiudi a +10 USDT', action: { type: 'close_at_pnl', value: 10, unit: 'usdt' } },
    { label: real ? 'Togli stop e target' : 'Togli le regole', action: { type: 'clear_rules' } },
    { label: 'Chiudi subito', action: { type: 'close_now' }, cls: 'danger' },
    { label: 'Come va?', ask: 'Come sta andando questa posizione e cosa mi consigli adesso?', cls: 'ask' },
];
const QUICK_GENERAL = [
    { label: 'Chiudi quelle in perdita', action: { type: 'close_positions', filter: 'loss' }, cls: 'danger' },
    { label: 'Chiudi quelle in profitto', action: { type: 'close_positions', filter: 'profit' } },
    { label: 'Stop a pareggio su tutte', action: { type: 'breakeven_all' } },
    { label: 'Chiudi tutto', action: { type: 'close_positions', filter: 'all' }, cls: 'danger' },
    { label: 'Riepilogo', ask: 'Fammi un riepilogo del conto, delle posizioni aperte e del bot.', cls: 'ask' },
    { label: 'Avvisi attivi', ask: 'Quali avvisi di prezzo ho attivi?', cls: 'ask' },
];
let quickList = [];
function renderQuick(real) {
    quickList = general ? QUICK_GENERAL : QUICK_POSITION(real);
    $('assistQuick').innerHTML = quickList.map((q, i) => `<button type="button" class="${q.cls || ''}" onclick="assistQuick(${i})">${escapeHtml(q.label)}</button>`).join('');
}
export function assistQuick(i) {
    const q = quickList[i];
    if (!q || busy) return;
    if (q.ask) { sendAssist(q.ask); return; }
    if (q.analysis) { chatAnalysis(); return; }
    addMsg('user', escapeHtml(q.label));
    (general ? showGeneralPlan : realSymbol ? showRealPlan : showPlan)(q.action);
}

// Analisi AI in tempo reale della posizione, scritta direttamente in chat
async function chatAnalysis() {
    const rp = realSymbol ? realPos() : null;
    const t = rp ? { ...realTrade(rp), real: true, pnl: Trade.liveUpl(rp) || 0 } : trade();
    if (!t) { addMsg('bot', 'La posizione non è più aperta.'); return; }
    addMsg('user', 'Analisi AI');
    busy = true; status('Raccolgo prezzi, candele 1d/4h/1h e dati futures…');
    try {
        const out = await AI.fetchAnalysis({ symbol: t.symbol, tf: t.granularity || '4h', trade: t }, step => status(step));
        addMsg('bot analysis', AI.renderAnalysis(out));
        const act = (out.analysis.match(/AZIONE:\s*([^\n]+)/) || [])[1];
        if (act) say(act);
    } catch (e) {
        addMsg('bot error', `Analisi non riuscita: ${escapeHtml(e.message)}`);
    } finally { busy = false; status(''); }
}

// Tutte le posizioni aperte della modalità attiva, con il PnL attuale (null se non noto)
function allOpen() {
    if (tradingMode().mode === 'on') {
        return realPositions().map(p => ({ real: p, name: `${SYM(p.symbol)} ${p.market === 'spot' ? 'spot' : p.side.toUpperCase()}`, pnl: Trade.liveUpl(p) }));
    }
    return State.simState.activeTrades.map(t => {
        const px = State.livePx[t.symbol] || t.currentPrice || t.entryPrice;
        return { sim: t, name: `${SYM(t.symbol)} ${t.type}`, pnl: calcPnl(t, px).net };
    });
}
const pnlLabel = v => (v == null ? 'PnL non noto' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2).replace('.', ',')} USDT`);

// Chiusura di più posizioni (in perdita, in profitto o tutte). In Reale: un comando a Bitget per posizione.
function planCloseMany(filter) {
    const all = allOpen();
    const pick = all.filter(x => filter === 'all' || (filter === 'loss' ? x.pnl != null && x.pnl < 0 : x.pnl != null && x.pnl > 0));
    const what = { loss: 'in perdita', profit: 'in profitto', all: 'aperte' }[filter];
    if (!all.length) return { ok: false, error: 'Non ci sono posizioni aperte.' };
    if (!pick.length) return { ok: false, error: `Nessuna posizione ${what} adesso.` };
    const real = !!pick[0].real;
    const list = pick.map(x => `${x.name} (${pnlLabel(x.pnl)})`).join(', ');
    return { ok: true, real,
        summary: `${real ? 'ORDINI VERI su Bitget: ' : ''}chiudo ${pick.length === 1 ? 'la posizione' : `le ${pick.length} posizioni`} ${what}: ${list}.`,
        run: () => (real ? sendMany(pick.map(x => ({ p: x.real, action: 'close' }))) : closeSimMany(pick)) };
}

// Stop a pareggio (commissioni comprese) su tutte le posizioni in profitto che lo permettono
function planBreakevenAll() {
    const items = [], skipped = [];
    for (const x of allOpen()) {
        if (!(x.pnl > 0)) continue;
        const t = x.real ? realTrade(x.real) : x.sim;
        const px = x.real ? (State.livePx[x.real.symbol] || x.real.mark) : (State.livePx[t.symbol] || t.currentPrice || t.entryPrice);
        const plan = planAction(t, { type: 'stop_breakeven' }, px);
        if (plan.ok) items.push({ x, plan }); else skipped.push(x.name);
    }
    if (!items.length) return { ok: false, error: 'Nessuna posizione in profitto abbastanza da mettere lo stop a pareggio.' };
    const real = !!items[0].x.real;
    return { ok: true, real,
        summary: `${real ? 'ORDINI VERI su Bitget: ' : ''}stop a pareggio su ${items.map(i => `${i.x.name} a ${fmtPrice(i.plan.price)}`).join(', ')}.${skipped.length ? ` Restano come sono: ${skipped.join(', ')}.` : ''}`,
        run: () => (real ? sendMany(items.map(i => ({ p: i.x.real, action: 'sl', price: i.plan.price })))
            : items.forEach(i => Trade.applyPlan(i.x.sim.id, i.plan))) };
}

function closeSimMany(pick) {
    pick.forEach(x => Trade.closeTrade(x.sim.id, 'MANUALE'));
    addMsg('bot', `Chiuse ${pick.length} posizioni simulate ✓`);
}

// Un comando a Bitget per posizione, uno dopo l'altro; gli esiti arrivano in Posizioni → Ordini e su Telegram
async function sendMany(items) {
    let sent = 0;
    for (const it of items) {
        try {
            const r = await apiPost('/api/command', { type: 'position', symbol: it.p.symbol, side: it.p.side, action: it.action, price: it.price != null ? String(it.price) : '', market: it.p.market || 'futures', req: newReq() });
            if (r.ok) sent++;
            else { let o = {}; try { o = await r.json(); } catch (e) {} addMsg('bot error', `${SYM(it.p.symbol)}: non inviato (${escapeHtml(o.error || r.status)})`); }
        } catch (e) { addMsg('bot error', `${SYM(it.p.symbol)}: server non raggiungibile.`); }
    }
    if (sent) { addMsg('bot', `Inviati ${sent} comandi a Bitget ✓ Esiti in Posizioni → Ordini e su Telegram entro 1-3 minuti.`); say('Comandi inviati a Bitget.'); }
    setTimeout(() => Auto.loadAutomation(), 90_000);
}

export function closeAssistant() {
    stopRecording(true);
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    $('assistModal').classList.remove('active');
    tradeId = null;
}

export function toggleAssistSpeak() {
    speak = !speak;
    $('assistSpeak').classList.toggle('active', speak);
    if (!speak) try { window.speechSynthesis.cancel(); } catch (e) {}
}

export async function sendAssist(textArg) {
    const input = $('assistInput');
    const text = (typeof textArg === 'string' ? textArg : input.value).trim();
    const rp = realSymbol ? realPos() : null;
    const t = general ? null : rp ? realTrade(rp) : trade();
    if (!text || busy) return;
    if (!general && !t) { addMsg('bot', 'La posizione non è più aperta.'); return; }
    input.value = '';
    addMsg('user', escapeHtml(text));
    busy = true; status('Sto pensando…');
    try {
        const res = await apiPost('/api/assistant', general ? { scope: 'general', text, history, context: generalContext() } : { text, history, position: rp ? { ...context(t), real: true, ...(rp.market === 'spot' ? { market: 'SPOT', leverage: 1 } : {}), hours_open: null, pnl: rp.upl } : context(t) });
        let out = {};
        try { out = await res.json(); } catch (e) {}
        if (!res.ok) throw new Error(out.error || `Errore ${res.status}`);
        history.push({ role: 'user', content: text }, { role: 'assistant', content: out.reply });
        history = history.slice(-6);
        addMsg('bot', escapeHtml(out.reply));
        say(out.reply);
        if (out.action) (general ? showGeneralPlan : rp ? showRealPlan : showPlan)(out.action);
    } catch (e) {
        addMsg('bot error', `Non riesco a rispondere: ${escapeHtml(e.message)}`);
    } finally { busy = false; status(''); }
}

function showPlan(action) {
    const plan = Trade.planForTrade(tradeId, action);
    if (!plan.ok) { addMsg('bot warn', escapeHtml(plan.error)); say(plan.error); return; }
    const box = addMsg('plan', `<div>${escapeHtml(plan.summary)}</div><div class="assist-plan-actions"><button type="button" class="btn-cancel">Annulla</button><button type="button" class="btn-confirm">Conferma</button></div>`);
    const [no, yes] = box.querySelectorAll('button');
    const done = text => { box.querySelector('.assist-plan-actions').outerHTML = `<div class="assist-plan-done">${text}</div>`; };
    no.onclick = () => done('Annullato.');
    yes.onclick = () => {
        // ricalcolo al momento della conferma: il prezzo può essere cambiato
        const fresh = Trade.planForTrade(tradeId, action);
        if (!fresh.ok) { done(escapeHtml(fresh.error)); return; }
        const ok = Trade.applyPlan(tradeId, fresh);
        done(ok ? 'Fatto ✓' : 'Non applicato: la posizione non è più aperta.');
        if (ok && fresh.kind === 'close_now') setTimeout(closeAssistant, 900);
    };
}

// Piano su posizione reale: dalla regola al comando per Bitget
function realCommand(p, plan) {
    const long = p.side !== 'short';
    if (plan.kind === 'close_now') return { action: 'close' };
    if (plan.kind === 'clear_rules') return { action: 'clear' };
    if (plan.kind === 'set_stop') return { action: 'sl', price: plan.price };
    if (plan.kind === 'set_target') return { action: 'tp', price: plan.price };
    if (plan.kind === 'rule') {   // chiusura a un livello: dal lato del guadagno è un take profit, dall'altro uno stop
        const profitSide = (plan.rule.side === 'above') === long;
        return { action: profitSide ? 'tp' : 'sl', price: plan.rule.price };
    }
    return null;
}

// Esito dei comandi reali: il workflow lo scrive in live_trades.json (evento "manual" con lo stesso
// codice), riuscito o no. Lo si cerca ogni 15 s per 5 minuti; poi si rimanda a Telegram.
const OUTCOME_EVERY_MS = 15_000, OUTCOME_MAX_MS = 5 * 60_000;
const newReq = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function findOutcome(live, req) {
    const ev = ((live && live.events) || []).slice().reverse().find(e => e && e.kind === 'manual' && e.req === req);
    return ev ? { ok: ev.ok !== false, msg: ev.msg || (ev.ok === false ? 'Comando non eseguito.' : 'Comando eseguito su Bitget.') } : null;
}

function waitOutcome(req, status) {
    const start = Date.now();
    const tick = async () => {
        let live = null;
        try { const r = await fetchData('live_trades.json'); live = r.ok ? await r.json() : null; } catch (e) {}
        const out = findOutcome(live, req);
        if (out) {
            status.textContent = `${out.ok ? '✓' : '✗'} ${out.msg}`;
            status.className = 'assist-plan-done ' + (out.ok ? 'text-accent' : 'text-danger');
            say(out.msg);
            Auto.loadAutomation();
            return;
        }
        if (Date.now() - start >= OUTCOME_MAX_MS) {
            status.textContent = 'Inviato, ma l\'esito non è ancora arrivato: controlla Telegram o la posizione fra qualche minuto.';
            return;
        }
        setTimeout(tick, OUTCOME_EVERY_MS);
    };
    setTimeout(tick, OUTCOME_EVERY_MS);
}

function showRealPlan(action) {
    const p = realPos();
    if (!p) { addMsg('bot warn', 'La posizione non risulta più aperta su Bitget.'); return; }
    const t = realTrade(p);
    let plan = action.type === 'clear_rules'
        ? (p.tp || p.sl ? { ok: true, kind: 'clear_rules', summary: `Tolgo take profit e stop loss di ${SYM(p.symbol)} ${p.side.toUpperCase()} su Bitget.` } : { ok: false, error: 'Su Bitget questa posizione non ha TP o SL da togliere.' })
        : planAction(t, action, t.currentPrice);
    if (!plan.ok) { addMsg('bot warn', escapeHtml(plan.error)); say(plan.error); return; }
    const cmd = realCommand(p, plan);
    if (!cmd) { addMsg('bot warn', 'Azione non disponibile sulle posizioni reali.'); return; }
    const spot = p.market === 'spot';
    const what = { close: spot ? 'vendita di tutta la coin' : 'chiusura a mercato', tp: 'take profit', sl: 'stop loss', clear: 'rimozione di TP e SL' }[cmd.action] + (spot ? ' (spot)' : '');
    const replaces = (cmd.action === 'tp' && p.tp) || (cmd.action === 'sl' && p.sl) ? ` Sostituisce quello attuale (${cmd.action === 'tp' ? p.tp : p.sl}).` : '';
    const box = addMsg('plan', `<div><b class="text-warning">ORDINE VERO su Bitget · ${what}</b><br>${escapeHtml(plan.summary.replace(/PnL netto/g, 'PnL'))}${escapeHtml(replaces)}</div><div class="assist-plan-actions"><button type="button" class="btn-cancel">Annulla</button><button type="button" class="btn-confirm">Conferma</button></div>`);
    const [no, yes] = box.querySelectorAll('button');
    const done = text => { box.querySelector('.assist-plan-actions').outerHTML = `<div class="assist-plan-done">${text}</div>`; };
    no.onclick = () => done('Annullato.');
    yes.onclick = async () => {
        done('Invio a Bitget…');
        const req = newReq();
        try {
            const res = await apiPost('/api/command', { type: 'position', symbol: p.symbol, side: p.side, action: cmd.action, price: cmd.price != null ? String(cmd.price) : '', market: p.market || 'futures', req });
            let out = {};
            try { out = await res.json(); } catch (e) {}
            if (!res.ok) throw new Error(out.error || `Errore ${res.status}`);
            const status = box.querySelector('.assist-plan-done');
            status.textContent = 'Inviato ✓ Attendo l\'esito da Bitget (1-3 minuti)…';
            say('Comando inviato a Bitget.');
            waitOutcome(req, status);
        } catch (e) {
            box.querySelector('.assist-plan-done').textContent = `Non inviato: ${e.message}`;
        }
    };
}

// ---------- Assistente generale: stato del tool e azioni ----------
const BLOCKED = ['forza relativa', 'funding'];   // famiglie che la prova su carta non riceve ancora
function generalContext() {
    const { cfg, ledger, lab, live } = Auto.getAutoState();
    const results = (lab && lab.results) || {};
    const active = Object.entries((cfg && cfg.strategies) || {}).filter(([, m]) => m !== 'off').map(([key, mode]) => {
        const st = (ledger && ledger.strategies && ledger.strategies[key] && ledger.strategies[key].stats) || {};
        return { key, mode, closed: st.n || 0, open: st.open || 0, avg_net_pct: st.avg_net_pct ?? null };
    });
    const available = Object.entries(results).filter(([, r]) => r.n > 0 && !BLOCKED.includes(r.family))
        .sort((a, b) => b[1].excess_avg_pct - a[1].excess_avg_pct).map(([k]) => k);
    const acc = live && live.account;
    let last = 0;
    for (const v of Object.values(State.allData || {})) if (v && v.last_update) last = Math.max(last, Date.parse(v.last_update));
    return {
        prices: Object.fromEntries(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map(s => [s, State.livePx[s] ?? (State.allData && State.allData[`${s}_1d`] ? State.allData[`${s}_1d`].current_price : null)])),
        trading: tradingMode().mode, emergency: !!(cfg && cfg.emergency),
        bitget_total: acc && acc.connected ? (acc.total_usdt ?? acc.equity) : null, bitget_positions: acc && acc.connected ? acc.positions : null,
        sim_free: Number(State.simState.freeBalance.toFixed(2)), sim_open: State.simState.activeTrades.length,
        bot_minutes: last ? Math.round((Date.now() - last) / 60000) : null,
        active, available, confirmed: (lab && lab.confirmed) || [],
        alerts: Auto.priceAlerts().map(a => ({ symbol: a.symbol, side: a.side, price: a.price }))
    };
}

const fmtPx = fmtPrice;
const PAGE_NAMES = { home: 'Home', terminal: 'Mercato', signals: 'Agente', trade: 'Posizioni', calculator: 'Trade', journal: 'Risultati', test: 'Backtest', settings: 'Impostazioni', account: 'Account' };
const label = k => k.replace(':', ' ').replace(/_/g, ' ');

function planGeneral(a) {
    const { cfg, lab, live } = Auto.getAutoState();
    const results = (lab && lab.results) || {};
    switch (a.type) {
        case 'set_strategy': {
            const r = results[a.key];
            const on = cfg && cfg.strategies && cfg.strategies[a.key] && cfg.strategies[a.key] !== 'off';
            if (a.mode === 'off') return on ? { ok: true, summary: `Spengo ${label(a.key)}: i suoi trade su carta restano nel registro.`, run: () => Auto.setAutoMode(a.key, 'off') }
                : { ok: false, error: `${label(a.key)} non è accesa.` };
            if (!r || !(r.n > 0)) return { ok: false, error: `Non trovo la strategia ${label(a.key)} nel laboratorio.` };
            if (BLOCKED.includes(r.family)) return { ok: false, error: `${label(a.key)} usa dati che la prova su carta non riceve ancora.` };
            if (on) return { ok: false, error: `${label(a.key)} è già accesa.` };
            return { ok: true, summary: `Metto ${label(a.key)} su carta (nello storico: ${r.n} trade, oltre il mercato ${r.excess_avg_pct >= 0 ? '+' : ''}${r.excess_avg_pct}% a trade). Nessun ordine vero.`, run: () => Auto.setAutoMode(a.key, 'paper') };
        }
        case 'set_trading':
            return { ok: true, summary: a.value === 'on' ? 'Passo alla modalità Reale (ti chiederò un\'altra conferma).' : 'Passo alla modalità Simulato: nessun ordine vero.', run: () => Auto.setTradingMode(a.value) };
        case 'emergency':
            return cfg && cfg.emergency ? { ok: false, error: 'L\'emergenza è già attiva.' } : { ok: true, summary: 'Attivo l\'emergenza: spengo tutte le strategie (ti chiederò conferma).', run: () => Auto.toggleEmergency() };
        case 'resume':
            return (cfg && cfg.emergency) || (live && live.halted) ? { ok: true, summary: 'Sblocco l\'automazione (le strategie restano spente).', run: () => Auto.toggleEmergency() } : { ok: false, error: 'L\'automazione non è bloccata.' };
        case 'run_lab':
            return { ok: true, summary: 'Rilancio il laboratorio delle strategie (circa 10 minuti).', run: () => Auto.runAutoJob('run_lab') };
        case 'analyze':
            return { ok: true, summary: `Apro l'analisi AI live di ${SYM(a.symbol)} a ${a.timeframe.toUpperCase()}.`, run: () => {
                closeAssistant(); window.switchTab('terminal'); window.setAsset(a.symbol); window.setTF(a.timeframe);
                setTimeout(() => window.requestMarketAnalysis(), 400);
            } };
        case 'open_page':
            return { ok: true, summary: `Apro ${PAGE_NAMES[a.page] || a.page}.`, run: () => { closeAssistant(); window.switchTab(a.page); } };
        case 'price_alert': {
            const px = State.livePx[a.symbol] ?? (State.allData && State.allData[`${a.symbol}_1d`] ? State.allData[`${a.symbol}_1d`].current_price : null);
            if (!(px > 0)) return { ok: false, error: `Prezzo attuale di ${SYM(a.symbol)} non disponibile: riprova fra poco.` };
            if (Math.abs(a.price / px - 1) < 0.0005) return { ok: false, error: `${SYM(a.symbol)} è già a ${fmtPx(px)}.` };
            if (Math.abs(a.price / px - 1) > 0.5) return { ok: false, error: `${fmtPx(a.price)} è lontanissimo dal prezzo attuale (${fmtPx(px)}): controlla la cifra.` };
            const side = a.price > px ? 'above' : 'below';
            const list = Auto.priceAlerts();
            if (list.length >= 10) return { ok: false, error: 'Hai già 10 avvisi attivi (il massimo): toglierne prima.' };
            return { ok: true, summary: `Ti avviso su Telegram quando ${SYM(a.symbol)} ${side === 'above' ? 'sale a' : 'scende a'} ${fmtPx(a.price)} (ora ${fmtPx(px)}). Controllo ogni 15 minuti sulle candele da 1 minuto: un tocco non si perde. Solo un messaggio, nessun ordine.`,
                run: () => Auto.sendAlertCommand({ op: 'add', symbol: a.symbol, side, price: String(a.price) }, 'Avviso inviato: attivo entro 1-2 minuti (Home → Stato).') };
        }
        case 'remove_alert': {
            const mine = Auto.priceAlerts().filter(x => x.symbol === a.symbol);
            const match = a.price == null ? (mine.length === 1 ? mine[0] : null)
                : mine.filter(x => Math.abs(x.price / a.price - 1) <= 0.005).sort((x, y) => Math.abs(x.price - a.price) - Math.abs(y.price - a.price))[0];
            if (!mine.length) return { ok: false, error: `Su ${SYM(a.symbol)} non ci sono avvisi attivi.` };
            if (!match) return { ok: false, error: `Su ${SYM(a.symbol)} ci sono ${mine.length > 1 ? 'più avvisi' : 'avvisi diversi'}: ${mine.map(x => fmtPx(x.price)).join(', ')}. Dimmi quale togliere.` };
            return { ok: true, summary: `Tolgo l'avviso ${SYM(a.symbol)} ${match.side === 'above' ? '≥' : '≤'} ${fmtPx(match.price)}.`, run: () => Auto.removePriceAlert(match.id) };
        }
        case 'close_positions':
            return planCloseMany(['loss', 'profit', 'all'].includes(a.filter) ? a.filter : 'loss');
        case 'breakeven_all':
            return planBreakevenAll();
        case 'clear_alerts': {
            const n = Auto.priceAlerts().length;
            return n ? { ok: true, summary: `Tolgo ${n === 1 ? 'l\'avviso di prezzo attivo' : `tutti i ${n} avvisi di prezzo`}.`, run: () => Auto.sendAlertCommand({ op: 'clear' }, 'Avvisi tolti (entro 1-2 minuti).') }
                : { ok: false, error: 'Non ci sono avvisi di prezzo attivi.' };
        }
    }
    return { ok: false, error: 'Richiesta non riconosciuta.' };
}

function showGeneralPlan(action) {
    const plan = planGeneral(action);
    if (!plan.ok) { addMsg('bot warn', escapeHtml(plan.error)); say(plan.error); return; }
    const box = addMsg('plan', `<div>${escapeHtml(plan.summary)}</div><div class="assist-plan-actions"><button type="button" class="btn-cancel">Annulla</button><button type="button" class="btn-confirm">Conferma</button></div>`);
    const [no, yes] = box.querySelectorAll('button');
    const done = text => { box.querySelector('.assist-plan-actions').outerHTML = `<div class="assist-plan-done">${text}</div>`; };
    no.onclick = () => done('Annullato.');
    yes.onclick = () => { done('Fatto ✓'); plan.run(); };
}

// ---------- Voce ----------
function pickMime() {
    if (!window.MediaRecorder) return null;
    for (const m of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']) {
        try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
    }
    return '';
}

function stopRecording(discard) {
    clearTimeout(recTimer);
    if (rec && rec.state !== 'inactive') { rec.discard = !!discard; rec.stop(); }
    $('assistMic') && $('assistMic').classList.remove('rec');
}

export async function toggleRecording() {
    if (rec && rec.state === 'recording') { stopRecording(false); return; }
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addMsg('bot warn', 'Il microfono non è disponibile qui: usa la chat di testo.');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = async () => {
            stream.getTracks().forEach(tr => tr.stop());
            if (rec.discard || !chunks.length) { status(''); return; }
            const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/mp4').split(';')[0] });
            await transcribeAndSend(blob);
        };
        rec.start();
        $('assistMic').classList.add('rec');
        status('Ti ascolto… tocca di nuovo il microfono per finire');
        recTimer = setTimeout(() => stopRecording(false), MAX_REC_MS);
    } catch (e) {
        addMsg('bot warn', 'Permesso del microfono negato: abilitalo nelle impostazioni di iOS, oppure usa la chat di testo.');
    }
}

async function transcribeAndSend(blob) {
    status('Trascrivo…');
    try {
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        const res = await apiPost('/api/transcribe', { audio: btoa(bin), mime: blob.type });
        let out = {};
        try { out = await res.json(); } catch (e) {}
        if (!res.ok) throw new Error(out.error || `Errore ${res.status}`);
        status('');
        await sendAssist(out.text);
    } catch (e) {
        status('');
        addMsg('bot error', `Trascrizione non riuscita: ${escapeHtml(e.message)}`);
    }
}
