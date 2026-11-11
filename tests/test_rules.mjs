// Test delle regole dell'assistente (src/core/rules.js). Eseguibile con: node tests/test_rules.mjs
import assert from 'node:assert/strict';
import { netPnlAt, priceForNetPnl, planAction, sanitizeAction, ruleHitPrice, ruleHitCandle } from '../src/core/rules.js';

const long = { symbol: 'BTCUSDT', type: 'LONG', entryPrice: 70000, size: 0.01, feeRate: 0.0006, margin: 233.33, capitalInvested: 700, slPrice: 68000, tpPrice: 74000 };
const short = { ...long, type: 'SHORT', slPrice: 72000, tpPrice: 66000 };
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('prezzo per un PnL netto e ritorno', () => {
    for (const t of [long, short]) for (const v of [10, -5, 0, 25.5]) close(netPnlAt(t, priceForNetPnl(t, v)), v, 1e-7);
    // a mano: LONG +10 netti = 14,925 prima delle tasse; (p - 70000)*0,01 - (70000 + p)*0,01*0,0006 = 14,925
    close(priceForNetPnl(long, 10), (14.925373134328357 / 0.01 + 70000 * 1.0006) / 0.9994, 1e-6);
});

test('"se arriva a 10 USDT di profitto chiudi": regola sopra il prezzo per un LONG, sotto per uno SHORT', () => {
    const p = planAction(long, { type: 'close_at_pnl', value: 10, unit: 'usdt' }, 70100);
    assert.equal(p.ok, true); assert.equal(p.kind, 'rule'); assert.equal(p.rule.side, 'above');
    assert.ok(p.rule.price > 71000 && p.rule.price < 71800, String(p.rule.price));
    assert.match(p.summary, /\+10,00 USDT/);
    const s = planAction(short, { type: 'close_at_pnl', value: 10 }, 69900);
    assert.equal(s.rule.side, 'below'); assert.ok(s.rule.price < 69000);
    // perdita massima: sotto per un LONG
    assert.equal(planAction(long, { type: 'close_at_pnl', value: -5 }, 70000).rule.side, 'below');
    // in percentuale del capitale (margine)
    const pct = planAction(long, { type: 'close_at_pnl', value: 5, unit: 'pct' }, 70000);
    assert.match(pct.summary, /\+11,67 USDT/);
});

test('rifiuta ciò che non ha senso', () => {
    assert.equal(planAction(long, { type: 'close_at_pnl', value: 10 }, 72000).ok, false);       // già oltre
    assert.equal(planAction(long, { type: 'set_stop', price: 71000 }, 70500).ok, false);        // stop sopra il prezzo di un LONG
    assert.equal(planAction(short, { type: 'set_target', price: 71000 }, 70000).ok, false);     // target sopra il prezzo di uno SHORT
    assert.equal(planAction(long, { type: 'stop_breakeven' }, 70010).ok, false);                // pareggio non ancora superato
    assert.equal(planAction(long, { type: 'clear_rules' }, 70000).ok, false);                   // nessuna regola
    assert.equal(planAction(long, { type: 'compra_tutto' }, 70000).ok, false);
    assert.equal(sanitizeAction({ type: 'set_stop', price: 'abc' }), null);
    assert.equal(sanitizeAction({ type: 'close_at_pnl', value: 0 }), null);
    assert.deepEqual(sanitizeAction({ type: 'set_stop', price: '69000', extra: 'x' }), { type: 'set_stop', price: 69000 });
});

test('stop a pareggio e stop/target validi', () => {
    const be = planAction(long, { type: 'stop_breakeven' }, 71000);
    assert.equal(be.ok, true); assert.ok(be.price > 70000 && be.price < 70200); close(netPnlAt(long, be.price), 0, 0.01);
    assert.equal(planAction(long, { type: 'set_stop', price: 69500 }, 70500).price, 69500);
    assert.equal(planAction(short, { type: 'set_target', price: 67000 }, 70000).ok, true);
});

test('regole toccate da prezzo e da candela', () => {
    const up = { price: 71000, side: 'above' }, dn = { price: 69000, side: 'below' };
    assert.equal(ruleHitPrice(up, 70999), false); assert.equal(ruleHitPrice(up, 71000), true);
    assert.equal(ruleHitPrice(dn, 69000.5), false); assert.equal(ruleHitPrice(dn, 68990), true);
    assert.equal(ruleHitCandle(up, 71200, 70000), true); assert.equal(ruleHitCandle(dn, 70000, 69500), false);
});

let failed = 0;
for (const [name, fn] of tests) {
    try { await fn(); console.log('ok', name); } catch (e) { failed++; console.log('FALLITO', name, e.message); }
}
console.log(failed ? `${failed} test falliti` : `${tests.length} test superati`);
process.exit(failed ? 1 : 0);
