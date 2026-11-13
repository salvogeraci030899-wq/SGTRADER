// --- Dati cifrati: lettura dei file personali che il bot salva cifrati nel repository pubblico ---
// Stesso formato di tools/datacrypt.py:  SGTENC1:<base64(nonce 12 byte + AES-256-GCM con tag)>
//   chiave AES = HMAC-SHA256(chiave dei dati, "sgtrader-enc-v1"), dati aggiuntivi "sgtrader-v1".
// Usato dall'app (helpers.fetchData) e dal server Cloudflare (bot Telegram). Solo WebCrypto, niente librerie.
// La chiave dei dati non esce mai dal dispositivo: al server si manda solo una prova derivata (aiProof).

const PREFIX = 'SGTENC1:';
const enc = new TextEncoder();
const cache = new Map();     // chiave → { aes, proof } (derivate una volta sola)

export const isEncrypted = text => typeof text === 'string' && text.trimStart().startsWith(PREFIX);

async function hmac(keyBytes, msg) {
    const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}

async function derived(key) {
    if (!cache.has(key)) {
        cache.set(key, (async () => {
            const raw = enc.encode(key);
            const aes = await crypto.subtle.importKey('raw', await hmac(raw, 'sgtrader-enc-v1'), 'AES-GCM', false, ['decrypt']);
            const proof = [...await hmac(raw, 'sgtrader-ai-v1')].map(b => b.toString(16).padStart(2, '0')).join('');
            return { aes, proof };
        })());
    }
    return cache.get(key);
}

function fromB64(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

// Testo in chiaro di un file cifrato; errore se la chiave è sbagliata o il file è rovinato
export async function decryptText(text, key) {
    const raw = fromB64(text.trim().slice(PREFIX.length));
    const { aes } = await derived(key);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: enc.encode('sgtrader-v1') }, aes, raw.slice(12));
    return new TextDecoder().decode(plain);
}

// Prova di possesso della chiave per il server (header x-pt-proof): derivata, non rivela la chiave
export async function aiProof(key) {
    return (await derived(key)).proof;
}

// Chiave nuova, casuale (32 byte, base64 senza simboli ambigui): la genera l'app, va copiata nel segreto DATA_KEY
export function newDataKey() {
    const b = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
