// Controllo statico del codice JavaScript (npx eslint@10.14.0 .): variabili non definite o inutilizzate, errori comuni.
// Nessuna dipendenza da installare nel progetto: le globali sono elencate qui sotto.
const browser = ['window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', 'fetch', 'Response', 'Request', 'Headers', 'URL',
    'URLSearchParams', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
    'getComputedStyle', 'matchMedia', 'CustomEvent', 'Event', 'ResizeObserver', 'IntersectionObserver', 'MutationObserver', 'crypto', 'TextEncoder',
    'TextDecoder', 'atob', 'btoa', 'Blob', 'File', 'FileReader', 'FormData', 'Image', 'Audio', 'MediaRecorder', 'AbortController', 'performance',
    'alert', 'confirm', 'prompt', 'history', 'screen', 'caches', 'self', 'Notification', 'PublicKeyCredential', 'structuredClone', 'queueMicrotask',
    'HTMLElement', 'Node', 'DOMParser', 'XMLHttpRequest', 'WebSocket', 'indexedDB', 'visualViewport', 'innerWidth', 'innerHeight', 'devicePixelRatio',
    'LightweightCharts', 'html2canvas', 'speechSynthesis', 'SpeechSynthesisUtterance', 'globalThis'];
const node = ['process', 'console', 'fetch', 'Response', 'Request', 'Headers', 'URL', 'URLSearchParams', 'setTimeout', 'clearTimeout', 'setInterval',
    'clearInterval', 'crypto', 'TextEncoder', 'TextDecoder', 'atob', 'btoa', 'Blob', 'FormData', 'AbortController', 'globalThis', 'Buffer', 'structuredClone'];
const globals = names => Object.fromEntries(names.map(n => [n, 'readonly']));

export default [
    { ignores: ['node_modules/**', 'validation/**', 'futures_archive/**'] },
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals([...new Set([...browser, ...node])]) },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
            'no-unreachable': 'error',
            'no-dupe-keys': 'error',
            'no-duplicate-case': 'error',
            'no-redeclare': 'error',
            'no-self-assign': 'error',
            'no-constant-condition': ['error', { checkLoops: false }],
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-unsafe-finally': 'error',
            'no-fallthrough': 'error',
            'no-cond-assign': ['error', 'except-parens'],
            'no-func-assign': 'error',
            'no-import-assign': 'error',
            'use-isnan': 'error',
            'valid-typeof': 'error',
            'no-sparse-arrays': 'error',
            'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }]
        }
    }
];
