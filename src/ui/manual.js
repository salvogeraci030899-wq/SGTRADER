// --- Manuale senza scroll verticale ---
// Le slide scritte in index.html sono il contenuto "sorgente". A ogni cambio di misura del carosello
// vengono ridistribuite in pagine orizzontali alte quanto lo spazio visibile: si riempie una pagina
// scheda per scheda; una scheda (.rule-card) che non entra da sola in una pagina viene spezzata tra i
// suoi paragrafi, ripetendo il titolo in ogni parte. I pallini vengono rigenerati di conseguenza.

let sourceSlides = null;   // copie delle slide originali
let lastSize = '';
let scheduled = false;

function carouselEl() { return document.getElementById('infoCarousel'); }

function overflows(slide) { return slide.scrollHeight > slide.clientHeight + 1; }

function newPage(carousel, source) {
    const page = document.createElement('div');
    page.className = 'info-slide';
    page.dataset.source = source;
    carousel.appendChild(page);
    return page;
}

// Mette una .rule-card a partire dalla pagina corrente, un paragrafo alla volta: riempie lo spazio
// rimasto e continua nella pagina successiva, ripetendo il titolo della scheda in ogni parte.
function placeCard(carousel, card, state) {
    const title = card.querySelector(':scope > .rule-card-title');
    const parts = [...card.children].filter(c => c !== title);
    const shell = () => {
        const c = card.cloneNode(false);
        if (title) c.appendChild(title.cloneNode(true));
        return c;
    };
    let current = shell();
    let hasBody = false;
    state.page.appendChild(current);
    // Scheda senza paragrafi oltre al titolo (o solo titolo che già non entra)
    if (parts.length === 0) {
        if (overflows(state.page) && state.page.children.length > 1) {
            state.page.removeChild(current);
            state.page = newPage(carousel, state.source);
            state.page.appendChild(current);
        }
        return;
    }
    for (const part of parts) {
        const node = part.cloneNode(true);
        current.appendChild(node);
        if (!overflows(state.page)) { hasBody = true; continue; }

        current.removeChild(node);
        if (!hasBody) {
            // Nemmeno titolo + primo paragrafo entrano qui: la scheda parte dalla pagina successiva
            state.page.removeChild(current);
            if (state.page.children.length === 0) state.page.remove();
        }
        state.page = newPage(carousel, state.source);
        current = shell();
        current.appendChild(node);
        state.page.appendChild(current);
        hasBody = true;
        // Un singolo paragrafo più alto di una pagina (caso limite): solo questa pagina scorre
        if (overflows(state.page)) state.page.classList.add('info-slide-scroll');
    }
}

function placeBlock(carousel, block, state) {
    if (block.classList.contains('rule-card')) return placeCard(carousel, block, state);
    const node = block.cloneNode(true);
    state.page.appendChild(node);
    if (!overflows(state.page)) return;
    if (state.page.children.length > 1) {
        state.page.removeChild(node);
        state.page = newPage(carousel, state.source);
        state.page.appendChild(node);
    }
    if (overflows(state.page)) state.page.classList.add('info-slide-scroll');
}

function paginate() {
    const carousel = carouselEl();
    if (!carousel || !sourceSlides || carousel.clientHeight === 0) return;

    // Sezione che si stava leggendo, per restare lì dopo la ridistribuzione
    const pages = [...carousel.children];
    const currentIdx = carousel.clientWidth ? Math.round(carousel.scrollLeft / carousel.clientWidth) : 0;
    const currentSource = pages[currentIdx] ? Number(pages[currentIdx].dataset.source || 0) : 0;

    carousel.replaceChildren();
    sourceSlides.forEach((src, sourceIdx) => {
        const state = { source: sourceIdx, page: newPage(carousel, sourceIdx) };
        for (const block of src.children) placeBlock(carousel, block, state);
    });

    renderDots(carousel.children.length);
    const target = [...carousel.children].findIndex(p => Number(p.dataset.source) === currentSource);
    carousel.scrollLeft = Math.max(0, target) * carousel.clientWidth;
    if (window.updateInfoDots) window.updateInfoDots();
}

// I pallini si rimpiccioliscono in base al numero di pagine per stare sempre su una riga
function renderDots(count) {
    const dots = document.getElementById('infoDots');
    if (!dots) return;
    dots.replaceChildren();
    const width = (dots.clientWidth || window.innerWidth) - 32;
    const step = Math.min(16, Math.floor(width / Math.max(count + 1, 1)));   // pallino + spazio
    const size = Math.max(3, Math.min(8, Math.round(step * 0.55)));
    dots.style.setProperty('--dot-size', size + 'px');
    dots.style.setProperty('--dot-gap', Math.max(2, step - size) + 'px');
    dots.classList.add('sized');
    for (let i = 0; i < count; i++) {
        const d = document.createElement('div');
        d.className = 'info-dot' + (i === 0 ? ' active' : '');
        d.addEventListener('click', () => window.goToSlide && window.goToSlide(i));
        dots.appendChild(d);
    }
}

function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
        scheduled = false;
        const carousel = carouselEl();
        if (!carousel || carousel.clientHeight === 0) return; // tab non visibile
        const size = `${carousel.clientWidth}x${carousel.clientHeight}`;
        if (size === lastSize) return;
        lastSize = size;
        paginate();
    });
}

export function initManual() {
    const carousel = carouselEl();
    if (!carousel) return;
    sourceSlides = [...carousel.querySelectorAll(':scope > .info-slide')].map(s => s.cloneNode(true));
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(carousel);
    window.addEventListener('resize', schedule);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
    schedule();
}
