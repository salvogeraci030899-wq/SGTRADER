import { CONFIG } from './config.js';

export const State = {
    simState: { initialAccountBalance: 2000, freeBalance: 2000, activeTrades: [], history: [] },
    signalSettings: { ...CONFIG.DEFAULT_SETTINGS },
    signalHistory: [],
    signalMatrix: {},
    signalPrevMatrix: {},
    allData: null,
    currentAIPlan: null,
    currentAsset: 'BTCUSDT',
    currentTF: '1d',
    currentMarket: 'SPOT',
    pendingTradePayload: null,
    lastBacktestData: null,
    
    // Stato runtime
    catching: true,
    cuRunning: false,
    capitalTouched: false,
    livePx: {},
    viewKey: '',
    candleTimes: [],
    atSig: null,
    currentAtrPct: 0,
    lastHeaderPrice: null,
    pollInFlight: false,
    signalScanInFlight: false,
    calcContext: null,
    tradeToCloseId: null,
    
    // Intervals
    tradeTimerInterval: null,
    pricePollInterval: null,
    refreshTimerInterval: null,
    signalScanInterval: null,

    saveState() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.simState));
        } catch (e) { console.warn('Errore salvataggio state', e); }
    },

    loadState() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (!saved) return;
            const s = JSON.parse(saved);
            if (s && typeof s.freeBalance === 'number' && Array.isArray(s.history) && Array.isArray(s.activeTrades)) {
                this.simState = s;
            }
        } catch (e) { console.warn('Errore caricamento state', e); }
    },

    saveSignalState() {
        try {
            localStorage.setItem(CONFIG.SIGNAL_STORAGE_KEY, JSON.stringify({
                settings: this.signalSettings,
                history: this.signalHistory.slice(0, 200),
                prevMatrix: this.signalPrevMatrix
            }));
        } catch (e) {}
    },

    loadSignalState() {
        try {
            const raw = localStorage.getItem(CONFIG.SIGNAL_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed.settings) {
                const s = parsed.settings;
                if (s.notificationsEnabled != null) this.signalSettings.notificationsEnabled = s.notificationsEnabled;
                if (s.telegramBotToken != null) this.signalSettings.telegramBotToken = s.telegramBotToken;
                if (s.telegramChatId != null) this.signalSettings.telegramChatId = s.telegramChatId;
                if (s.webhookUrl != null) this.signalSettings.webhookUrl = s.webhookUrl;
                if (s.minAgreement != null) this.signalSettings.minAgreement = s.minAgreement;
                if ('barkKey' in s) delete s.barkKey;
            }
            if (Array.isArray(parsed.history)) this.signalHistory = parsed.history;
            if (parsed.prevMatrix && typeof parsed.prevMatrix === 'object') this.signalPrevMatrix = parsed.prevMatrix;
        } catch (e) {}
    }
};
