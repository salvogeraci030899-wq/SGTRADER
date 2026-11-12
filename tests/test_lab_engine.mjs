// Parità del motore del laboratorio nell'app (src/core/labEngine.js) con quello Python (strategy_lab.simulate):
// stessi trade, stessa uscita, stesso risultato lordo, sugli stessi dati (tests/fixtures/lab_parity.json,
// generato con Python). `node tests/test_lab_engine.mjs`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAB, LAB_ONLY, simulate, netPct } from '../src/core/labEngine.js';

const fx = JSON.parse(readFileSync(new URL('./fixtures/lab_parity.json', import.meta.url)));
const candles = fx.candles.map(([ts, open, high, low, close]) => ({ ts, open, high, low, close }));
const tfMs = 4 * 3600e3;
let n = 0;
for (const [name, ref] of Object.entries(fx.trades)) {
    const got = simulate(candles, tfMs, LAB[name]);
    assert.equal(got.length, ref.length, `${name}: numero di trade`);
    got.forEach((t, k) => {
        const r = ref[k];
        assert.equal(candles[t.i].ts, r.t, `${name} #${k}: candela d'ingresso`);
        assert.equal(t.bars, r.bars, `${name} #${k}: durata`);
        assert.equal(t.dir, r.dir, `${name} #${k}: direzione`);
        assert.equal(t.reason, r.reason, `${name} #${k}: motivo di uscita`);
        assert.ok(Math.abs(t.gross - r.gross) < 1e-9, `${name} #${k}: lordo ${t.gross} vs ${r.gross}`);
    });
    n++;
    console.log('ok', name, got.length, 'trade');
}
assert.equal(n, Object.keys(LAB).length, 'tutte le strategie dell\'app sono confrontate con Python');
// costi: 0,11% per lato; funding prudente solo sui long (0,01% ogni 8 ore)
assert.ok(Math.abs(netPct({ gross: 1, bars: 6, dir: 1 }, tfMs) - (1 - 0.22 - 0.03)) < 1e-12);
assert.ok(Math.abs(netPct({ gross: 1, bars: 6, dir: -1 }, tfMs) - 0.78) < 1e-12);
assert.ok(Object.keys(LAB_ONLY).every(k => !LAB[k]));
console.log(`${n + 1} test superati`);
