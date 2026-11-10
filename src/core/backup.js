import { State } from './state.js';
import { CONFIG } from './config.js';

export function exportBackup() {
    try {
        const payload = {
            _kronos_backup_version: 1,
            timestamp: new Date().toISOString(),
            simState: State.simState,
            // Il token del bot Telegram non finisce nel file: va reinserito a mano dopo un ripristino
            signalSettings: { ...State.signalSettings, telegramBotToken: '' },
            signalHistory: State.signalHistory
        };
        
        const dataStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `kronos_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        if (window.showAlert) window.showAlert('Backup Completato', 'Il file di backup è stato scaricato. Salvalo su iCloud per tenerlo al sicuro. Il token Telegram non è incluso.');
    } catch (e) {
        if (window.showAlert) window.showAlert('Errore', 'Impossibile creare il backup: ' + e.message);
    }
}

export function triggerImportBackup() {
    const input = document.getElementById('backupFileInput');
    if (input) {
        input.value = ''; // Reset per permettere di riselezionare lo stesso file
        input.click();
    }
}

export function handleImportBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const parsed = JSON.parse(content);

            // Validazione di base
            if (!parsed._kronos_backup_version || !parsed.simState) {
                throw new Error("Il file non sembra un backup valido di Kronos.");
            }
            if (typeof parsed.simState.freeBalance !== 'number' || !Array.isArray(parsed.simState.history)) {
                throw new Error("La struttura dei dati del portafoglio è corrotta.");
            }

            // Ripristino dei dati
            State.simState = parsed.simState;
            // I backup non contengono il token Telegram: tengo quello già salvato su questo dispositivo
            const currentToken = State.signalSettings.telegramBotToken;
            State.signalSettings = { ...CONFIG.DEFAULT_SETTINGS, ...parsed.signalSettings };
            if (!State.signalSettings.telegramBotToken) State.signalSettings.telegramBotToken = currentToken || '';
            State.signalHistory = parsed.signalHistory || [];
            State.signalPrevMatrix = {}; // Resetta per forzare una nuova scansione pulita

            // Salvataggio nel localStorage
            State.saveState();
            State.saveSignalState();

            if (window.showAlert) {
                window.showAlert('Ripristino Completato', 'I dati sono stati importati con successo. L\'app verrà ricaricata per applicare le modifiche.');
            }
            
            // Ricarica la pagina per reinizializzare tutto in modo pulito
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (err) {
            if (window.showAlert) window.showAlert('Errore Importazione', 'Impossibile leggere il backup: ' + err.message);
        }
    };
    reader.readAsText(file);
}
