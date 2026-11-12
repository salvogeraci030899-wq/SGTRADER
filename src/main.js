import { State } from './core/state.js';
import { CONFIG } from './core/config.js';
import { Logger } from './core/logger.js';
import * as Helpers from './utils/helpers.js';
import * as TerminalUI from './ui/terminal.js';
import * as CalculatorUI from './ui/calculator.js';
import * as TradeUI from './ui/trade.js';
import * as JournalUI from './ui/journal.js';
import * as SignalsUI from './ui/signals.js';
import * as BacktestUI from './ui/backtest.js';
import * as HomeUI from './ui/home.js';
import * as AI from './ui/ai.js';
import * as Assist from './ui/assistant.js';
import * as HomeCharts from './ui/home-charts.js';
import * as Backup from './core/backup.js';
import * as LabUI from './ui/lab.js';
import * as AutoUI from './ui/automation.js';
import * as AccountUI from './ui/account.js';
import { initTheme } from './core/theme.js';
import { initManual } from './ui/manual.js';
import * as Lock from './ui/lock.js';
import * as Orders from './ui/orders.js';
import { initPageFit } from './ui/page-fit.js';

State.loadState();
State.loadSignalState();

window.H = Helpers;
window.KState = State;

// ==========================================
// FUNZIONI GLOBALI (definite SUBITO per l'HTML)
// ==========================================
// Account (icona in Home) e Impostazioni (barra in basso): src/ui/account.js
window.openAccount = AccountUI.openAccount;
window.setTheme = AccountUI.setTheme;
window.setStatusBar = AccountUI.setStatusBar;
window.renderAccount = AccountUI.renderAccount;
window.setTradingMode = AutoUI.setTradingMode;
window.openConnections = AccountUI.openConnections;
window.closeConnections = AccountUI.closeConnections;
window.goToSlide = (idx) => {
    const carousel = document.getElementById('infoCarousel');
    if (!carousel) return;
    carousel.scrollTo({ left: idx * carousel.clientWidth, behavior: 'smooth' });
};
window.updateInfoDots = () => {
    const carousel = document.getElementById('infoCarousel');
    if (!carousel || carousel.clientWidth === 0) return;
    const idx = Math.round(carousel.scrollLeft / carousel.clientWidth);
    document.querySelectorAll('#infoDots .info-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
};
window.showAlert = (title, msg) => {
    const t = document.getElementById('alertTitle');
    const m = document.getElementById('alertMessage');
    const modal = document.getElementById('alertModal');
    if (t) t.textContent = title;
    if (m) m.textContent = msg;
    if (modal) modal.classList.add('active');
};
window.closeAlert = () => {
    const modal = document.getElementById('alertModal');
    if (modal) modal.classList.remove('active');
};

// ==========================================
// UI MODULES WIRING
// ==========================================
// Terminal
window.setAsset = TerminalUI.setAsset;
window.setTF = TerminalUI.setTF;
window.triggerRefresh = TerminalUI.triggerRefresh;
window.toggleFullscreenChart = TerminalUI.toggleFullscreenChart;
window.takeSnapshot = TerminalUI.takeSnapshot;
window.renderTechFilters = TerminalUI.renderTechFilters;
window.goToDashboardSlide = TerminalUI.goToDashboardSlide;
window.refreshMarkers = TerminalUI.refreshMarkers;
window.updatePriceLines = TerminalUI.updatePriceLines;

// Calculator
window.setMarket = CalculatorUI.setMarket;
window.calc = CalculatorUI.calc;
window.updateCalcHints = CalculatorUI.updateCalcHints;
window.openTradeFromCalculator = CalculatorUI.openTradeFromCalculator;
window.closeForceTradeModal = CalculatorUI.closeForceTradeModal;
window.confirmForceTrade = CalculatorUI.confirmForceTrade;
window.setCtxLabel = CalculatorUI.setCtxLabel;
window.sendToCalculator = CalculatorUI.sendToCalculator;
window.setCalcDirection = CalculatorUI.setCalcDirection;
window.onFuturesData = CalculatorUI.onFuturesData;

// Trade
window.startTimer = TradeUI.startTimer;
window.checkAutoClose = TradeUI.checkAutoClose;
window.renderActiveTrades = TradeUI.renderActiveTrades;
window.refreshCapitalUI = TradeUI.refreshCapitalUI;
window.openCloseTradeModal = TradeUI.openCloseTradeModal;
window.closeCloseTradeModal = TradeUI.closeCloseTradeModal;
window.executeCloseTrade = TradeUI.executeCloseTrade;
window.openCapitalModal = TradeUI.openCapitalModal;
window.setCapitalSign = TradeUI.setCapitalSign;
window.closeCapitalModal = TradeUI.closeCapitalModal;
window.applyCapitalChange = TradeUI.applyCapitalChange;
window.requestAIAnalysis = TradeUI.requestAIAnalysis;
window.closeAIAnalysisModal = TradeUI.closeAIAnalysisModal;
window.renderActiveTradeDots = TradeUI.renderActiveTradeDots;
window.goToActiveTradePage = TradeUI.goToActiveTradePage;
window.runCatchUp = TradeUI.runCatchUp;
window.executeTradeOpen = TradeUI.executeTradeOpen;

// Journal
window.renderHistory = JournalUI.renderHistory;
window.renderStats = JournalUI.renderStats;
window.renderBreakEven = CalculatorUI.renderBreakEven;
window.syncTradeMode = CalculatorUI.syncTradeMode;
window.exportCSV = JournalUI.exportCSV;
window.confirmReset = JournalUI.confirmReset;
window.closeResetModal = JournalUI.closeResetModal;
window.executeReset = JournalUI.executeReset;
window.openDeleteModal = JournalUI.openDeleteModal;
window.closeModal = JournalUI.closeModal;
window.confirmDelete = JournalUI.confirmDelete;
window.goToTradeSlide = JournalUI.goToTradeSlide;
window.updateTradeLogDots = JournalUI.updateTradeLogDots;

// Signals
window.scanAllSignals = SignalsUI.scanAllSignals;
window.refreshKronosSignalsInMatrix = SignalsUI.refreshKronosSignalsInMatrix;
window.openSignalDetail = SignalsUI.openSignalDetail;
window.closeSignalDetailModal = SignalsUI.closeSignalDetailModal;
window.clearSignalHistory = SignalsUI.clearSignalHistory;
window.toggleBrowserNotifications = SignalsUI.toggleBrowserNotifications;
window.openSignalSettings = SignalsUI.openSignalSettings;
window.closeSignalSettings = SignalsUI.closeSignalSettings;
window.saveSignalSettingsFromUI = SignalsUI.saveSignalSettingsFromUI;
window.testTelegramNotification = SignalsUI.testTelegramNotification;
window.goToSignalSlide = SignalsUI.goToSignalSlide;
window.renderSignalHistoryDots = SignalsUI.renderSignalHistoryDots;
window.updateSignalHistoryDots = SignalsUI.updateSignalHistoryDots;

// Scelta a tasti (strategia, coin, timeframe): aggiorna il campo nascosto indicato da data-target
// (letto dal codice con .value come prima con le tendine), evidenzia il tasto e richiama la
// funzione in data-onchange, se c'è
window.selectOption = (btn) => {
    const group = btn.closest('.option-toggle');
    const input = group && document.getElementById(group.dataset.target);
    if (!input) return;
    input.value = btn.dataset.value;
    group.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    const cb = group.dataset.onchange && window[group.dataset.onchange];
    if (typeof cb === 'function') cb();
};

// Backtest
window.runBacktestSingle = BacktestUI.runBacktestSingle;
window.exportBacktestCSV = BacktestUI.exportBacktestCSV;
window.applyBtParams = BacktestUI.applyBtParams;
window.openBtStrategies = BacktestUI.openBtStrategies;
window.closeBtStrategies = BacktestUI.closeBtStrategies;
window.pickBtStrategy = BacktestUI.pickBtStrategy;

// Laboratorio strategie (stessa pagina del Backtest)
window.setTestView = LabUI.setTestView;
window.renderLab = LabUI.renderLab;
window.goToLabPage = LabUI.goToLabPage;
window.openLabDetail = LabUI.openLabDetail;

// Automazione (pagina Segnali, vista Auto) e server comandi (Impostazioni)
window.setSignalsView = AutoUI.setSignalsView;
window.setAutoMode = AutoUI.setAutoMode;
window.toggleEmergency = AutoUI.toggleEmergency;
window.runAutoJob = AutoUI.runAutoJob;
window.openAutoAdd = AutoUI.openAutoAdd;
window.closeAutoAdd = AutoUI.closeAutoAdd;
window.openAlerts = AutoUI.openAlerts;
window.openAgent = AutoUI.openAgent;
window.closeAgent = AutoUI.closeAgent;
window.agentPromote = AutoUI.agentPromote;
window.runAgent = AutoUI.runAgent;
window.setAgent = AutoUI.setAgent;
window.openChartAlert = AutoUI.openChartAlert;
window.closeChartAlert = AutoUI.closeChartAlert;
window.chartAlertStep = AutoUI.chartAlertStep;
window.caHint = AutoUI.caHint;
window.confirmChartAlert = AutoUI.confirmChartAlert;
window.chartAlertSignals = TerminalUI.chartAlertSignals;
window.closeAlerts = AutoUI.closeAlerts;
window.removePriceAlert = AutoUI.removePriceAlert;
Object.assign(window, { lockKey: Lock.lockKey, lockFaceId: Lock.lockFaceId, lockForgot: Lock.lockForgot, lockCancel: Lock.lockCancel,
    openLockSettings: Lock.openLockSettings, closeLockSettings: Lock.closeLockSettings, lockSetup: Lock.lockSetup, lockChange: Lock.lockChange,
    lockDisable: Lock.lockDisable, lockSetAfter: Lock.lockSetAfter, lockSetFace: Lock.lockSetFace });
Lock.initLock();
window.setPosView = Orders.setPosView;
window.renderOrders = Orders.renderOrders;
window.ordStep = Orders.ordStep;
window.ordSync = Orders.ordSync;
Orders.initOrders();
window.removeRealOrder = AutoUI.removeRealOrder;
window.requestAIAnalysisReal = TradeUI.requestAIAnalysisReal;
window.addAutoPaper = AutoUI.addAutoPaper;
window.closeAutoConfirm = AutoUI.closeAutoConfirm;
window.okAutoConfirm = AutoUI.okAutoConfirm;
window.saveServerSettings = AutoUI.saveServerSettings;
window.resetAppKey = AutoUI.resetAppKey;
window.saveGhToken = AutoUI.saveGhToken;
window.openAutoRisk = AutoUI.openAutoRisk;
window.openPaperTrades = AutoUI.openPaperTrades;
window.closePaperTrades = AutoUI.closePaperTrades;
window.goToAutoPage = AutoUI.goToAutoPage;
window.updateAutoDots = AutoUI.updateAutoDots;
window.closeAutoRisk = AutoUI.closeAutoRisk;
window.saveAutoRisk = AutoUI.saveAutoRisk;
window.removeGhToken = AutoUI.removeGhToken;

// Home
window.updateHome = HomeUI.updateHome;
window.requestMarketAnalysis = AI.requestMarketAnalysis;
// Assistente sulle posizioni (chat e voce)
window.openAssistant = Assist.openAssistant;
window.openAssistantReal = Assist.openAssistantReal;
window.assistQuick = Assist.assistQuick;
window.closeAssistant = Assist.closeAssistant;
window.sendAssist = Assist.sendAssist;
window.toggleRecording = Assist.toggleRecording;
window.toggleAssistSpeak = Assist.toggleAssistSpeak;
window.removeRule = TradeUI.removeRule;
// dalla Home: Segnali → Auto in un tocco
window.openAutomation = () => { window.switchTab('signals'); AutoUI.setSignalsView('auto'); };

// Home Live Charts
window.initHomeCharts = HomeCharts.initHomeCharts;
window.refreshHomeCharts = HomeCharts.refresh;
window.toggleHomeChartFullscreen = HomeCharts.toggleFullscreen;
window.goToHomeChart = HomeCharts.goToHomeChart;
window.updateHomeChartDots = HomeCharts.updateHomeChartDots;

// Backup
window.exportBackup = Backup.exportBackup;
window.triggerImportBackup = Backup.triggerImportBackup;
window.handleImportBackup = Backup.handleImportBackup;


window.scrollNavTo = (idx) => {
    const navScroll = document.getElementById('navScroll');
    if (navScroll) navScroll.scrollTo({ left: idx * navScroll.clientWidth, behavior: 'smooth' });
};

function updateNavDots() {
    const navScroll = document.getElementById('navScroll');
    if (!navScroll) return;
    const pages = navScroll.querySelectorAll('.nav-page');
    if (pages.length === 0) return;
    const scrollLeft = navScroll.scrollLeft;
    let closestIdx = 0, minDist = Infinity;
    pages.forEach((page, idx) => {
        const dist = Math.abs(page.offsetLeft - scrollLeft);
        if (dist < minDist) { minDist = dist; closestIdx = idx; }
    });
    document.querySelectorAll('#navDots .nav-dot').forEach((d, i) => d.classList.toggle('active', i === closestIdx));
}

window.switchTab = (tabId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const targetPage = document.getElementById(`page-${tabId}`);
    const targetNav = document.getElementById(`nav-${tabId}`);
    if (targetPage) targetPage.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    const navItem = document.getElementById(`nav-${tabId}`);
    if (navItem) {
        const navScroll = document.getElementById('navScroll');
        const page = navItem.closest('.nav-page');
        if (page && navScroll) {
            const pageIdx = Array.from(navScroll.children).indexOf(page);
            if (pageIdx >= 0) {
                navScroll.scrollTo({ left: pageIdx * navScroll.clientWidth, behavior: 'smooth' });
                setTimeout(updateNavDots, 100);
            }
        }
    }

    if (tabId === 'trade') TradeUI.onOpenTrade();
    if (tabId === 'home') {
        HomeUI.updateHome();
        if (typeof HomeCharts.refresh === 'function') {
            setTimeout(() => HomeCharts.refresh(), 60);
        }
    } else if (tabId === 'terminal') {
        // il grafico va ridimensionato (e inquadrato) quando la pagina ha la misura definitiva:
        // su iOS il layout si assesta più tardi, quindi ripeto dopo che si è stabilizzato
        requestAnimationFrame(() => requestAnimationFrame(TerminalUI.resizeChart));
        setTimeout(TerminalUI.resizeChart, 50);
        setTimeout(TerminalUI.resizeChart, 350);
    } else if (tabId === 'trade') {
        TradeUI.refreshCapitalUI();
        TradeUI.renderActiveTrades();
        TradeUI.renderActiveTradeDots();
        setTimeout(TradeUI.renderActiveTradeDots, 50);
    } else if (tabId === 'journal') {
        JournalUI.renderHistory();
        JournalUI.renderStats();
        CalculatorUI.renderBreakEven();
        setTimeout(JournalUI.updateTradeLogDots, 50);
    } else if (tabId === 'calculator') {
        CalculatorUI.setCtxLabel();
    } else if (tabId === 'account') {
        AccountUI.renderAccount();
    } else if (tabId === 'settings') {
        AccountUI.renderSettings();
    } else if (tabId === 'signals') {
        SignalsUI.renderSignalGrid();
        SignalsUI.renderSignalHistory();
        SignalsUI.updateSignalNotifStatus();
        setTimeout(SignalsUI.updateSignalHistoryDots, 50);
        AutoUI.renderAutomation();
    }
};

initTheme();

document.addEventListener('DOMContentLoaded', () => {
    Logger.log('INFO', 'SYSTEM', 'SGTRADER avviato');

    // Versione dell'app (da <meta name="app-version">, aggiornata da tools/bump_version.py):
    // serve a verificare sul telefono di avere davvero l'ultima versione e non una in cache
    const appVersion = document.querySelector('meta[name="app-version"]')?.content || '—';
    const versionEl = document.getElementById('homeAppVersion');
    if (versionEl) versionEl.textContent = 'v' + appVersion;

    document.body.classList.remove('chart-fullscreen', 'snapshot-mode');

    TerminalUI.initTerminal();
    CalculatorUI.initCalculator();
    TradeUI.initTrade();
    JournalUI.initJournal();
    SignalsUI.initSignals();
    HomeUI.initHome();

    initManual();
    initPageFit();

    try {
        HomeCharts.initHomeCharts();
    } catch (e) {
        Logger.log('ERROR', 'HOME_CHARTS', `Init fallita: ${e.message}`);
    }

    CalculatorUI.setMarket('SPOT');
    CalculatorUI.setCtxLabel();
    CalculatorUI.syncCapital();
    TradeUI.refreshCapitalUI();

    if (State.simState.activeTrades.length > 0) {
        TradeUI.startTimer();
        TradeUI.runCatchUp();
    }

    HomeUI.updateHome();

    const navScroll = document.getElementById('navScroll');
    if (navScroll) {
        navScroll.addEventListener('scroll', () => {
            clearTimeout(window._navScrollTimeout);
            window._navScrollTimeout = setTimeout(updateNavDots, 50);
        });
        updateNavDots();

        // In PWA la fila di icone non è scorrevole al tocco (vedi style.css, html.pwa-mode):
        // il passaggio tra le due pagine della navbar lo gestisce questo swipe.
        if (document.documentElement.classList.contains('pwa-mode')) {
            let startX = null, startY = null;
            navScroll.addEventListener('touchstart', e => {
                startX = e.touches[0].clientX; startY = e.touches[0].clientY;
            }, { passive: true });
            navScroll.addEventListener('touchend', e => {
                if (startX === null) return;
                const dx = e.changedTouches[0].clientX - startX;
                const dy = e.changedTouches[0].clientY - startY;
                startX = startY = null;
                if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
                const pages = navScroll.querySelectorAll('.nav-page').length;
                const current = Math.round(navScroll.scrollLeft / navScroll.clientWidth);
                const next = Math.max(0, Math.min(pages - 1, current + (dx < 0 ? 1 : -1)));
                if (next !== current) window.scrollNavTo(next);
            }, { passive: true });
        }
    }

    const dashCarousel = document.getElementById('dashboardCarousel');
    if (dashCarousel) dashCarousel.addEventListener('scroll', () => {
        clearTimeout(window._dashScrollTimeout);
        window._dashScrollTimeout = setTimeout(TerminalUI.updateDashboardDots, 50);
    });

    const activeTradesListEl = document.getElementById('activeTradesList');
    if (activeTradesListEl) activeTradesListEl.addEventListener('scroll', () => {
        clearTimeout(window._activeTradeScrollTimeout);
        window._activeTradeScrollTimeout = setTimeout(TradeUI.renderActiveTradeDots, 50);
    });

    const simHistoryEl = document.getElementById('simHistory');
    if (simHistoryEl) simHistoryEl.addEventListener('scroll', () => {
        clearTimeout(window._tradeLogScrollTimeout);
        window._tradeLogScrollTimeout = setTimeout(JournalUI.updateTradeLogDots, 50);
    });

    const signalHistoryEl = document.getElementById('signalHistoryList');
    if (signalHistoryEl) signalHistoryEl.addEventListener('scroll', () => {
        clearTimeout(window._signalHistoryScrollTimeout);
        window._signalHistoryScrollTimeout = setTimeout(SignalsUI.updateSignalHistoryDots, 50);
    });

    const infoCarouselEl = document.getElementById('infoCarousel');
    if (infoCarouselEl) infoCarouselEl.addEventListener('scroll', () => {
        clearTimeout(window._infoScrollTimeout);
        window._infoScrollTimeout = setTimeout(() => {
            if (typeof window.updateInfoDots === 'function') window.updateInfoDots();
        }, 50);
    });

    window.addEventListener('resize', () => {
        clearTimeout(window._resizeTimer);
        window._resizeTimer = setTimeout(() => {
            if (typeof HomeCharts.refresh === 'function') HomeCharts.refresh();
        }, 200);
    });
});
