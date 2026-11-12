import { sanitizeAction } from './rules.js';
// Logica comune dei comandi: la usano l'app nel browser (utils/helpers.js), Vercel (api/*.js, tramite api/_core.js)
// e Cloudflare Workers (worker/index.js).
// Nessuna dipendenza da Node: solo fetch e JavaScript standard.
//
// Endpoint (tutti POST, protetti da APP_SECRET tramite l'header x-app-key):
//   /api/trigger   avvia il bot per una coppia (come prima)
//   /api/analyze   analisi AI di un trade (Groq)
//   /api/command   comandi della dashboard: test, interruttori delle strategie, emergenza
//
// I comandi non toccano mai direttamente file o ordini: avviano un workflow GitHub con parametri
// controllati qui E di nuovo nel workflow (automation.py), che decide se il comando è ammesso.
// Il "file del server" vale come prima barriera, il repository come ultima.

const SYMBOLS = ['ALL', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const TIMEFRAMES = ['ALL', '1d', '4h', '1h'];
const MODES = ['off', 'paper', 'live'];
const STRATEGY_KEY = /^[a-z0-9_]{1,40}:(1d|4h|1h)$/;

// Confronto a tempo costante (non rivela quanti caratteri della chiave sono giusti)
export function safeEqual(a, b) {
    a = String(a || '');
    b = String(b || '');
    let diff = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return diff === 0;
}

// Senza APP_SECRET l'endpoint resterebbe aperto a chiunque: per i comandi è obbligatoria
export function isAuthorized(headers, env, required = false) {
    const secret = String(env.APP_SECRET || '').trim();
    if (!secret) return !required;
    return safeEqual(headers['x-app-key'], secret);
}

const json = (status, body) => ({ status, body });

async function dispatch(env, fetchFn, workflow, inputs) {
    const token = env.GH_TOKEN;
    if (!token) return json(500, { error: 'Token GitHub non configurato sul server' });
    const repo = String(env.GH_REPO || 'salvogeraci030899-wq/SGTRADER').trim();
    const ref = String(env.GH_REF || 'main').trim();
    try {
        const r = await fetchFn(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
                'User-Agent': 'SGTRADER-server'
            },
            body: JSON.stringify({ ref, inputs })
        });
        if (r.ok) return json(200, { status: 'started', workflow });
        if ([401, 403, 404].includes(r.status)) {
            return json(502, { error: 'GitHub ha rifiutato il token: deve essere valido, sul repository SGTRADER, con permesso "Actions: Read and write".', status: r.status });
        }
        return json(502, { error: 'Errore GitHub', status: r.status });
    } catch (e) {
        return json(500, { error: 'Errore di rete verso GitHub' });
    }
}

export async function trigger(body, env, fetchFn) {
    const { symbol = 'ALL', timeframe = 'ALL', force = 'true' } = body || {};
    if (!SYMBOLS.includes(symbol) || !TIMEFRAMES.includes(timeframe) || !['true', 'false'].includes(force)) return json(400, { error: 'Parametri non validi' });
    return dispatch(env, fetchFn, 'bot.yml', { symbol, timeframe, force });
}

// Ogni comando ammesso, con i soli parametri che può ricevere
export async function command(body, env, fetchFn) {
    const b = body || {};
    switch (b.type) {
        case 'run_lab': {
            const unseal = b.unseal == null ? '' : String(b.unseal);
            if (unseal && !STRATEGY_KEY.test(unseal)) return json(400, { error: 'Prova finale: strategia non valida' });
            return dispatch(env, fetchFn, 'lab.yml', { unseal });
        }
        case 'run_strategies':
            return dispatch(env, fetchFn, 'strategies.yml', { start: '2018-01-01' });
        case 'run_validation':
            return dispatch(env, fetchFn, 'validation.yml', { n_samples: '50', max_minutes: '320' });
        case 'set_mode':
            if (!STRATEGY_KEY.test(String(b.key || '')) || !MODES.includes(b.mode)) return json(400, { error: 'Strategia o stato non validi' });
            return dispatch(env, fetchFn, 'automation.yml', { action: 'set', key: b.key, mode: b.mode });
        case 'set_risk': {
            const fields = ['risk_per_trade_pct', 'max_leverage', 'max_exposure_x', 'max_open_positions', 'max_daily_loss_pct', 'dry_run_equity'];
            const value = String(b.value == null ? '' : b.value);
            if (!fields.includes(b.field) || !/^\d{1,7}(\.\d{1,3})?$/.test(value)) return json(400, { error: 'Limite o valore non validi' });
            return dispatch(env, fetchFn, 'automation.yml', { action: 'risk', key: b.field, mode: value });
        }
        case 'trading':
            if (!['on', 'off'].includes(b.value)) return json(400, { error: 'Valore non valido' });
            return dispatch(env, fetchFn, 'automation.yml', { action: 'trading', key: '', mode: b.value });
        case 'account_refresh':
            // rilettura del conto Bitget (nessun ordine), chiesta dall'app aperta in modalità Reale
            return dispatch(env, fetchFn, 'position.yml', { action: 'refresh', symbol: 'BTCUSDT', side: 'long', price: '' });
        case 'alert': {
            // avvisi di prezzo su Telegram (price_alerts.py): aggiungi, togli, togli tutti
            if (b.op === 'add') {
                const price = String(b.price == null ? '' : b.price);
                if (!ANALYZE_SYMBOLS.includes(b.symbol) || !['above', 'below'].includes(b.side) || !/^\d{1,9}(\.\d{1,8})?$/.test(price) || !(Number(price) > 0)) {
                    return json(400, { error: 'Avviso non valido' });
                }
                return dispatch(env, fetchFn, 'automation.yml', { action: 'alert', key: `${b.symbol}:${b.side}:${price}`, mode: 'add' });
            }
            if (b.op === 'del') {
                if (!/^[0-9a-f]{8}$/.test(String(b.id || ''))) return json(400, { error: 'Avviso non valido' });
                return dispatch(env, fetchFn, 'automation.yml', { action: 'alert', key: b.id, mode: 'del' });
            }
            if (b.op === 'clear') return dispatch(env, fetchFn, 'automation.yml', { action: 'alert', key: '', mode: 'clear' });
            return json(400, { error: 'Avviso non valido' });
        }
        case 'emergency':
            return dispatch(env, fetchFn, 'automation.yml', { action: 'emergency', key: '', mode: '' });
        case 'resume':
            return dispatch(env, fetchFn, 'automation.yml', { action: 'resume', key: '', mode: '' });
        case 'position': {
            // posizione REALE su Bitget (assistente): chiusura, TP, SL, rimozione TP/SL. position_cmd.py ricontrolla tutto.
            const price = b.price == null || b.price === '' ? '' : String(b.price);
            if (!['close', 'tp', 'sl', 'clear', 'untp', 'unsl'].includes(b.action) || !['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].includes(b.symbol) || !['long', 'short'].includes(b.side)) {
                return json(400, { error: 'Comando sulla posizione non valido' });
            }
            if (['tp', 'sl'].includes(b.action) ? !/^\d{1,9}(\.\d{1,8})?$/.test(price) || !(Number(price) > 0) : price !== '') {
                return json(400, { error: 'Prezzo non valido' });
            }
            // codice della richiesta (facoltativo): l'app lo ritrova in live_trades.json per mostrare l'esito
            const req = typeof b.req === 'string' && /^[a-z0-9]{6,20}$/.test(b.req) ? b.req : '';
            return dispatch(env, fetchFn, 'position.yml', { action: b.action, symbol: b.symbol, side: b.side, price, ...(req ? { req } : {}) });
        }
        default:
            return json(400, { error: 'Comando sconosciuto' });
    }
}

const ANALYZE_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const ANALYZE_TFS = ['1d', '4h', '1h'];
const BIASES = ['LONG', 'SHORT', 'NEUTRO'];
const CONSENSUS = ['LONG', 'SHORT', 'NEUTRAL'];
// Solo numeri finiti finiscono nel prompt: niente testo libero dal client al posto dei prezzi
const num = v => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);
const show = v => (v === null ? 'N/D' : v);
const r2 = (v, d = 2) => (v === null || !Number.isFinite(v) ? 'N/D' : Number(v.toFixed(d)));

// ---------- Indicatori calcolati qui (il client manda solo candele numeriche) ----------
function ema(values, period) {
    if (values.length < period) return null;
    const k = 2 / (period + 1);
    let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
    return e;
}
function rsi(closes, period = 14) {
    if (closes.length <= period) return null;
    let gain = 0, loss = 0;
    for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) gain += d; else loss -= d; }
    gain /= period; loss /= period;
    for (let i = period + 1; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        gain = (gain * (period - 1) + Math.max(d, 0)) / period;
        loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    }
    return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}
function atr(c, period = 14) {
    if (c.length <= period) return null;
    const tr = c.slice(1).map((x, i) => Math.max(x.h - x.l, Math.abs(x.h - c[i].c), Math.abs(x.l - c[i].c)));
    let a = tr.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < tr.length; i++) a = (a * (period - 1) + tr[i]) / period;
    return a;
}

// candele [[t, o, h, l, c, v], ...] -> riassunto numerico di un timeframe
export function summarizeCandles(raw) {
    const c = (Array.isArray(raw) ? raw : []).slice(-300).map(x => Array.isArray(x)
        ? { o: num(x[1]), h: num(x[2]), l: num(x[3]), c: num(x[4]), v: num(x[5]) } : null)
        .filter(x => x && x.o !== null && x.h !== null && x.l !== null && x.c !== null);
    if (c.length < 30) return null;
    const closes = c.map(x => x.c), last = closes[closes.length - 1];
    const pct = (a, b) => (a && b ? (a / b - 1) * 100 : null);
    const e20 = ema(closes, 20), e50 = ema(closes, 50), e200 = ema(closes, 200), a14 = atr(c);
    const look = c.slice(-20), vols = c.slice(-21, -1).map(x => x.v).filter(v => v !== null);
    const avgVol = vols.length ? vols.reduce((s, v) => s + v, 0) / vols.length : null;
    return {
        n: c.length, last,
        chg1: pct(last, closes[closes.length - 2]), chg10: pct(last, closes[closes.length - 11]),
        ema20: e20, ema50: e50, ema200: e200,
        rsi14: rsi(closes), atr_pct: a14 ? (a14 / last) * 100 : null,
        high20: Math.max(...look.map(x => x.h)), low20: Math.min(...look.map(x => x.l)),
        vol_ratio: avgVol && c[c.length - 1].v !== null ? c[c.length - 1].v / avgVol : null,
        last3: c.slice(-3).map(x => `${r2(x.o)}/${r2(x.h)}/${r2(x.l)}/${r2(x.c)}`).join(' ; ')
    };
}

function tfLine(tf, s) {
    if (!s) return `${tf}: dati insufficienti`;
    const vs = (a, b) => (a === null || b === null ? 'N/D' : a > b ? 'sopra' : 'sotto');
    return `${tf}: chiusura ${r2(s.last)} | var. ultima candela ${r2(s.chg1)}% | ultime 10 ${r2(s.chg10)}% | `
        + `EMA20 ${r2(s.ema20)} EMA50 ${r2(s.ema50)} EMA200 ${r2(s.ema200)} (prezzo ${vs(s.last, s.ema200)} EMA200, EMA50 ${vs(s.ema50, s.ema200)} EMA200) | `
        + `RSI14 ${r2(s.rsi14, 1)} | ATR14 ${r2(s.atr_pct)}% | max/min 20 candele ${r2(s.high20)}/${r2(s.low20)} | `
        + `volume vs media 20 ${r2(s.vol_ratio)}x | ultime 3 candele O/H/L/C: ${s.last3}`;
}

export function buildAnalysisPrompt(b) {
    const plan = b.ai_plan && typeof b.ai_plan === 'object' ? b.ai_plan : {};
    const f = b.futures && typeof b.futures === 'object' ? b.futures : {};
    const cons = b.consensus && typeof b.consensus === 'object' ? b.consensus : {};
    const candles = b.candles && typeof b.candles === 'object' ? b.candles : {};
    const tfs = ['1d', '4h', '1h'].map(tf => tfLine(tf, summarizeCandles(candles[tf]))).join('\n');
    const hasTrade = b.type === 'LONG' || b.type === 'SHORT';
    const trade = hasTrade
        ? (b.real === true
            ? `POSIZIONE APERTA REALE su Bitget (soldi veri): ${b.type} ${b.symbol}, entry ${show(num(b.entry))}, stop su Bitget ${num(b.stop) == null ? 'nessuno' : show(num(b.stop))}, target su Bitget ${num(b.take) == null ? 'nessuno' : show(num(b.take))}, `
              + `leva ${show(num(b.leverage))}x, PnL attuale ${show(num(b.pnl))} USDT (prezzo mark, prima delle commissioni di chiusura). Valuta anche se manca uno stop.`
            : `POSIZIONE APERTA (simulata): ${b.type} ${b.symbol} timeframe ${b.timeframe}, entry ${show(num(b.entry))}, stop ${show(num(b.stop))}, target ${show(num(b.take))}, `
              + `leva ${show(num(b.leverage))}x, PnL netto attuale ${show(num(b.pnl))} USDT, aperta da ${show(num(b.hours_open))} ore.`)
        : `NESSUNA POSIZIONE: analisi di mercato su ${b.symbol}, timeframe di riferimento ${b.timeframe}.`;
    const consensus = CONSENSUS.includes(cons.direction) ? `${cons.direction} (${show(num(cons.agreement))}/4 strategie d'accordo)` : 'N/D';
    const bias = BIASES.includes(plan.bias) ? plan.bias : 'N/D';
    return `Dati di mercato in tempo reale (${new Date().toISOString().slice(0, 16)} UTC), ${b.symbol}:
Prezzo live: ${show(num(b.currentPrice))}
${tfs}
Futures Bitget: funding ${show(num(f.funding_rate_pct))}% per periodo, open interest 24h ${show(num(f.oi_change_24h_pct))}%, posizioni long ${show(num(f.long_positions_pct))}%.
Consenso delle regole tecniche dell'app: ${consensus}. Modello Kronos: ${bias}, probabilità di rialzo ${show(num(plan.prob_up))}%.
Nota di onestà: né le regole tecniche né Kronos hanno un vantaggio dimostrato nei test fuori campione; non trattarli come prove.
${trade}`;
}

const SYSTEM_PROMPT = `Sei un analista di trading crypto rigoroso. Ragiona SOLO sui dati forniti, citando i numeri.
Struttura della risposta, in italiano, testo semplice senza Markdown, titoli in maiuscolo seguiti da due punti:
QUADRO: tendenza su 1d, 4h e 1h e se sono allineate.
LIVELLI: supporti e resistenze dai dati (EMA, massimi/minimi a 20 candele), con i prezzi.
MOMENTUM E RISCHIO: RSI, volatilità (ATR), volumi, funding e affollamento dei futures.
SCENARI: rialzista e ribassista, ciascuno con il livello che lo conferma o lo annulla.
AZIONE: se c'è una posizione, una tra MANTIENI, CHIUDI ORA, SPOSTA STOP a un prezzo preciso, INCASSA PARZIALE, con il motivo; se non c'è, ATTENDI oppure il livello che renderebbe sensato entrare, con lo stop.
Massimo 220 parole. Niente promesse di guadagno: è un'opinione, non un segnale validato.`;

// ---------- Scelta del modello Groq ----------
// Groq ritira i modelli senza preavviso: si usa GROQ_MODEL se impostato, altrimenti il primo di
// questa lista tra quelli che l'account vede (/models). Se il modello in uso sparisce, si riprova.
const MODEL_PREFERENCE = ['openai/gpt-oss-120b', 'moonshotai/kimi-k2', 'meta-llama/llama-4-maverick', 'qwen/qwen3-32b',
    'llama-3.3-70b', 'meta-llama/llama-4-scout', 'openai/gpt-oss-20b', 'llama-3.1-8b'];
const NOT_CHAT = /whisper|tts|guard|playai|orpheus|compound|distil|allam|safeguard/i;
let cachedModel = null;

export function pickModel(ids) {
    const chat = (ids || []).filter(id => typeof id === 'string' && !NOT_CHAT.test(id));
    for (const pref of MODEL_PREFERENCE) {
        const hit = chat.find(id => id === pref || id.startsWith(pref));
        if (hit) return hit;
    }
    return chat[0] || null;
}

async function availableModel(key, fetchFn, refresh = false) {
    if (cachedModel && !refresh) return cachedModel;
    const r = await fetchFn('https://api.groq.com/openai/v1/models', { method: 'GET', headers: { 'Authorization': `Bearer ${key}` } });
    if (!r.ok) return null;
    const data = await r.json();
    cachedModel = pickModel((data.data || []).filter(m => m.active !== false).map(m => m.id));
    return cachedModel;
}

// Modelli che ragionano prima di rispondere (gpt-oss, qwen3...): il ragionamento consuma il limite di
// token e la risposta può arrivare troncata. Si chiede un ragionamento breve e si alza il limite.
const REASONING = /gpt-oss|qwen3|deepseek-r1|reason/i;
export function modelOptions(model, maxTokens) {
    const opts = { max_tokens: REASONING.test(model) ? maxTokens * 3 : maxTokens };
    if (/gpt-oss/i.test(model)) opts.reasoning_effort = 'low';
    return opts;
}
const truncated = data => data && data.choices && data.choices[0] && data.choices[0].finish_reason === 'length';

const modelGone = (status, msg) => status === 404 || /model.*(not exist|not found|decommission|deprecat|access)/i.test(msg || '');

export async function analyze(body, env, fetchFn) {
    const key = String(env.GROQ_API_KEY || '').trim();
    if (!key) return json(500, { error: 'GROQ_API_KEY non configurata sul server.' });
    const b = body || {};
    if (!ANALYZE_SYMBOLS.includes(b.symbol) || !ANALYZE_TFS.includes(b.timeframe) || !['LONG', 'SHORT', 'NONE'].includes(b.type || 'NONE')) {
        return json(400, { error: 'Parametri non validi' });
    }
    const prompt = buildAnalysisPrompt(b);
    const call = model => fetchFn('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }], temperature: 0.2, ...modelOptions(model, 1000) })
    });
    try {
        const forced = String(env.GROQ_MODEL || '').trim();
        let model = forced || await availableModel(key, fetchFn);
        if (!model) return json(502, { error: 'Nessun modello Groq disponibile per questa chiave.' });
        let r = await call(model), data = await r.json();
        if (!r.ok && modelGone(r.status, data.error && data.error.message)) {
            const next = await availableModel(key, fetchFn, true);
            if (next && next !== model) { model = next; r = await call(model); data = await r.json(); }
        }
        if (!r.ok) return json(r.status, { error: (data.error && data.error.message) || 'Errore sconosciuto API Groq' });
        let analysis = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!analysis) return json(502, { error: 'Risposta vuota da Groq' });
        analysis = analysis.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\*\*/g, '').trim();
        if (truncated(data)) analysis += '\n\n(Risposta interrotta dal limite di lunghezza del modello: riprova.)';
        return json(200, { analysis, model });
    } catch (e) {
        return json(500, { error: 'Errore di rete verso Groq' });
    }
}

// ---------- Assistente sulle posizioni (chat e voce) ----------
// Risponde in breve e, se l'utente chiede qualcosa da fare, propone UNA azione strutturata scelta da
// un elenco chiuso. L'app la ricontrolla (src/core/rules.js) e la applica solo dopo conferma.
const ASSISTANT_SYSTEM = `Sei l'assistente di trading di SGTRADER e parli in italiano, in modo breve (massimo 60 parole).
Ricevi i dati di UNA posizione (simulata dell'app oppure REALE su Bitget) e un messaggio dell'utente. Rispondi SOLO con un oggetto JSON:
{"reply": "testo per l'utente", "action": null oppure un'azione}
Azioni possibili (usa SOLO queste, con questi campi):
- {"type":"close_at_pnl","value":numero,"unit":"usdt" o "pct"}: chiudi quando il PnL netto arriva a value (negativo per una perdita massima; pct = percentuale del capitale della posizione)
- {"type":"close_at_price","price":numero}: chiudi quando il prezzo arriva a quel livello
- {"type":"set_stop","price":numero}: sposta lo stop loss
- {"type":"stop_breakeven"}: sposta lo stop a pareggio
- {"type":"set_target","price":numero}: sposta il take profit
- {"type":"close_now"}: chiudi subito
- {"type":"clear_rules"}: togli le regole automatiche attive
Se l'utente fa una domanda o la richiesta non è chiara, action è null e nella reply chiedi di precisare.
Non inventare numeri: usa quelli forniti. Nella reply spiega l'azione proposta senza dire che è già fatta e chiudi con «Confermi?».
Non dare consigli finanziari come certezze.`;

function positionFacts(p) {
    const n = v => show(num(v));
    const rules = Array.isArray(p.rules) ? p.rules.slice(0, 5).map(r => (typeof r === 'string' ? r.slice(0, 80) : '')).filter(Boolean) : [];
    const real = p.real === true
        ? 'Posizione REALE su Bitget: le chiusure automatiche diventano un take profit o uno stop loss sull\'exchange (uno solo per tipo: il nuovo sostituisce il vecchio); "togli le regole" toglie TP e SL. PnL senza tasse.\n'
        : '';
    return `${real}Posizione: ${ANALYZE_SYMBOLS.includes(p.symbol) ? p.symbol : 'N/D'} ${['LONG', 'SHORT'].includes(p.type) ? p.type : 'N/D'}, `
        + `mercato ${p.market === 'FUTURES' ? 'futures' : 'spot'}, leva ${n(p.leverage)}x, timeframe ${ANALYZE_TFS.includes(p.timeframe) ? p.timeframe : 'N/D'}.
Entry ${n(p.entry)}, prezzo attuale ${n(p.price)}, stop ${n(p.stop)}, target ${n(p.take)}.
Quantità ${n(p.size)}, capitale impiegato ${n(p.capital)} USDT, PnL netto ora ${n(p.pnl)} USDT, aperta da ${n(p.hours_open)} ore.
Regole automatiche attive: ${rules.length ? rules.join('; ') : 'nessuna'}.`;
}

// ---------- Assistente generale (Home): comanda il tool ----------
const GENERAL_SYSTEM = `Sei l'assistente di SGTRADER, un'app personale di trading su BTC, ETH e SOL. Parli in italiano, in modo breve (massimo 70 parole).
Ricevi lo stato attuale del tool e un messaggio dell'utente. Rispondi SOLO con un oggetto JSON:
{"reply": "testo per l'utente", "action": null oppure un'azione}
Azioni possibili (usa SOLO queste, con questi campi):
- {"type":"set_strategy","key":"nome:tf","mode":"paper" o "off"}: metti su carta o spegni una strategia (key esattamente come negli elenchi forniti)
- {"type":"set_trading","value":"on" o "off"}: modalità ordini reale (on) o simulata (off)
- {"type":"emergency"}: emergenza, spegne tutto
- {"type":"resume"}: sblocca dopo l'emergenza
- {"type":"run_lab"}: rilancia il laboratorio delle strategie
- {"type":"analyze","symbol":"BTCUSDT"|"ETHUSDT"|"SOLUSDT","timeframe":"1d"|"4h"|"1h"}: apri l'analisi AI live
- {"type":"price_alert","symbol":"BTCUSDT"|"ETHUSDT"|"SOLUSDT","price":numero}: avviso su Telegram quando il prezzo tocca quel livello (solo un messaggio, nessun ordine)
- {"type":"remove_alert","symbol":"BTCUSDT"|"ETHUSDT"|"SOLUSDT","price":numero o null}: togli UN avviso di prezzo (price null se su quella coin ce n'è uno solo)
- {"type":"clear_alerts"}: togli tutti gli avvisi di prezzo
- {"type":"open_page","page":"home"|"terminal"|"signals"|"trade"|"calculator"|"journal"|"test"|"settings"|"account"}: apri una pagina
Per le domande rispondi con i dati forniti e action null. Non inventare numeri. Se la richiesta non è chiara, chiedi di precisare.
Quando proponi un'azione NON dire mai che è già fatta: scrivi cosa farai e chiudi con «Confermi?» (es. «Metto donchian55 1d su carta. Confermi?»). Nessuna strategia è confermata dalla prova finale finché l'elenco "confermate" è vuoto: dillo se l'utente chiede di andare in reale.`;

const PAGES_OK = ['home', 'terminal', 'signals', 'trade', 'calculator', 'journal', 'test', 'settings', 'account'];
export function sanitizeGeneralAction(a) {
    if (!a || typeof a !== 'object') return null;
    switch (a.type) {
        case 'set_strategy':
            return STRATEGY_KEY.test(a.key || '') && ['paper', 'off'].includes(a.mode) ? { type: a.type, key: a.key, mode: a.mode } : null;
        case 'set_trading':
            return ['on', 'off'].includes(a.value) ? { type: a.type, value: a.value } : null;
        case 'emergency': case 'resume': case 'run_lab':
            return { type: a.type };
        case 'analyze':
            return ANALYZE_SYMBOLS.includes(a.symbol) && ANALYZE_TFS.includes(a.timeframe) ? { type: a.type, symbol: a.symbol, timeframe: a.timeframe } : null;
        case 'open_page':
            return PAGES_OK.includes(a.page) ? { type: a.type, page: a.page } : null;
        case 'price_alert': {
            const price = Number(a.price);
            return ANALYZE_SYMBOLS.includes(a.symbol) && Number.isFinite(price) && price > 0 && price < 1e9 ? { type: a.type, symbol: a.symbol, price } : null;
        }
        case 'clear_alerts':
            return { type: a.type };
        case 'remove_alert': {
            if (!ANALYZE_SYMBOLS.includes(a.symbol)) return null;
            const price = a.price == null || a.price === '' ? null : Number(a.price);
            return price === null || (Number.isFinite(price) && price > 0) ? { type: a.type, symbol: a.symbol, price } : null;
        }
    }
    return null;
}

function generalFacts(c) {
    const n = v => show(num(v));
    const list = (arr, max) => (Array.isArray(arr) ? arr : []).filter(x => typeof x === 'string' && STRATEGY_KEY.test(x)).slice(0, max);
    const active = (Array.isArray(c.active) ? c.active : []).slice(0, 6)
        .filter(a => a && STRATEGY_KEY.test(a.key || ''))
        .map(a => `${a.key} (${a.mode === 'live' ? 'reale' : 'carta'}, ${n(a.closed)} chiusi, medio ${n(a.avg_net_pct)}%, ${n(a.open)} aperti)`);
    const prices = ANALYZE_SYMBOLS.map(s => `${s} ${n(c.prices && c.prices[s])}`).join(', ');
    const alerts = (Array.isArray(c.alerts) ? c.alerts : []).slice(0, 10)
        .filter(a => a && ANALYZE_SYMBOLS.includes(a.symbol) && ['above', 'below'].includes(a.side) && Number.isFinite(Number(a.price)))
        .map(a => `${a.symbol} ${a.side === 'above' ? '≥' : '≤'} ${Number(a.price)}`);
    return `Stato del tool:
Prezzi: ${prices}.
Modalità ordini: ${c.trading === 'on' ? 'reale' : 'simulato'}. Emergenza: ${c.emergency ? 'sì' : 'no'}.
Saldo Bitget: ${n(c.bitget_total)} USDT, posizioni reali ${n(c.bitget_positions)}.
Conto simulato dell'app: capitale libero ${n(c.sim_free)} USDT, posizioni aperte ${n(c.sim_open)}.
Ultimo giro del bot: ${n(c.bot_minutes)} minuti fa (parte ogni 15 minuti).
Strategie accese (massimo 6): ${active.length ? active.join('; ') : 'nessuna'}.
Confermate dalla prova finale: ${list(c.confirmed, 10).join(', ') || 'nessuna'}.
Avvisi di prezzo attivi: ${alerts.length ? alerts.join(', ') : 'nessuno'}.
Strategie che si possono mettere su carta (migliori nello storico per prime): ${list(c.available, 30).join(', ') || 'N/D'}.`;
}

export async function assistant(body, env, fetchFn) {
    const key = String(env.GROQ_API_KEY || '').trim();
    if (!key) return json(500, { error: 'GROQ_API_KEY non configurata sul server.' });
    const b = body || {};
    const text = typeof b.text === 'string' ? b.text.trim().slice(0, 500) : '';
    const general = b.scope === 'general';
    if (!text || (!general && (!b.position || typeof b.position !== 'object'))) return json(400, { error: 'Parametri non validi' });
    const history = (Array.isArray(b.history) ? b.history : []).slice(-6)
        .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, 400) }));
    const messages = general
        ? [{ role: 'system', content: GENERAL_SYSTEM }, { role: 'system', content: generalFacts(b.context && typeof b.context === 'object' ? b.context : {}) }, ...history, { role: 'user', content: text }]
        : [{ role: 'system', content: ASSISTANT_SYSTEM }, { role: 'system', content: positionFacts(b.position) }, ...history, { role: 'user', content: text }];
    const clean = general ? sanitizeGeneralAction : sanitizeAction;
    const call = model => fetchFn('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: 0.1, ...modelOptions(model, 500), response_format: { type: 'json_object' } })
    });
    try {
        const forced = String(env.GROQ_MODEL || '').trim();
        let model = forced || await availableModel(key, fetchFn);
        if (!model) return json(502, { error: 'Nessun modello Groq disponibile per questa chiave.' });
        let r = await call(model), data = await r.json();
        if (!r.ok && modelGone(r.status, data.error && data.error.message)) {
            const next = await availableModel(key, fetchFn, true);
            if (next && next !== model) { model = next; r = await call(model); data = await r.json(); }
        }
        if (!r.ok) return json(r.status, { error: (data.error && data.error.message) || 'Errore sconosciuto API Groq' });
        const raw = String((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '')
            .replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (e) { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch (e2) {} } }
        if (!parsed || typeof parsed.reply !== 'string') return json(200, { reply: raw.slice(0, 600) || 'Non ho capito, puoi ripetere?', action: null, model });
        return json(200, { reply: parsed.reply.slice(0, 600), action: clean(parsed.action), model });
    } catch (e) {
        return json(500, { error: 'Errore di rete verso Groq' });
    }
}

// Trascrizione della voce (Whisper su Groq, gratuito). Audio in base64, al massimo ~2 MB.
export async function transcribe(body, env, fetchFn) {
    const key = String(env.GROQ_API_KEY || '').trim();
    if (!key) return json(500, { error: 'GROQ_API_KEY non configurata sul server.' });
    const b = body || {};
    const audio = typeof b.audio === 'string' ? b.audio : '';
    const mime = /^audio\/[a-z0-9.+-]+$/i.test(b.mime || '') ? b.mime.split(';')[0] : 'audio/mp4';
    if (!audio || audio.length > 2_800_000) return json(400, { error: 'Audio mancante o troppo lungo (massimo circa un minuto).' });
    let bytes;
    try {
        const bin = atob(audio);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch (e) { return json(400, { error: 'Audio non valido.' }); }
    const ext = { 'audio/mp4': 'm4a', 'audio/aac': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' }[mime] || 'm4a';
    const send = model => {
        const form = new FormData();
        form.append('file', new Blob([bytes], { type: mime }), `voce.${ext}`);
        form.append('model', model);
        form.append('language', 'it');
        form.append('response_format', 'json');
        return fetchFn('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { 'Authorization': `Bearer ${key}` }, body: form });
    };
    try {
        let r = await send('whisper-large-v3-turbo'), data = await r.json();
        if (!r.ok && modelGone(r.status, data.error && data.error.message)) { r = await send('whisper-large-v3'); data = await r.json(); }
        if (!r.ok) return json(r.status, { error: (data.error && data.error.message) || 'Trascrizione non riuscita' });
        const text = String(data.text || '').trim();
        return text ? json(200, { text }) : json(422, { error: 'Non ho sentito nulla: riprova parlando più vicino.' });
    } catch (e) {
        return json(500, { error: 'Errore di rete verso Groq' });
    }
}

// Instradamento unico: path, corpo già letto, header in minuscolo, variabili d'ambiente, fetch
export async function handle(method, path, body, headers, env, fetchFn) {
    const route = path.replace(/\/+$/, '');
    const routes = { '/api/trigger': [trigger, false], '/api/analyze': [analyze, false], '/api/assistant': [assistant, false], '/api/transcribe': [transcribe, false], '/api/command': [command, true] };
    if (!routes[route]) return json(404, { error: 'Endpoint sconosciuto' });
    if (method !== 'POST') return json(405, { error: 'Metodo non consentito' });
    const [fn, secretRequired] = routes[route];
    if (!isAuthorized(headers, env, secretRequired)) {
        return json(401, { error: secretRequired && !String(env.APP_SECRET || '').trim() ? 'APP_SECRET non configurata sul server: i comandi sono disattivati' : 'Chiave app mancante o errata' });
    }
    return fn(body, env, fetchFn);
}
