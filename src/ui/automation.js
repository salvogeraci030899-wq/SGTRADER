import { State } from '../core/state.js';
import { $, escapeHtml, apiPost, getApiBase, setApiBase, clearAppKey, getGhToken, setGhToken, commandMode, fmtIt, fmtPrice, fetchData } from '../utils/helpers.js';

// --- AUTOMAZIONE (pagina Segnali, vista "Auto") ---
// Mostra e comanda le strategie automatiche: spenta, su carta (segnali seguiti senza ordini) o reale.
// L'app non tocca mai direttamente file o ordini: manda un comando al server comandi, che avvia il
// workflow "Automazione"; il controllo vero (reale solo se confermata, niente durante l'emergenza)
// è ripetuto lì, in automation.py. I file letti qui sono quelli pubblicati: si aggiornano con ritardo.

const MODE_LABEL = { off: 'Spenta', paper: 'Su carta', live: 'Reale' };
const MAX_ACTIVE = 6;      // stesso limite di automation.py
const PER_PAGE = 3;        // strategie per pagina nella lista (scorrimento orizzontale)
let cfg = null, ledger = null, lab = null, live = null, loaded = false, loading = false;
// Limiti di rischio dell'esecutore: stessi valori predefiniti e intervalli di executor.py
const DEFAULT_RISK = { trading_enabled: false, risk_per_trade_pct: 0.5, max_leverage: 3, max_exposure_x: 1.5, max_open_positions: 3, max_daily_loss_pct: 3, dry_run_equity: 1000 };
const RISK_FIELDS = [
    ['risk_per_trade_pct', 'Rischio per trade (%)', 0.1, 2, 0.1],
    ['max_leverage', 'Leva massima (x)', 1, 5, 1],
    ['max_exposure_x', 'Esposizione totale (x patrimonio)', 0.5, 3, 0.1],
    ['max_open_positions', 'Posizioni aperte al massimo', 1, 6, 1],
    ['max_daily_loss_pct', 'Perdita massima al giorno (%)', 1, 10, 0.5],
];
export const riskCfg = () => ({ ...DEFAULT_RISK, ...((cfg && cfg.risk) || {}) });
// Stato letto dai file pubblicati, per le pagine Account e Impostazioni
// Pagine che cambiano tra Simulato e Reale: Account, Posizioni (saldo e lista), Home
function onModeData() {
    if (window.renderAccount) window.renderAccount();
    // Diario, break-even e segni sul grafico: trade della sola modalità attiva
    if (window.renderHistory) window.renderHistory();
    if (window.renderStats) window.renderStats();
    if (window.renderBreakEven) window.renderBreakEven();
    if (window.refreshMarkers) window.refreshMarkers();
    if (window.syncTradeMode) window.syncTradeMode();
    if (window.refreshCapitalUI) window.refreshCapitalUI();
    if (window.renderActiveTrades) window.renderActiveTrades();
    if (window.updateHome) window.updateHome();
}
export const getAutoState = () => ({ cfg, ledger, lab, live, loaded, pendingTrading });
// Avvisi di prezzo (price_alerts.py): attivi = in automation.json e non ancora scattati (alerts_state.json)
let firedAlerts = [];
const removingAlerts = new Set();   // tolti dall'app, finché automation.json non si aggiorna
export const isRemovingAlert = id => removingAlerts.has(id);
export const priceAlerts = () => ((cfg && cfg.price_alerts) || []).filter(a => a && !firedAlerts.includes(a.id) && !removingAlerts.has(a.id));

// Rilettura del conto Bitget con l'app aperta in modalità Reale: una posizione aperta a mano su Bitget
// compare senza aspettare il giro del bot (15 minuti). Nessun ordine.
// - Subito quando torni nell'app (per esempio dall'app Bitget) o apri Posizioni, se l'ultima richiesta ha più di 1 minuto;
// - con l'app aperta in Reale, ogni 3 minuti.
// Dopo la richiesta (il workflow impiega circa 30-60 s, la pubblicazione dei dati altri 30-60 s) l'app controlla i dati
// ogni 10 secondi per 4 minuti e mostra il cambiamento appena arriva. Il bot salva solo se le posizioni cambiano.
const REFRESH_GAP_MS = 60_000, REFRESH_EVERY_MS = 3 * 60_000, WATCH_EVERY_MS = 10_000, WATCH_FIRST_MS = 30_000, WATCH_MAX_MS = 4 * 60_000;
const REFRESH_KEY = 'sg_account_refresh_at';
let refreshing = false;
export const isRefreshingAccount = () => refreshing;
const posSig = acc => JSON.stringify(((acc && acc.positions_detail) || []).map(p => [p.symbol, p.side, p.size, p.tp, p.sl]));
function setRefreshing(v) {
    refreshing = v;
    if (window.renderActiveTrades) window.renderActiveTrades();
}
export async function maybeRefreshAccount(soon = false) {
    const acc = live && live.account;
    if (refreshing || !acc || !acc.connected || document.visibilityState !== 'visible' || commandMode() === 'none') return;
    const gap = soon ? REFRESH_GAP_MS : REFRESH_EVERY_MS;
    const checked = Date.parse(acc.checked_at || '') || 0;
    let last = 0;
    try { last = Number(localStorage.getItem(REFRESH_KEY)) || 0; } catch (e) {}
    const now = Date.now();
    if (now - checked < gap || now - last < gap) return;
    try { localStorage.setItem(REFRESH_KEY, String(now)); } catch (e) {}
    setRefreshing(true);
    let ok = false;
    try { ok = (await apiPost('/api/command', { type: 'account_refresh' }, { silent: true })).ok; } catch (e) { /* rete: si riprova più tardi */ }
    if (!ok) { setRefreshing(false); return; }
    const before = posSig(acc), started = Date.now();
    const watch = async () => {
        const fresh = await getJson('live_trades.json');
        if (fresh && fresh.account && posSig(fresh.account) !== before) { refreshing = false; await loadAutomation(); return; }
        if (Date.now() - started >= WATCH_MAX_MS) { setRefreshing(false); return; }   // nessun cambiamento su Bitget
        setTimeout(watch, WATCH_EVERY_MS);
    };
    setTimeout(watch, WATCH_FIRST_MS);
}

// Togliere solo lo stop o solo il target di una posizione REALE (✕ nei "Comandi attivi" della scheda)
const removingReal = new Set();
export const isRealOrderRemoving = (symbol, kind) => removingReal.has(`${symbol}|${kind}`);
export function removeRealOrder(symbol, side, kind, price, market = 'futures') {
    if (!['tp', 'sl'].includes(kind) || !['long', 'short'].includes(side) || !['futures', 'spot'].includes(market)) return;
    const what = kind === 'tp' ? 'il take profit' : 'lo stop loss';
    const name = market === 'spot' ? `${symbol.replace('USDT', '')} spot` : `${symbol.replace('USDT', '')} ${side.toUpperCase()}`;
    openAutoConfirm(`Togli ${what}`, `ORDINE VERO su Bitget: tolgo ${what} di ${name} (${fmtPrice(price)}). ${market === 'spot' ? 'La coin resta' : 'La posizione resta aperta'}${kind === 'sl' ? ' senza stop' : ''}.`, 'Togli', async () => {
        const key = `${market}:${symbol}|${kind}`;
        removingReal.add(key);
        if (window.renderActiveTrades) window.renderActiveTrades();
        const ok = await send({ type: 'position', symbol, side, action: `un${kind}`, price: '', market }, 'Inviato a Bitget: esito su Telegram e nella scheda entro 1-2 minuti.');
        if (ok === false) removingReal.delete(key);
        else setTimeout(() => { removingReal.delete(key); loadAutomation(); }, 120_000);
        if (window.renderActiveTrades) window.renderActiveTrades();
    });
}

// Elenco degli avvisi (tocco sulla riga "Avvisi prezzo" della Home): togliere un avviso alla volta
const fmtAlert = a => `${a.symbol.replace('USDT', '')} ${a.side === 'above' ? '≥' : '≤'} ${fmtPrice(a.price)}`;
function renderAlerts() {
    const box = $('alertsList');
    if (!box) return;
    const list = priceAlerts();
    box.innerHTML = !loaded ? '<div class="empty-hint">Caricamento…</div>'
        : list.length ? list.map(a => `<div class="auto-add-item"><span><b>${escapeHtml(fmtAlert(a))}</b><br><small>${a.side === 'above' ? 'in salita' : 'in discesa'} · dal ${escapeHtml(day(a.created_at))}</small></span><button type="button" class="alert-del" onclick="removePriceAlert('${escapeHtml(a.id)}')">Togli</button></div>`).join('')
        : '<div class="empty-hint">Nessun avviso attivo. Chiedilo all\'assistente: «avvisami se BTC arriva a 75.000».</div>';
}
export async function openAlerts() {
    $('alertsModal').classList.add('active');
    renderAlerts();
    if (!loaded) { await loadAutomation(); renderAlerts(); }
}
export function closeAlerts() { $('alertsModal').classList.remove('active'); }
export async function removePriceAlert(id) {
    if (!/^[0-9a-f]{8}$/.test(id)) return;
    removingAlerts.add(id);
    renderAlerts();
    const ok = await send({ type: 'alert', op: 'del', id }, '');
    if (ok === false) removingAlerts.delete(id);
    renderAlerts();
    if (window.updateHome) window.updateHome();
}
export const sendAlertCommand = (body, okText) => send({ type: 'alert', ...body }, okText);

// Avviso dal grafico a schermo intero (Home e Segnali): livello scritto o scelto con +/- %, poi conferma.
// Stesse regole dell'assistente: entro ±50% dal prezzo, massimo 10 avvisi, la direzione la decide il livello.
let caSym = null, caPx = null;
export function openChartAlert(symbol, px) {
    caSym = symbol;
    caPx = px > 0 ? px : (State.livePx[symbol] || null);
    $('caTitle').textContent = `Avviso su ${symbol.replace('USDT', '')}`;
    $('caNow').textContent = caPx ? `Ora ${fmtPrice(caPx)} USDT` : 'Prezzo attuale non disponibile';
    $('caPrice').value = caPx ? String(Number(caPx.toPrecision(6))) : '';
    $('caSteps').innerHTML = [-5, -2, -1, 1, 2, 5].map(p => `<button type="button" onclick="chartAlertStep(${p})">${p > 0 ? '+' : ''}${p}%</button>`).join('');
    const mine = priceAlerts().filter(a => a.symbol === symbol);
    $('caList').innerHTML = mine.length ? `<small>Attivi: ${mine.map(a => escapeHtml(fmtAlert(a).replace(/^\S+ /, ''))).join(' · ')}</small>` : '';
    caHint();
    $('chartAlertModal').classList.add('active');
}
export function closeChartAlert() { $('chartAlertModal').classList.remove('active'); }
export function chartAlertStep(pct) {
    if (!caPx) return;
    const v = caPx * (1 + pct / 100);
    $('caPrice').value = String(Number(v.toPrecision(6)));
    caHint();
}
function caCheck() {
    const v = parseFloat(String($('caPrice').value).replace(',', '.'));
    if (!(v > 0)) return { error: 'Scrivi un prezzo.' };
    if (!caPx) return { error: 'Prezzo attuale non disponibile: riprova fra poco.' };
    if (Math.abs(v / caPx - 1) < 0.0005) return { error: 'È il prezzo attuale: scegli un livello sopra o sotto.' };
    if (Math.abs(v / caPx - 1) > 0.5) return { error: 'Troppo lontano dal prezzo attuale (oltre ±50%).' };
    if (priceAlerts().length >= 10) return { error: 'Hai già 10 avvisi attivi (il massimo).' };
    return { price: v, side: v > caPx ? 'above' : 'below' };
}
export function caHint() {
    const c = caCheck(), h = $('caHint');
    if (c.error) { h.textContent = c.error; h.className = 'ca-hint text-danger'; return; }
    const pct = (c.price / caPx - 1) * 100;
    h.textContent = `Messaggio su Telegram quando ${caSym.replace('USDT', '')} ${c.side === 'above' ? 'sale a' : 'scende a'} ${fmtPrice(c.price)} (${pct >= 0 ? '+' : ''}${fmtIt(pct, 2)}%). Nessun ordine.`;
    h.className = 'ca-hint';
}
export async function confirmChartAlert() {
    const c = caCheck();
    if (c.error) { caHint(); return; }
    closeChartAlert();
    await sendAlertCommand({ op: 'add', symbol: caSym, side: c.side, price: String(c.price) }, 'Avviso inviato: attivo entro 1-2 minuti.');
    if (window.renderOrders) window.renderOrders();
}
let agentState = null;     // agent_state.json: ultimo giro dell'agente, rapporto, proposte
let pendingTrading = null;   // 'on' / 'off' inviato ma non ancora visibile in automation.json
const pending = {};   // comandi inviati ma non ancora visibili nei file pubblicati

const pct = (v, d = 2) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${fmtIt(v, d)}%`);
const day = iso => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—');
const label = key => key.replace(':', ' ').replace(/_/g, ' ');

async function getJson(name) {
    try {
        const r = await fetchData(name);
        return r.ok ? await r.json() : null;
    } catch (e) { return null; }
}

// Stato del conto Bitget letto dal bot (live_trades.json, campo account): usato qui e nella Home.
// text = riga breve; detail = composizione (spot e futures) quando il bot l'ha letta
// separatore delle migliaia sempre presente (Intl in italiano lo omette sotto 10.000)
const usdt = v => { const [i, d] = Math.abs(Number(v)).toFixed(2).split('.'); return (Number(v) < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
export function bitgetAccountText(acc) {
    if (!acc) return { text: 'non ancora letto', cls: '', detail: '' };
    if (acc.connected) {
        const total = acc.total_usdt != null ? acc.total_usdt : acc.equity;
        const kind = acc.demo ? 'demo' : 'reale';
        const pos = `${acc.positions} ${acc.positions === 1 ? 'posizione' : 'posizioni'}`;
        const NAMES = { spot: 'spot', futures: 'futures', usdt_futures: 'futures', funding: 'funding', earn: 'earn', bots: 'bot', margin: 'margin' };
        const parts = acc.accounts_usdt
            ? Object.entries(acc.accounts_usdt).filter(([, v]) => v >= 0.01).map(([k, v]) => `${NAMES[k] || k} ${usdt(v)}`)
            : null;
        const detail = parts && parts.length
            ? `${parts.join(' · ')} · ${pos}`
            : acc.spot_usdt != null
                ? `spot ${usdt(acc.spot_usdt)} · futures ${usdt(acc.equity)} · ${pos}`
                : `futures ${usdt(acc.equity)} · ${pos}${acc.spot_error ? ' · spot non leggibile' : ''}`;
        return { text: `${usdt(total)} USDT · ${kind}`, cls: 'text-ui', detail };
    }
    if (acc.reason === 'chiavi non impostate') return { text: 'chiavi non impostate', cls: '', detail: '' };
    return { text: 'lettura non riuscita: controlla la chiave', cls: 'text-danger', detail: '' };
}

export async function loadAutomation() {
    if (loading) return;
    loading = true;
    let alertsState, quickState;
    [cfg, ledger, lab, live, alertsState, quickState, agentState] = await Promise.all([getJson('automation.json'), getJson('paper_trades.json'), getJson('lab_summary.json'), getJson('live_trades.json'), getJson('alerts_state.json'), getJson('quick_state.json'), getJson('agent_state.json')]);
    firedAlerts = [...((alertsState && alertsState._price_alerts_fired) || []), ...((quickState && quickState._price_alerts_fired) || [])];
    loaded = true;
    loading = false;
    for (const [key, mode] of Object.entries(pending)) if (currentMode(key, true) === mode) delete pending[key];
    for (const [f, v] of Object.entries(agentPending)) if (cfg && cfg.agent && cfg.agent[f] === v) delete agentPending[f];
    if (pendingTrading && (pendingTrading === 'on') === !!riskCfg().trading_enabled) pendingTrading = null;
    renderAutomation();
    renderAgentView();
    onModeData();
}

function currentMode(key, ignorePending = false) {
    if (!ignorePending && pending[key]) return pending[key];
    return (cfg && cfg.strategies && cfg.strategies[key]) || 'off';
}

function activeKeys() {
    const keys = new Set(Object.entries((cfg && cfg.strategies) || {}).filter(([, m]) => m !== 'off').map(([k]) => k));
    for (const [k, m] of Object.entries(pending)) { if (m === 'off') keys.delete(k); else keys.add(k); }
    return keys;
}

const isConfirmed = key => !!(lab && (lab.confirmed || []).includes(key));

// Strategie da mostrare: quelle accese, quelle confermate e le candidate ancora in attesa
function shownKeys() {
    const keys = new Set(Object.keys((cfg && cfg.strategies) || {}));
    Object.keys(pending).forEach(k => keys.add(k));
    ((lab && lab.confirmed) || []).forEach(k => keys.add(k));
    ((lab && lab.candidates) || []).filter(k => !(lab.results[k] || {}).holdout).forEach(k => keys.add(k));
    return [...keys].sort();
}

export function renderAutomation() {
    const status = $('autoStatus'), list = $('autoList');
    if (!status || !list || $('signalsView').value !== 'auto') return;
    if (!loaded) { status.innerHTML = 'Caricamento…'; loadAutomation(); return; }

    const emergency = !!(cfg && cfg.emergency);
    const halted = !!(live && live.halted);
    const risk = riskCfg();
    const execMode = (live && live.mode) || 'simulata';
    const realText = !risk.trading_enabled ? 'spenti (esecutore simulato)'
        : (execMode === 'simulata' ? 'abilitati, ma senza chiavi Bitget o strategie confermate' : `abilitati (${execMode})`);
    const mode = commandMode();
    const serverText = { server: 'server impostato', github: 'token GitHub', site: 'questo sito', cloud: 'server Cloudflare', none: 'non impostati' }[mode];
    const onPaper = Object.values(cfg ? cfg.strategies : {}).filter(m => m !== 'off').length;
    const { text: accText, cls: accClass, detail: accDetail } = bitgetAccountText(live && live.account);
    const acc = live && live.account;
    status.innerHTML = `
        <div class="auto-row"><span>Comandi</span><b class="${mode === 'none' ? 'text-warning' : 'text-ui'}">${serverText}</b></div>
        <div class="auto-row"><span>Stato</span><b class="${emergency || halted ? 'text-danger' : 'text-accent'}">${emergency ? 'EMERGENZA: tutto bloccato' : (halted ? 'esecutore bloccato: controlla Bitget' : `${onPaper} ${onPaper === 1 ? 'strategia attiva' : 'strategie attive'}`)}</b></div>
        <div class="auto-row"><span>Saldo Bitget</span><b class="${accClass}" title="${escapeHtml((acc && acc.reason) || '')}">${accText}</b></div>
        ${accDetail ? `<div class="auto-row auto-sub"><span></span><b>${escapeHtml(accDetail)}</b></div>` : ''}
        <div class="auto-row clickable" onclick="openAccount()"><span>Ordini veri</span><b class="${risk.trading_enabled ? 'text-warning' : ''}">${realText} ›</b></div>
        <div class="auto-row clickable" onclick="setSignalsView('agent')"><span>Agente</span><b class="${agentProposals().length ? 'text-warning' : 'text-ui'}">${escapeHtml(agentLine())} ›</b></div>
        <div class="auto-row auto-row-risk"><span>Rischio</span><b>${risk.risk_per_trade_pct}% a trade · leva ${risk.max_leverage}x · max ${risk.max_open_positions} · −${risk.max_daily_loss_pct}%/giorno</b></div>`;

    const keys = shownKeys();
    const card = key => {
        const mode = currentMode(key);
        const st = ledger && ledger.strategies && ledger.strategies[key] && ledger.strategies[key].stats;
        const res = lab && lab.results && lab.results[key];
        const info = st && (st.n || st.open)
            ? `Su carta: ${st.n} ${st.n === 1 ? 'chiuso' : 'chiusi'}${st.n ? ` (${pct(st.avg_net_pct)} medio)` : ''}, ${st.open} ${st.open === 1 ? 'aperto' : 'aperti'}${st.vs_backtest && st.vs_backtest.verdict !== 'pochi_trade' ? ' · ' + { in_linea: 'in linea con lo storico', sotto: '⚠ sotto lo storico', sopra: 'sopra lo storico' }[st.vs_backtest.verdict] : ''}`
            : (res ? `Storico: ${res.n} trade, oltre il mercato ${pct(res.excess_avg_pct)}${res.holdout ? (res.holdout.confirmed ? ' · confermata' : ' · bocciata alla prova finale') : ''}` : 'Nessun dato');
        const btn = (m, text, disabled, title) => `<button type="button" class="pill-btn${mode === m ? ' active' : ''}" ${disabled ? 'disabled' : ''} title="${title || ''}" onclick="setAutoMode('${escapeHtml(key)}','${m}')">${text}</button>`;
        return `<div class="auto-item">
            <div class="auto-item-head"><b class="clickable auto-open-trades" onclick="openPaperTrades('${escapeHtml(key)}')">${escapeHtml(label(key))} ›</b>${pending[key] ? '<span class="text-warning">in corso…</span>' : ''}</div>
            <div class="auto-item-info">${escapeHtml(info)}</div>
            <div class="option-toggle compact">${btn('off', 'Spenta')}${btn('paper', 'Su carta', emergency)}${btn('live', 'Reale', emergency || !isConfirmed(key), isConfirmed(key) ? '' : 'Solo per strategie confermate dalla prova finale')}</div>
        </div>`;
    };
    // Pagine da PER_PAGE strategie, scorrimento orizzontale con i puntini sotto
    const pages = [];
    for (let i = 0; i < keys.length; i += PER_PAGE) pages.push(keys.slice(i, i + PER_PAGE));
    const prevPage = list.querySelector('.auto-pages') ? Math.round(list.querySelector('.auto-pages').scrollLeft / Math.max(1, list.querySelector('.auto-pages').clientWidth)) : 0;
    list.innerHTML = keys.length
        ? `<div class="auto-pages" onscroll="updateAutoDots()">${pages.map(p => `<div class="auto-page">${p.map(card).join('')}</div>`).join('')}</div>`
          + (pages.length > 1 ? `<div class="auto-dots">${pages.map((_, i) => `<div class="info-dot${i === 0 ? ' active' : ''}" onclick="goToAutoPage(${i})"></div>`).join('')}</div>` : '')
        : '<div class="empty-hint">Nessuna strategia attiva. Usa "Aggiungi" per metterne una su carta.</div>';
    if (prevPage > 0) goToAutoPage(Math.min(prevPage, pages.length - 1), 'instant');
    const count = $('autoCount');
    if (count) count.textContent = `${activeKeys().size}/${MAX_ACTIVE}`;

    const btn = $('autoEmergencyBtn');
    if (btn) {
        btn.textContent = emergency || halted ? 'Sblocca automazione' : 'Emergenza: spegni tutto';
        btn.classList.toggle('auto-resume', emergency || halted);
    }
    const note = $('autoNote');
    if (note) note.textContent = `Su carta dal ${day(cfg && cfg.paper_start)}. I comandi passano da GitHub: l'effetto si vede qui dopo qualche minuto. Ordini veri solo con: strategia confermata in Reale, interruttore acceso e chiavi Bitget.`;
}

// --- Agente selezionatore (agent.py, ogni domenica): rapporto, scelte su carta, proposte per il reale ---
// Le proposte non partono mai da sole: "Passa al reale" invia lo stesso comando del tasto Reale, dopo conferma.
const agentProposals = () => ((agentState && agentState.proposals) || []).filter(p => p && currentMode(p.key) === 'paper' && isConfirmed(p.key));
function agentLine() {
    if (!agentState || !agentState.last_run) return 'ogni domenica, non ancora partito';
    const n = agentProposals().length;
    return `${day(agentState.last_run)}${n ? ` · ${n} ${n === 1 ? 'proposta' : 'proposte'}` : ' · nessuna proposta'}`;
}
function renderAgent() {
    const box = $('agentBody');
    if (!box) return;
    const a = agentState;
    const props = agentProposals();
    const when = a && a.last_run ? new Date(a.last_run).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
    box.innerHTML = `
        <p class="agent-lead">Ogni domenica rilancia il laboratorio, mette su carta le strategie candidate e spegne quelle che ha messo lui se su carta vanno peggio dello storico. <b>Non passa mai nulla al reale</b>: te lo propone.</p>
        ${props.length ? `<div class="agent-props">${props.map(p => `<div class="agent-prop"><span><b>${escapeHtml(label(p.key))}</b><br><small>Su carta ${p.n} trade, netto medio ${pct(p.avg_net_pct)}, in linea con lo storico</small></span><button type="button" class="btn-confirm agent-go" onclick="agentPromote('${escapeHtml(p.key)}')">Passa al reale</button></div>`).join('')}</div>` : ''}
        <div class="agent-report">${when ? `<small>Ultimo giro: ${escapeHtml(when)}${a.report_model ? ` · testo di ${escapeHtml(a.report_model)}` : ''}</small>` : '<small>Non ancora partito: il primo giro è domenica sera, oppure avvialo ora.</small>'}
            ${a && a.report ? `<p>${escapeHtml(a.report).replace(/\n/g, '<br>')}</p>` : ''}
            ${a && a.facts && a.facts.length ? `<ul>${a.facts.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
        </div>`;
}
export function openAgent() { $('agentModal').classList.add('active'); renderAgent(); }
export function closeAgent() { $('agentModal').classList.remove('active'); }
export function agentPromote(key) {
    if (!agentProposals().some(p => p.key === key)) return;
    closeAgent();
    openAutoConfirm('Passare al reale?', `${label(key)} userà soldi veri su Bitget, con i limiti di rischio attuali. Va bene su carta, ma i risultati passati non garantiscono quelli futuri. Servono anche l'interruttore degli ordini veri acceso e le chiavi Bitget.`, 'Passa al reale', () => setAutoMode(key, 'live'));
}
export function runAgent() {
    send({ type: 'run_agent' }, 'Agente avviato: laboratorio e scelte in circa 15-30 minuti, rapporto su Telegram.');
}

const NO_SERVER = 'Per inviare comandi serve un token GitHub (Impostazioni → Comandi) oppure l\'indirizzo di un server.';

async function send(body, okText) {
    // okText vuoto: l'esito positivo lo comunica chi chiama (più comandi di fila)
    // Su GitHub Pages (o in locale) senza indirizzo impostato non c'è nessun server: lo si dice subito
    if (commandMode() === 'none') {
        window.showAlert('Comando non inviato', NO_SERVER);
        return false;
    }
    let r;
    try {
        r = await apiPost('/api/command', body);
    } catch (e) {
        window.showAlert('Comando non inviato', commandMode() === 'github' ? 'GitHub non raggiungibile: controlla la connessione e riprova.' : 'Server comandi non raggiungibile. Controlla l\'indirizzo in Impostazioni → Comandi.');
        return false;
    }
    if ([404, 405, 501].includes(r.status)) {
        window.showAlert('Comando non inviato', NO_SERVER);
        return false;
    }
    let data = {};
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) {
        window.showAlert('Comando rifiutato', data.error || `Errore ${r.status}`);
        return false;
    }
    if (okText) window.showAlert('Comando inviato', okText);
    return true;
}

export async function setAutoMode(key, mode) {
    if (currentMode(key) === mode) return;
    if (mode === 'live' && !isConfirmed(key)) return;
    if (mode !== 'off' && !activeKeys().has(key) && activeKeys().size >= MAX_ACTIVE) {
        window.showAlert('Limite raggiunto', `Al massimo ${MAX_ACTIVE} strategie accese insieme: spegnine una prima.`);
        return;
    }
    const ok = await send({ type: 'set_mode', key, mode }, `${label(key)}: ${MODE_LABEL[mode].toLowerCase()}. Il bot applica il cambio entro qualche minuto.`);
    if (ok) { pending[key] = mode; renderAutomation(); setTimeout(loadAutomation, 90000); }
}

export function toggleEmergency() {
    const emergency = !!(cfg && cfg.emergency) || !!(live && live.halted);
    openAutoConfirm(
        emergency ? 'Sblocca automazione' : 'Emergenza',
        emergency ? 'L\'automazione torna disponibile. Le strategie restano spente: vanno riaccese una a una.'
                  : 'Tutte le strategie vengono spente subito e l\'automazione resta bloccata finché non la sblocchi.',
        emergency ? 'Sblocca' : 'Spegni tutto',
        async () => {
            const ok = await send({ type: emergency ? 'resume' : 'emergency' }, emergency ? 'Sblocco inviato.' : 'Emergenza inviata: tutto viene spento entro qualche minuto.');
            if (ok) setTimeout(loadAutomation, 90000);
        });
}

export function runAutoJob(type) {
    const text = { run_lab: 'Laboratorio strategie avviato: risultati in circa 10 minuti (Backtest → Lab).',
                   run_validation: 'Validazione di Kronos avviata: circa 6 ore (Grafici → Validazione storica).' }[type];
    if (text) send({ type }, text);
}

// --- Aggiungere una strategia su carta: elenco delle strategie del laboratorio ---
export function openAutoAdd() {
    const box = $('autoAddList');
    if (!box) return;
    const rows = lab && lab.results ? Object.entries(lab.results).filter(([, r]) => r.n > 0)
        .sort((a, b) => b[1].excess_avg_pct - a[1].excess_avg_pct) : [];
    const full = activeKeys().size >= MAX_ACTIVE;
    $('autoAddFull').textContent = full ? `Hai già ${MAX_ACTIVE} strategie accese (il massimo): spegnine una per aggiungerne un'altra.` : `Accese ${activeKeys().size} su ${MAX_ACTIVE}.`;
    $('autoAddFull').className = 'settings-hint' + (full ? ' text-warning' : '');
    box.innerHTML = rows.length ? rows.map(([key, r]) => {
        const on = currentMode(key) !== 'off';
        const rel = r.family === 'forza relativa' || r.family === 'funding';
        return `<button class="auto-add-item" ${on || rel || full ? 'disabled' : ''} onclick="addAutoPaper('${escapeHtml(key)}')">
            <span><b>${escapeHtml(label(key))}</b><br><small>${r.n} trade · oltre il mercato ${pct(r.excess_avg_pct)}${r.holdout ? (r.holdout.confirmed ? ' · confermata' : ' · bocciata') : (r.candidate ? ' · candidata' : '')}</small></span>
            <small>${on ? 'già attiva' : (rel ? 'non ancora' : (full ? 'limite' : 'su carta'))}</small></button>`;
    }).join('') : '<div class="empty-hint">Risultati del laboratorio non disponibili.</div>';
    $('autoAddModal').classList.add('active');
}

export function goToAutoPage(i, behavior = 'smooth') {
    const el = document.querySelector('#autoList .auto-pages');
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior });
    updateAutoDots(i);
}
export function updateAutoDots(force) {
    const el = document.querySelector('#autoList .auto-pages');
    if (!el || !el.clientWidth) return;
    const idx = typeof force === 'number' ? force : Math.round(el.scrollLeft / el.clientWidth);
    document.querySelectorAll('#autoList .auto-dots .info-dot').forEach((d, j) => d.classList.toggle('active', j === idx));
}

// Confronto carta / storico (paper.py, vs_backtest): dopo 10 trade chiusi
export function vsBacktestText(st) {
    const v = st && st.vs_backtest;
    if (!v) return '';
    if (v.verdict === 'pochi_trade') return `Confronto con lo storico dopo 10 trade chiusi (ora ${v.n}).`;
    const ref = `media storica ${pct(v.bt_avg)} su ${v.bt_n} trade`;
    if (v.verdict === 'in_linea') return `In linea con lo storico (${ref}).`;
    if (v.verdict === 'sotto') return `⚠ Sotto lo storico (${ref}): la strategia potrebbe non funzionare più.`;
    return `Sopra lo storico (${ref}): bene, ma in buona parte può essere fortuna.`;
}

// --- Trade su carta di una strategia (tocco sul nome) ---
const dt = ts => (ts ? new Date(ts * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '—');
const px = v => (v == null ? '—' : fmtIt(v, v >= 1000 ? 0 : 2));
export function openPaperTrades(key) {
    const e = ledger && ledger.strategies && ledger.strategies[key];
    const trades = ((e && e.trades) || []).slice().sort((a, b) => b.t - a.t);
    const st = (e && e.stats) || {};
    $('autoTradesTitle').textContent = label(key);
    const head = st.n
        ? `${st.n} ${st.n === 1 ? 'chiuso' : 'chiusi'} · vinti ${fmtIt(st.win_rate, 1)}% · medio ${pct(st.avg_net_pct)} · totale ${pct(st.total_net_pct)} · ${st.open} ${st.open === 1 ? 'aperto' : 'aperti'}`
        : `${st.open || 0} ${st.open === 1 ? 'aperto' : 'aperti'}, nessuno chiuso finora`;
    const cmp = vsBacktestText(st);
    $('autoTradesBody').innerHTML = `<div class="settings-hint">${escapeHtml(head)}. Rendimenti per trade, netti di costi futures e funding.</div>`
        + (cmp ? `<div class="settings-hint ${st.vs_backtest.verdict === 'sotto' ? 'text-danger' : ''}">${escapeHtml(cmp)}</div>` : '') + (trades.length
        ? trades.map(t => {
            const side = t.dir > 0 ? 'LONG' : 'SHORT';
            const res = t.open ? '<span class="text-ui">aperto</span>'
                : (t.net != null ? `<b class="${t.net >= 0 ? 'text-accent' : 'text-danger'}">${pct(t.net)}</b>` : `${pct(t.gross)} lordo`);
            return `<div class="paper-row"><div><b>${escapeHtml(t.symbol.replace('USDT', ''))} ${side}</b> <span class="paper-reason">${t.open ? '' : escapeHtml(t.reason || '')}${t.revised ? ' · rivisto' : ''}</span><br>
                <small>${dt(t.t_entry)} → ${t.open ? 'oggi' : dt(t.t_exit)} · ${px(t.entry)} → ${t.open ? 'stop ' + px(t.stop) : px(t.exit)}</small></div><div>${res}</div></div>`;
        }).join('')
        : '<div class="empty-hint">Ancora nessun trade: la strategia apre solo quando arriva un segnale.</div>');
    $('autoTradesModal').classList.add('active');
}
export function closePaperTrades() { $('autoTradesModal').classList.remove('active'); }

export function closeAutoAdd() { $('autoAddModal').classList.remove('active'); }

export function addAutoPaper(key) {
    closeAutoAdd();
    setAutoMode(key, 'paper');
}

// --- Limiti di rischio e interruttore degli ordini veri ---
export function openAutoRisk() {
    const risk = riskCfg();
    $('autoRiskFields').innerHTML = RISK_FIELDS.map(([f, text, lo, hi, step]) =>
        `<label class="auto-risk-field"><span>${text}</span><input type="number" inputmode="decimal" id="risk_${f}" value="${risk[f]}" min="${lo}" max="${hi}" step="${step}"></label>`).join('');
    $('autoRiskModal').classList.add('active');
}
export function closeAutoRisk() { $('autoRiskModal').classList.remove('active'); }

export async function saveAutoRisk() {
    const risk = riskCfg();
    const changes = [];
    for (const [f, text, lo, hi, step] of RISK_FIELDS) {
        const v = parseFloat(String($('risk_' + f).value).replace(',', '.'));
        if (!(v >= lo && v <= hi) || (step === 1 && v !== Math.round(v))) {
            window.showAlert('Valore non valido', `${text}: ammesso da ${lo} a ${hi}${step === 1 ? ', numero intero' : ''}.`);
            return;
        }
        if (v !== Number(risk[f])) changes.push({ type: 'set_risk', field: f, value: String(v) });
    }
    closeAutoRisk();
    if (!changes.length) return;
    for (const c of changes) if (!(await send(c, ''))) return;
    window.showAlert('Comandi inviati', `${changes.length} ${changes.length === 1 ? 'modifica inviata' : 'modifiche inviate'}: visibili qui dopo qualche minuto.`);
    setTimeout(loadAutomation, 90000);
}

// --- Modalità ordini: Simulato / Reale (pagina Account) ---
// "Reale" accende l'interruttore generale; gli ordini partono comunque solo per strategie confermate
// dalla prova finale e messe su Reale, con le chiavi Bitget impostate (lo ricontrolla automation.py).
export function setTradingMode(value) {
    const now = pendingTrading || (riskCfg().trading_enabled ? 'on' : 'off');
    if (value === now) return;
    const go = async () => {
        const ok = await send({ type: 'trading', value }, value === 'on'
            ? 'Modalità reale inviata. Diventa attiva entro qualche minuto.'
            : 'Modalità simulata inviata: nessun nuovo ordine vero.');
        if (ok) { pendingTrading = value; onModeData(); setTimeout(loadAutomation, 90000); }
    };
    if (value === 'on') {
        const confirmed = (lab && lab.confirmed) || [];
        openAutoConfirm('Passa al reale',
            (confirmed.length ? '' : 'Oggi nessuna strategia è confermata dalla prova finale: anche in Reale nessun ordine partirà finché una non lo sarà. ')
            + 'In Reale l\'esecutore apre ordini veri su Bitget per le strategie confermate e messe su Reale, con i limiti di rischio impostati. Con la leva puoi perdere tutto il capitale impiegato.',
            'Passa al reale', go);
    } else {
        go();
    }
}

// --- Conferma generica ---
let confirmAction = null;
export function openAutoConfirm(title, msg, okText, action) {
    $('autoConfirmTitle').textContent = title;
    $('autoConfirmMsg').textContent = msg;
    $('autoConfirmOk').textContent = okText;
    confirmAction = action;
    $('autoConfirmModal').classList.add('active');
}
export function closeAutoConfirm() { $('autoConfirmModal').classList.remove('active'); confirmAction = null; }
export function okAutoConfirm() { const a = confirmAction; closeAutoConfirm(); if (a) a(); }

// Passa tra i segnali e l'automazione (stessa pagina, tasti in alto a destra)
export function setSignalsView(view) {
    $('signalsView').value = view;
    for (const v of ['sig', 'auto', 'agent']) {
        $(`btn-view-${v}`).classList.toggle('active', view === v);
        $(`${v}View`).style.display = view === v ? '' : 'none';
    }
    $('signalsSubtitle').textContent = { sig: 'Consensus multi-sorgente', auto: 'Strategie automatiche', agent: 'Lavora per te' }[view];
    if (view === 'auto') { loaded = false; renderAutomation(); }
    if (view === 'agent') { loaded = false; renderAgentView(); }
}

// --- Vista Agente: stato, impostazioni (autonomia, profilo, stile), cronologia delle decisioni ---
const AG_DEFAULT = { autonomy: 'paper', profile: 'bilanciato', style: 'swing' };
const AG_LABELS = {
    autonomy: { off: 'Spento', paper: 'Simulato', live: 'Reale' },
    profile: { prudente: 'Prudente', bilanciato: 'Bilanciato', aggressivo: 'Aggressivo' },
    style: { swing: 'Swing', giornaliero: 'Giornaliero', misto: 'Misto' }
};
const AG_TITLES = { autonomy: 'Autonomia', profile: 'Rischio', style: 'Stile' };
const AG_KIND = { on: ['＋', 'Su carta', 'text-ui'], off: ['−', 'Spenta', ''], promote: ['▲', 'Al reale', 'text-warning'], demote: ['▼', 'Tornata su carta', 'text-danger'], proposal: ['?', 'Proposta', 'text-warning'] };
const agentPending = {};
export const agentSettings = () => ({ ...AG_DEFAULT, ...((cfg && cfg.agent) || {}), ...agentPending });

export function renderAgentView() {
    const status = $('agentStatus');
    if (!status || $('signalsView').value !== 'agent') return;
    if (!loaded) { status.innerHTML = 'Caricamento…'; loadAutomation(); return; }
    const ag = agentSettings(), risk = riskCfg();
    const strategies = Object.entries((cfg && cfg.strategies) || {}).filter(([, m]) => m !== 'off');
    const nPaper = strategies.filter(([, m]) => m === 'paper').length, nLive = strategies.filter(([, m]) => m === 'live').length;
    // andamento del giorno dell'esecutore: solo con il conto vero (in simulazione il saldo è fittizio)
    const realExec = live && live.mode && live.mode !== 'simulata';
    const dayInfo = realExec && live.day && live.day.start_equity && live.account && live.account.equity
        ? (live.account.equity / live.day.start_equity - 1) * 100 : null;
    const target = Number(risk.daily_target_pct) || 0;
    const dayText = (dayInfo == null ? (realExec ? 'nessun dato di oggi' : 'esecutore simulato') : `${pct(dayInfo)}`) + ` · obiettivo ${target ? '+' + fmtIt(target, 1).replace(/,0$/, '') + '%' : 'nessuno'} · limite −${fmtIt(risk.max_daily_loss_pct, 1).replace(/,0$/, '')}%`;
    const autoCls = ag.autonomy === 'live' ? 'text-warning' : ag.autonomy === 'paper' ? 'text-ui' : '';
    const realState = ag.autonomy !== 'live' ? 'decidi tu' : (risk.trading_enabled ? 'decide l\'agente' : 'interruttore spento');
    status.innerHTML = `
        <div class="auto-row"><span>Autonomia</span><b class="${autoCls}">${AG_LABELS.autonomy[ag.autonomy]}${agentPending.autonomy ? ' (in corso…)' : ''} · reale: ${realState}</b></div>
        <div class="auto-row"><span>Strategie</span><b>${nPaper} su carta · ${nLive} reali</b></div>
        ${capitalRow()}
        <div class="auto-row"><span>Oggi</span><b class="${dayInfo > 0 ? 'text-accent' : dayInfo < 0 ? 'text-danger' : ''}">${escapeHtml(dayText)}</b></div>
        <div class="auto-row"><span>Ultima decisione</span><b>${agentState && agentState.last_run ? escapeHtml(new Date(agentState.last_run).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) : 'ogni giorno alle 19:41'}${agentProposals().length ? ` · <span class="text-warning">${agentProposals().length} proposta</span>` : ''}</b></div>`;
    $('agentSettings').innerHTML = Object.keys(AG_LABELS).map(field => `<div class="agent-set"><span>${AG_TITLES[field]}</span><div class="option-toggle compact">${
        Object.entries(AG_LABELS[field]).map(([v, l]) => `<button type="button" class="pill-btn${ag[field] === v ? ' active' : ''}${field === 'autonomy' && v === 'live' ? ' agent-live' : ''}" onclick="setAgent('${field}','${v}')">${l}</button>`).join('')
    }</div></div>`).join('');
    const log = ((agentState && agentState.log) || []).slice().reverse();
    $('agentLogCount').textContent = log.length ? String(log.length) : '';
    $('agentLog').innerHTML = log.length
        ? log.map(e => { const [icon, what, cls] = AG_KIND[e.kind] || ['•', e.kind, '']; return `<div class="agent-ev"><div class="agent-ev-head"><b class="${cls}">${icon} ${what}</b><small>${escapeHtml(day(e.at))}</small></div><b>${escapeHtml(label(e.key || ''))}</b><small>${escapeHtml(e.why || '')}</small></div>`; }).join('')
        : '<div class="empty-hint">Ancora nessuna decisione. L\'agente decide ogni giorno alle 19:41 (ora italiana); la domenica rilancia anche il laboratorio.</div>';
    renderAgentPerf();
    $('agentNote').textContent = 'Ogni cambio arriva su Telegram. Il reale dell\'agente richiede autonomia Reale e interruttore degli ordini veri acceso (Account). Emergenza: Auto → Emergenza.';
}

// --- Rendimento su carta: tutte le strategie, in % del patrimonio con il rischio per trade attuale ---
// Ogni trade chiuso vale R = netto / distanza dello stop (quante volte il rischio); in patrimonio R x rischio %.
// È quello che avrebbe fatto il conto vero seguendo la carta con il profilo di oggi (stessa regola dell'esecutore).
export function paperPerformance(led, riskPct) {
    const trades = [];
    for (const [key, e] of Object.entries((led && led.strategies) || {})) {
        for (const t of (e.trades || [])) {
            if (t.open || t.net == null || !t.entry || !t.stop) continue;
            const stopPct = Math.abs(t.entry - t.stop) / t.entry * 100;
            if (stopPct > 0) trades.push({ key, t: t.t_exit || t.t, r: t.net / stopPct });
        }
    }
    trades.sort((a, b) => a.t - b.t);
    let eq = 0, peak = 0, dd = 0, wins = 0;
    const points = [[trades.length ? trades[0].t - 1 : 0, 0]];
    for (const x of trades) {
        eq += x.r * riskPct;
        peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq);
        if (x.r > 0) wins++;
        points.push([x.t, eq]);
    }
    return { n: trades.length, ret: eq, maxdd: dd, win: trades.length ? wins / trades.length * 100 : null, points };
}

function sparkline(points) {
    const W = 300, H = 90, P = 4;
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(0, ...ys), y1 = Math.max(0, ...ys);
    const X = x => P + (x1 > x0 ? (x - x0) / (x1 - x0) : 1) * (W - 2 * P), Y = y => H - P - (y1 > y0 ? (y - y0) / (y1 - y0) : 0.5) * (H - 2 * P);
    const line = points.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
    const up = ys[ys.length - 1] >= 0;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="agent-spark" role="img" aria-label="Andamento su carta">
        <line x1="0" x2="${W}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" class="zero"/>
        <polyline points="${line}" class="${up ? 'up' : 'down'}"/></svg>`;
}

let agentTab = 'log';
export function setAgentTab(tab) {
    agentTab = tab === 'perf' ? 'perf' : 'log';
    $('agentTabLog').classList.toggle('active', agentTab === 'log');
    $('agentTabPerf').classList.toggle('active', agentTab === 'perf');
    $('agentLog').style.display = agentTab === 'log' ? '' : 'none';
    $('agentPerf').style.display = agentTab === 'perf' ? '' : 'none';
    renderAgentPerf();
}

function renderAgentPerf() {
    const box = $('agentPerf');
    if (!box || agentTab !== 'perf') return;
    const risk = riskCfg();
    const p = paperPerformance(ledger, Number(risk.risk_per_trade_pct) || 0.5);
    const since = day(ledger && ledger.started) || day(cfg && cfg.paper_start);
    if (!p.n) {
        box.innerHTML = `<div class="empty-hint">Nessun trade chiuso su carta finora (dal ${escapeHtml(since)}). Le strategie a 1 giorno fanno pochi trade: servono settimane.</div>`;
        return;
    }
    const cls = v => (v > 0 ? 'text-accent' : v < 0 ? 'text-danger' : '');
    box.innerHTML = `<div class="agent-perf-nums">
            <div><small>Rendimento</small><b class="${cls(p.ret)}">${pct(p.ret)}</b></div>
            <div><small>Trade</small><b>${p.n}</b></div>
            <div><small>Vincenti</small><b>${fmtIt(p.win, 0)}%</b></div>
            <div><small>Max calo</small><b class="${p.maxdd ? 'text-danger' : ''}">−${fmtIt(p.maxdd, 2)}%</b></div>
        </div>
        ${sparkline(p.points)}
        <small class="agent-perf-note">Su carta dal ${escapeHtml(since)}, tutte le strategie, in % del patrimonio con ${fmtIt(risk.risk_per_trade_pct, 2)}% di rischio a trade. Costi compresi. Simulato: non è denaro vero.</small>`;
}

// Capitale rispetto ai minimi di Bitget (calcolato dall'agente con il profilo attuale)
function capitalRow() {
    const c = agentState && agentState.capital;
    if (!c || !c.symbols || !Object.keys(c.symbols).length) return '';
    const ok = Object.entries(c.symbols).filter(([, v]) => v.ok).map(([k]) => k.replace('USDT', ''));
    const least = Object.entries(c.symbols).sort((a, b) => a[1].needed - b[1].needed)[0];
    const text = ok.length === Object.keys(c.symbols).length ? `${fmtIt(c.equity, 2)} USDT · basta per tutte le coin`
        : ok.length ? `${fmtIt(c.equity, 2)} USDT · solo ${ok.join(', ')}`
        : `${fmtIt(c.equity, 2)} USDT · troppo poco: servono ~${fmtIt(least[1].needed, 0)} (${least[0].replace('USDT', '')})`;
    return `<div class="auto-row"><span>Capitale</span><b class="${ok.length ? '' : 'text-warning'}" title="Rischio ${c.risk_pct}% a trade, stop tipico ${c.stop_pct}%">${escapeHtml(text)}</b></div>`;
}

export function setAgent(field, value) {
    if (!AG_LABELS[field] || !(value in AG_LABELS[field]) || agentSettings()[field] === value) return;
    const go = async () => {
        const ok = await send({ type: 'set_agent', field, value }, `Agente: ${AG_TITLES[field].toLowerCase()} ${AG_LABELS[field][value].toLowerCase()}. Attivo entro 1-2 minuti.`);
        if (ok) { agentPending[field] = value; renderAgentView(); setTimeout(() => { delete agentPending[field]; loadAutomation(); }, 90000); }
    };
    if (field === 'autonomy' && value === 'live') {
        return openAutoConfirm('Autonomia reale?', 'L\'agente potrà portare da solo al reale le strategie che hanno superato laboratorio, carta e prova finale, e riportarle su carta se peggiorano. Userà soldi veri con i limiti del profilo scelto. I risultati passati non garantiscono quelli futuri. Serve anche l\'interruttore degli ordini veri acceso.', 'Attiva', go);
    }
    if (field === 'profile') {
        const P = { prudente: '0,25% a trade, leva 2x, max 2 posizioni, obiettivo +1% e limite −2% al giorno, ogni strategia reale torna su carta oltre −3% dal suo massimo', bilanciato: '0,5% a trade, leva 3x, max 3 posizioni, obiettivo +2% e limite −3% al giorno, ogni strategia reale torna su carta oltre −5% dal suo massimo', aggressivo: '1% a trade, leva 5x, max 4 posizioni, obiettivo +3% e limite −5% al giorno, ogni strategia reale torna su carta oltre −8% dal suo massimo' };
        return openAutoConfirm(`Profilo ${AG_LABELS.profile[value].toLowerCase()}?`, `Imposta tutti i limiti di rischio: ${P[value]}.`, 'Imposta', go);
    }
    go();
}

// --- Impostazioni: indirizzo del server comandi ---
export function fillServerSettings() {
    const input = $('apiBaseInput'), tok = $('ghTokenInput');
    if (input) input.value = getApiBase();
    if (tok) tok.value = '';
    const st = $('ghTokenState');
    if (st) st.textContent = getGhToken() ? 'Token salvato su questo dispositivo.' : 'Nessun token salvato.';
}
export function saveGhToken() {
    const value = ($('ghTokenInput').value || '').trim();
    if (!value) { window.showAlert('Token GitHub', 'Incolla il token nel campo, poi premi Salva.'); return; }
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(value)) {
        window.showAlert('Token non valido', 'Un token GitHub inizia con "github_pat_" (consigliato) o "ghp_".');
        return;
    }
    setGhToken(value);
    fillServerSettings();
    window.showAlert('Token GitHub', 'Salvato su questo dispositivo. Ora i comandi partono direttamente da GitHub.');
    renderAutomation();
}
export function removeGhToken() {
    setGhToken('');
    fillServerSettings();
    window.showAlert('Token GitHub', 'Token rimosso da questo dispositivo.');
    renderAutomation();
}
export function saveServerSettings() {
    const value = ($('apiBaseInput').value || '').trim();
    if (value && !/^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(value)) {
        window.showAlert('Indirizzo non valido', 'Serve un indirizzo https://..., per esempio quello di un server su Cloudflare (…workers.dev).');
        return;
    }
    setApiBase(value);
    window.showAlert('Server comandi', value ? 'Indirizzo salvato: i comandi passano dal server (ha la precedenza sul token).' : 'Indirizzo rimosso.');
    renderAutomation();
}
export function resetAppKey() {
    clearAppKey();
    window.showAlert('Chiave app', 'Chiave rimossa da questo dispositivo: verrà richiesta al prossimo comando.');
}
