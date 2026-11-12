// Prova dell'interfaccia in un browser vero (Playwright, Chromium), su iPhone 15 Safari e iPhone 17 Pro installata:
// ogni pagina e vista, in Simulato e in Reale, deve caricarsi senza errori JavaScript e senza scroll verticale
// (regola dell'app: si scorre solo di lato); poi le azioni principali: assistente dalla scheda, grafico a
// schermo intero con l'avviso, conferma prima dell'autonomia Reale. Dati: i file del repository; Bitget e GitHub simulati.
//   node tests/ui_smoke.mjs                 (serve Playwright: npm i playwright && npx playwright install chromium)
//   LWC_PATH=...lightweight-charts.js       facoltativo: libreria dei grafici da file invece che da unpkg
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8800 + Math.floor(Math.random() * 100);
const DEVICES = [{ n: 'iPhone 15 Safari', w: 393, h: 659 }, { n: 'iPhone 17 Pro app', w: 402, h: 874, pwa: true }];
const VIEWS = { log: [['setLogFilter', 'all'], ['setLogFilter', 'agente']], journal: [['setResultsSource', 'real'], ['setResultsSource', 'sim'], ['setResultsSource', 'paper'], ['setResultsPeriod', 'all'], ['setResultsPeriod', 'day']], terminal: [['setMarketView', 'chart'], ['setMarketView', 'sig'], ['setMarketView', 'alerts']], trade: [['setPosView', 'open'], ['setPosView', 'orders']], signals: [['setSignalsView', 'agent'], ['setSignalsView', 'auto'], ['setSignalsView', 'lab'], ['setTestView', 'bt'], ['setSignalsView', 'risk']] };

const now = Date.now();
const candles = (n = 200) => Array.from({ length: n }, (_, i) => {
    const p = 70000 + Math.sin(i / 7) * 900 + i * 3;
    return [String(now - (n - i) * 3600e3), String(p), String(p + 250), String(p - 250), String(p + 40), '12', '0', '0'];
});

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const problems = [];
try {
    for (let i = 0; i < 50; i++) {
        const up = await new Promise(res => { const c = net.connect(PORT, '127.0.0.1', () => { c.end(); res(true); }); c.on('error', () => res(false)); });
        if (up) break;
        await new Promise(r => setTimeout(r, 200));
    }
    const browser = await chromium.launch();
    // ogni dispositivo in Simulato e Reale; l'app installata anche in Reale con il vetro e il tema chiaro
    const RUNS = DEVICES.flatMap(dev => [{ dev, mode: 'sim' }, { dev, mode: 'real' }, ...(dev.pwa ? [{ dev, mode: 'real', glass: true }] : [])]);
    for (const { dev, mode, glass } of RUNS) {
        const tag = (mode === 'real' ? 'Reale' : 'Simulato') + (glass ? ', vetro animato chiaro' : '');
        const ctx = await browser.newContext({ viewport: { width: dev.w, height: dev.h }, isMobile: true, hasTouch: true, colorScheme: glass ? 'light' : 'dark' });
        await ctx.addInitScript(([pwa, glass]) => {
            try {
                localStorage.setItem('kronos_gh_token', 'github_pat_' + 'x'.repeat(30));
                // un trade simulato aperto, per provare la scheda e l'assistente (in Simulato)
                localStorage.setItem('kronos_state_v3', JSON.stringify({ initialAccountBalance: 2000, freeBalance: 1800, history: [], activeTrades: [
                    { id: 'ui1', symbol: 'BTCUSDT', type: 'LONG', entryPrice: 70000, slPrice: 60000, tpPrice: 90000, capitalInvested: 200, margin: 200, size: 0.003,
                      entryTime: Date.now() - 3600e3, timerSeconds: 86400 * 7, granularity: '1d', market: 'SPOT' }] }));
            } catch (e) {}
            if (pwa) Object.defineProperty(navigator, 'standalone', { get: () => true });
            if (glass) try { localStorage.setItem('sgt_glass', 'anim'); localStorage.setItem('sgt_theme', 'light'); } catch (e) {}
        }, [!!dev.pwa, !!glass]);
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        if (process.env.LWC_PATH) await page.route('https://unpkg.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(process.env.LWC_PATH, 'utf8') }));
        await page.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
        await page.route('https://api.bitget.com/**', r => {
            const u = r.request().url();
            const data = u.includes('candles') ? candles() : u.includes('ticker') ? [{ symbol: 'BTCUSDT', lastPr: '70500', open24h: '69000', change24h: '0.021', high24h: '71000', low24h: '68800', baseVolume: '1000', usdtVolume: '7e7', markPrice: '70500' }] : [];
            return r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ code: '00000', data }) });
        });
        await page.route('**/events/*.jsonl*', r => {
            const at = new Date().toISOString();
            const ev = Array.from({ length: 14 }, (_, i) => JSON.stringify({ at, kind: ['ordini', 'agente', 'carta', 'avvisi', 'posizioni', 'sistema', 'conto'][i % 7], action: 'prova', text: `🔔 Evento di prova numero ${i + 1} ✅, con un testo di lunghezza normale come quelli veri.`, id: 'e' + i, ok: i % 5 !== 0, net: i % 2 ? 0.5 : -0.2 }));
            return r.fulfill({ contentType: 'text/plain', body: ev.join('\n') + '\n' });
        });
        // dati personali inventati (quelli veri nel repository sono cifrati): conto, posizioni, carta, agente, storico
        const FIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'ui_data.json'), 'utf8'));
        await page.route(/\/(automation|live_trades|paper_trades|agent_state|equity_history|quick_state|alerts_state)\.json/, r => {
            const name = new URL(r.request().url()).pathname.split('/').pop();
            const j = structuredClone(FIX[name]);
            if (name === 'automation.json') j.risk = { ...(j.risk || {}), trading_enabled: mode === 'real' };
            return r.fulfill({ contentType: 'application/json', body: JSON.stringify(j) });
        });
        await page.route(/api\.github\.com|workers\.dev|api\.telegram\.org/, r => r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } }));
        await page.goto(`http://127.0.0.1:${PORT}/index.html`);
        await page.waitForTimeout(3500);
        const pages = await page.evaluate(() => [...document.querySelectorAll('section.page')].map(s => s.id.replace('page-', '')));
        // barra in basso: centrata, staccata dal fondo, stesso margine interno sopra (puntini) e sotto (voci)
        const nav = await page.evaluate(() => { const n = document.querySelector('.nav-bar').getBoundingClientRect(), d = document.querySelector('.nav-dots').getBoundingClientRect(), it = document.querySelector('.nav-item').getBoundingClientRect();
            return { l: Math.round(n.left), r: Math.round(innerWidth - n.right), b: Math.round(innerHeight - n.bottom), sopra: Math.round(d.top - n.top), sotto: Math.round(n.bottom - it.bottom) }; });
        if (glass && !(await page.evaluate(() => document.documentElement.classList.contains('glass')))) problems.push(`${dev.n}, ${tag}: il vetro non si accende`);
        if (nav.l !== nav.r || nav.l < 4 || nav.b < 4 || nav.b > 60 || nav.sopra !== nav.sotto) problems.push(`${dev.n}, ${tag}: barra in basso fuori posto ${JSON.stringify(nav)}`);
        // identificativi doppi: il codice troverebbe l'elemento sbagliato
        const dup = await page.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach(e => { c[e.id] = (c[e.id] || 0) + 1; }); return Object.keys(c).filter(k => c[k] > 1); });
        if (dup.length) problems.push(`${dev.n}, ${tag}: identificativi doppi: ${dup.join(', ')}`);
        for (const p of pages) for (const v of (VIEWS[p] || [[null]])) {
            await page.evaluate(t => window.switchTab(t), p);
            await page.waitForTimeout(400);
            if (v[0]) { await page.evaluate(([f, a]) => window[f] && window[f](a), v); await page.waitForTimeout(400); }
            const r = await page.evaluate(W => {
                const pg = document.querySelector('section.page.active');
                const emoji = pg ? (pg.innerText.match(/\p{Extended_Pictographic}/gu) || []).join('') : '';
                return { over: pg ? pg.scrollHeight - pg.clientHeight : -1, wide: document.documentElement.scrollWidth - W, emoji };
            }, dev.w);
            const where = `${dev.n}, ${tag}, ${p}${v[1] ? '/' + v[1] : ''}`;
            if (r.over > 1) problems.push(`${where}: la pagina scorre in verticale di ${r.over}px`);
            if (r.over < 0) problems.push(`${where}: pagina non trovata`);
            if (r.wide > 1) problems.push(`${where}: più larga dello schermo di ${r.wide}px`);
            if (r.emoji) problems.push(`${where}: emoji nella pagina (${r.emoji}); nell'app non ce ne devono essere`);
        }
        // Regole fisse: ogni finestra a schermo intero, intestazione nello stesso punto della Home, niente scroll verticale
        await page.evaluate(() => window.switchTab('home'));
        await page.waitForTimeout(300);
        const wins = await page.evaluate(() => {
            const pos = el => { const r = el.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)]; };
            const home = document.querySelector('#page-home .header-row');
            const ref = { row: pos(home), h1: pos(home.querySelector('h1')), p: pos(home.querySelector('.header-title p')), btn: pos(home.querySelector('.header-icon-btn')) };
            const out = [];
            for (const ov of document.querySelectorAll('.modal-overlay')) {
                ov.classList.add('active');
                const box = ov.querySelector('.modal-box, .assist-box'), row = ov.querySelector('.header-row');
                const r = box.getBoundingClientRect();
                const bad = [];
                if (Math.round(r.left) !== 0 || Math.round(r.top) !== 0 || Math.round(r.width) !== innerWidth || Math.round(r.height) !== innerHeight) bad.push(`non a schermo intero (${Math.round(r.width)}x${Math.round(r.height)})`);
                if (!row) bad.push('senza intestazione');
                else {
                    const got = { row: pos(row), h1: pos(row.querySelector('h1')), p: pos(row.querySelector('.header-title p')), btn: row.querySelector('.header-icon-btn') ? pos(row.querySelector('.header-icon-btn')) : null };
                    for (const k of ['row', 'h1', 'p', 'btn']) if (got[k] && JSON.stringify(got[k]) !== JSON.stringify(ref[k])) bad.push(`${k} a ${got[k]} invece di ${ref[k]}`);
                }
                for (const el of [box, ...box.querySelectorAll('.win-body, .assist-log')]) if (el.scrollHeight - el.clientHeight > 1 && getComputedStyle(el).overflowY !== 'hidden') bad.push(`scorre in verticale (${el.className})`);
                if (bad.length) out.push(`${ov.id}: ${bad.join(', ')}`);
                ov.classList.remove('active');
            }
            return out;
        });
        for (const w of wins) problems.push(`${dev.n}, ${tag}: finestra ${w}`);
        // Azioni principali, come le farebbe una persona
        const where = `${dev.n}, ${tag}`;
        const step = async (name, fn) => { try { if (!(await fn())) problems.push(`${where}: ${name}`); } catch (e) { problems.push(`${where}: ${name} (${e.message.split('\n')[0]})`); } };
        if (mode === 'sim') {
            await page.evaluate(() => { window.switchTab('trade'); window.setPosView('open'); });
            await page.waitForTimeout(500);
            await step('assistente: non si apre dalla scheda', async () => { await page.click('.at-assist'); await page.waitForTimeout(400); return page.evaluate(() => document.getElementById('assistModal').classList.contains('active')); });
            await step('assistente: la X non chiude', async () => { await page.click('.assist-head [title="Chiudi"]'); await page.waitForTimeout(300); return page.evaluate(() => !document.getElementById('assistModal').classList.contains('active')); });
        }
        await page.evaluate(() => { window.switchTab('terminal'); window.setMarketView('chart'); });
        await page.waitForTimeout(600);
        await step('grafico: schermo intero senza tasti avviso e condividi', async () => {
            await page.click('#btnFullscreen'); await page.waitForTimeout(500);
            return page.evaluate(() => [...document.querySelectorAll('#mainChartContainer .chart-tool')].filter(b => b.offsetParent !== null).length === 2);
        });
        await step('grafico: la finestra dell\'avviso non si apre', async () => {
            await page.click('#mainChartContainer .chart-tool >> nth=0'); await page.waitForTimeout(300);
            const on = await page.evaluate(() => document.getElementById('chartAlertModal').classList.contains('active'));
            await page.evaluate(() => window.closeChartAlert()); await page.click('#mainChartContainer .home-chart-fullscreen'); await page.waitForTimeout(300);
            return on;
        });
        await step('mercato: Nuovo avviso non apre la finestra', async () => {
            await page.evaluate(() => window.setMarketView('alerts')); await page.waitForTimeout(300);
            await page.click('.mkt-new-alert'); await page.waitForTimeout(300);
            const on = await page.evaluate(() => document.getElementById('chartAlertModal').classList.contains('active') && document.querySelectorAll('#caCoins .pill-btn').length === 3);
            await page.evaluate(() => window.closeChartAlert());
            return on;
        });
        await page.evaluate(() => { window.switchTab('signals'); window.setSignalsView('agent'); });
        await page.waitForTimeout(800);
        await step('agente: Reale senza la conferma', async () => {
            await page.click('#agentSettings .pill-btn:has-text("Reale")'); await page.waitForTimeout(300);
            const on = await page.evaluate(() => document.getElementById('autoConfirmModal').classList.contains('active'));
            await page.evaluate(() => window.closeAutoConfirm());
            return on;
        });
        for (const e of new Set(errors)) problems.push(`${dev.n}, ${tag}: errore JavaScript: ${e}`);
        console.log(`ok ${dev.n}, ${tag}: ${pages.length} pagine`);
        await ctx.close();
    }
    await browser.close();
} finally {
    server.kill();
}
if (problems.length) {
    console.log(`\n${problems.length} PROBLEMI:\n- ` + problems.join('\n- '));
    process.exit(1);
}
console.log('Interfaccia: tutto in ordine.');
