// Logica comune del server comandi, uguale su Vercel (api/*.js) e su Cloudflare Workers (worker/index.js).
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
    const { symbol = 'ALL', timeframe = 'ALL' } = body || {};
    if (!SYMBOLS.includes(symbol) || !TIMEFRAMES.includes(timeframe)) return json(400, { error: 'Parametri non validi' });
    return dispatch(env, fetchFn, 'bot.yml', { symbol, timeframe });
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
// Solo numeri finiti finiscono nel prompt: niente testo libero dal client al posto dei prezzi
const num = v => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);
const show = v => (v === null ? 'N/D' : v);

export async function analyze(body, env, fetchFn) {
    const key = String(env.GROQ_API_KEY || '').trim();
    if (!key) return json(500, { error: 'GROQ_API_KEY non configurata sul server.' });
    const b = body || {};
    const plan = b.ai_plan && typeof b.ai_plan === 'object' ? b.ai_plan : {};
    if (!ANALYZE_SYMBOLS.includes(b.symbol) || !ANALYZE_TFS.includes(b.timeframe) || !['LONG', 'SHORT'].includes(b.type)) {
        return json(400, { error: 'Parametri non validi' });
    }
    const candles = Array.isArray(b.recent_candles) ? b.recent_candles.slice(-10) : [];
    const candlesText = candles.map(c =>
        `O:${show(num(c && c.open))} H:${show(num(c && c.high))} L:${show(num(c && c.low))} C:${show(num(c && c.close))}`
    ).join(' | ');
    const bias = BIASES.includes(plan.bias) ? plan.bias : 'NEUTRO';
    const reasoning = typeof plan.reasoning === 'string' ? plan.reasoning.slice(0, 600) : 'Nessuno';
    const prompt = `Sei un trader professionista. Analizza questo trade in tempo reale.
Asset: ${b.symbol} (${b.timeframe})
Direzione: ${b.type}
Entry: $${show(num(b.entry))} | SL: $${show(num(b.stop))} | TP: $${show(num(b.take))}
Prezzo Attuale: $${show(num(b.currentPrice))}
PnL Attuale: ${show(num(b.pnl))} USDT
Bias modello: ${bias} (Prob rialzo: ${show(num(plan.prob_up))}%)
Reasoning: ${reasoning}
Ultime 10 candele: ${candlesText}

Dai un consiglio operativo secco (MANTIENI, CHIUDI ORA, SPOSTA STOP, INCASSA PARZIALE). Max 100 parole, tono diretto, no Markdown.`;
    try {
        const r = await fetchFn('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // Modello sovrascrivibile con GROQ_MODEL (Groq dismette periodicamente i modelli)
                model: String(env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim(),
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 250
            })
        });
        const data = await r.json();
        if (!r.ok) return json(r.status, { error: (data.error && data.error.message) || 'Errore sconosciuto API Groq' });
        const analysis = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!analysis) return json(502, { error: 'Risposta vuota da Groq' });
        return json(200, { analysis });
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
