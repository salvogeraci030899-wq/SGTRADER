// --- TEMA: chiaro, scuro o automatico (segue iOS) ---
// La preferenza resta su questo dispositivo (localStorage). Il primo frame lo imposta lo script in
// <head> di index.html; qui si gestiscono il cambio dalle Impostazioni e il cambio di iOS mentre
// l'app è aperta. Chi deve ridisegnarsi (i grafici) ascolta l'evento "pt-theme".

const KEY = 'pt_theme';
const BAR_KEY = 'pt_statusbar';     // 'integrated' | 'separate'
const MODES = ['auto', 'light', 'dark'];
const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

export function getThemePref() {
    try { const v = localStorage.getItem(KEY); return MODES.includes(v) ? v : 'auto'; } catch (e) { return 'auto'; }
}

export function resolvedTheme(pref = getThemePref()) {
    if (pref === 'light' || pref === 'dark') return pref;
    return media && media.matches ? 'light' : 'dark';
}

export function applyTheme() {
    const theme = resolvedTheme();
    const root = document.documentElement;
    if (root.getAttribute('data-theme') !== theme) root.setAttribute('data-theme', theme);
    const meta = document.getElementById('metaThemeColor');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f2f2f7' : '#000000');
    const bar = document.getElementById('metaStatusBar');
    if (bar) bar.setAttribute('content', theme === 'light' ? 'default' : (getStatusBarPref() === 'separate' ? 'black' : 'black-translucent'));
    window.dispatchEvent(new CustomEvent('pt-theme', { detail: theme }));
    return theme;
}

export function setThemePref(pref) {
    if (!MODES.includes(pref)) return;
    try { localStorage.setItem(KEY, pref); } catch (e) {}
    applyTheme();
}

export function initTheme() {
    applyTheme();
    if (media) {
        const onChange = () => { if (getThemePref() === 'auto') applyTheme(); };
        if (media.addEventListener) media.addEventListener('change', onChange);
        else if (media.addListener) media.addListener(onChange);
    }
}

// Colore di una variabile CSS del tema (per i grafici, che non leggono il CSS da soli)
export const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Vetro (stile Liquid Glass) su barra, tasti e schede: 'off' | 'on' (sfondo statico) | 'anim' (sfondo dinamico: luci che cambiano colore e posizione piano), spento all'inizio
const GLASS_KEY = 'pt_glass';
const GLASS = ['off', 'on', 'anim'];
export function getGlassPref() {
    try { const v = localStorage.getItem(GLASS_KEY); return GLASS.includes(v) ? v : 'off'; } catch (e) { return 'off'; }
}
export function setGlassPref(pref) {
    if (!GLASS.includes(pref)) pref = 'off';
    try { localStorage.setItem(GLASS_KEY, pref); } catch (e) {}
    document.documentElement.classList.toggle('glass', pref !== 'off');
    document.documentElement.classList.toggle('glass-anim', pref === 'anim');
    applyTheme();      // i grafici si ridipingono (sfondo trasparente col vetro)
}

export function getStatusBarPref() {
    try { return localStorage.getItem(BAR_KEY) === 'separate' ? 'separate' : 'integrated'; } catch (e) { return 'integrated'; }
}
export function setStatusBarPref(pref) {
    try { localStorage.setItem(BAR_KEY, pref === 'separate' ? 'separate' : 'integrated'); } catch (e) {}
    applyTheme();
}
