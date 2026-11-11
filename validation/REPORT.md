# Validazione storica di Kronos

Generato il 2026-11-11T23:07:51+00:00 · modello Kronos-small · orizzonte 7 candele.

- **Fuori campione**: solo previsioni successive alla data di pubblicazione dei pesi del modello su Hugging Face (30/06/2025).
- **Costi**: commissione 0.1% e slippage 0.05% per lato. "Netto" = dopo questi costi. Tasse 33% applicate una volta al guadagno complessivo (le perdite compensano i guadagni).
- **Intervalli di confidenza** al 95% con bootstrap a blocchi di tempo: un vantaggio è dimostrato solo se l'intero intervallo è sopra zero.
- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.

### Tutte le coppie

4753 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.3% (IC 95% [47.2, 53.4]) |
| Momentum sugli stessi punti | 50.9% (differenza IC [-5.0, 4.0]) |
| Quante volte il prezzo è salito | 49.7% |
| Brier Kronos / frequenza storica / moneta | 0.341 / 0.253 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.11, -0.06] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 49.0% (atteso 80%) |
| Calibrazione walk-forward (4627 casi) | Brier 0.3385 → 0.256 (frequenza storica 0.2534); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 684 | 3.6% | 48.8% |
| 10-20% | 509 | 13.8% | 46.8% |
| 20-30% | 491 | 24.1% | 48.7% |
| 30-40% | 462 | 33.8% | 51.3% |
| 40-50% | 474 | 44.1% | 51.9% |
| 50-60% | 413 | 53.8% | 49.4% |
| 60-70% | 387 | 63.8% | 51.9% |
| 70-80% | 405 | 74.0% | 49.9% |
| 80-90% | 386 | 84.0% | 52.3% |
| 90-100% | 542 | 95.5% | 47.8% |

Probabilità di chiudere in utile calcolata dalle traiettorie (4753 casi): prevista 68.1%, reale 47.8%; Brier 0.275 contro 0.2506 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 62.8% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 796 | 0.0% | 0.0% |
| 20-40% | 1 | 30.0% | 100.0% |
| 40-60% | 30 | 55.5% | 76.7% |
| 60-80% | 1635 | 72.2% | 64.5% |
| 80-100% | 2291 | 89.1% | 52.2% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 278 | 45.3% | +0.247% | -0.053% | [-1.20%, +1.25%] | -14.9% | -14.9% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 2986 | 53.1% | +0.082% | -0.218% | [-0.60%, +0.16%] | -651.5% | -651.5% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 4753 | 47.8% | +0.029% | -0.271% | [-0.52%, -0.03%] | -1287.0% | -1287.0% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 2213 | 45.5% | -0.034% | -0.334% | [-1.06%, +0.41%] | -739.0% | -739.0% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 4753 | 43.2% | -0.069% | -0.369% | [-0.79%, +0.04%] | -1751.7% | -1751.7% | vantaggio NON dimostrato |
| Momentum | 4753 | 43.9% | +0.217% | -0.083% | [-0.45%, +0.28%] | -394.9% | -394.9% | vantaggio NON dimostrato |
| Sempre long | 4753 | 42.7% | -0.084% | -0.384% | [-0.94%, +0.16%] | -1824.4% | -1824.4% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.96%, +0.36%]. Buy & hold nello stesso periodo: -30.0% lordo, -30.3% netto.

### Timeframe 1d

1473 previsioni dal 01/07/2025 al 03/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 52.1% (IC 95% [45.1, 59.4]) |
| Momentum sugli stessi punti | 53.2% (differenza IC [-10.5, 8.9]) |
| Quante volte il prezzo è salito | 46.9% |
| Brier Kronos / frequenza storica / moneta | 0.3654 / 0.2667 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.16, -0.03] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 44.9% (atteso 80%) |
| Calibrazione walk-forward (1350 casi) | Brier 0.3523 → 0.289 (frequenza storica 0.2593); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 356 | 3.4% | 45.2% |
| 10-20% | 180 | 13.7% | 43.3% |
| 20-30% | 101 | 23.7% | 48.5% |
| 30-40% | 53 | 33.9% | 47.2% |
| 40-50% | 50 | 44.3% | 40.0% |
| 50-60% | 61 | 53.7% | 34.4% |
| 60-70% | 76 | 63.8% | 43.4% |
| 70-80% | 120 | 74.1% | 47.5% |
| 80-90% | 171 | 83.9% | 52.0% |
| 90-100% | 305 | 95.9% | 51.8% |

Probabilità di chiudere in utile calcolata dalle traiettorie (1473 casi): prevista 85.6%, reale 57.1%; Brier 0.3491 contro 0.2536 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 91.2% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 15 | 0.0% | 0.0% |
| 20-40% | 1 | 30.0% | 100.0% |
| 40-60% | 12 | 54.5% | 83.3% |
| 60-80% | 326 | 73.1% | 69.9% |
| 80-100% | 1119 | 90.8% | 53.8% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 195 | 51.8% | +0.439% | +0.139% | [-1.41%, +1.78%] | +27.1% | +18.2% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 1344 | 56.1% | +0.322% | +0.022% | [-0.75%, +0.81%] | +29.9% | +20.0% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 1473 | 57.1% | +0.254% | -0.046% | [-0.75%, +0.68%] | -67.1% | -67.1% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 1037 | 51.4% | +0.132% | -0.168% | [-1.54%, +1.20%] | -174.2% | -174.2% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 1473 | 49.8% | -0.078% | -0.378% | [-1.45%, +0.81%] | -556.3% | -556.3% | vantaggio NON dimostrato |
| Momentum | 1473 | 50.8% | +0.567% | +0.267% | [-0.78%, +1.28%] | +393.4% | +263.6% | vantaggio NON dimostrato |
| Sempre long | 1473 | 44.5% | -0.187% | -0.487% | [-1.99%, +1.08%] | -718.0% | -718.0% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-2.48%, +1.20%]. Buy & hold nello stesso periodo: -30.9% lordo, -31.2% netto.

### Timeframe 4h

1610 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.9% (IC 95% [47.5, 54.3]) |
| Momentum sugli stessi punti | 48.5% (differenza IC [-3.6, 8.2]) |
| Quante volte il prezzo è salito | 51.5% |
| Brier Kronos / frequenza storica / moneta | 0.3275 / 0.2518 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 49.8% (atteso 80%) |
| Calibrazione walk-forward (1508 casi) | Brier 0.3232 → 0.2562 (frequenza storica 0.2516); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 182 | 4.1% | 52.2% |
| 10-20% | 180 | 13.9% | 48.9% |
| 20-30% | 194 | 23.9% | 49.0% |
| 30-40% | 204 | 33.8% | 50.0% |
| 40-50% | 200 | 43.6% | 51.5% |
| 50-60% | 154 | 53.6% | 55.2% |
| 60-70% | 144 | 63.8% | 54.2% |
| 70-80% | 138 | 74.0% | 56.5% |
| 80-90% | 109 | 83.8% | 51.4% |
| 90-100% | 105 | 94.6% | 46.7% |

Probabilità di chiudere in utile calcolata dalle traiettorie (1610 casi): prevista 72.1%, reale 53.7%; Brier 0.2753 contro 0.2498 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 63.7% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 159 | 0.0% | 0.0% |
| 40-60% | 8 | 55.8% | 75.0% |
| 60-80% | 695 | 72.7% | 65.6% |
| 80-100% | 748 | 87.1% | 53.9% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 35 | 34.3% | -0.033% | -0.333% | [-1.37%, +0.94%] | -11.7% | -11.7% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 1025 | 54.1% | -0.094% | -0.394% | [-0.60%, -0.19%] | -404.1% | -404.1% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 1610 | 53.7% | -0.083% | -0.383% | [-0.52%, -0.24%] | -616.4% | -616.4% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 616 | 45.1% | -0.170% | -0.470% | [-0.92%, -0.05%] | -289.3% | -289.3% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 1610 | 46.2% | +0.011% | -0.289% | [-0.53%, -0.03%] | -465.8% | -465.8% | svantaggio dimostrato |
| Momentum | 1610 | 43.3% | -0.027% | -0.327% | [-0.56%, -0.08%] | -526.9% | -526.9% | svantaggio dimostrato |
| Sempre long | 1610 | 46.4% | -0.035% | -0.335% | [-0.62%, -0.04%] | -538.9% | -538.9% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.40%, +0.48%]. Buy & hold nello stesso periodo: -29.8% lordo, -30.1% netto.

### Timeframe 1h

1670 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: svantaggio dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 48.2% (IC 95% [45.2, 51.1]) |
| Momentum sugli stessi punti | 51.1% (differenza IC [-7.9, 2.1]) |
| Quante volte il prezzo è salito | 50.4% |
| Brier Kronos / frequenza storica / moneta | 0.3324 / 0.2515 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.06] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 51.9% (atteso 80%) |
| Calibrazione walk-forward (1570 casi) | Brier 0.3298 → 0.2529 (frequenza storica 0.2511); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 146 | 3.4% | 53.4% |
| 10-20% | 149 | 13.6% | 48.3% |
| 20-30% | 196 | 24.5% | 48.5% |
| 30-40% | 205 | 33.8% | 53.7% |
| 40-50% | 224 | 44.4% | 54.9% |
| 50-60% | 198 | 53.9% | 49.5% |
| 60-70% | 167 | 63.8% | 53.9% |
| 70-80% | 147 | 73.8% | 45.6% |
| 80-90% | 106 | 84.2% | 53.8% |
| 90-100% | 132 | 95.2% | 39.4% |

Probabilità di chiudere in utile calcolata dalle traiettorie (1670 casi): prevista 48.9%, reale 34.0%; Brier 0.2093 contro 0.2262 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 36.9% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 622 | 0.0% | 0.0% |
| 40-60% | 10 | 56.6% | 70.0% |
| 60-80% | 614 | 71.2% | 60.3% |
| 80-100% | 424 | 88.2% | 45.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 48 | 27.1% | -0.332% | -0.632% | [-1.14%, -0.12%] | -30.3% | -30.3% | svantaggio dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 617 | 44.7% | -0.149% | -0.449% | [-0.57%, -0.32%] | -277.3% | -277.3% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 1670 | 34.0% | -0.061% | -0.361% | [-0.42%, -0.31%] | -603.5% | -603.5% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 560 | 35.0% | -0.192% | -0.492% | [-0.69%, -0.31%] | -275.5% | -275.5% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 1670 | 34.6% | -0.137% | -0.437% | [-0.53%, -0.35%] | -729.6% | -729.6% | svantaggio dimostrato |
| Momentum | 1670 | 38.5% | +0.144% | -0.156% | [-0.26%, -0.05%] | -261.3% | -261.3% | svantaggio dimostrato |
| Sempre long | 1670 | 37.5% | -0.040% | -0.340% | [-0.46%, -0.22%] | -567.5% | -567.5% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.46%, -0.12%]. Buy & hold nello stesso periodo: -29.4% lordo, -29.6% netto.

### BTCUSDT 1d

491 previsioni dal 01/07/2025 al 03/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 51.6% (IC 95% [43.4, 59.9]) |
| Momentum sugli stessi punti | 52.3% (differenza IC [-12.2, 10.6]) |
| Quante volte il prezzo è salito | 45.8% |
| Brier Kronos / frequenza storica / moneta | 0.362 / 0.2571 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.18, -0.04] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 45.6% (atteso 80%) |
| Calibrazione walk-forward (384 casi) | Brier 0.3623 → 0.3044 (frequenza storica 0.2534); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 103 | 3.3% | 42.7% |
| 10-20% | 55 | 14.0% | 40.0% |
| 20-30% | 33 | 24.6% | 48.5% |
| 30-40% | 17 | 33.8% | 52.9% |
| 40-50% | 14 | 45.1% | 42.9% |
| 50-60% | 20 | 54.4% | 30.0% |
| 60-70% | 33 | 64.0% | 42.4% |
| 70-80% | 53 | 73.6% | 49.1% |
| 80-90% | 55 | 83.5% | 50.9% |
| 90-100% | 108 | 96.8% | 50.0% |

Probabilità di chiudere in utile calcolata dalle traiettorie (491 casi): prevista 85.1%, reale 58.7%; Brier 0.336 contro 0.251 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 89.2% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 6 | 0.0% | 0.0% |
| 40-60% | 1 | 58.0% | 0.0% |
| 60-80% | 132 | 73.0% | 71.2% |
| 80-100% | 352 | 91.1% | 55.1% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 59 | 47.5% | -0.438% | -0.738% | [-2.62%, +1.31%] | -43.5% | -43.5% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 438 | 58.0% | +0.261% | -0.039% | [-0.70%, +0.64%] | -16.9% | -16.9% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 491 | 58.7% | +0.196% | -0.104% | [-0.70%, +0.51%] | -50.8% | -50.8% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 328 | 52.4% | +0.066% | -0.234% | [-1.40%, +0.94%] | -76.7% | -76.7% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 491 | 49.9% | +0.155% | -0.145% | [-1.12%, +0.86%] | -71.0% | -71.0% | vantaggio NON dimostrato |
| Momentum | 491 | 48.1% | +0.274% | -0.026% | [-0.90%, +0.84%] | -12.5% | -12.5% | vantaggio NON dimostrato |
| Sempre long | 491 | 42.4% | -0.359% | -0.659% | [-1.77%, +0.55%] | -323.4% | -323.4% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-1.74%, +1.45%]. Buy & hold nello stesso periodo: -31.9% lordo, -32.2% netto.

### BTCUSDT 1h

536 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 49.1% (IC 95% [45.0, 53.3]) |
| Momentum sugli stessi punti | 47.8% (differenza IC [-5.5, 8.6]) |
| Quante volte il prezzo è salito | 51.1% |
| Brier Kronos / frequenza storica / moneta | 0.3209 / 0.2522 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.09, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 55.2% (atteso 80%) |
| Calibrazione walk-forward (436 casi) | Brier 0.3202 → 0.2541 (frequenza storica 0.2509); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 32 | 3.7% | 53.1% |
| 10-20% | 54 | 13.5% | 40.7% |
| 20-30% | 73 | 24.7% | 47.9% |
| 30-40% | 66 | 33.9% | 60.6% |
| 40-50% | 71 | 45.1% | 53.5% |
| 50-60% | 55 | 54.0% | 54.5% |
| 60-70% | 53 | 63.6% | 56.6% |
| 70-80% | 57 | 73.9% | 43.9% |
| 80-90% | 30 | 84.1% | 56.7% |
| 90-100% | 45 | 94.7% | 44.4% |

Probabilità di chiudere in utile calcolata dalle traiettorie (536 casi): prevista 37.1%, reale 25.6%; Brier 0.1622 contro 0.1953 della frequenza storica → vantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 25.9% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 274 | 0.0% | 0.0% |
| 40-60% | 7 | 57.1% | 71.4% |
| 60-80% | 169 | 70.4% | 55.6% |
| 80-100% | 86 | 88.5% | 44.2% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 12 | 41.7% | -0.175% | -0.475% | [-1.20%, +0.33%] | -5.7% | -5.7% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 139 | 41.0% | -0.149% | -0.449% | [-0.60%, -0.28%] | -62.5% | -62.5% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 536 | 25.6% | -0.040% | -0.340% | [-0.39%, -0.29%] | -182.3% | -182.3% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 167 | 35.3% | -0.088% | -0.388% | [-0.57%, -0.21%] | -64.8% | -64.8% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 536 | 31.9% | -0.067% | -0.367% | [-0.45%, -0.28%] | -196.8% | -196.8% | svantaggio dimostrato |
| Momentum | 536 | 31.7% | +0.044% | -0.256% | [-0.34%, -0.17%] | -137.4% | -137.4% | svantaggio dimostrato |
| Sempre long | 536 | 32.5% | -0.030% | -0.330% | [-0.42%, -0.24%] | -177.1% | -177.1% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.26%, +0.03%]. Buy & hold nello stesso periodo: -30.3% lordo, -30.6% netto.

### BTCUSDT 4h

516 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.9% (IC 95% [46.3, 55.5]) |
| Momentum sugli stessi punti | 47.7% (differenza IC [-4.2, 10.8]) |
| Quante volte il prezzo è salito | 52.3% |
| Brier Kronos / frequenza storica / moneta | 0.328 / 0.2514 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 49.6% (atteso 80%) |
| Calibrazione walk-forward (415 casi) | Brier 0.3269 → 0.2609 (frequenza storica 0.2515); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 50 | 3.8% | 54.0% |
| 10-20% | 51 | 14.1% | 54.9% |
| 20-30% | 67 | 23.7% | 50.7% |
| 30-40% | 76 | 33.4% | 53.9% |
| 40-50% | 69 | 43.6% | 43.5% |
| 50-60% | 58 | 53.7% | 58.6% |
| 60-70% | 49 | 62.9% | 53.1% |
| 70-80% | 29 | 74.0% | 51.7% |
| 80-90% | 40 | 84.2% | 52.5% |
| 90-100% | 27 | 94.2% | 51.9% |

Probabilità di chiudere in utile calcolata dalle traiettorie (516 casi): prevista 65.2%, reale 46.3%; Brier 0.266 contro 0.2502 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 52.7% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 89 | 0.0% | 0.0% |
| 40-60% | 4 | 55.5% | 50.0% |
| 60-80% | 220 | 72.2% | 61.4% |
| 80-100% | 203 | 86.4% | 50.2% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 11 | 9.1% | -1.045% | -1.345% | [-2.26%, -0.28%] | -14.8% | -14.8% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 272 | 48.5% | -0.191% | -0.491% | [-0.69%, -0.29%] | -133.6% | -133.6% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 516 | 46.3% | -0.122% | -0.422% | [-0.54%, -0.31%] | -217.9% | -217.9% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 186 | 43.0% | -0.210% | -0.510% | [-0.95%, -0.12%] | -94.8% | -94.8% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 516 | 44.6% | -0.088% | -0.388% | [-0.62%, -0.17%] | -200.1% | -200.1% | svantaggio dimostrato |
| Momentum | 516 | 42.4% | +0.047% | -0.253% | [-0.46%, -0.03%] | -130.4% | -130.4% | svantaggio dimostrato |
| Sempre long | 516 | 45.0% | -0.057% | -0.357% | [-0.58%, -0.12%] | -184.2% | -184.2% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.53%, +0.23%]. Buy & hold nello stesso periodo: -29.8% lordo, -30.1% netto.

### ETHUSDT 1d

491 previsioni dal 01/07/2025 al 03/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 53.3% (IC 95% [44.6, 61.8]) |
| Momentum sugli stessi punti | 51.9% (differenza IC [-9.9, 12.7]) |
| Quante volte il prezzo è salito | 48.5% |
| Brier Kronos / frequenza storica / moneta | 0.353 / 0.2643 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.16, -0.02] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 47.9% (atteso 80%) |
| Calibrazione walk-forward (384 casi) | Brier 0.3257 → 0.276 (frequenza storica 0.2552); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 131 | 3.4% | 47.3% |
| 10-20% | 75 | 14.0% | 46.7% |
| 20-30% | 47 | 23.8% | 44.7% |
| 30-40% | 20 | 34.3% | 50.0% |
| 40-50% | 23 | 44.0% | 34.8% |
| 50-60% | 17 | 53.9% | 35.3% |
| 60-70% | 16 | 64.4% | 37.5% |
| 70-80% | 31 | 74.9% | 48.4% |
| 80-90% | 62 | 84.3% | 53.2% |
| 90-100% | 69 | 94.4% | 60.9% |

Probabilità di chiudere in utile calcolata dalle traiettorie (491 casi): prevista 85.1%, reale 56.6%; Brier 0.3453 contro 0.2584 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 92.7% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 4 | 0.0% | 0.0% |
| 40-60% | 5 | 56.4% | 80.0% |
| 60-80% | 114 | 73.6% | 67.5% |
| 80-100% | 368 | 90.0% | 53.5% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 53 | 56.6% | +1.885% | +1.586% | [-0.75%, +4.34%] | +84.0% | +56.3% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 455 | 54.7% | +0.386% | +0.086% | [-0.90%, +1.06%] | +39.0% | +26.1% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 491 | 56.6% | +0.390% | +0.090% | [-0.83%, +1.00%] | +44.0% | +29.5% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 348 | 50.6% | +0.196% | -0.104% | [-1.99%, +1.71%] | -36.3% | -36.3% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 491 | 50.1% | -0.267% | -0.567% | [-2.14%, +1.06%] | -278.4% | -278.4% | vantaggio NON dimostrato |
| Momentum | 491 | 50.3% | +0.443% | +0.143% | [-1.07%, +1.48%] | +70.3% | +47.1% | vantaggio NON dimostrato |
| Sempre long | 491 | 46.2% | +0.151% | -0.149% | [-1.82%, +1.72%] | -73.0% | -73.0% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-3.08%, +1.43%]. Buy & hold nello stesso periodo: -16.9% lordo, -17.2% netto.

### ETHUSDT 1h

576 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 49.5% (IC 95% [45.3, 53.8]) |
| Momentum sugli stessi punti | 53.4% (differenza IC [-10.8, 2.5]) |
| Quante volte il prezzo è salito | 51.2% |
| Brier Kronos / frequenza storica / moneta | 0.3297 / 0.2517 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 51.7% (atteso 80%) |
| Calibrazione walk-forward (476 casi) | Brier 0.3262 → 0.2544 (frequenza storica 0.2508); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 50 | 3.1% | 54.0% |
| 10-20% | 52 | 13.6% | 50.0% |
| 20-30% | 66 | 24.3% | 50.0% |
| 30-40% | 73 | 33.8% | 49.3% |
| 40-50% | 83 | 44.2% | 55.4% |
| 50-60% | 77 | 53.6% | 53.2% |
| 60-70% | 56 | 64.0% | 53.6% |
| 70-80% | 38 | 73.7% | 44.7% |
| 80-90% | 37 | 84.9% | 56.8% |
| 90-100% | 44 | 95.3% | 40.9% |

Probabilità di chiudere in utile calcolata dalle traiettorie (576 casi): prevista 50.9%, reale 35.8%; Brier 0.2173 contro 0.2324 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 38.4% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 201 | 0.0% | 0.0% |
| 40-60% | 2 | 56.0% | 100.0% |
| 60-80% | 219 | 71.3% | 61.2% |
| 80-100% | 154 | 88.2% | 45.5% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 20 | 5.0% | -0.958% | -1.258% | [-1.67%, -0.89%] | -25.2% | -25.2% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 221 | 44.8% | -0.122% | -0.422% | [-0.57%, -0.27%] | -93.2% | -93.2% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 576 | 35.8% | -0.045% | -0.345% | [-0.42%, -0.28%] | -198.6% | -198.6% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 195 | 32.8% | -0.237% | -0.537% | [-0.77%, -0.32%] | -104.7% | -104.7% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 576 | 35.2% | -0.154% | -0.454% | [-0.59%, -0.33%] | -261.7% | -261.7% | svantaggio dimostrato |
| Momentum | 576 | 39.4% | +0.198% | -0.102% | [-0.23%, +0.03%] | -59.0% | -59.0% | vantaggio NON dimostrato |
| Sempre long | 576 | 38.5% | -0.038% | -0.338% | [-0.46%, -0.21%] | -194.6% | -194.6% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.58%, -0.15%]. Buy & hold nello stesso periodo: -14.6% lordo, -14.9% netto.

### ETHUSDT 4h

530 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.8% (IC 95% [46.6, 55.2]) |
| Momentum sugli stessi punti | 49.0% (differenza IC [-5.3, 8.8]) |
| Quante volte il prezzo è salito | 51.1% |
| Brier Kronos / frequenza storica / moneta | 0.3213 / 0.2524 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.04] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 52.3% (atteso 80%) |
| Calibrazione walk-forward (429 casi) | Brier 0.3135 → 0.2621 (frequenza storica 0.2513); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 66 | 4.6% | 47.0% |
| 10-20% | 66 | 13.8% | 43.9% |
| 20-30% | 64 | 24.0% | 53.1% |
| 30-40% | 56 | 34.1% | 46.4% |
| 40-50% | 58 | 44.0% | 60.3% |
| 50-60% | 45 | 53.2% | 51.1% |
| 60-70% | 59 | 64.5% | 54.2% |
| 70-80% | 47 | 73.7% | 59.6% |
| 80-90% | 31 | 82.8% | 45.2% |
| 90-100% | 38 | 95.0% | 50.0% |

Probabilità di chiudere in utile calcolata dalle traiettorie (530 casi): prevista 75.6%, reale 55.3%; Brier 0.2895 contro 0.2502 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 69.2% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 29 | 0.0% | 0.0% |
| 40-60% | 1 | 58.0% | 100.0% |
| 60-80% | 244 | 72.4% | 62.7% |
| 80-100% | 256 | 87.2% | 54.3% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 15 | 46.7% | +0.088% | -0.212% | [-1.42%, +1.08%] | -3.2% | -3.2% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 367 | 54.0% | -0.101% | -0.401% | [-0.66%, -0.17%] | -147.1% | -147.1% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 530 | 55.3% | -0.107% | -0.407% | [-0.60%, -0.21%] | -215.9% | -215.9% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 213 | 46.9% | -0.162% | -0.462% | [-1.01%, +0.08%] | -98.5% | -98.5% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 530 | 46.2% | -0.089% | -0.389% | [-0.73%, -0.06%] | -206.4% | -206.4% | svantaggio dimostrato |
| Momentum | 530 | 43.2% | +0.054% | -0.246% | [-0.56%, +0.07%] | -130.5% | -130.5% | vantaggio NON dimostrato |
| Sempre long | 530 | 46.2% | -0.005% | -0.305% | [-0.65%, +0.05%] | -161.9% | -161.9% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.70%, +0.40%]. Buy & hold nello stesso periodo: -13.6% lordo, -13.9% netto.

### SOLUSDT 1d

491 previsioni dal 01/07/2025 al 03/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 51.5% (IC 95% [42.8, 60.3]) |
| Momentum sugli stessi punti | 55.4% (differenza IC [-16.0, 8.0]) |
| Quante volte il prezzo è salito | 46.4% |
| Brier Kronos / frequenza storica / moneta | 0.3812 / 0.2591 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.20, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 41.3% (atteso 80%) |
| Calibrazione walk-forward (384 casi) | Brier 0.3645 → 0.3115 (frequenza storica 0.2583); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 122 | 3.5% | 45.1% |
| 10-20% | 50 | 13.0% | 42.0% |
| 20-30% | 21 | 22.3% | 57.1% |
| 30-40% | 16 | 33.6% | 37.5% |
| 40-50% | 13 | 43.8% | 46.2% |
| 50-60% | 24 | 53.0% | 37.5% |
| 60-70% | 27 | 63.3% | 48.1% |
| 70-80% | 36 | 74.1% | 44.4% |
| 80-90% | 54 | 83.9% | 51.9% |
| 90-100% | 128 | 96.0% | 48.4% |

Probabilità di chiudere in utile calcolata dalle traiettorie (491 casi): prevista 86.7%, reale 56.0%; Brier 0.3659 contro 0.2532 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 91.9% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 5 | 0.0% | 0.0% |
| 20-40% | 1 | 30.0% | 100.0% |
| 40-60% | 6 | 52.3% | 100.0% |
| 60-80% | 80 | 72.5% | 71.2% |
| 80-100% | 399 | 91.3% | 52.9% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 83 | 51.8% | +0.139% | -0.161% | [-2.45%, +2.29%] | -13.4% | -13.4% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 451 | 55.7% | +0.317% | +0.017% | [-1.01%, +1.14%] | +7.9% | +5.3% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 491 | 56.0% | +0.177% | -0.123% | [-1.18%, +0.91%] | -60.3% | -60.3% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 361 | 51.2% | +0.131% | -0.169% | [-2.12%, +1.67%] | -61.2% | -61.2% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 491 | 49.5% | -0.121% | -0.421% | [-2.03%, +1.18%] | -206.8% | -206.8% | vantaggio NON dimostrato |
| Momentum | 491 | 54.0% | +0.983% | +0.683% | [-0.72%, +2.05%] | +335.6% | +224.8% | vantaggio NON dimostrato |
| Sempre long | 491 | 45.0% | -0.355% | -0.655% | [-2.50%, +1.26%] | -321.5% | -321.5% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-3.60%, +1.28%]. Buy & hold nello stesso periodo: -43.9% lordo, -44.2% netto.

### SOLUSDT 1h

558 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 45.9% (IC 95% [41.8, 49.9]) |
| Momentum sugli stessi punti | 51.9% (differenza IC [-12.5, 0.4]) |
| Quante volte il prezzo è salito | 48.9% |
| Brier Kronos / frequenza storica / moneta | 0.3463 / 0.2518 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.12, -0.07] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 48.7% (atteso 80%) |
| Calibrazione walk-forward (458 casi) | Brier 0.3444 → 0.2537 (frequenza storica 0.2508); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 64 | 3.5% | 53.1% |
| 10-20% | 43 | 13.8% | 55.8% |
| 20-30% | 57 | 24.4% | 47.4% |
| 30-40% | 66 | 33.8% | 51.5% |
| 40-50% | 70 | 44.0% | 55.7% |
| 50-60% | 66 | 54.2% | 40.9% |
| 60-70% | 58 | 63.9% | 51.7% |
| 70-80% | 52 | 73.8% | 48.1% |
| 80-90% | 39 | 83.8% | 48.7% |
| 90-100% | 43 | 95.5% | 32.6% |

Probabilità di chiudere in utile calcolata dalle traiettorie (558 casi): prevista 58.1%, reale 40.3%; Brier 0.2462 contro 0.2422 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 46.1% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 147 | 0.0% | 0.0% |
| 40-60% | 1 | 54.0% | 0.0% |
| 60-80% | 226 | 71.6% | 62.8% |
| 80-100% | 184 | 88.0% | 45.1% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 16 | 43.8% | +0.334% | +0.034% | [-0.88%, +0.93%] | +0.5% | +0.4% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 257 | 46.7% | -0.173% | -0.473% | [-0.64%, -0.31%] | -121.6% | -121.6% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 558 | 40.3% | -0.099% | -0.399% | [-0.49%, -0.31%] | -222.6% | -222.6% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 198 | 36.9% | -0.235% | -0.535% | [-0.79%, -0.28%] | -106.0% | -106.0% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 558 | 36.4% | -0.186% | -0.486% | [-0.64%, -0.33%] | -271.2% | -271.2% | svantaggio dimostrato |
| Momentum | 558 | 44.1% | +0.184% | -0.116% | [-0.26%, +0.03%] | -65.0% | -65.0% | vantaggio NON dimostrato |
| Sempre long | 558 | 41.2% | -0.051% | -0.351% | [-0.49%, -0.20%] | -195.8% | -195.8% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.62%, -0.13%]. Buy & hold nello stesso periodo: -43.1% lordo, -43.4% netto.

### SOLUSDT 4h

564 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 51.1% (IC 95% [46.6, 55.5]) |
| Momentum sugli stessi punti | 48.7% (differenza IC [-5.1, 9.5]) |
| Quante volte il prezzo è salito | 51.1% |
| Brier Kronos / frequenza storica / moneta | 0.333 / 0.2528 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.11, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 47.5% (atteso 80%) |
| Calibrazione walk-forward (463 casi) | Brier 0.3356 → 0.2623 (frequenza storica 0.2518); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 66 | 3.8% | 56.1% |
| 10-20% | 63 | 13.9% | 49.2% |
| 20-30% | 63 | 23.9% | 42.9% |
| 30-40% | 72 | 34.0% | 48.6% |
| 40-50% | 73 | 43.3% | 52.1% |
| 50-60% | 51 | 54.0% | 54.9% |
| 60-70% | 36 | 63.7% | 55.6% |
| 70-80% | 62 | 74.3% | 56.5% |
| 80-90% | 38 | 84.2% | 55.3% |
| 90-100% | 40 | 94.6% | 40.0% |

Probabilità di chiudere in utile calcolata dalle traiettorie (564 casi): prevista 75.2%, reale 59.0%; Brier 0.2705 contro 0.2442 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 68.4% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 41 | 0.0% | 0.0% |
| 40-60% | 3 | 55.3% | 100.0% |
| 60-80% | 231 | 73.4% | 72.7% |
| 80-100% | 289 | 87.5% | 56.1% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 9 | 44.4% | +1.002% | +0.702% | [-1.77%, +3.32%] | +6.3% | +4.2% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 386 | 58.3% | -0.020% | -0.320% | [-0.57%, -0.06%] | -123.4% | -123.4% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 564 | 59.0% | -0.024% | -0.324% | [-0.51%, -0.13%] | -182.6% | -182.6% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 217 | 45.2% | -0.143% | -0.443% | [-1.03%, +0.14%] | -96.0% | -96.0% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 564 | 47.7% | +0.195% | -0.105% | [-0.45%, +0.24%] | -59.3% | -59.3% | vantaggio NON dimostrato |
| Momentum | 564 | 44.1% | -0.172% | -0.472% | [-0.78%, -0.15%] | -266.1% | -266.1% | svantaggio dimostrato |
| Sempre long | 564 | 47.9% | -0.042% | -0.342% | [-0.69%, +0.02%] | -192.8% | -192.8% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.21%, +0.95%]. Buy & hold nello stesso periodo: -45.8% lordo, -46.1% netto.

