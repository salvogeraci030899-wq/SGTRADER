// --- MOTORE DEL LABORATORIO NELL'APP ---
// Stesse strategie, stessi indicatori e stesse regole di uscita di lab_strategies.py e strategy_lab.simulate,
// per provarle nel Backtest su una coin e un timeframe qualsiasi con le candele di Bitget.
// Modulo puro (nessun DOM): lo usano l'app e il test di parità con Python (tests/test_lab_engine.mjs).
// Non ci sono le strategie che servono dati che l'app non ha: forza relativa (tutte e tre le coin nello
// stesso istante) e funding/open interest (archivio di Binance). Quelle restano solo nel Laboratorio.

export const ATR_PERIOD = 14;
export const WARMUP = 300;
// Scenario principale del laboratorio, "futures taker": 0,06% di commissione + 0,05% di slippage per lato.
export const COST_PER_SIDE_PCT = 0.11;
// Funding: ipotesi prudente del laboratorio quando non c'è lo storico reale (il long paga 0,01% ogni 8 ore).
export const FUNDING_LONG_PCT_8H = 0.01;

// ---------- indicatori (come pandas: NaN finché la finestra non è piena) ----------
const NaNs = n => new Array(n).fill(NaN);
function rolling(arr, p, fn) {
    const out = NaNs(arr.length);
    for (let i = p - 1; i < arr.length; i++) {
        const w = arr.slice(i - p + 1, i + 1);
        out[i] = w.some(v => !Number.isFinite(v)) ? NaN : fn(w);
    }
    return out;
}
const mean = w => w.reduce((a, b) => a + b, 0) / w.length;
const shift1 = arr => [NaN, ...arr.slice(0, -1)];
function ewm(arr, alpha, minPeriods) {         // adjust=False, come pandas
    const out = NaNs(arr.length);
    let prev = NaN, count = 0;
    for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (!Number.isFinite(v)) { out[i] = count >= minPeriods ? prev : NaN; continue; }
        prev = count === 0 ? v : alpha * v + (1 - alpha) * prev;
        count++;
        out[i] = count >= minPeriods ? prev : NaN;
    }
    return out;
}

export function indicators(c) {        // c: [{open, high, low, close, volume}]
    const o = c.map(x => x.open), h = c.map(x => x.high), l = c.map(x => x.low), cl = c.map(x => x.close);
    const tr = c.map((x, i) => i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - cl[i - 1]), Math.abs(x.low - cl[i - 1])));
    const atr = rolling(tr, ATR_PERIOD, mean);
    const cache = new Map();
    const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
    const rsi = p => {
        const d = cl.map((v, i) => i === 0 ? NaN : v - cl[i - 1]);
        const gain = ewm(d.map(v => Number.isFinite(v) ? Math.max(v, 0) : NaN), 1 / p, p);
        const loss = ewm(d.map(v => Number.isFinite(v) ? Math.max(-v, 0) : NaN), 1 / p, p);
        return gain.map((g, i) => !Number.isFinite(g) ? NaN : loss[i] === 0 ? 100 : 100 - 100 / (1 + g / loss[i]));
    };
    return {
        open: o, high: h, low: l, close: cl, atr, atr_pct: atr.map((a, i) => a / cl[i] * 100),
        ema: p => memo(`ema${p}`, () => ewm(cl, 2 / (p + 1), p)),
        sma: p => memo(`sma${p}`, () => rolling(cl, p, mean)),
        std: p => memo(`std${p}`, () => rolling(cl, p, w => { const m = mean(w); return Math.sqrt(mean(w.map(v => (v - m) ** 2))); })),
        ret: p => memo(`ret${p}`, () => cl.map((v, i) => i < p ? 0 : v / cl[i - p] - 1)),
        rsi: p => memo(`rsi${p}`, () => rsi(p)),
        high_max: p => memo(`hh${p}`, () => shift1(rolling(h, p, w => Math.max(...w)))),
        low_min: p => memo(`ll${p}`, () => shift1(rolling(l, p, w => Math.min(...w)))),
        median: (arr, p) => rolling(arr, p, w => { const s = [...w].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }),
    };
}

// ---------- strategie (segnale alla chiusura: +1 long, -1 short, 0 niente) ----------
const TREND_EXIT = { stop_atr: 2.0, target_atr: null, trail_atr: 3.0, max_hold: 60 };
const MOM_EXIT = { stop_atr: 3.0, target_atr: null, trail_atr: null, max_hold: 7 };
const REV_EXIT = { stop_atr: 3.0, target_atr: null, trail_atr: null, max_hold: 5 };
const sel = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const gt = (a, b) => Number.isFinite(a) && Number.isFinite(b) && a > b;     // confronti con NaN: falso, come numpy
const lt = (a, b) => gt(b, a);
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);

const donchian = (x, p) => sel(x.close.length, i => gt(x.close[i], x.high_max(p)[i]) ? 1 : lt(x.close[i], x.low_min(p)[i]) ? -1 : 0);
const bigCandle = x => sel(x.close.length, i => {
    const body = x.close[i] - x.open[i], prev = i > 0 ? x.atr[i - 1] : NaN;
    return gt(body, 1.5 * prev) ? 1 : lt(body, -1.5 * prev) ? -1 : 0;
});
const crossUp = (a, b, i) => i > 0 && a[i] > b[i] && a[i - 1] <= b[i - 1];

export const LAB = {
    donchian20: { family: 'trend', exit: TREND_EXIT, fn: x => donchian(x, 20),
        desc: 'Rottura del massimo (long) o del minimo (short) delle 20 candele precedenti. Stop 2 ATR, poi stop che segue a 3 ATR, massimo 60 candele.' },
    donchian55: { family: 'trend', exit: { ...TREND_EXIT, max_hold: 120 }, fn: x => donchian(x, 55),
        desc: 'Come donchian20 ma su 55 candele, massimo 120 candele.' },
    donchian20_long: { family: 'trend', exit: TREND_EXIT, fn: x => donchian(x, 20).map(s => (s > 0 ? 1 : 0)),
        desc: 'Solo la parte long di donchian20.' },
    donchian20_calm: { family: 'trend', exit: TREND_EXIT, fn: x => { const med = x.median(x.atr_pct, 100), d = donchian(x, 20); return d.map((s, i) => (lt(x.atr_pct[i], med[i]) ? s : 0)); },
        desc: 'donchian20 solo quando la volatilità (ATR in %) è sotto la sua mediana delle ultime 100 candele.' },
    ema_pullback: { family: 'trend', exit: TREND_EXIT, fn: x => {
        const e20 = x.ema(20), e50 = x.ema(50), e200 = x.ema(200), c = x.close, nc = c.map(v => -v), ne20 = e20.map(v => -v);
        return sel(c.length, i => (gt(e50[i], e200[i]) && crossUp(c, e20, i)) ? 1 : (lt(e50[i], e200[i]) && crossUp(nc, ne20, i)) ? -1 : 0);
    }, desc: 'Con EMA50 sopra EMA200, long quando la chiusura torna sopra l\'EMA20 (speculare per lo short). Uscite da trend.' },
    tsmom30: { family: 'momentum', exit: MOM_EXIT, fn: x => x.ret(30).map(sign), desc: 'Direzione del rendimento delle ultime 30 candele, tenuta 7 candele, stop 3 ATR.' },
    tsmom90: { family: 'momentum', exit: MOM_EXIT, fn: x => x.ret(90).map(sign), desc: 'Come tsmom30 sul rendimento a 90 candele.' },
    tsmom30_long: { family: 'momentum', exit: MOM_EXIT, fn: x => { const r = x.ret(30), s = x.sma(200); return sel(r.length, i => (r[i] > 0 && gt(x.close[i], s[i]) ? 1 : 0)); },
        desc: 'Solo long con rendimento a 30 candele positivo e prezzo sopra la media a 200.' },
    tsmom_combo: { family: 'momentum', exit: MOM_EXIT, tfs: ['1d', '4h'], fn: x => { const a = x.ret(30), b = x.ret(90); return sel(a.length, i => (a[i] > 0 && b[i] > 0 ? 1 : a[i] < 0 && b[i] < 0 ? -1 : 0)); },
        desc: 'Long se i rendimenti a 30 e 90 candele sono positivi, short se entrambi negativi.' },
    rsi2_pullback: { family: 'ritorno alla media', exit: REV_EXIT, fn: x => { const r = x.rsi(2), s = x.sma(200), c = x.close; return sel(c.length, i => (gt(c[i], s[i]) && lt(r[i], 10) ? 1 : lt(c[i], s[i]) && gt(r[i], 90) ? -1 : 0)); },
        desc: 'Sopra la media a 200: long se RSI(2) < 10; sotto: short se RSI(2) > 90. Tenuta 5 candele, stop 3 ATR.' },
    bollinger_revert: { family: 'ritorno alla media', exit: REV_EXIT, fn: x => { const c = x.close, m = x.sma(20), sd = x.std(20), s = x.sma(200);
        return sel(c.length, i => (lt(c[i], m[i] - 2 * sd[i]) && gt(c[i], s[i]) ? 1 : gt(c[i], m[i] + 2 * sd[i]) && lt(c[i], s[i]) ? -1 : 0)); },
        desc: 'Long sotto la banda inferiore di Bollinger (20, 2) ma sopra la media a 200; short speculare.' },
    big_candle: { family: 'volatilità', exit: { stop_atr: 1.5, target_atr: 3.0, trail_atr: null, max_hold: 5 }, fn: bigCandle,
        desc: 'Segue una candela con corpo oltre 1,5 ATR. Tenuta 5 candele, stop 1,5 ATR, target 3 ATR.' },
    big_candle_trail: { family: 'volatilità', exit: { stop_atr: 1.5, target_atr: null, trail_atr: 3.0, max_hold: 20 }, tfs: ['1d', '4h'], fn: bigCandle,
        desc: 'Ingressi di big_candle lasciati correre: stop 1,5 ATR, stop che segue a 3 ATR, massimo 20 candele.' },
    donchian20_regime: { family: 'trend', exit: TREND_EXIT, tfs: ['1d', '4h'], fn: x => { const c = x.close, s = x.sma(200), d = donchian(x, 20);
        return d.map((v, i) => (v > 0 && gt(c[i], s[i]) ? 1 : v < 0 && lt(c[i], s[i]) ? -1 : 0)); },
        desc: 'donchian20 solo a favore del regime: long sopra la media a 200, short sotto.' },
    donchian20_turtle: { family: 'trend', exit: { stop_atr: 2.0, target_atr: null, trail_atr: null, channel_exit: 10, max_hold: 120 }, tfs: ['1d', '4h'], fn: x => donchian(x, 20),
        desc: 'Ingressi di donchian20, uscita a canale: chiusura oltre il minimo/massimo delle 10 candele precedenti. Stop 2 ATR, massimo 120 candele.' },
};
// Strategie del laboratorio che l'app non può ricalcolare, con il motivo
export const LAB_ONLY = {
    app_breakout_trail: 'usa la regola Breakout del bot in Python',
    relstrength30: 'confronta le tre coin nello stesso istante', relstrength90: 'confronta le tre coin nello stesso istante',
    relstrength30_long: 'confronta le tre coin nello stesso istante',
    funding_fade: 'usa lo storico del funding', donchian20_oi: 'usa lo storico dell\'open interest', crowd_fade: 'usa le posizioni dei trader',
};

// ---------- simulazione, come strategy_lab.simulate ----------
// candles: [{ts (ms, apertura), open, high, low, close}], tfMs: durata della candela.
export function simulate(candles, tfMs, spec) {
    const x = indicators(candles);
    const sig = spec.fn(x), ex = spec.exit;
    const { open: o, high: h, low: l, close: c, atr } = x;
    const ts = candles.map(k => k.ts);
    const n = c.length, trades = [];
    const channel = ex.channel_exit ? [x.low_min(ex.channel_exit), x.high_max(ex.channel_exit)] : null;
    let i = WARMUP;
    while (i < n - 1) {
        const s = sig[i];
        if (!s || !Number.isFinite(atr[i]) || atr[i] <= 0 || ts[i + 1] - ts[i] !== tfMs) { i++; continue; }
        const long = s > 0, entry = c[i], a = atr[i];
        let stop = long ? entry - ex.stop_atr * a : entry + ex.stop_atr * a;
        const target = ex.target_atr == null ? null : (long ? entry + ex.target_atr * a : entry - ex.target_atr * a);
        let best = entry, exitPrice = null, reason = 'TEMPO', j = i;
        const last = Math.min(i + ex.max_hold, n - 1);
        while (j < last) {
            if (ts[j + 1] - ts[j] !== tfMs) { reason = 'BUCO'; break; }
            j++;
            if (long ? l[j] <= stop : h[j] >= stop) { exitPrice = long ? Math.min(stop, o[j]) : Math.max(stop, o[j]); reason = 'STOP'; break; }
            if (target != null && (long ? h[j] >= target : l[j] <= target)) { exitPrice = target; reason = 'TARGET'; break; }
            if (ex.trail_atr != null) {
                best = long ? Math.max(best, c[j]) : Math.min(best, c[j]);
                stop = long ? Math.max(stop, best - ex.trail_atr * a) : Math.min(stop, best + ex.trail_atr * a);
            }
            if (channel && (long ? lt(c[j], channel[0][j]) : gt(c[j], channel[1][j]))) { exitPrice = c[j]; reason = 'CANALE'; break; }
        }
        const stillOpen = exitPrice === null && reason === 'TEMPO' && j === n - 1 && j < i + ex.max_hold;
        if (exitPrice === null) exitPrice = c[j];
        if (j > i && !stillOpen) {
            const dir = long ? 1 : -1;
            trades.push({ i, j, dir, entry, exit: exitPrice, bars: j - i, reason,
                entryTime: ts[i] + tfMs, exitTime: ts[j] + tfMs, gross: (exitPrice - entry) / entry * 100 * dir });
        }
        if (stillOpen) break;
        i = Math.max(j, i + 1);
    }
    return trades;
}

// Netto per trade nello scenario "futures taker": costi di entrata e uscita e funding prudente (solo i long pagano)
export function netPct(t, tfMs) {
    const hours = t.bars * tfMs / 3600e3;
    return t.gross - 2 * COST_PER_SIDE_PCT - (t.dir > 0 ? (hours / 8) * FUNDING_LONG_PCT_8H : 0);
}
