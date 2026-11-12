import { State } from '../core/state.js';
import { getThemePref, setThemePref, getStatusBarPref, setStatusBarPref } from '../core/theme.js';
import { $, fmtUsdt, getApiBase, getGhToken, commandMode } from '../utils/helpers.js';
import { getAutoState, riskCfg, loadAutomation, bitgetAccountText } from './automation.js';

// --- ACCOUNT (icona in Home) e IMPOSTAZIONI (barra in basso) ---
// Account: saldo Bitget letto dal bot, interruttore Simulato/Reale, limiti di rischio, conto simulato.
// I dati vengono dai file pubblicati dal bot (automation.json, live_trades.json, lab_summary.json).

const usdt = v => { const [i, d] = Math.abs(Number(v)).toFixed(2).split('.'); return (Number(v) < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };

function set(id, text, cls) {
    const el = $(id);
    if (!el) return;
    if (el.textContent !== text) el.textContent = text;
    if (cls !== undefined && el.className !== cls) el.className = cls;
}

// Modalità effettiva: quella inviata (in attesa) o quella pubblicata
export function tradingMode() {
    const { pendingTrading, loaded } = getAutoState();
    if (pendingTrading) return { mode: pendingTrading, pending: true, known: true };
    return { mode: riskCfg().trading_enabled ? 'on' : 'off', pending: false, known: loaded };
}

export function openAccount() {
    window.switchTab('account');
}

export function renderAccount() {
    const page = $('page-account');
    const { cfg, lab, live, loaded } = getAutoState();
    if (!loaded) { loadAutomation(); }
    updateModePills();
    if (!page || !page.classList.contains('active')) return;

    // Saldo Bitget
    const acc = live && live.account;
    const t = bitgetAccountText(acc);
    if (acc && acc.connected) {
        set('accTotal', `${usdt(acc.total_usdt != null ? acc.total_usdt : acc.equity)} USDT`, 'acc-total');
        set('accKind', acc.demo ? 'DEMO' : 'REALE', 'acc-kind ' + (acc.demo ? 'demo' : 'real'));
        set('accDetail', t.detail);
        const when = acc.checked_at ? new Date(acc.checked_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
        set('accMeta', `Letto dal bot in sola lettura il ${when} · si aggiorna ogni 15 minuti`);
    } else {
        set('accTotal', loaded ? (acc ? '—' : 'Non ancora letto') : 'Caricamento…', 'acc-total muted');
        set('accKind', '', 'acc-kind');
        set('accDetail', acc ? t.text : 'Il bot legge il conto a ogni giro, se le chiavi Bitget sono impostate su GitHub.');
        set('accMeta', acc && acc.reason && acc.reason !== 'chiavi non impostate' ? `Errore: ${acc.reason}` : '');
    }

    // Modalità
    const m = tradingMode();
    document.querySelectorAll('#accModeSwitch button').forEach(b => {
        b.classList.toggle('active', m.known && b.dataset.mode === m.mode);
        b.classList.toggle('real', b.dataset.mode === 'on');
    });
    set('accModePending', m.pending ? 'in arrivo…' : '');
    const confirmed = (lab && lab.confirmed) || [];
    const liveKeys = Object.entries((cfg && cfg.strategies) || {}).filter(([, v]) => v === 'live').map(([k]) => k);
    let explain;
    if (cfg && cfg.emergency) explain = 'Emergenza attiva: tutto fermo. Si sblocca da Segnali → Auto.';
    else if (m.mode === 'off') explain = "Simulato: nessun ordine vero. Il bot segue le strategie su carta e l'esecutore simula gli ordini.";
    else if (!confirmed.length) explain = 'Reale, ma nessuna strategia è confermata dalla prova finale: per ora non parte nessun ordine.';
    else if (!liveKeys.length) explain = 'Reale, ma nessuna strategia è su Reale: mettine una da Segnali → Auto.';
    else explain = `Reale: ordini veri su Bitget per ${liveKeys.join(', ')}, con i limiti qui sotto.`;
    set('accModeExplain', explain, 'acc-explain' + (m.mode === 'on' ? ' warn' : ''));

    // Rischio
    const r = riskCfg();
    set('accRiskTrade', `${r.risk_per_trade_pct}% del patrimonio`);
    set('accRiskLev', `${r.max_leverage}x · max ${r.max_open_positions}`);
    set('accRiskDay', `${r.max_daily_loss_pct}%`);

    // Conto simulato dell'app
    set('accSimFree', fmtUsdt(State.simState.freeBalance));
    set('accSimOpen', String(State.simState.activeTrades.length));
}

// Pastiglia "SIMULATO / REALE" in Home e valore nelle Impostazioni
export function updateModePills() {
    const st = getAutoState();
    if (!st.loaded) loadAutomation();          // la Home deve mostrare la modalità anche senza aprire Auto
    const m = tradingMode();
    const text = !m.known ? '—' : (m.mode === 'on' ? 'REALE' : 'SIMULATO') + (m.pending ? '…' : '');
    const pill = $('homeModePill');
    const cls = 'mode-pill' + (m.known && m.mode === 'on' ? ' real' : '');
    if (pill && pill.textContent !== text) pill.textContent = text;
    if (pill && pill.className !== cls) pill.className = cls;
    set('setModeVal', !m.known ? '—' : (m.mode === 'on' ? 'Reale' : 'Simulato'));
}

// Aspetto: Auto segue iOS (anche mentre l'app è aperta), Chiaro e Scuro sono fissi
export function setTheme(pref) {
    setThemePref(pref);
    renderSettings();
}

// Barra di stato: iOS la rilegge solo alla riapertura dell'app
export function setStatusBar(pref) {
    const changed = pref !== getStatusBarPref();
    setStatusBarPref(pref);
    renderSettings();
    if (changed && window.showAlert) window.showAlert('Barra di stato', "Chiudi e riapri l'app dalla schermata Home per vedere il cambio. Nel tema chiaro la barra è sempre separata.");
}

export function renderSettings() {
    const bar = getStatusBarPref();
    document.querySelectorAll('#statusBarToggle button').forEach(b => b.classList.toggle('active', b.dataset.bar === bar));
    const pref = getThemePref();
    document.querySelectorAll('#themeToggle button').forEach(b => b.classList.toggle('active', b.dataset.pref === pref));
    const version = document.querySelector('meta[name="app-version"]')?.content || '—';
    set('settingsSubtitle', `SGTRADER · v${version}`);
    const mode = commandMode();
    set('setConnVal', { server: 'server', github: 'token GitHub', site: 'questo sito', cloud: 'server Cloudflare', none: 'da impostare' }[mode]);
    updateModePills();
    if (!getAutoState().loaded) loadAutomation();
}

// Connessioni: schermata a parte (Impostazioni → Altro)
export function openConnections() {
    const input = $('apiBaseInput'), tok = $('ghTokenInput');
    if (input) input.value = getApiBase();
    if (tok) tok.value = '';
    const st = $('ghTokenState');
    if (st) st.textContent = getGhToken() ? 'Token salvato su questo dispositivo.' : 'Nessun token salvato.';
    $('connModal').classList.add('active');
}
export function closeConnections() {
    $('connModal').classList.remove('active');
    renderSettings();
}
