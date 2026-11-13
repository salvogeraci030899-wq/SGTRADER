// --- Finestre a schermo intero con l'intestazione delle pagine (regole fisse dell'app) ---
// Ogni finestra (.modal-overlay) diventa all'avvio:
//   intestazione identica alle pagine (.header-row: titolo, sottotitolo da data-sub, X in alto a destra)
//   corpo (.win-body): tutto il contenuto, impaginato a colonne larghe quanto lo schermo, quindi se è lungo
//                      continua di lato (niente scroll verticale)
//   tasti (.modal-actions) in fondo.
// Gli id dei titoli restano (passano dal vecchio h3 al nuovo h1): il resto dell'app continua a usarli.
// La X fa quello che farebbe il tasto Annulla/Chiudi della finestra.
const X = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

function closer(ov) {
    // tasto che chiude la finestra senza fare altro: Annulla/Chiudi, la vecchia X, altrimenti l'unico tasto
    const cancel = ov.querySelector('.modal-actions .btn-cancel') || ov.querySelector('.settings-close');
    const actions = ov.querySelectorAll('.modal-actions button');
    const only = actions.length === 1 ? actions[0] : null;
    const btn = cancel || only;
    return btn ? () => btn.click() : () => ov.classList.remove('active');
}

export function normalizeWindows(root = document) {
    root.querySelectorAll('.modal-overlay').forEach(ov => {
        const box = ov.querySelector('.modal-box');
        if (!box || box.dataset.win) return;
        box.dataset.win = '1';
        box.removeAttribute('style');                 // larghezze e allineamenti a mano: ora valgono le regole comuni
        const close = closer(ov);
        const h3 = box.querySelector('h3');
        const head = document.createElement('div');
        head.className = 'header-row win-head';
        head.innerHTML = '<div class="header-title"><h1></h1><p></p></div><div class="header-actions"><button type="button" class="header-icon-btn win-x" title="Chiudi" aria-label="Chiudi"></button></div>';
        const h1 = head.querySelector('h1');
        h1.textContent = h3 ? h3.textContent : '';
        if (h3 && h3.id) { const id = h3.id; h3.removeAttribute('id'); h1.id = id; }
        head.querySelector('p').textContent = ov.dataset.sub || 'PinscherTrade';
        const x = head.querySelector('.win-x');
        x.innerHTML = X;
        x.addEventListener('click', close);
        // vecchia intestazione: il contenitore apposito (Connessioni, Analisi AI) o il solo titolo
        if (h3) {
            const old = h3.parentElement !== box ? h3.parentElement : h3;
            old.querySelectorAll('.be-badge').forEach(b => box.insertBefore(b, old.nextSibling));   // l'indicatore resta nel corpo
            old.remove();
        }
        const actions = [...box.children].filter(c => c.classList.contains('modal-actions'));
        const body = document.createElement('div');
        body.className = 'win-body';
        [...box.children].filter(c => !actions.includes(c)).forEach(c => body.appendChild(c));
        const dots = document.createElement('div');
        dots.className = 'win-dots';
        box.append(head, body, dots, ...actions);
        // puntini delle pagine (solo se il contenuto è più lungo di una schermata), aggiornati scorrendo
        const update = () => {
            const pages = Math.max(1, Math.ceil((body.scrollWidth - 2) / (body.clientWidth + 32)));
            const at = Math.round(body.scrollLeft / (body.clientWidth + 32));
            dots.innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => `<span class="${i === at ? 'on' : ''}"></span>`).join('') : '';
        };
        body.addEventListener('scroll', update, { passive: true });
        new MutationObserver(() => { if (ov.classList.contains('active')) { body.scrollLeft = 0; requestAnimationFrame(update); } })
            .observe(ov, { attributes: true, attributeFilter: ['class'] });
        new MutationObserver(() => requestAnimationFrame(update)).observe(body, { childList: true, subtree: true, characterData: true });
    });
}
