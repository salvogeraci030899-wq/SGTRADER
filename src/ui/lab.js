import { $, escapeHtml, fmtIt, fetchData } from '../utils/helpers.js';

// --- LABORATORIO STRATEGIE (lab_summary.json, scritto dal workflow "Laboratorio strategie") ---
// Classifica delle strategie provate sullo storico, per timeframe, ordinata per risultato "oltre il
// mercato". Sola lettura: i test girano su GitHub Actions. Una strategia è "candidata" solo se supera
// la correzione per prove multiple ed è stabile; "confermata" solo dopo la prova sui mesi sigillati.

const ROWS_PER_PAGE = 6;
let summary = null;
let paperLedger = null;     // prova su carta (paper_trades.json, scritto dal bot)
let loaded = false;
let loading = false;

const pct = (v, d = 2) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${fmtIt(v, d)}%`);
const day = iso => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });

function outcome(r) {
    if (r.holdout) return r.holdout.confirmed ? { text: 'Confermata', cls: 'text-accent' } : { text: 'Bocciata', cls: 'text-danger' };
    if (r.candidate) return { text: 'Candidata', cls: 'text-accent' };
    if (r.n < 30) return { text: 'Pochi dati', cls: '' };
    return { text: 'No', cls: '' };
}

async function load() {
    if (loading) return;
    loading = true;
    try {
        const r = await fetchData('lab_summary.json');
        summary = r.ok ? await r.json() : null;
    } catch (e) { summary = null; }
    try {
        const r = await fetchData('paper_trades.json');
        paperLedger = r.ok ? await r.json() : null;
    } catch (e) { paperLedger = null; }
    loaded = true;
    loading = false;
    renderLab();
}

function rowsFor(tf) {
    return Object.values(summary.results)
        .filter(r => r.tf === tf && r.n > 0)
        .sort((a, b) => b.excess_avg_pct - a.excess_avg_pct);
}

export function renderLab() {
    const box = $('labResults'), sub = $('testSubtitle');
    if (!box) return;
    if ($('testView').value !== 'lab') return;
    if (!loaded) { box.innerHTML = '<div class="empty-hint">Laboratorio in caricamento…</div>'; load(); return; }
    if (!summary || !summary.results) {
        if (sub) sub.textContent = 'Laboratorio · strategie sullo storico';
        box.innerHTML = '<div class="empty-hint">Risultati del laboratorio non ancora disponibili: vanno calcolati con il workflow "Laboratorio strategie".</div>';
        return;
    }
    const tf = $('labTF').value;
    const rows = rowsFor(tf);
    if (sub) sub.textContent = `Laboratorio · ${summary.trials_registered} prove sullo storico`;

    // Una candidata che ha già fatto la prova finale non è più "in attesa": o è confermata o è bocciata
    const names = keys => (keys.length ? keys.map(k => k.replace(':', ' ').replace(/_/g, ' ')).join(', ') : 'nessuna');
    const tested = k => !!summary.results[k].holdout;
    const cand = names(summary.candidates.filter(k => !tested(k)));
    const conf = names(summary.confirmed);
    const failed = Object.keys(summary.results).filter(k => tested(k) && !summary.results[k].holdout.confirmed);

    // Prova su carta: segnali seguiti dal vivo dal bot, senza ordini
    const onPaper = Object.entries((paperLedger && paperLedger.strategies) || {}).filter(([, e]) => e.mode === 'paper' || e.mode === 'live');
    const paperLine = onPaper.length
        ? `<div class="lab-summary"><b>Su carta dal ${day(paperLedger.started)}:</b> ${onPaper.map(([k, e]) => {
            const st = e.stats || { n: 0, open: 0 };
            return `${escapeHtml(k.replace(':', ' ').replace(/_/g, ' '))} · ${st.n} chiusi${st.n ? ' (netto medio ' + pct(st.avg_net_pct) + ')' : ''}, ${st.open || 0} aperti`;
        }).join(' · ')}</div>`
        : '';

    const pages = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) pages.push(rows.slice(i, i + ROWS_PER_PAGE));
    const table = chunk => `
        <table class="bt-table lab-table">
            <thead><tr><th>Strategia</th><th>N</th><th>Netto</th><th>Oltre merc.</th><th>Esito</th></tr></thead>
            <tbody>${chunk.map(r => {
                const o = outcome(r);
                return `<tr onclick="openLabDetail('${escapeHtml(r.strategy)}:${escapeHtml(r.tf)}')"><td>${escapeHtml(r.strategy.replace(/_/g, ' '))}</td><td>${r.n}</td>` +
                    `<td class="${r.avg_net_pct > 0 ? 'text-accent' : 'text-danger'}">${pct(r.avg_net_pct)}</td>` +
                    `<td class="${r.excess_avg_pct > 0 ? 'text-accent' : 'text-danger'}">${pct(r.excess_avg_pct)}</td><td class="${o.cls}">${o.text}</td></tr>`;
            }).join('')}</tbody>
        </table>`;

    box.innerHTML = `
        <div class="lab-summary"><b>Candidate in attesa:</b> ${escapeHtml(cand)} · <b>Confermate:</b> ${escapeHtml(conf)}${failed.length ? ` · <b>Non confermate:</b> ${escapeHtml(names(failed))}` : ''}</div>
        ${paperLine}
        ${rows.length ? `<div class="lab-pages" id="labPages">${pages.map(p => `<div class="lab-page">${table(p)}</div>`).join('')}</div>
        <div class="info-dots" id="labDots">${pages.map((_, i) => `<div class="info-dot${i === 0 ? ' active' : ''}" onclick="goToLabPage(${i})"></div>`).join('')}</div>`
            : `<div class="empty-hint">Nessuna strategia provata su ${tf.toUpperCase()}.</div>`}
        <div class="bt-note lab-note">Tocca una riga per i dettagli. "Netto" = per trade, dopo costi futures e funding. "Oltre merc." = netto meno il rendimento della semplice esposizione. Mesi sigillati per la prova finale: dal ${day(summary.holdout_start)}. Nessuna strategia è valida per soldi veri finché non è confermata.</div>`;

    const list = $('labPages');
    if (list) list.addEventListener('scroll', () => {
        clearTimeout(window._labScrollTimeout);
        window._labScrollTimeout = setTimeout(() => {
            if (list.clientWidth === 0) return;
            const idx = Math.round(list.scrollLeft / list.clientWidth);
            document.querySelectorAll('#labDots .info-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
        }, 50);
    });
}

export function goToLabPage(idx) {
    const list = $('labPages');
    if (list) list.scrollTo({ left: idx * list.clientWidth, behavior: 'smooth' });
}

export function openLabDetail(key) {
    const r = summary && summary.results && summary.results[key];
    if (!r || !window.showAlert) return;
    const ci = c => (c ? `da ${pct(c[0])} a ${pct(c[1])}` : 'n/d');
    const halves = (r.halves || []).map(h => pct(h.excess_avg_pct)).join(' / ');
    const coins = Object.entries(r.excess_by_coin || {}).map(([s, v]) => `${s.replace('USDT', '')} ${pct(v)}`).join(' · ');
    const lines = [
        `${r.n} trade · ${r.win_rate}% vincenti · durata media ${r.avg_bars} candele`,
        `Netto medio: ${pct(r.avg_net_pct, 3)} a trade`,
        r.portfolio && r.portfolio.n ? `Con le regole dell'esecutore (3 coin): ${pct(r.portfolio.annual_return_pct, 1)} l'anno, drawdown massimo ${pct(r.portfolio.max_drawdown_pct, 1)} in ${r.portfolio.years} anni` : 'Portafoglio: n/d',
        `Oltre il mercato: ${pct(r.excess_avg_pct, 3)}, intervallo 95% ${ci(r.excess_ci)}, p ${r.excess_p == null ? 'n/d' : r.excess_p.toFixed(4)}`,
        `Prima / seconda metà: ${halves || 'n/d'}`,
        `Per coin: ${coins || 'n/d'}`,
        `Esito: ${r.candidate ? 'candidata' : (r.significant ? 'significativa ma instabile' : 'non candidata')}`,
    ];
    if (r.holdout) {
        const h = r.holdout;
        lines.push(h.n
            ? `Prova finale (${day(h.unsealed_on)}): ${h.n} trade, oltre il mercato ${pct(h.excess_avg_pct, 3)}, p ${h.excess_p == null ? 'n/d' : h.excess_p.toFixed(3)} → ${h.confirmed ? 'CONFERMATA' : 'non confermata'}`
            : `Prova finale (${day(h.unsealed_on)}): nessun trade`);
    }
    const desc = (summary.descriptions && summary.descriptions[r.strategy]) || '';
    window.showAlert(`${r.strategy.replace(/_/g, ' ')} · ${r.tf.toUpperCase()}`, (desc ? desc + '\n\n' : '') + lines.join('\n'));
}

// Passa tra il backtest dell'app e la classifica del laboratorio (stessa pagina, tasti in alto a destra)
export function setTestView(view) {
    $('testView').value = view;
    $('btn-view-bt').classList.toggle('active', view === 'bt');
    $('btn-view-lab').classList.toggle('active', view === 'lab');
    $('btView').style.display = view === 'bt' ? '' : 'none';
    $('labView').style.display = view === 'lab' ? '' : 'none';
    const sub = $('testSubtitle');
    if (view === 'bt') { if (sub) sub.textContent = '3000 candele · train 70 / test 30'; }
    else renderLab();
}
