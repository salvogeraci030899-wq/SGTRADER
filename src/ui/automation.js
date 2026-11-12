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
export function removeRealOrder(symbol, side, kind, price) {
    if (!['tp', 'sl'].includes(kind) || !['long', 'short'].includes(side)) return;
    const what = kind === 'tp' ? 'il take profit' : 'lo stop loss';
    const name = `${symbol.replace('USDT', '')} ${side.toUpperCase()}`;
    openAutoConfirm(`Togli ${what}`, `ORDINE VERO su Bitget: tolgo ${what} di ${name} (${fmtPrice(price)}). La posizione resta aperta${kind === 'sl' ? ' senza stop' : ''}.`, 'Togli', async () => {
        const key = `${symbol}|${kind}`;
        removingReal.add(key);
        if (window.renderActiveTrades) window.renderActiveTrades();
        const ok = await send({ type: 'position', symbol, side, action: `un${kind}`, price: '' }, 'Inviato a Bitget: esito su Telegram e nella scheda entro 1-2 minuti.');
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
    let alertsState;
    [cfg, ledger, lab, live, alertsState] = await Promise.all([getJson('automation.json'), getJson('paper_trades.json'), getJson('lab_summary.json'), getJson('live_trades.json'), getJson('alerts_state.json')]);
    firedAlerts = (alertsState && alertsState._price_alerts_fired) || [];
    loaded = true;
    loading = false;
    for (const [key, mode] of Object.entries(pending)) if (currentMode(key, true) === mode) delete pending[key];
    if (pendingTrading && (pendingTrading === 'on') === !!riskCfg().trading_enabled) pendingTrading = null;
    renderAutomation();
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
    const serverText = { server: 'server impostato', github: 'token GitHub', site: 'questo sito', none: 'non impostati' }[mode];
    const onPaper = Object.values(cfg ? cfg.strategies : {}).filter(m => m !== 'off').length;
    const { text: accText, cls: accClass, detail: accDetail } = bitgetAccountText(live && live.account);
    const acc = live && live.account;
    status.innerHTML = `
        <div class="auto-row"><span>Comandi</span><b class="${mode === 'none' ? 'text-warning' : 'text-ui'}">${serverText}</b></div>
        <div class="auto-row"><span>Stato</span><b class="${emergency || halted ? 'text-danger' : 'text-accent'}">${emergency ? 'EMERGENZA: tutto bloccato' : (halted ? 'esecutore bloccato: controlla Bitget' : `${onPaper} ${onPaper === 1 ? 'strategia attiva' : 'strategie attive'}`)}</b></div>
        <div class="auto-row"><span>Saldo Bitget</span><b class="${accClass}" title="${escapeHtml((acc && acc.reason) || '')}">${accText}</b></div>
        ${accDetail ? `<div class="auto-row auto-sub"><span></span><b>${escapeHtml(accDetail)}</b></div>` : ''}
        <div class="auto-row clickable" onclick="openAccount()"><span>Ordini veri</span><b class="${risk.trading_enabled ? 'text-warning' : ''}">${realText} ›</b></div>
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
function openAutoConfirm(title, msg, okText, action) {
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
    $('btn-view-sig').classList.toggle('active', view === 'sig');
    $('btn-view-auto').classList.toggle('active', view === 'auto');
    $('sigView').style.display = view === 'sig' ? '' : 'none';
    $('autoView').style.display = view === 'auto' ? '' : 'none';
    $('signalsSubtitle').textContent = view === 'sig' ? 'Consensus multi-sorgente' : 'Strategie automatiche';
    if (view === 'auto') { loaded = false; renderAutomation(); }
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
