export const Logger = {
    log(level, module, message, data = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            level, // INFO, WARN, ERROR, TRADE
            module,
            message,
            data
        };
        
        if (level === 'ERROR') console.error(`[${module}] ${message}`, data || '');
        else if (level === 'WARN') console.warn(`[${module}] ${message}`, data || '');
        else console.log(`[${module}] ${message}`, data || '');

        // In futuro, qui si può aggiungere il push verso un server di audit o IndexedDB
        this._appendToLocal(entry);
    },
    
    _appendToLocal(entry) {
        try {
            let logs = JSON.parse(localStorage.getItem('kronos_audit_log') || '[]');
            logs.unshift(entry);
            if (logs.length > 500) logs = logs.slice(0, 500); // Mantieni solo gli ultimi 500
            localStorage.setItem('kronos_audit_log', JSON.stringify(logs));
        } catch (e) {}
    }
};
