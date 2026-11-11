// Vercel: tutta la logica sta in api/_core.js (condivisa con il server su Cloudflare, worker/index.js)
import { handle } from './_core.js';

export default async function handler(req, res) {
    const headers = Object.fromEntries(Object.entries(req.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
    const { status, body } = await handle(req.method, '/api/assistant', req.body || {}, headers, process.env, fetch);
    res.setHeader('Content-Type', 'application/json');
    return res.status(status).json(body);
}
