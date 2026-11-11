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
        const { status, body: out } = await handle(request.method, path, body, headers, env, fetch);
        return new Response(JSON.stringify(out), { status, headers: { ...headersOut, 'Content-Type': 'application/json' } });
    }
};
