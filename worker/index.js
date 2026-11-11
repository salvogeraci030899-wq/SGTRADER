// Server comandi su Cloudflare Workers (gratuito: 100.000 richieste al giorno).
// Fa anche da orologio del bot: GitHub esegue lo schedule "quando può" (anche con ore di ritardo),
// il Cron Trigger di Cloudflare invece avvia il bot ogni 15 minuti (wrangler.toml).
// Stessa logica di Vercel (api/_core.js); qui si aggiunge solo il CORS, perché l'app (GitHub Pages
// o altro dominio) chiama il worker da un'origine diversa.
//
// Variabili e segreti del worker (impostati dal workflow "Pubblica server comandi"):
//   APP_SECRET       chiave che l'app manda nell'header x-app-key (obbligatoria per i comandi)
//   GH_TOKEN         token GitHub che può avviare i workflow del repository
//   GROQ_API_KEY     facoltativa, per l'analisi AI
//   ALLOWED_ORIGINS  origini ammesse, separate da virgola
import { handle, trigger } from '../api/_core.js';

const DEFAULT_ORIGINS = 'https://salvogeraci030899-wq.github.io,https://sgtrader.vercel.app';

function cors(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean);
    const h = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-app-key',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
    if (allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
    return h;
}

// Avvio programmato del bot (stesso comando di "Aggiorna" nell'app, per tutte le coppie)
export async function scheduled(env, fetchFn = fetch) {
    const r = await trigger({ symbol: 'ALL', timeframe: 'ALL', force: 'false' }, env, fetchFn);
    if (r.status !== 200) console.log('Avvio programmato del bot fallito:', JSON.stringify(r.body));
    return r;
}

// Endpoint dell'IA (Groq gratuito): rispondono solo alla tua app. Un browser manda sempre l'header
// Origin, quindi una pagina di un altro sito non può usarli; in più un limite di richieste al minuto
// per indirizzo IP (memoria del singolo worker: protezione semplice, non assoluta) evita che uno
// script consumi tutta la quota gratuita. Con la chiave app (x-app-key) i limiti non si applicano.
const AI_PATHS = ['/api/analyze', '/api/assistant', '/api/transcribe'];
const AI_PER_MINUTE = 30;
const hits = new Map();

function aiGate(request, env, path) {
    if (!AI_PATHS.includes(path.replace(/\/+$/, '')) || request.method !== 'POST') return null;
    const secret = String(env.APP_SECRET || '').trim();
    if (secret && request.headers.get('x-app-key') === secret) return null;
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(x => x.trim()).filter(Boolean);
    if (!allowed.includes(origin)) return { status: 403, error: "Richiesta non ammessa: l'IA risponde solo all'app SGTRADER." };
    const ip = request.headers.get('CF-Connecting-IP') || 'ip';
    const now = Date.now(), recent = (hits.get(ip) || []).filter(t => now - t < 60000);
    if (recent.length >= AI_PER_MINUTE) return { status: 429, error: 'Troppe richieste in un minuto: riprova tra poco.' };
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) hits.clear();
    return null;
}

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(scheduled(env));
    },
    async fetch(request, env) {
        const headersOut = cors(request, env);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersOut });
        let body = {};
        if (request.method === 'POST') {
            try { body = await request.json(); } catch (e) { body = {}; }
        }
        const headers = {};
        request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
        const path = new URL(request.url).pathname;
        const gate = aiGate(request, env, path);
        if (gate) return new Response(JSON.stringify({ error: gate.error }), { status: gate.status, headers: { ...headersOut, 'Content-Type': 'application/json' } });
        const { status, body: out } = await handle(request.method, path, body, headers, env, fetch);
        return new Response(JSON.stringify(out), { status, headers: { ...headersOut, 'Content-Type': 'application/json' } });
    }
};
