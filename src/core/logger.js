// Log dell'app: avvisi ed errori nella console del browser (Safari → Sviluppo), per capire un problema
// sul telefono. Le informazioni ordinarie non si stampano.
export const Logger = {
    log(level, module, message, data = null) {
        if (level === 'ERROR') console.error(`[${module}] ${message}`, data ?? '');
        else if (level === 'WARN') console.warn(`[${module}] ${message}`, data ?? '');
    }
};

// Vecchio registro locale (non più letto da nessuna parte): si libera lo spazio una volta
try { localStorage.removeItem('kronos_audit_log'); } catch (e) {}
