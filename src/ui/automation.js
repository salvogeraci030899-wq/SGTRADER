import { $, escapeHtml, apiPost, getApiBase, setApiBase, clearAppKey, getGhToken, setGhToken, commandMode } from '../utils/helpers.js';

// --- AUTOMAZIONE (pagina Segnali, vista "Auto") ---
// Mostra e comanda le strategie automatiche: spenta, su carta (segnali seguiti senza ordini) o reale.
// L'app non tocca mai direttamente file o ordini: manda un comando al server comandi, che avvia il
// workflow "Automazione"; il controllo vero (reale solo se confermata, niente durante l'emergenza)
// è ripetuto lì, in automation.py. I file letti qui sono quelli pubblicati: si aggiornano con ritardo.

const MODE_LABEL = { off: 'Spenta', paper: 'Su carta', live: 'Reale' };
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
const riskCfg = () => ({ ...DEFAULT_RISK, ...((cfg && cfg.risk) || {}) });
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
        return { text: `${usdt(total)} USDT · ${kind}`, cls: 'text-accent', detail };
    }
    if (acc.reason === 'chiavi non impostate') return { text: 'chiavi non impostate', cls: '', detail: '' };
    return { text: 'lettura non riuscita: controlla la chiave', cls: 'text-danger', detail: '' };
}

export async function loadAutomation() {
    if (loading) return;
    loading = true;
    [cfg, ledger, lab, live] = await Promise.all([getJson('automation.json'), getJson('paper_trades.json'), getJson('lab_summary.json'), getJson('live_trades.json')]);
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
        <div class="auto-row"><span>Comandi</span><b class="${mode === 'none' ? 'text-warning' : 'text-accent'}">${serverText}</b></div>
        <div class="auto-row"><span>Stato</span><b class="${emergency || halted ? 'text-danger' : 'text-accent'}">${emergency ? 'EMERGENZA: tutto bloccato' : (halted ? 'esecutore bloccato: controlla Bitget' : `${onPaper} ${onPaper === 1 ? 'strategia attiva' : 'strategie attive'}`)}</b></div>
        <div class="auto-row"><span>Saldo Bitget</span><b class="${accClass}" title="${escapeHtml((acc && acc.reason) || '')}">${accText}</b></div>
        ${accDetail ? `<div class="auto-row auto-sub"><span></span><b>${escapeHtml(accDetail)}</b></div>` : ''}
        <div class="auto-row"><span>Ordini veri</span><b class="${risk.trading_enabled ? 'text-warning' : ''}">${realText}</b></div>
        <div class="auto-row"><span>Rischio</span><b>${risk.risk_per_trade_pct}% a trade · leva ${risk.max_leverage}x · max ${risk.max_open_positions} · −${risk.max_daily_loss_pct}%/giorno</b></div>`;

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
    box.innerHTML = rows.length ? rows.map(([key, r]) => {
        const on = currentMode(key) !== 'off';
        const rel = r.family === 'forza relativa' || r.family === 'funding';
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

// --- Limiti di rischio e interruttore degli ordini veri ---
export function openAutoRisk() {
    const risk = riskCfg();
    $('autoRiskFields').innerHTML = RISK_FIELDS.map(([f, text, lo, hi, step]) =>
        `<label class="auto-risk-field"><span>${text}</span><input type="number" inputmode="decimal" id="risk_${f}" value="${risk[f]}" min="${lo}" max="${hi}" step="${step}"></label>`).join('');
    $('riskTrading').value = risk.trading_enabled ? 'on' : 'off';
    document.querySelectorAll('.option-toggle[data-target="riskTrading"] button').forEach(b => b.classList.toggle('active', b.dataset.value === $('riskTrading').value));
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
    const trading = $('riskTrading').value;
    if ((trading === 'on') !== !!risk.trading_enabled) changes.push({ type: 'trading', value: trading });
    closeAutoRisk();
    if (!changes.length) return;
    const go = async () => {
        for (const c of changes) if (!(await send(c, ''))) return;
        window.showAlert('Comandi inviati', `${changes.length} ${changes.length === 1 ? 'modifica inviata' : 'modifiche inviate'}: visibili qui dopo qualche minuto.`);
        setTimeout(loadAutomation, 90000);
    };
    if (trading === 'on' && !risk.trading_enabled) {
        openAutoConfirm('Ordini veri', 'Abiliti gli ordini veri su Bitget. Partiranno solo per strategie confermate e messe su Reale, e solo con le chiavi Bitget impostate su GitHub. Con la leva puoi perdere tutto il capitale impiegato.', 'Abilita', go);
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
