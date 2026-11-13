// --- Backup dell'app: trade simulati, segnali e TUTTE le impostazioni di questo dispositivo ---
// Serve soprattutto a passare da un'installazione all'altra: su iPhone ogni app aggiunta alla schermata Home ha la
// sua memoria, che iOS cancella quando la togli. Le chiavi (token GitHub, chiave app, chiave dei dati) entrano nel
// file solo se lo scegli tu; il blocco con codice e Face ID no: è legato all'installazione e va rifatto.
import { State } from './state.js';
import { CONFIG } from './config.js';

const SETTINGS = ['pt_theme', 'pt_statusbar', 'pt_glass', 'pt_pos_view', 'pt_api_base'];
const SECRETS = ['pt_gh_token', 'pt_app_key', 'pt_data_key'];

function readKeys(keys) {
    const out = {};
    for (const k of keys) {
        try { const v = localStorage.getItem(k); if (v !== null) out[k] = v; } catch (e) {}
    }
    return out;
}

// Tasto "Esporta backup": la finestra fa scegliere se includere le chiavi
export function exportBackup() { document.getElementById('backupModal').classList.add('active'); }
export function closeBackupModal() { document.getElementById('backupModal').classList.remove('active'); }

export function doExportBackup(withKeys) {
    closeBackupModal();
    try {
        const payload = {
            _pinscher_backup_version: 2,
            timestamp: new Date().toISOString(),
            simState: State.simState,
            // il token del bot Telegram dei segnali dell'app non entra mai nel file
            signalSettings: { ...State.signalSettings, telegramBotToken: '' },
            signalHistory: State.signalHistory,
            settings: readKeys(SETTINGS),
            ...(withKeys ? { secrets: readKeys(SECRETS) } : {})
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `pinschertrade_backup_${new Date().toISOString().slice(0, 10)}${withKeys ? '_con_chiavi' : ''}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        if (window.showAlert) window.showAlert('Backup pronto', withKeys
            ? 'Il file contiene anche token e chiave dei dati: tienilo in un posto sicuro (iCloud) e cancellalo dopo il ripristino.'
            : 'Salvalo su iCloud. Token e chiave dei dati non sono inclusi: dopo il ripristino reinseriscili in Impostazioni → Connessioni.');
    } catch (e) {
        if (window.showAlert) window.showAlert('Errore', 'Impossibile creare il backup: ' + e.message);
    }
}

export function triggerImportBackup() {
    const input = document.getElementById('backupFileInput');
    if (input) { input.value = ''; input.click(); }
}

export function handleImportBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const parsed = JSON.parse(e.target.result);
            // anche i backup fatti con il nome vecchio dell'app (versione 1)
            if (!(parsed._pinscher_backup_version || parsed._kronos_backup_version) || !parsed.simState) {
                throw new Error('Il file non sembra un backup di PinscherTrade.');
            }
            if (typeof parsed.simState.freeBalance !== 'number' || !Array.isArray(parsed.simState.history)) {
                throw new Error('La struttura dei dati del portafoglio è corrotta.');
            }
            State.simState = parsed.simState;
            const currentToken = State.signalSettings.telegramBotToken;
            State.signalSettings = { ...CONFIG.DEFAULT_SETTINGS, ...parsed.signalSettings };
            if (!State.signalSettings.telegramBotToken) State.signalSettings.telegramBotToken = currentToken || '';
            State.signalHistory = parsed.signalHistory || [];
            State.signalPrevMatrix = {};
            State.saveState();
            State.saveSignalState();
            // impostazioni e, se presenti, chiavi: solo quelle conosciute
            const allowed = new Set([...SETTINGS, ...SECRETS]);
            let keys = 0;
            for (const [k, v] of Object.entries({ ...(parsed.settings || {}), ...(parsed.secrets || {}) })) {
                if (!allowed.has(k) || typeof v !== 'string') continue;
                try { localStorage.setItem(k, v); if (SECRETS.includes(k)) keys++; } catch (err) {}
            }
            if (window.showAlert) {
                window.showAlert('Ripristino completato', `Trade, segnali e impostazioni ripristinati${keys ? `, con ${keys} ${keys === 1 ? 'chiave' : 'chiavi'}` : ''}. `
                    + 'Il blocco con codice e Face ID va riattivato in Impostazioni → Blocco app. L\'app si ricarica.');
            }
            setTimeout(() => window.location.reload(), 2500);
        } catch (err) {
            if (window.showAlert) window.showAlert('Errore importazione', 'Impossibile leggere il backup: ' + err.message);
        }
    };
    reader.readAsText(file);
}
