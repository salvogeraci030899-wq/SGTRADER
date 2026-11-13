// --- BLOCCO DELL'APP: codice numerico di 6 cifre e Face ID / Touch ID ---
// Come lo sblocco del telefono: all'apertura e al ritorno nell'app dopo un po' (Impostazioni → Blocco app).
// - Il codice non viene mai salvato: solo un'impronta PBKDF2-SHA256 (150.000 giri, sale casuale) in localStorage.
// - Face ID usa le passkey del sistema (WebAuthn, autenticatore del dispositivo con verifica dell'utente):
//   l'app chiede a iOS di riconoscerti, nessun dato biometrico passa dall'app.
// - Codice sbagliato 5 volte: attesa crescente (30 s, 60 s, ...).
// - "Hai dimenticato il codice?": cancella i dati dell'app su QUESTO dispositivo e toglie il blocco
//   (come il ripristino di un telefono). Bitget, GitHub e i server non vengono toccati.
// È una protezione contro chi prende in mano il telefono, non una cifratura dei dati.

const KEY = 'pt_lock';
const PIN_LEN = 6, ITER = 150_000;
const DELAYS = { now: 0, '1m': 60_000, '5m': 300_000 };

const $ = id => document.getElementById(id);
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
function save(cfg) { try { cfg ? localStorage.setItem(KEY, JSON.stringify(cfg)) : localStorage.removeItem(KEY); } catch (e) {} }
export const lockEnabled = () => !!(load() || {}).hash;

async function hashPin(pin, salt, iter = ITER) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(salt), iterations: iter, hash: 'SHA-256' }, base, 256);
    return b64(bits);
}
async function checkPin(pin) {
    const cfg = load();
    return !!cfg && (await hashPin(pin, cfg.salt, cfg.iter)) === cfg.hash;
}

// ---------- Face ID (WebAuthn, autenticatore del dispositivo) ----------
export async function faceIdAvailable() {
    try {
        return !!(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
            && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch (e) { return false; }
}
async function enrollFaceId() {
    const cred = await navigator.credentials.create({ publicKey: {
        rp: { name: 'PinscherTrade' },   // dominio: quello del sito (GitHub Pages e Vercel hanno passkey separate)
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'pinschertrade', displayName: 'PinscherTrade' },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000, attestation: 'none'
    } });
    return b64(cred.rawId);
}
async function verifyFaceId(credId) {
    const res = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(credId) }],
        userVerification: 'required', timeout: 60_000
    } });
    return !!(res && res.response && res.response.authenticatorData);
}

// ---------- Schermata ----------
// mode: unlock | setup1 | setup2 | verify (per cambiare il codice o togliere il blocco)
let mode = 'unlock', entry = '', firstPin = '', onVerified = null, busy = false;

function attemptsWait() {
    const cfg = load() || {};
    return Math.max(0, (cfg.until || 0) - Date.now());
}

function render(msg = '', error = false) {
    const titles = { unlock: 'Inserisci il codice', setup1: 'Scegli un codice di 6 cifre', setup2: 'Ripeti il codice', verify: 'Inserisci il codice attuale' };
    $('lockMsg').textContent = msg || titles[mode];
    $('lockMsg').classList.toggle('error', error);
    $('lockDots').innerHTML = Array.from({ length: PIN_LEN }, (_, i) => `<span class="${i < entry.length ? 'on' : ''}"></span>`).join('');
    const cfg = load() || {};
    $('lockFace').style.visibility = mode === 'unlock' && cfg.faceId ? 'visible' : 'hidden';
    $('lockForgot').style.display = mode === 'unlock' ? '' : 'none';
    $('lockCancel').style.display = mode === 'unlock' ? 'none' : '';
}

function show(m) {
    mode = m; entry = ''; busy = false;
    document.documentElement.classList.add('app-locked');
    $('lockScreen').classList.add('active');
    render();
}
function hide() {
    document.documentElement.classList.remove('app-locked');
    $('lockScreen').classList.remove('active');
    entry = ''; firstPin = ''; onVerified = null;
}

function shake(msg) {
    entry = '';
    render(msg, true);
    const d = $('lockDots');
    d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
}

async function complete() {
    busy = true;
    const pin = entry;
    if (mode === 'setup1') { firstPin = pin; mode = 'setup2'; entry = ''; busy = false; render(); return; }
    if (mode === 'setup2') {
        if (pin !== firstPin) { mode = 'setup1'; firstPin = ''; busy = false; shake('I codici non coincidono: riprova'); return; }
        const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
        const old = load() || {};
        save({ salt, iter: ITER, hash: await hashPin(pin, salt), faceId: old.faceId || null, after: old.after || '1m' });
        hide(); renderLockSettings();
        window.showAlert && window.showAlert('Blocco attivo', 'Da ora l\'app chiede il codice all\'apertura. Puoi aggiungere Face ID in Impostazioni → Blocco app.');
        return;
    }
    const wait = attemptsWait();
    if (wait > 0) { busy = false; shake(`Troppi tentativi: riprova tra ${Math.ceil(wait / 1000)} s`); return; }
    if (await checkPin(pin)) {
        const cfg = load(); cfg.fails = 0; cfg.until = 0; save(cfg);
        const next = onVerified; hide();
        if (mode === 'verify' && next) next();
        return;
    }
    const cfg = load(); cfg.fails = (cfg.fails || 0) + 1;
    if (cfg.fails >= 5) cfg.until = Date.now() + 30_000 * 2 ** (cfg.fails - 5);
    save(cfg); busy = false;
    shake(cfg.fails >= 5 ? `Codice errato. Attendi ${Math.round(30 * 2 ** (cfg.fails - 5))} s` : 'Codice errato');
}

export function lockKey(k) {
    if (busy) return;
    if (k === 'del') { entry = entry.slice(0, -1); render(); return; }
    if (entry.length >= PIN_LEN) return;
    entry += k;
    render();
    if (entry.length === PIN_LEN) setTimeout(complete, 120);
}

export async function lockFaceId() {
    const cfg = load();
    if (!cfg || !cfg.faceId || busy) return;
    try {
        if (await verifyFaceId(cfg.faceId)) { cfg.fails = 0; cfg.until = 0; save(cfg); hide(); }
    } catch (e) { render('Face ID non riuscito: usa il codice', true); }
}

export function lockCancel() { hide(); }

export function lockForgot() {
    const ok = window.confirm('Hai dimenticato il codice?\n\nPer togliere il blocco cancello i dati dell\'app su questo dispositivo: trade simulati, impostazioni, chiavi salvate (le reinserisci dopo). Bitget, GitHub e i server non vengono toccati.\n\nProcedo?');
    if (!ok) return;
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    location.reload();
}

// ---------- Impostazioni → Blocco app ----------
export async function renderLockSettings() {
    const box = $('lockSettingsBody');
    if (!box) return;
    const cfg = load();
    const val = $('setLockVal');
    if (val) val.textContent = cfg && cfg.hash ? (cfg.faceId ? 'Codice e Face ID' : 'Codice') : 'Spento';
    if (!cfg || !cfg.hash) {
        box.innerHTML = `<p>Come lo sblocco del telefono: all'apertura l'app chiede un codice di 6 cifre (e, se vuoi, Face ID).</p>
            <button type="button" class="btn-confirm lock-wide" onclick="lockSetup()">Imposta il codice</button>`;
        return;
    }
    const face = await faceIdAvailable();
    const after = cfg.after || '1m';
    box.innerHTML = `
        <div class="set-row set-static"><span class="set-label">Face ID</span>
            ${face ? `<div class="theme-toggle"><button type="button" class="${cfg.faceId ? 'active' : ''}" onclick="lockSetFace(true)">Sì</button><button type="button" class="${cfg.faceId ? '' : 'active'}" onclick="lockSetFace(false)">No</button></div>`
                   : '<span class="set-val">non disponibile qui</span>'}
        </div>
        <div class="set-row set-static"><span class="set-label">Blocca dopo</span>
            <div class="theme-toggle">${Object.entries({ now: 'Subito', '1m': '1 min', '5m': '5 min' }).map(([k, l]) => `<button type="button" class="${after === k ? 'active' : ''}" onclick="lockSetAfter('${k}')">${l}</button>`).join('')}</div>
        </div>
        <div class="lock-actions">
            <button type="button" class="btn-cancel" onclick="lockChange()">Cambia codice</button>
            <button type="button" class="btn-cancel lock-off" onclick="lockDisable()">Togli il blocco</button>
        </div>
        <div class="settings-hint" id="lockHint">Uscendo dall'app per più del tempo scelto, al ritorno chiede di nuovo il codice.</div>`;
}

export function openLockSettings() { $('lockModal').classList.add('active'); renderLockSettings(); }
export function closeLockSettings() { $('lockModal').classList.remove('active'); }
export function lockSetup() { closeLockSettings(); show('setup1'); }
export function lockChange() { closeLockSettings(); onVerified = () => show('setup1'); show('verify'); }
export function lockDisable() {
    closeLockSettings();
    onVerified = () => { save(null); renderLockSettings(); window.showAlert && window.showAlert('Blocco tolto', 'L\'app non chiede più il codice all\'apertura.'); };
    show('verify');
}
export function lockSetAfter(k) { const cfg = load(); if (!cfg || !(k in DELAYS)) return; cfg.after = k; save(cfg); renderLockSettings(); }
export async function lockSetFace(on) {
    const cfg = load();
    if (!cfg) return;
    if (!on) { cfg.faceId = null; save(cfg); renderLockSettings(); return; }
    try {
        cfg.faceId = await enrollFaceId();
        save(cfg);
    } catch (e) {
        const hint = $('lockHint');
        if (hint) hint.textContent = 'Face ID non attivato: ' + (e && e.name === 'NotAllowedError' ? 'richiesta annullata o non consentita.' : (e && e.message) || 'errore');
        return;
    }
    renderLockSettings();
}

// ---------- Avvio e ritorno nell'app ----------
let hiddenAt = 0;
export function initLock() {
    if (lockEnabled()) show('unlock'); else hide();
    document.addEventListener('visibilitychange', () => {
        if (!lockEnabled()) return;
        if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
        const cfg = load() || {};
        if (hiddenAt && Date.now() - hiddenAt >= (DELAYS[cfg.after || '1m'] ?? 60_000) && mode !== 'setup1' && mode !== 'setup2') show('unlock');
        hiddenAt = 0;
    });
    renderLockSettings();
}
