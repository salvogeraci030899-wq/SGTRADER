export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    symbol, timeframe, type, entry, stop, take, currentPrice, pnl, ai_plan, recent_candles 
  } = req.body;

  const GROQ_API_KEY = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;
  
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY non configurata nelle impostazioni di Vercel.' });
  }

  const candlesText = (recent_candles || []).map(c => 
    `O:${c.open} H:${c.high} L:${c.low} C:${c.close}`
  ).join(' | ');

  const prompt = `Sei un trader professionista. Analizza questo trade in tempo reale.
Asset: ${symbol} (${timeframe})
Direzione: ${type}
Entry: $${entry} | SL: $${stop} | TP: $${take}
Prezzo Attuale: $${currentPrice}
PnL Attuale: ${pnl} USDT
Bias modello: ${ai_plan.bias || 'NEUTRO'} (Prob rialzo: ${ai_plan.prob_up || 'N/D'}%)
Reasoning: ${ai_plan.reasoning || 'Nessuno'}
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
        model: 'llama3-70b-8192',
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

    const analysis = data.choices[0].message.content;
    return res.status(200).json({ analysis });

  } catch (error) {
    console.error('Groq Error:', error);
    return res.status(500).json({ error: 'Errore di rete: ' + error.message });
  }
}
