// --- Pagine sempre interamente visibili, senza scroll ---
// Per le pagine che non scorrono (overflow: hidden) controlla a ogni cambio di misura o di contenuto:
// 1) se la pagina scende sotto la parte di schermo visibile (in Safari mobile il contenitore può
//    essere più alto dell'area visibile), lo scarto diventa margine in fondo;
// 2) se il contenuto deborda ancora, i blocchi della pagina vengono rimpiccioliti con CSS zoom
//    quanto basta (mai sotto MIN_ZOOM); se nemmeno così entra, la pagina diventa scorrevole.
// I valori vanno in variabili CSS su <html> (non sulla pagina osservata), così non ci sono cicli.
// La pagina Rischio ha la sua logica in calculator.js, il Manuale in manual.js.

const PAGES = ['home', 'terminal', 'trade', 'journal', 'log', 'signals', 'account', 'settings'];
const MIN_ZOOM = 0.7;

const root = document.documentElement;
let scheduled = false;

function setVar(name, value) {
    if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
}

// Quanto la pagina scende oltre il limite visibile (minimo tra area visibile del browser e inizio
// della navbar). Calcolato dal layout, così l'animazione di apertura della tab non falsa la misura.
function overshoot(page) {
    const main = page.closest('main');
    if (!main) return 0;
    const pageBottom = main.getBoundingClientRect().top - main.scrollTop + page.offsetTop - main.offsetTop + page.offsetHeight;
    let limit = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const nav = document.querySelector('.nav-bar');
    if (nav && nav.getClientRects().length > 0) limit = Math.min(limit, nav.getBoundingClientRect().top);
    return Math.max(0, Math.ceil(pageBottom - limit));
}

const overflowing = page => page.scrollHeight > page.clientHeight + 1;

// Liste a scorrimento orizzontale che si restringono per riempire lo spazio rimasto (min-height: 0):
// se una scheda non entra, il suo contenuto verrebbe tagliato senza che la pagina "deborda".
// Do alla lista l'altezza minima che serve alla scheda più alta; così, se lo spazio non basta,
// la pagina deborda e interviene lo zoom. #activeTradesList ha due righe di schede: conta doppio.
const SHRINKING_LISTS = '.log-list, #activeTradesList';

function reserveListHeights(page) {
    const lists = [...page.querySelectorAll(SHRINKING_LISTS)];
    lists.forEach(l => { l.style.minHeight = ''; });
    for (const list of lists) {
        if (list.getClientRects().length === 0) continue;
        let deficit = 0;
        for (const item of list.children) deficit = Math.max(deficit, item.scrollHeight - item.clientHeight);
        if (deficit <= 1) continue;
        // righe di schede della lista (due, una sugli schermi bassi)
        const rows = list.id === 'activeTradesList' ? Math.max(1, getComputedStyle(list).gridTemplateRows.split(' ').filter(Boolean).length) : 1;
        list.style.minHeight = Math.ceil(list.clientHeight + deficit * rows) + 'px';
    }
}

function fit(page, id) {
    const zoomVar = `--fit-zoom-${id}`;
    setVar(`--fit-extra-bottom-${id}`, overshoot(page) + 'px');
    setVar(zoomVar, '1');
    setVar(`--fit-overflow-${id}`, 'hidden');
    reserveListHeights(page);
    if (!overflowing(page)) return;

    // Lo zoom cambia la larghezza delle schede (e quindi dove va a capo il testo): l'altezza minima
    // delle liste si ricalcola a ogni passo
    let zoom = Math.max(MIN_ZOOM, Math.min(1, Math.floor((page.clientHeight / page.scrollHeight) * 100) / 100));
    setVar(zoomVar, String(zoom));
    reserveListHeights(page);
    while (overflowing(page) && zoom > MIN_ZOOM) {
        zoom = Math.max(MIN_ZOOM, Math.round((zoom - 0.02) * 100) / 100);
        setVar(zoomVar, String(zoom));
        reserveListHeights(page);
    }
    // Ultima risorsa: anche al minimo non entra (schermi molto bassi) -> la pagina scorre invece di tagliare
    if (overflowing(page)) setVar(`--fit-overflow-${id}`, 'auto');
}

function fitActive() {
    for (const id of PAGES) {
        const page = document.getElementById(`page-${id}`);
        if (page && page.classList.contains('active')) fit(page, id);
    }
}

function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; fitActive(); });
}

export function initPageFit() {
    for (const id of PAGES) {
        const page = document.getElementById(`page-${id}`);
        if (!page) continue;
        if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(page);
        // Contenuto che cambia (liste, griglie, testi, elementi mostrati/nascosti con una classe)
        new MutationObserver(schedule).observe(page, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    }
    window.addEventListener('resize', schedule);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
    schedule();
}

export { schedule as refitPages };
