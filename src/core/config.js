export const CONFIG = {
    TAX_RATE: 0.33,
    FEE_RATE: 0.001,
    REFRESH_MAX_WAIT: 900,
    SIGNAL_SCAN_INTERVAL_MS: 600000,
    SIGNAL_ASSETS: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    SIGNAL_TFS: ['1d', '4h', '1h'],
    SIGNAL_STRATEGIES: ['breakout', 'mean_reversion', 'ma_crossover'],
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
