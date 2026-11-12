export const CONFIG = {
    TAX_RATE: 0.33,
    // Server su Cloudflare (ha la chiave Groq): l'analisi AI passa da qui quando non c'è un altro server
    AI_SERVER: 'https://sgtrader-server.salvogeraci030899.workers.dev',
    // Dati del bot (dashboard.json, live_trades.json, ...) per la copia su Vercel: lì il sito si
    // ripubblica solo quando cambia il codice (piano gratuito: 100 pubblicazioni al giorno), mentre
    // GitHub Pages si aggiorna a ogni salvataggio del bot. Riserva: i file grezzi del repository.
    DATA_SOURCES: ['https://salvogeraci030899-wq.github.io/SGTRADER/', 'https://raw.githubusercontent.com/salvogeraci030899-wq/SGTRADER/main/'],
    FEE_RATE: 0.001,
    REFRESH_MAX_WAIT: 900,
    SIGNAL_SCAN_INTERVAL_MS: 600000,
    SIGNAL_ASSETS: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    SIGNAL_TFS: ['1d', '4h', '1h'],
    SIGNAL_STRATEGIES: ['breakout', 'mean_reversion', 'ma_crossover'],
    SIGNAL_STRATEGY_LABELS: {
        breakout: 'Breakout',
        mean_reversion: 'Mean Rev',
        ma_crossover: 'MA Cross'
    },
    STORAGE_KEY: 'kronos_state_v3',
    SIGNAL_STORAGE_KEY: 'kronos_signals_v1',
    ICONS: {
        REFRESH: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><polyline points="21 3 21 8 16 8"/></svg>`,
        CHECK: '✓',
        WARN: '!'
    },
    DEFAULT_SETTINGS: {
        notificationsEnabled: false,
        telegramBotToken: '',
        telegramChatId: '',
        webhookUrl: '',
        minAgreement: 2
    }
};
