export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

    const token = process.env.GH_TOKEN;
    if (!token) return res.status(500).json({ error: 'Token non configurato' });

    const { symbol, timeframe } = req.body; // Riceve i parametri!
    const owner = "salvogeraci030899-wq"; 
    const repo = "Kronos";
    const workflow_id = "bot.yml";

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
                'User-Agent': 'Vercel-Kronos-App'
            },
            body: JSON.stringify({ 
                ref: 'main',
                inputs: { symbol: symbol, timeframe: timeframe } // Li passa a GitHub
            })
        });

        if (response.ok) return res.status(200).json({ status: "started" });
        
        const errorText = await response.text();
        return res.status(response.status).json({ error: "Errore GitHub", details: errorText });
    } catch (error) {
        return res.status(500).json({ error: "Errore di rete", details: error.message });
    }
}
