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
        case 'emergency':
            return dispatch(env, fetchFn, 'automation.yml', { action: 'emergency', key: '', mode: '' });
        case 'resume':
            return dispatch(env, fetchFn, 'automation.yml', { action: 'resume', key: '', mode: '' });
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
        ? `POSIZIONE APERTA (simulata): ${b.type} ${b.symbol} timeframe ${b.timeframe}, entry ${show(num(b.entry))}, stop ${show(num(b.stop))}, target ${show(num(b.take))}, `
          + `leva ${show(num(b.leverage))}x, PnL netto attuale ${show(num(b.pnl))} USDT, aperta da ${show(num(b.hours_open))} ore.`
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
        body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }], temperature: 0.2, max_tokens: 900 })
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
        return json(200, { analysis, model });
    } catch (e) {
        return json(500, { error: 'Errore di rete verso Groq' });
    }
}

// Instradamento unico: path, corpo già letto, header in minuscolo, variabili d'ambiente, fetch
export async function handle(method, path, body, headers, env, fetchFn) {
    const route = path.replace(/\/+$/, '');
    const routes = { '/api/trigger': [trigger, false], '/api/analyze': [analyze, false], '/api/command': [command, true] };
    if (!routes[route]) return json(404, { error: 'Endpoint sconosciuto' });
    if (method !== 'POST') return json(405, { error: 'Metodo non consentito' });
    const [fn, secretRequired] = routes[route];
    if (!isAuthorized(headers, env, secretRequired)) {
        return json(401, { error: secretRequired && !String(env.APP_SECRET || '').trim() ? 'APP_SECRET non configurata sul server: i comandi sono disattivati' : 'Chiave app mancante o errata' });
    }
    return fn(body, env, fetchFn);
}
