// --- Bot Telegram in SOLA LETTURA: chiedi al tool come va, dalla chat dove già ricevi gli avvisi ---
// Telegram manda ogni messaggio al server (webhook /api/telegram). Il server risponde solo se:
//   1. l'header "X-Telegram-Bot-Api-Secret-Token" coincide con TELEGRAM_WEBHOOK_SECRET (lo imposta il
//      workflow "Pubblica server comandi" quando registra il webhook);
//   2. il messaggio arriva dalla tua chat (TELEGRAM_CHAT_ID).
// I dati sono gli stessi file pubblici che legge l'app (GitHub Pages). L'unico comando che cambia qualcosa è
// "/emergenza CONFERMA": spegne tutte le strategie e chiude le posizioni dell'esecutore (come il tasto
// Emergenza dell'app). Va solo nella direzione che riduce il rischio; sbloccare si fa dall'app.
import { CONFIG } from './config.js';

const COMMANDS = {
    '/stato': 'conto, modalità, strategie, blocchi',
    '/posizioni': 'posizioni reali aperte su Bitget',
    '/agente': 'impostazioni, ultime decisioni, proposte',
    '/carta': 'come vanno le strategie su carta',
    '/avvisi': 'avvisi di prezzo attivi',
    '/emergenza': 'spegne tutto (serve la parola CONFERMA)',
    '/aiuto': 'questo elenco'
};
const FILES = ['automation.json', 'live_trades.json', 'paper_trades.json', 'agent_state.json', 'alerts_state.json', 'quick_state.json'];

const n = (v, d = 2) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }));
const sg = (v, d = 2) => (v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + n(v, d));
const coin = s => String(s || '').replace('USDT', '');
const lab = k => String(k || '').replace(/_/g, ' ').replace(':', ' ');
const AG = { autonomy: { off: 'spento', paper: 'simulato', live: 'REALE' }, def: { autonomy: 'paper', profile: 'bilanciato', style: 'swing' } };

function help() {
    return '🤖 SGTRADER: comandi (sola lettura)\n' + Object.entries(COMMANDS).map(([c, t]) => `${c} · ${t}`).join('\n')
        + '\nOrdini e impostazioni si cambiano dall\'app, con la conferma. Da qui si può solo fermare tutto.';
}

function stato(d) {
    const cfg = d['automation.json'] || {}, live = d['live_trades.json'] || {}, acc = live.account || {};
    const risk = cfg.risk || {};
    const lines = ['📊 STATO'];
    if (cfg.emergency) lines.push('⛔ EMERGENZA ATTIVA: automazione ferma.');
    if (live.halted) lines.push('⚠️ Esecutore BLOCCATO: controlla Bitget e sblocca dall\'app.');
    if (acc.connected) {
        lines.push(`Bitget ${acc.demo ? 'demo' : 'reale'}: ${n(acc.total_usdt ?? acc.equity)} USDT${acc.day_change != null ? ` (oggi ${sg(acc.day_change)})` : ''}`);
        lines.push(`Posizioni: ${acc.positions || 0}${acc.positions ? ` · PnL aperto ${sg(acc.upl)} USDT` : ''}`);
        if (acc.checked_at) lines.push(`Letto alle ${new Date(acc.checked_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}`);
    } else lines.push('Conto Bitget non letto.');
    lines.push(`Ordini veri: ${risk.trading_enabled ? 'interruttore ACCESO' : 'spenti'} · esecutore ${live.mode || 'simulato'}`);
    const active = Object.entries(cfg.strategies || {}).filter(([, m]) => m !== 'off');
    lines.push('Strategie: ' + (active.length ? active.map(([k, m]) => `${lab(k)} (${m === 'live' ? 'reale' : 'carta'})`).join(', ') : 'nessuna'));
    const ag = { ...AG.def, ...(cfg.agent || {}) };
    lines.push(`Agente: ${AG.autonomy[ag.autonomy] || ag.autonomy}, ${ag.profile}, ${ag.style}`);
    return lines.join('\n');
}

function posizioni(d) {
    const acc = (d['live_trades.json'] || {}).account || {};
    const fut = acc.positions_detail || [], spot = (acc.spot_detail || []).filter(p => (p.usdt || 0) >= 1);
    if (!acc.connected) return 'Conto Bitget non letto.';
    if (!fut.length && !spot.length) return 'Nessuna posizione aperta su Bitget.';
    const lines = ['📈 POSIZIONI'];
    for (const p of fut) {
        lines.push(`${coin(p.symbol)} ${String(p.side || '').toUpperCase()} ${p.leverage ? p.leverage + 'x' : ''} · ${n(p.size, 4)} da ${n(p.entry)}`
            + `\n  mark ${n(p.mark)} · PnL ${sg(p.upl)} USDT · stop ${p.sl ? n(p.sl) : 'NESSUNO'} · target ${p.tp ? n(p.tp) : '—'}`);
    }
    for (const p of spot) lines.push(`${coin(p.symbol)} spot · ${n(p.qty, 4)} (${n(p.usdt)} USDT) · stop ${p.sl ? n(p.sl) : '—'} · target ${p.tp ? n(p.tp) : '—'}`);
    return lines.join('\n');
}

const KIND = { on: 'su carta', observe: 'in osservazione', off: 'spenta', promote: 'AL REALE', demote: 'tornata su carta', proposal: 'proposta' };
function agente(d) {
    const cfg = d['automation.json'] || {}, st = d['agent_state.json'] || {};
    const ag = { ...AG.def, ...(cfg.agent || {}) };
    const lines = [`🤖 AGENTE · ${AG.autonomy[ag.autonomy] || ag.autonomy}, ${ag.profile}, ${ag.style}`];
    if (st.last_run) lines.push(`Ultima decisione: ${new Date(st.last_run).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}`);
    for (const p of st.proposals || []) lines.push(`👉 Proposta: ${lab(p.key)} al reale (${p.n} trade su carta, netto medio ${sg(p.avg_net_pct)}%). Conferma nell'app.`);
    const cap = st.capital;
    if (cap && cap.symbols && Object.keys(cap.symbols).length && !Object.values(cap.symbols).some(v => v.ok)) {
        const least = Object.entries(cap.symbols).sort((a, b) => a[1].needed - b[1].needed)[0];
        lines.push(`Capitale ${n(cap.equity)} USDT: troppo poco per i minimi di Bitget (servono ~${n(least[1].needed, 0)} per ${coin(least[0])}).`);
    }
    if (cap && cap.paper_feasible && cap.paper_feasible[1]) lines.push(`Della carta, il conto vero avrebbe aperto ${cap.paper_feasible[0]} trade su ${cap.paper_feasible[1]}.`);
    const log = (st.log || []).slice(-5).reverse();
    if (log.length) lines.push('Ultime decisioni:\n' + log.map(e => `• ${KIND[e.kind] || e.kind}: ${lab(e.key)}`).join('\n'));
    else lines.push('Nessuna decisione ancora.');
    return lines.join('\n');
}

const VERDICT = { in_linea: 'in linea con lo storico', sotto: '⚠️ sotto lo storico', sopra: 'sopra lo storico' };
function carta(d) {
    const cfg = d['automation.json'] || {}, paper = d['paper_trades.json'] || {};
    const active = new Set(Object.entries(cfg.strategies || {}).filter(([, m]) => m !== 'off').map(([k]) => k));
    const observing = new Set((d['agent_state.json'] || {}).observing || []);
    const risk = Number((cfg.risk || {}).risk_per_trade_pct) || 0.5;
    const lines = ['🧪 CARTA'];
    let eq = 0, tot = 0;
    for (const [k, e] of Object.entries(paper.strategies || {})) {
        for (const t of e.trades || []) {
            if (t.open || t.net == null || !t.entry || !t.stop) continue;
            const stop = Math.abs(t.entry - t.stop) / t.entry * 100;
            if (stop > 0) { eq += t.net / stop * risk; tot++; }
        }
        if (!active.has(k)) continue;
        const s = e.stats || {}, v = (s.vs_backtest || {}).verdict;
        lines.push(`${lab(k)}${observing.has(k) ? ' (osservazione)' : ''}: ${s.n || 0} chiusi${s.n ? `, netto medio ${sg(s.avg_net_pct)}%` : ''}, ${s.open || 0} aperti${VERDICT[v] ? ' · ' + VERDICT[v] : ''}`);
    }
    if (lines.length === 1) lines.push('Nessuna strategia su carta.');
    lines.push(tot ? `In totale: ${sg(eq)}% del patrimonio in ${tot} trade (rischio ${n(risk, 2)}% a trade).` : 'Nessun trade chiuso finora.');
    return lines.join('\n');
}

function avvisi(d) {
    const cfg = d['automation.json'] || {};
    const fired = new Set([...((d['alerts_state.json'] || {})._price_alerts_fired || []), ...((d['quick_state.json'] || {})._price_alerts_fired || [])]);
    const list = (cfg.price_alerts || []).filter(a => a && !fired.has(a.id));
    return list.length ? '🔔 AVVISI ATTIVI\n' + list.map(a => `${coin(a.symbol)} ${a.side === 'above' ? '≥' : '≤'} ${n(a.price, a.price >= 1000 ? 0 : 2)}`).join('\n')
        : 'Nessun avviso di prezzo attivo. Crealo dall\'app (assistente o campanella nel grafico).';
}

// Testo della risposta a un messaggio, dai file già letti. Esportata per i test.
export function telegramAnswer(text, data) {
    const cmd = String(text || '').trim().split(/[\s@]/)[0].toLowerCase();
    const fn = { '/stato': stato, '/posizioni': posizioni, '/agente': agente, '/carta': carta, '/avvisi': avvisi }[cmd];
    return fn ? fn(data) : help();
}

async function loadData(env, fetchFn) {
    const base = String(env.DATA_BASE || CONFIG.DATA_SOURCES[0]);
    const out = {};
    await Promise.all(FILES.map(async f => {
        try {
            const r = await fetchFn(`${base}${f}?t=${Date.now()}`);
            out[f] = r.ok ? await r.json() : null;
        } catch (e) { out[f] = null; }
    }));
    return out;
}

const eq = (a, b) => {
    a = String(a || ''); b = String(b || '');
    if (!a || a.length !== b.length) return false;
    let x = 0;
    for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return x === 0;
};

const EMERGENCY_HELP = '⛔ EMERGENZA\nSpegne tutte le strategie, chiude le posizioni aperte dall\'esecutore e blocca l\'automazione '
    + '(le posizioni aperte a mano restano). Per confermare scrivi:\n/emergenza CONFERMA\nPer ripartire: app, Agente → Rischio → Sblocca.';

// Tasti sotto i messaggi (inline keyboard): rispondono qui, senza aprire niente fuori da Telegram.
// Gli stessi tasti li mettono anche i messaggi del bot (watchdog.keyboard_for).
export const INFO_KEYS = { inline_keyboard: [[{ text: '📊 Stato', callback_data: 'stato' }, { text: '📈 Posizioni', callback_data: 'posizioni' }, { text: '🤖 Agente', callback_data: 'agente' }]] };
const CONFIRM_SECONDS = 120;        // la conferma dell'emergenza vale 2 minuti: un tasto vecchio non fa nulla

async function tg(env, fetchFn, method, payload) {
    try {
        await fetchFn(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
    } catch (e) { /* risposta persa: si può ritoccare il tasto */ }
}

async function onButton(cb, env, fetchFn, command, now) {
    await tg(env, fetchFn, 'answerCallbackQuery', { callback_query_id: cb.id });     // toglie la rotellina dal tasto
    const data = String(cb.data || '');
    const send = (text, keys = INFO_KEYS) => tg(env, fetchFn, 'sendMessage', { chat_id: env.TELEGRAM_CHAT_ID, text: text.slice(0, 4000), reply_markup: keys, disable_web_page_preview: true });
    if (['stato', 'posizioni', 'agente', 'carta', 'avvisi'].includes(data)) return send(telegramAnswer('/' + data, await loadData(env, fetchFn)));
    if (data === 'emg') {
        return send(EMERGENCY_HELP.split('\nPer confermare')[0] + '\n\nConfermi? (vale 2 minuti)', { inline_keyboard: [[
            { text: '⛔ Sì, spegni tutto', callback_data: `emg_yes:${Math.floor(now / 1000)}` }, { text: 'No', callback_data: 'emg_no' }]] });
    }
    if (data === 'emg_no') return send('Emergenza annullata: non è cambiato nulla.');
    if (data.startsWith('emg_yes:')) {
        const t = Number(data.split(':')[1]) || 0;
        if (Math.floor(now / 1000) - t > CONFIRM_SECONDS || !command) return send('Conferma scaduta: tocca di nuovo ⛔ Emergenza se serve ancora.');
        const r = await command({ type: 'emergency' });
        return send(r && r.status === 200
            ? '⛔ Emergenza inviata. Entro 1-2 minuti strategie spente; al giro successivo del bot (entro 15 minuti) l\'esecutore chiude le sue posizioni e lo scrive qui. Le posizioni aperte a mano restano: controlla su Bitget.'
            : `Emergenza NON inviata (${(r && r.body && r.body.error) || 'errore'}). Usa l'app o chiudi direttamente su Bitget.`);
    }
    return null;
}

// command: funzione che invia un comando come l'app (commands.js), passata da handle()
export async function telegramWebhook(body, headers, env, fetchFn, command = null, now = Date.now()) {
    const ok = { status: 200, body: { ok: true } };
    if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID || !env.TELEGRAM_WEBHOOK_SECRET) return { status: 503, body: { error: 'Bot Telegram non configurato' } };
    if (!eq(headers['x-telegram-bot-api-secret-token'], env.TELEGRAM_WEBHOOK_SECRET)) return { status: 401, body: { error: 'non autorizzato' } };
    const cb = body && body.callback_query;
    if (cb) {
        if (String(cb.message && cb.message.chat && cb.message.chat.id) === String(env.TELEGRAM_CHAT_ID)) await onButton(cb, env, fetchFn, command, now);
        return ok;
    }
    const msg = (body && (body.message || body.edited_message)) || null;
    // altre chat o messaggi senza testo: nessuna risposta (200, così Telegram non riprova)
    if (!msg || !msg.text || String(msg.chat && msg.chat.id) !== String(env.TELEGRAM_CHAT_ID)) return ok;
    const words = String(msg.text).trim().split(/\s+/);
    let answer;
    if (words[0].split('@')[0].toLowerCase() === '/emergenza') {
        if ((words[1] || '').toUpperCase() !== 'CONFERMA' || !command) answer = EMERGENCY_HELP;
        else {
            const r = await command({ type: 'emergency' });
            answer = r && r.status === 200
                ? '⛔ Emergenza inviata. Entro 1-2 minuti strategie spente; al giro successivo del bot (entro 15 minuti) l\'esecutore chiude le sue posizioni e lo scrive qui. Le posizioni aperte a mano restano: controlla su Bitget.'
                : `Emergenza NON inviata (${(r && r.body && r.body.error) || 'errore'}). Usa l'app o chiudi direttamente su Bitget.`;
        }
    } else answer = telegramAnswer(msg.text, await loadData(env, fetchFn));
    try {
        await fetchFn(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: answer.slice(0, 4000), disable_web_page_preview: true, reply_markup: INFO_KEYS })
        });
    } catch (e) { /* risposta persa: l'utente può riscrivere */ }
    return ok;
}
