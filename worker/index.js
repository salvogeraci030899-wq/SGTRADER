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
//   DATA_KEY         facoltativa: chiave dei dati cifrati (bot Telegram); con questa l'IA risponde solo a chi
//                    ha la chiave sul dispositivo (header x-pt-proof, una prova derivata, non la chiave)
import { handle, trigger, quickCheck } from '../api/_core.js';
import { aiProof } from '../src/core/datacrypt.js';
import { safeEqual } from '../src/core/commands.js';

const DEFAULT_ORIGINS = 'https://salvogeraci030899-wq.github.io,https://sgtrader.vercel.app,https://pinschertrade.vercel.app';

function cors(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean);
    const h = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-app-key, x-pt-proof',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
    if (allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
    return h;
}

// Avvio programmato del bot (stesso comando di "Aggiorna" nell'app, per tutte le coppie)
// Due orologi (wrangler.toml): ai minuti 2, 17, 32 e 47 il bot completo, ogni 5 minuti il controllo rapido
// (avvisi di prezzo e chiusure su Bitget). Il bot resta a 15 minuti: i segnali cambiano solo alla chiusura
// delle candele e il giro dei :02 prende già quella oraria appena chiusa.
export const BOT_CRON = '2,17,32,47 * * * *';
export async function scheduled(env, fetchFn = fetch, cron = BOT_CRON) {
    let r = null;
    if (cron === BOT_CRON) {
        r = await trigger({ symbol: 'ALL', timeframe: 'ALL', force: 'false' }, env, fetchFn);
        if (r.status !== 200) console.log('Avvio programmato del bot fallito:', JSON.stringify(r.body));
    }
    const q = await quickCheck(env, fetchFn);
    if (q.status !== 200) console.log('Controllo rapido non avviato:', JSON.stringify(q.body));
    return r || q;
}

// Endpoint dell'IA (Groq gratuito): rispondono solo alla tua app. Un browser manda sempre l'header
// Origin, quindi una pagina di un altro sito non può usarli; in più un limite di richieste al minuto
// per indirizzo IP (memoria del singolo worker: protezione semplice, non assoluta) evita che uno
// script consumi tutta la quota gratuita. Con la chiave app (x-app-key) i limiti non si applicano.
const AI_PATHS = ['/api/analyze', '/api/assistant', '/api/transcribe'];
const AI_PER_MINUTE = 30;
const hits = new Map();

async function aiGate(request, env, path) {
    if (!AI_PATHS.includes(path.replace(/\/+$/, '')) || request.method !== 'POST') return null;
    const secret = String(env.APP_SECRET || '').trim();
    if (secret && request.headers.get('x-app-key') === secret) return null;
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(x => x.trim()).filter(Boolean);
    if (!allowed.includes(origin)) return { status: 403, error: "Richiesta non ammessa: l'IA risponde solo all'app PinscherTrade." };
    // con i dati cifrati l'IA risponde solo a chi ha la chiave dei dati: chi apre il link senza chiave non usa la tua quota
    const dataKey = String(env.DATA_KEY || '').trim();
    if (dataKey && !safeEqual(request.headers.get('x-pt-proof') || '', await aiProof(dataKey)))
        return { status: 403, error: "Serve la chiave dei dati: inseriscila nell'app (Impostazioni → Connessioni)." };
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
        ctx.waitUntil(scheduled(env, fetch, event.cron));
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
        const gate = await aiGate(request, env, path);
        if (gate) return new Response(JSON.stringify({ error: gate.error }), { status: gate.status, headers: { ...headersOut, 'Content-Type': 'application/json' } });
        const { status, body: out } = await handle(request.method, path, body, headers, env, fetch);
        return new Response(JSON.stringify(out), { status, headers: { ...headersOut, 'Content-Type': 'application/json' } });
    }
};
