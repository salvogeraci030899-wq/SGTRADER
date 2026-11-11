import { $, escapeHtml, apiPost, getApiBase, setApiBase, clearAppKey } from '../utils/helpers.js';

// --- AUTOMAZIONE (pagina Segnali, vista "Auto") ---
// Mostra e comanda le strategie automatiche: spenta, su carta (segnali seguiti senza ordini) o reale.
// L'app non tocca mai direttamente file o ordini: manda un comando al server comandi, che avvia il
// workflow "Automazione"; il controllo vero (reale solo se confermata, niente durante l'emergenza)
// è ripetuto lì, in automation.py. I file letti qui sono quelli pubblicati: si aggiornano con ritardo.

const MODE_LABEL = { off: 'Spenta', paper: 'Su carta', live: 'Reale' };
let cfg = null, ledger = null, lab = null, loaded = false, loading = false;
const pending = {};   // comandi inviati ma non ancora visibili nei file pubblicati

const pct = (v, d = 2) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`);
const day = iso => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—');
const label = key => key.replace(':', ' ').replace(/_/g, ' ');

async function getJson(name) {
    try {
        const r = await fetch(`./${name}?t=${Date.now()}`);
        return r.ok ? await r.json() : null;
    } catch (e) { return null; }
}

export async function loadAutomation() {
    if (loading) return;
    loading = true;
    [cfg, ledger, lab] = await Promise.all([getJson('automation.json'), getJson('paper_trades.json'), getJson('lab_summary.json')]);
    loaded = true;
    loading = false;
    for (const [key, mode] of Object.entries(pending)) if (currentMode(key, true) === mode) delete pending[key];
    renderAutomation();
}

function currentMode(key, ignorePending = false) {
    if (!ignorePending && pending[key]) return pending[key];
    return (cfg && cfg.strategies && cfg.strategies[key]) || 'off';
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
    const server = getApiBase();
    const onPaper = Object.values(cfg ? cfg.strategies : {}).filter(m => m !== 'off').length;
    status.innerHTML = `
        <div class="auto-row"><span>Server comandi</span><b class="${server || sameSiteServer() ? 'text-accent' : 'text-warning'}">${server ? 'impostato' : (sameSiteServer() ? 'questo sito' : 'non impostato')}</b></div>
        <div class="auto-row"><span>Stato</span><b class="${emergency ? 'text-danger' : 'text-accent'}">${emergency ? 'EMERGENZA: tutto bloccato' : `${onPaper} ${onPaper === 1 ? 'strategia attiva' : 'strategie attive'}`}</b></div>
        <div class="auto-row"><span>Ordini reali</span><b>${(lab && lab.confirmed && lab.confirmed.length) ? 'consentiti solo per le confermate' : 'nessuna strategia confermata'}</b></div>`;

    const keys = shownKeys();
    list.innerHTML = keys.length ? keys.map(key => {
        const mode = currentMode(key);
        const st = ledger && ledger.strategies && ledger.strategies[key] && ledger.strategies[key].stats;
        const res = lab && lab.results && lab.results[key];
        const info = st && (st.n || st.open)
            ? `Su carta: ${st.n} chiusi${st.n ? ` (${pct(st.avg_net_pct)} medio)` : ''}, ${st.open} aperti`
            : (res ? `Storico: ${res.n} trade, oltre il mercato ${pct(res.excess_avg_pct)}${res.holdout ? (res.holdout.confirmed ? ' · confermata' : ' · bocciata alla prova finale') : ''}` : 'Nessun dato');
        const btn = (m, text, disabled, title) => `<button type="button" class="pill-btn${mode === m ? ' active' : ''}" ${disabled ? 'disabled' : ''} title="${title || ''}" onclick="setAutoMode('${escapeHtml(key)}','${m}')">${text}</button>`;
        return `<div class="auto-item">
            <div class="auto-item-head"><b>${escapeHtml(label(key))}</b>${pending[key] ? '<span class="text-warning">in corso…</span>' : ''}</div>
            <div class="auto-item-info">${escapeHtml(info)}</div>
            <div class="option-toggle compact">${btn('off', 'Spenta')}${btn('paper', 'Su carta', emergency)}${btn('live', 'Reale', emergency || !isConfirmed(key), isConfirmed(key) ? '' : 'Solo per strategie confermate dalla prova finale')}</div>
        </div>`;
    }).join('') : '<div class="empty-hint">Nessuna strategia attiva. Usa "Aggiungi" per metterne una su carta.</div>';

    const btn = $('autoEmergencyBtn');
    if (btn) {
        btn.textContent = emergency ? 'Sblocca automazione' : 'Emergenza: spegni tutto';
        btn.classList.toggle('auto-resume', emergency);
    }
    const note = $('autoNote');
    if (note) note.textContent = `Su carta dal ${day(cfg && cfg.paper_start)}. I comandi passano da GitHub: l'effetto si vede qui dopo qualche minuto. Ordini reali su Bitget: non ancora collegati.`;
}

const NO_SERVER = 'Questo sito non ha un server comandi. Imposta l\'indirizzo del server in Impostazioni → Server comandi.';
const sameSiteServer = () => location.hostname.endsWith('vercel.app');

async function send(body, okText) {
    // Su GitHub Pages (o in locale) senza indirizzo impostato non c'è nessun server: lo si dice subito
    if (!getApiBase() && !sameSiteServer()) {
        window.showAlert('Comando non inviato', NO_SERVER);
        return false;
    }
    let r;
    try {
        r = await apiPost('/api/command', body);
    } catch (e) {
        window.showAlert('Comando non inviato', 'Server comandi non raggiungibile. Controlla l\'indirizzo in Impostazioni → Server comandi.');
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
    window.showAlert('Comando inviato', okText);
    return true;
}

export async function setAutoMode(key, mode) {
    if (currentMode(key) === mode) return;
    if (mode === 'live' && !isConfirmed(key)) return;
    const ok = await send({ type: 'set_mode', key, mode }, `${label(key)}: ${MODE_LABEL[mode].toLowerCase()}. Il bot applica il cambio entro qualche minuto.`);
    if (ok) { pending[key] = mode; renderAutomation(); setTimeout(loadAutomation, 90000); }
}

export function toggleEmergency() {
    const emergency = !!(cfg && cfg.emergency);
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
    box.innerHTML = rows.length ? rows.map(([key, r]) => {
        const on = currentMode(key) !== 'off';
        const rel = r.family === 'forza relativa';
        return `<button class="auto-add-item" ${on || rel ? 'disabled' : ''} onclick="addAutoPaper('${escapeHtml(key)}')">
            <span><b>${escapeHtml(label(key))}</b><br><small>${r.n} trade · oltre il mercato ${pct(r.excess_avg_pct)}${r.holdout ? (r.holdout.confirmed ? ' · confermata' : ' · bocciata') : (r.candidate ? ' · candidata' : '')}</small></span>
            <small>${on ? 'già attiva' : (rel ? 'non ancora' : 'su carta')}</small></button>`;
    }).join('') : '<div class="empty-hint">Risultati del laboratorio non disponibili.</div>';
    $('autoAddModal').classList.add('active');
}

export function closeAutoAdd() { $('autoAddModal').classList.remove('active'); }

export function addAutoPaper(key) {
    closeAutoAdd();
    setAutoMode(key, 'paper');
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
    const input = $('apiBaseInput');
    if (input) input.value = getApiBase();
}
export function saveServerSettings() {
    const value = ($('apiBaseInput').value || '').trim();
    if (value && !/^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(value)) {
        window.showAlert('Indirizzo non valido', 'Serve un indirizzo https://..., per esempio quello del server su Cloudflare (…workers.dev).');
        return;
    }
    setApiBase(value);
    window.showAlert('Server comandi', value ? 'Indirizzo salvato su questo dispositivo.' : 'Indirizzo rimosso: si usa il sito stesso.');
    renderAutomation();
}
export function resetAppKey() {
    clearAppKey();
    window.showAlert('Chiave app', 'Chiave rimossa da questo dispositivo: verrà richiesta al prossimo comando.');
}
