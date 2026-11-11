// La logica dei comandi sta in src/core/commands.js, perché la usa anche l'app nel browser:
// su Vercel la cartella api/ contiene solo funzioni server e i suoi file non vengono serviti al browser.
export * from '../src/core/commands.js';
