import { State } from '../core/state.js';
import { $, SYM, apiPost, escapeHtml, calcPnl } from '../utils/helpers.js';
import * as Trade from './trade.js';

// --- ASSISTENTE SULLA POSIZIONE: chat di testo e chat vocale ---
// Testo o voce → il server (src/core/commands.js, Groq gratuito) risponde e propone al massimo UNA
// azione da un elenco chiuso → l'app la traduce in una modifica precisa (src/core/rules.js) e la
// mostra con "Conferma". Niente viene eseguito senza il tuo tocco su Conferma.
// Voce: registrazione nel telefono (MediaRecorder) → trascrizione Whisper su Groq; le risposte le
// legge la sintesi vocale di iOS.

let tradeId = null, history = [], speak = false, rec = null, chunks = [], recTimer = null, busy = false;
const MAX_REC_MS = 30000;

const trade = () => State.simState.activeTrades.find(t => t.id === tradeId);

function addMsg(role, html) {
    const log = $('assistLog');
    const div = document.createElement('div');
    div.className = `assist-msg ${role}`;
    div.innerHTML = html;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
}

function status(text) { const el = $('assistStatus'); if (el) el.textContent = text || ''; }

function say(text) {
    if (!speak || !('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'it-IT';
        window.speechSynthesis.speak(u);
    } catch (e) { /* sintesi non disponibile */ }
}

function context(t) {
    const px = t.currentPrice || State.livePx[t.symbol] || t.entryPrice;
    return {
        symbol: t.symbol, type: t.type, market: t.market || 'SPOT', leverage: t.leverage || 1, timeframe: t.granularity,
        entry: t.entryPrice, price: px, stop: t.slPrice, take: t.tpPrice, size: t.size,
        capital: t.margin != null ? t.margin : t.capitalInvested,
        pnl: Number(calcPnl(t, px).net.toFixed(2)),
        hours_open: Number(((Date.now() - t.entryTime) / 3600e3).toFixed(1)),
        rules: (t.rules || []).map(r => `chiude a ${r.side === 'above' ? '≥' : '≤'} ${r.price} (${r.label})`)
    };
}

export function openAssistant(id, voice) {
    const t = State.simState.activeTrades.find(x => x.id === id);
    if (!t) return;
    tradeId = id; history = []; speak = !!voice;
    $('assistTitle').textContent = `${voice ? 'Voce' : 'Chat'} · ${SYM(t.symbol)} ${t.type}`;
    $('assistLog').innerHTML = '';
    addMsg('bot', 'Dimmi cosa fare con questa posizione, per esempio: <i>«se arriva a 10 USDT di profitto chiudi»</i>, <i>«sposta lo stop a pareggio»</i>, <i>«come sta andando?»</i>. Ogni azione la confermi tu.');
    $('assistInput').value = '';
    $('assistSpeak').classList.toggle('active', speak);
    status('');
    $('assistModal').classList.add('active');
    if (voice) toggleRecording();
    else setTimeout(() => $('assistInput').focus(), 200);
}

export function closeAssistant() {
    stopRecording(true);
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    $('assistModal').classList.remove('active');
    tradeId = null;
}

export function toggleAssistSpeak() {
    speak = !speak;
    $('assistSpeak').classList.toggle('active', speak);
    if (!speak) try { window.speechSynthesis.cancel(); } catch (e) {}
}

export async function sendAssist(textArg) {
    const input = $('assistInput');
    const text = (typeof textArg === 'string' ? textArg : input.value).trim();
    const t = trade();
    if (!text || busy) return;
    if (!t) { addMsg('bot', 'La posizione non è più aperta.'); return; }
    input.value = '';
    addMsg('user', escapeHtml(text));
    busy = true; status('Sto pensando…');
    try {
        const res = await apiPost('/api/assistant', { text, history, position: context(t) });
        let out = {};
        try { out = await res.json(); } catch (e) {}
        if (!res.ok) throw new Error(out.error || `Errore ${res.status}`);
        history.push({ role: 'user', content: text }, { role: 'assistant', content: out.reply });
        history = history.slice(-6);
        addMsg('bot', escapeHtml(out.reply));
        say(out.reply);
        if (out.action) showPlan(out.action);
    } catch (e) {
        addMsg('bot error', `Non riesco a rispondere: ${escapeHtml(e.message)}`);
    } finally { busy = false; status(''); }
}

function showPlan(action) {
    const plan = Trade.planForTrade(tradeId, action);
    if (!plan.ok) { addMsg('bot warn', escapeHtml(plan.error)); say(plan.error); return; }
    const box = addMsg('plan', `<div>${escapeHtml(plan.summary)}</div><div class="assist-plan-actions"><button type="button" class="btn-cancel">Annulla</button><button type="button" class="btn-confirm">Conferma</button></div>`);
    const [no, yes] = box.querySelectorAll('button');
    const done = text => { box.querySelector('.assist-plan-actions').outerHTML = `<div class="assist-plan-done">${text}</div>`; };
    no.onclick = () => done('Annullato.');
    yes.onclick = () => {
        // ricalcolo al momento della conferma: il prezzo può essere cambiato
        const fresh = Trade.planForTrade(tradeId, action);
        if (!fresh.ok) { done(escapeHtml(fresh.error)); return; }
        const ok = Trade.applyPlan(tradeId, fresh);
        done(ok ? 'Fatto ✓' : 'Non applicato: la posizione non è più aperta.');
        if (ok && fresh.kind === 'close_now') setTimeout(closeAssistant, 900);
    };
}

// ---------- Voce ----------
function pickMime() {
    if (!window.MediaRecorder) return null;
    for (const m of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']) {
        try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
    }
    return '';
}

function stopRecording(discard) {
    clearTimeout(recTimer);
    if (rec && rec.state !== 'inactive') { rec.discard = !!discard; rec.stop(); }
    $('assistMic') && $('assistMic').classList.remove('rec');
}

export async function toggleRecording() {
    if (rec && rec.state === 'recording') { stopRecording(false); return; }
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addMsg('bot warn', 'Il microfono non è disponibile qui: usa la chat di testo.');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = async () => {
            stream.getTracks().forEach(tr => tr.stop());
            if (rec.discard || !chunks.length) { status(''); return; }
            const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/mp4').split(';')[0] });
            await transcribeAndSend(blob);
        };
        rec.start();
        $('assistMic').classList.add('rec');
        status('Ti ascolto… tocca di nuovo il microfono per finire');
        recTimer = setTimeout(() => stopRecording(false), MAX_REC_MS);
    } catch (e) {
        addMsg('bot warn', 'Permesso del microfono negato: abilitalo nelle impostazioni di iOS, oppure usa la chat di testo.');
    }
}

async function transcribeAndSend(blob) {
    status('Trascrivo…');
    try {
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        const res = await apiPost('/api/transcribe', { audio: btoa(bin), mime: blob.type });
        let out = {};
        try { out = await res.json(); } catch (e) {}
        if (!res.ok) throw new Error(out.error || `Errore ${res.status}`);
        status('');
        await sendAssist(out.text);
    } catch (e) {
        status('');
        addMsg('bot error', `Trascrizione non riuscita: ${escapeHtml(e.message)}`);
    }
}
