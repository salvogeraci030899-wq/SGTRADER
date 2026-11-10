import { timingSafeEqual } from 'crypto';

const SYMBOLS = ['ALL', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const TIMEFRAMES = ['ALL', '1d', '4h', '1h'];

// Se su Vercel è impostata APP_SECRET, la richiesta deve portare la stessa chiave
// nell'header x-app-key. Senza APP_SECRET l'endpoint resta aperto (configurala!).
function isAuthorized(req) {
    const secret = (process.env.APP_SECRET || '').trim();
    if (!secret) return true;
    const given = Buffer.from(String(req.headers['x-app-key'] || ''));
    const expected = Buffer.from(secret);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
    if (!isAuthorized(req)) return res.status(401).json({ error: 'Chiave app mancante o errata' });

    const token = process.env.GH_TOKEN;
    if (!token) return res.status(500).json({ error: 'Token non configurato' });

    const { symbol = 'ALL', timeframe = 'ALL' } = req.body || {};
    if (!SYMBOLS.includes(symbol) || !TIMEFRAMES.includes(timeframe)) {
        return res.status(400).json({ error: 'Parametri non validi' });
    }

    // Repo e branch del bot: sovrascrivibili da Vercel con GH_REPO ("owner/nome") e GH_REF
    const repoPath = (process.env.GH_REPO || 'salvogeraci030899-wq/SGTRADER').trim();
    const ref = (process.env.GH_REF || 'main').trim();
    const workflow_id = 'bot.yml';

    try {
        const response = await fetch(`https://api.github.com/repos/${repoPath}/actions/workflows/${workflow_id}/dispatches`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
                'User-Agent': 'Vercel-Kronos-App'
            },
            body: JSON.stringify({ ref, inputs: { symbol, timeframe } })
        });

        if (response.ok) return res.status(200).json({ status: 'started' });

        const errorText = await response.text();
        console.error('GitHub dispatch error:', response.status, errorText);
        return res.status(502).json({ error: 'Errore GitHub', status: response.status });
    } catch (error) {
        return res.status(500).json({ error: 'Errore di rete', details: error.message });
    }
}
