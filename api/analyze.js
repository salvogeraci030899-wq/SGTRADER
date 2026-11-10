import { timingSafeEqual } from 'crypto';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const TIMEFRAMES = ['1d', '4h', '1h'];
const BIASES = ['LONG', 'SHORT', 'NEUTRO'];

// Se su Vercel è impostata APP_SECRET, la richiesta deve portare la stessa chiave
// nell'header x-app-key. Senza APP_SECRET l'endpoint resta aperto (configurala!).
function isAuthorized(req) {
  const secret = (process.env.APP_SECRET || '').trim();
  if (!secret) return true;
  const given = Buffer.from(String(req.headers['x-app-key'] || ''));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Solo numeri finiti finiscono nel prompt: niente testo libero dal client al posto dei prezzi
const num = v => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);
const show = v => (v === null ? 'N/D' : v);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Chiave app mancante o errata' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY non configurata nelle impostazioni di Vercel.' });
  }

  const body = req.body || {};
  const ai_plan = body.ai_plan && typeof body.ai_plan === 'object' ? body.ai_plan : {};

  if (!SYMBOLS.includes(body.symbol) || !TIMEFRAMES.includes(body.timeframe) || !['LONG', 'SHORT'].includes(body.type)) {
    return res.status(400).json({ error: 'Parametri non validi' });
  }

  const candles = Array.isArray(body.recent_candles) ? body.recent_candles.slice(-10) : [];
  const candlesText = candles.map(c =>
    `O:${show(num(c && c.open))} H:${show(num(c && c.high))} L:${show(num(c && c.low))} C:${show(num(c && c.close))}`
  ).join(' | ');

  const bias = BIASES.includes(ai_plan.bias) ? ai_plan.bias : 'NEUTRO';
  const reasoning = typeof ai_plan.reasoning === 'string' ? ai_plan.reasoning.slice(0, 600) : 'Nessuno';

  const prompt = `Sei un trader professionista. Analizza questo trade in tempo reale.
Asset: ${body.symbol} (${body.timeframe})
Direzione: ${body.type}
Entry: $${show(num(body.entry))} | SL: $${show(num(body.stop))} | TP: $${show(num(body.take))}
Prezzo Attuale: $${show(num(body.currentPrice))}
PnL Attuale: ${show(num(body.pnl))} USDT
Bias modello: ${bias} (Prob rialzo: ${show(num(ai_plan.prob_up))}%)
Reasoning: ${reasoning}
Ultime 10 candele: ${candlesText}

Dai un consiglio operativo secco (MANTIENI, CHIUDI ORA, SPOSTA STOP, INCASSA PARZIALE). Max 100 parole, tono diretto, no Markdown.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Modello sovrascrivibile da Vercel con GROQ_MODEL (Groq dismette periodicamente i modelli)
        model: (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 250
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || 'Errore sconosciuto API Groq';
      return res.status(response.status).json({ error: errMsg });
    }

    const analysis = data.choices?.[0]?.message?.content;
    if (!analysis) {
      return res.status(502).json({ error: 'Risposta vuota da Groq' });
    }
    return res.status(200).json({ analysis });

  } catch (error) {
    console.error('Groq Error:', error);
    return res.status(500).json({ error: 'Errore di rete: ' + error.message });
  }
}
