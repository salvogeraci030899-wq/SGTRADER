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
import * as HomeCharts from './ui/home-charts.js';
import * as Backup from './core/backup.js';

State.loadState();
State.loadSignalState();

window.H = Helpers;
window.KState = State;

// ==========================================
// FUNZIONI GLOBALI (definite SUBITO per l'HTML)
// ==========================================
window.openSettings = () => {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.add('active');
};
window.closeSettings = () => {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('active');
};
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
    const counter = document.getElementById('infoCounter');
    if (counter) counter.textContent = `${idx + 1} / 5`;
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

// Trade
window.startTimer = TradeUI.startTimer;
window.checkAutoClose = TradeUI.checkAutoClose;
window.renderActiveTrades = TradeUI.renderActiveTrades;
window.refreshCapitalUI = TradeUI.refreshCapitalUI;
window.openCloseTradeModal = TradeUI.openCloseTradeModal;
window.closeCloseTradeModal = TradeUI.closeCloseTradeModal;
window.executeCloseTrade = TradeUI.executeCloseTrade;
window.openCapitalModal = TradeUI.openCapitalModal;
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

// Backtest
window.runBacktestSingle = BacktestUI.runBacktestSingle;
window.exportBacktestCSV = BacktestUI.exportBacktestCSV;
window.applyBtParams = BacktestUI.applyBtParams;

// Home
window.updateHome = HomeUI.updateHome;

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

    if (tabId === 'home') {
        HomeUI.updateHome();
        if (typeof HomeCharts.refresh === 'function') {
            setTimeout(() => HomeCharts.refresh(), 60);
        }
    } else if (tabId === 'terminal') {
        setTimeout(TerminalUI.resizeChart, 50);
    } else if (tabId === 'trade') {
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
    } else if (tabId === 'signals') {
        SignalsUI.renderSignalGrid();
        SignalsUI.renderSignalHistory();
        SignalsUI.updateSignalNotifStatus();
        setTimeout(SignalsUI.updateSignalHistoryDots, 50);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Logger.log('INFO', 'SYSTEM', 'SGTRADER avviato');

    document.body.classList.remove('chart-fullscreen', 'snapshot-mode');

    TerminalUI.initTerminal();
    CalculatorUI.initCalculator();
    TradeUI.initTrade();
    JournalUI.initJournal();
    SignalsUI.initSignals();
    HomeUI.initHome();

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

    // Info carousel: aggiorna dots e contatore on scroll
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
