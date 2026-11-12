# SGTRADER

App personale di trading su BTC, ETH e SOL (Bitget, futures e spot) con un bot che lavora da solo su GitHub Actions.
Non è un consiglio finanziario: nessuna strategia ha un vantaggio garantito.

## Com'è fatta

| Parte | Dove | Cosa fa |
| --- | --- | --- |
| App (PWA) | `index.html`, `style.css`, `src/` (GitHub Pages) | Home, Mercato, Trade, Posizioni, Agente, Risultati, Registro, Impostazioni, Assistente |
| Bot | `*.py`, `.github/workflows/` (GitHub Actions) | segnali, prova su carta, esecutore, agente, avvisi, controlli |
| Server | `worker/` + `api/_core.js` (Cloudflare Workers) | orologio del bot (ogni 15 min), comandi dall'app, IA (Groq), bot Telegram |
| Dati | file `.json`/`.jsonl` nel repository | stato del bot letto dall'app; quelli personali sono **cifrati** |

Moduli principali del bot: `run_bot.py` (giro completo), `quick.py` (controllo rapido ogni 5 min), `paper.py` (carta),
`executor.py` (ordini reali e storico del conto), `agent.py` (agente giornaliero), `automation.py` / `position_cmd.py`
(comandi dall'app), `strategy_lab.py` + `lab_strategies.py` (laboratorio), `events.py` (registro), `watchdog.py` (salute).

## Dati cifrati

Il repository è pubblico. I file personali (elencati in `.gitattributes`) sono cifrati con AES-256-GCM da un filtro git
(`tools/datacrypt.py`), configurato in ogni workflow dal passo `.github/actions/data-key`. Nei workflow il bot li vede in
chiaro; l'app e il server li decifrano con la stessa chiave (`src/core/datacrypt.js`). La chiave è il segreto `DATA_KEY`
e, sul telefono, Impostazioni → Connessioni. **Non cambiarla**: i file cifrati con la vecchia chiave non si aprirebbero più.

## Segreti (GitHub → Settings → Secrets and variables → Actions)

| Nome | Serve a |
| --- | --- |
| `DATA_KEY` | cifratura dei dati personali |
| `BITGET_API_KEY`, `BITGET_API_SECRET`, `BITGET_API_PASSPHRASE` | conto Bitget (lettura e, se acceso dall'app, ordini) |
| `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` | messaggi e bot Telegram |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SERVER_GH_TOKEN` | pubblicazione del server Cloudflare |
| `APP_SECRET` | chiave dei comandi inviati al server |
| `GROQ_API_KEY` | analisi AI, assistente, voce |

Variabili: `BITGET_DEMO` (`1` = conto demo, predefinito), `N_SAMPLES` (campioni del modello Kronos, predefinito 50).
Nessun file `.env`: tutto passa dai segreti di GitHub e del worker. Ordini veri solo con le chiavi Bitget, l'interruttore
Reale acceso nell'app e una strategia confermata dalla prova finale.

## Controlli

```bash
pip install "pandas>=2.2.2" numpy requests cryptography ruff
ruff check .                                  # lint Python
npx --yes eslint@10.14.0 .                    # lint JavaScript
for t in tests/test_*.py; do python3 "$t"; done
node tests/test_core.mjs && node tests/test_rules.mjs && node tests/test_lab_engine.mjs
node tests/ui_smoke.mjs                       # interfaccia in Chromium (Playwright)
```

Gli stessi controlli girano su GitHub a ogni modifica (`.github/workflows/tests.yml`).

## Versione

`python3 tools/bump_version.py` aggiorna il numero di versione e la mappa dei moduli in `index.html` (serve a ogni
modifica dell'app, così il telefono scarica i file nuovi).
