# Validazione storica di Kronos

Generato il 2026-11-11T17:44:14+00:00 · modello Kronos-small · orizzonte 7 candele.

- **Fuori campione**: solo previsioni successive alla data di pubblicazione dei pesi del modello su Hugging Face (30/06/2025).
- **Costi**: commissione 0.1% e slippage 0.05% per lato. "Netto" = dopo questi costi. Tasse 33% applicate una volta al guadagno complessivo (le perdite compensano i guadagni).
- **Intervalli di confidenza** al 95% con bootstrap a blocchi di tempo: un vantaggio è dimostrato solo se l'intero intervallo è sopra zero.
- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.

### Tutte le coppie

4736 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.4% (IC 95% [47.3, 53.5]) |
| Momentum sugli stessi punti | 50.8% (differenza IC [-5.0, 4.2]) |
| Quante volte il prezzo è salito | 49.7% |
| Brier Kronos / frequenza storica / moneta | 0.341 / 0.253 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.11, -0.06] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 48.9% (atteso 80%) |
| Calibrazione walk-forward (4610 casi) | Brier 0.3384 → 0.2561 (frequenza storica 0.2535); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 682 | 3.6% | 48.8% |
| 10-20% | 509 | 13.8% | 46.8% |
| 20-30% | 489 | 24.1% | 48.7% |
| 30-40% | 459 | 33.8% | 51.4% |
| 40-50% | 475 | 44.1% | 51.6% |
| 50-60% | 407 | 53.8% | 49.1% |
| 60-70% | 384 | 63.8% | 52.6% |
| 70-80% | 404 | 74.0% | 50.2% |
| 80-90% | 387 | 84.0% | 51.9% |
| 90-100% | 540 | 95.5% | 47.8% |

Probabilità di chiudere in utile calcolata dalle traiettorie (4736 casi): prevista 68.0%, reale 47.7%; Brier 0.2751 contro 0.2506 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 62.7% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 798 | 0.0% | 0.0% |
| 20-40% | 1 | 30.0% | 100.0% |
| 40-60% | 31 | 55.6% | 77.4% |
| 60-80% | 1630 | 72.2% | 64.4% |
| 80-100% | 2276 | 89.1% | 52.1% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 279 | 45.9% | +0.255% | -0.045% | [-1.20%, +1.24%] | -12.6% | -12.6% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 2970 | 53.1% | +0.079% | -0.221% | [-0.61%, +0.16%] | -656.5% | -656.5% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 4736 | 47.7% | +0.026% | -0.274% | [-0.52%, -0.03%] | -1296.4% | -1296.4% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 2210 | 45.3% | -0.054% | -0.354% | [-1.07%, +0.38%] | -782.2% | -782.2% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 4736 | 43.2% | -0.072% | -0.372% | [-0.79%, +0.04%] | -1762.4% | -1762.4% | vantaggio NON dimostrato |
| Momentum | 4736 | 43.9% | +0.215% | -0.085% | [-0.45%, +0.29%] | -403.0% | -403.0% | vantaggio NON dimostrato |
| Sempre long | 4736 | 42.6% | -0.078% | -0.378% | [-0.93%, +0.17%] | -1791.0% | -1791.0% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.96%, +0.36%]. Buy & hold nello stesso periodo: -30.6% lordo, -30.9% netto.

### Timeframe 1d

1470 previsioni dal 01/07/2025 al 02/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 52.0% (IC 95% [45.0, 59.3]) |
| Momentum sugli stessi punti | 53.1% (differenza IC [-10.6, 8.9]) |
| Quante volte il prezzo è salito | 47.0% |
| Brier Kronos / frequenza storica / moneta | 0.3661 / 0.2668 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.16, -0.03] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 45.0% (atteso 80%) |
| Calibrazione walk-forward (1347 casi) | Brier 0.353 → 0.2892 (frequenza storica 0.2594); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 354 | 3.4% | 45.5% |
| 10-20% | 179 | 13.7% | 43.6% |
| 20-30% | 101 | 23.7% | 48.5% |
| 30-40% | 53 | 33.9% | 47.2% |
| 40-50% | 50 | 44.3% | 40.0% |
| 50-60% | 61 | 53.7% | 34.4% |
| 60-70% | 76 | 63.8% | 43.4% |
| 70-80% | 120 | 74.1% | 47.5% |
| 80-90% | 171 | 83.9% | 52.0% |
| 90-100% | 305 | 95.9% | 51.8% |

Probabilità di chiudere in utile calcolata dalle traiettorie (1470 casi): prevista 85.6%, reale 57.0%; Brier 0.3497 contro 0.2537 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 91.2% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 15 | 0.0% | 0.0% |
| 20-40% | 1 | 30.0% | 100.0% |
| 40-60% | 12 | 54.5% | 83.3% |
| 60-80% | 326 | 73.1% | 69.9% |
| 80-100% | 1116 | 90.8% | 53.7% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 195 | 51.8% | +0.439% | +0.139% | [-1.41%, +1.78%] | +27.1% | +18.2% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 1341 | 56.0% | +0.311% | +0.011% | [-0.77%, +0.79%] | +15.2% | +10.2% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 1470 | 57.0% | +0.244% | -0.056% | [-0.77%, +0.67%] | -81.7% | -81.7% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 1034 | 51.3% | +0.099% | -0.201% | [-1.59%, +1.17%] | -207.9% | -207.9% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 1470 | 49.7% | -0.101% | -0.401% | [-1.48%, +0.78%] | -590.0% | -590.0% | vantaggio NON dimostrato |
| Momentum | 1470 | 50.7% | +0.564% | +0.264% | [-0.78%, +1.28%] | +388.6% | +260.4% | vantaggio NON dimostrato |
| Sempre long | 1470 | 44.6% | -0.164% | -0.464% | [-1.97%, +1.10%] | -682.5% | -682.5% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-2.50%, +1.18%]. Buy & hold nello stesso periodo: -32.4% lordo, -32.7% netto.

### Timeframe 4h

1592 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 51.1% (IC 95% [47.6, 54.4]) |
| Momentum sugli stessi punti | 48.5% (differenza IC [-3.4, 8.4]) |
| Quante volte il prezzo è salito | 51.5% |
| Brier Kronos / frequenza storica / moneta | 0.3275 / 0.2518 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 49.7% (atteso 80%) |
| Calibrazione walk-forward (1490 casi) | Brier 0.323 → 0.2569 (frequenza storica 0.2516); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 182 | 4.1% | 52.2% |
| 10-20% | 179 | 13.9% | 48.6% |
| 20-30% | 193 | 23.9% | 49.2% |
| 30-40% | 199 | 33.8% | 49.7% |
| 40-50% | 199 | 43.6% | 51.3% |
| 50-60% | 151 | 53.7% | 55.0% |
| 60-70% | 141 | 63.7% | 55.3% |
| 70-80% | 136 | 74.1% | 56.6% |
| 80-90% | 109 | 83.8% | 51.4% |
| 90-100% | 103 | 94.6% | 46.6% |

Probabilità di chiudere in utile calcolata dalle traiettorie (1592 casi): prevista 72.1%, reale 53.8%; Brier 0.2746 contro 0.2497 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 63.7% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 158 | 0.0% | 0.0% |
| 40-60% | 8 | 55.8% | 75.0% |
| 60-80% | 685 | 72.7% | 65.8% |
| 80-100% | 741 | 87.1% | 54.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 35 | 37.1% | +0.070% | -0.230% | [-1.27%, +1.10%] | -8.1% | -8.1% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 1014 | 54.3% | -0.088% | -0.388% | [-0.61%, -0.20%] | -393.3% | -393.3% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 1592 | 53.8% | -0.079% | -0.379% | [-0.51%, -0.24%] | -603.0% | -603.0% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 613 | 45.2% | -0.178% | -0.478% | [-0.93%, -0.06%] | -293.0% | -293.0% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 1592 | 46.3% | +0.019% | -0.281% | [-0.53%, -0.02%] | -447.1% | -447.1% | svantaggio dimostrato |
| Momentum | 1592 | 43.3% | -0.027% | -0.327% | [-0.56%, -0.08%] | -520.3% | -520.3% | svantaggio dimostrato |
| Sempre long | 1592 | 46.4% | -0.036% | -0.336% | [-0.63%, -0.04%] | -534.4% | -534.4% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.39%, +0.50%]. Buy & hold nello stesso periodo: -30.1% lordo, -30.4% netto.

### Timeframe 1h

1674 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: svantaggio dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 48.3% (IC 95% [45.4, 51.4]) |
| Momentum sugli stessi punti | 50.9% (differenza IC [-7.6, 2.7]) |
| Quante volte il prezzo è salito | 50.4% |
| Brier Kronos / frequenza storica / moneta | 0.3318 / 0.2515 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.06] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 51.6% (atteso 80%) |
| Calibrazione walk-forward (1572 casi) | Brier 0.3292 → 0.2523 (frequenza storica 0.2511); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 146 | 3.5% | 52.7% |
| 10-20% | 151 | 13.6% | 48.3% |
| 20-30% | 195 | 24.5% | 48.2% |
| 30-40% | 207 | 33.8% | 54.1% |
| 40-50% | 226 | 44.4% | 54.4% |
| 50-60% | 195 | 54.0% | 49.2% |
| 60-70% | 167 | 63.9% | 54.5% |
| 70-80% | 148 | 73.8% | 46.6% |
| 80-90% | 107 | 84.2% | 52.3% |
| 90-100% | 132 | 95.2% | 39.4% |

Probabilità di chiudere in utile calcolata dalle traiettorie (1674 casi): prevista 48.8%, reale 33.8%; Brier 0.21 contro 0.2254 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 36.7% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 625 | 0.0% | 0.0% |
| 40-60% | 11 | 56.7% | 72.7% |
| 60-80% | 619 | 71.2% | 59.8% |
| 80-100% | 419 | 88.2% | 44.6% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 49 | 28.6% | -0.345% | -0.645% | [-1.12%, -0.12%] | -31.6% | -31.6% | svantaggio dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 615 | 44.6% | -0.153% | -0.453% | [-0.58%, -0.32%] | -278.4% | -278.4% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 1674 | 33.8% | -0.065% | -0.365% | [-0.42%, -0.31%] | -611.6% | -611.6% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 563 | 34.5% | -0.200% | -0.500% | [-0.68%, -0.33%] | -281.4% | -281.4% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 1674 | 34.5% | -0.133% | -0.433% | [-0.52%, -0.34%] | -725.4% | -725.4% | svantaggio dimostrato |
| Momentum | 1674 | 38.4% | +0.138% | -0.162% | [-0.27%, -0.06%] | -271.3% | -271.3% | svantaggio dimostrato |
| Sempre long | 1674 | 37.3% | -0.043% | -0.343% | [-0.45%, -0.23%] | -574.1% | -574.1% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.44%, -0.11%]. Buy & hold nello stesso periodo: -29.4% lordo, -29.6% netto.

### BTCUSDT 1d

490 previsioni dal 01/07/2025 al 02/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 51.5% (IC 95% [43.3, 59.8]) |
| Momentum sugli stessi punti | 52.2% (differenza IC [-12.2, 10.6]) |
| Quante volte il prezzo è salito | 45.9% |
| Brier Kronos / frequenza storica / moneta | 0.3627 / 0.2572 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.18, -0.04] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 45.5% (atteso 80%) |
| Calibrazione walk-forward (383 casi) | Brier 0.3633 → 0.3046 (frequenza storica 0.2535); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 103 | 3.3% | 42.7% |
| 10-20% | 54 | 14.0% | 40.7% |
| 20-30% | 33 | 24.6% | 48.5% |
| 30-40% | 17 | 33.8% | 52.9% |
| 40-50% | 14 | 45.1% | 42.9% |
| 50-60% | 20 | 54.4% | 30.0% |
| 60-70% | 33 | 64.0% | 42.4% |
| 70-80% | 53 | 73.6% | 49.1% |
| 80-90% | 55 | 83.5% | 50.9% |
| 90-100% | 108 | 96.8% | 50.0% |

Probabilità di chiudere in utile calcolata dalle traiettorie (490 casi): prevista 85.1%, reale 58.6%; Brier 0.3367 contro 0.2512 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 89.2% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 6 | 0.0% | 0.0% |
| 40-60% | 1 | 58.0% | 0.0% |
| 60-80% | 132 | 73.0% | 71.2% |
| 80-100% | 351 | 91.1% | 55.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 59 | 47.5% | -0.438% | -0.738% | [-2.62%, +1.31%] | -43.5% | -43.5% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 437 | 57.9% | +0.254% | -0.046% | [-0.72%, +0.63%] | -20.2% | -20.2% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 490 | 58.6% | +0.190% | -0.110% | [-0.71%, +0.51%] | -54.1% | -54.1% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 327 | 52.3% | +0.042% | -0.258% | [-1.44%, +0.91%] | -84.3% | -84.3% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 490 | 49.8% | +0.140% | -0.160% | [-1.15%, +0.85%] | -78.6% | -78.6% | vantaggio NON dimostrato |
| Momentum | 490 | 48.0% | +0.259% | -0.041% | [-0.92%, +0.83%] | -20.1% | -20.1% | vantaggio NON dimostrato |
| Sempre long | 490 | 42.4% | -0.343% | -0.643% | [-1.76%, +0.57%] | -315.2% | -315.2% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-1.74%, +1.45%]. Buy & hold nello stesso periodo: -32.7% lordo, -33.0% netto.

### BTCUSDT 1h

569 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 48.6% (IC 95% [44.4, 52.5]) |
| Momentum sugli stessi punti | 48.6% (differenza IC [-6.6, 7.0]) |
| Quante volte il prezzo è salito | 50.8% |
| Brier Kronos / frequenza storica / moneta | 0.3244 / 0.2522 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 54.1% (atteso 80%) |
| Calibrazione walk-forward (469 casi) | Brier 0.3238 → 0.2539 (frequenza storica 0.2509); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 36 | 3.6% | 52.8% |
| 10-20% | 57 | 13.5% | 40.4% |
| 20-30% | 75 | 24.8% | 48.0% |
| 30-40% | 70 | 33.9% | 60.0% |
| 40-50% | 76 | 45.1% | 55.3% |
| 50-60% | 57 | 54.1% | 52.6% |
| 60-70% | 55 | 63.7% | 56.4% |
| 70-80% | 61 | 73.9% | 45.9% |
| 80-90% | 34 | 83.9% | 52.9% |
| 90-100% | 48 | 94.7% | 41.7% |

Probabilità di chiudere in utile calcolata dalle traiettorie (569 casi): prevista 37.5%, reale 25.1%; Brier 0.1671 contro 0.1929 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 26.4% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 289 | 0.0% | 0.0% |
| 40-60% | 8 | 57.2% | 75.0% |
| 60-80% | 181 | 70.5% | 54.1% |
| 80-100% | 91 | 88.9% | 42.9% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 15 | 40.0% | -0.297% | -0.597% | [-1.21%, +0.09%] | -8.9% | -8.9% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 150 | 40.7% | -0.161% | -0.461% | [-0.61%, -0.31%] | -69.1% | -69.1% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 569 | 25.1% | -0.050% | -0.350% | [-0.40%, -0.30%] | -199.0% | -199.0% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 181 | 33.7% | -0.153% | -0.453% | [-0.64%, -0.27%] | -82.0% | -82.0% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 569 | 31.5% | -0.090% | -0.390% | [-0.47%, -0.30%] | -221.9% | -221.9% | svantaggio dimostrato |
| Momentum | 569 | 33.0% | +0.070% | -0.230% | [-0.32%, -0.14%] | -130.6% | -130.6% | svantaggio dimostrato |
| Sempre long | 569 | 32.3% | -0.044% | -0.344% | [-0.43%, -0.26%] | -195.8% | -195.8% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.30%, -0.01%]. Buy & hold nello stesso periodo: -30.3% lordo, -30.6% netto.

### BTCUSDT 4h

518 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.9% (IC 95% [46.4, 55.4]) |
| Momentum sugli stessi punti | 47.9% (differenza IC [-3.8, 10.3]) |
| Quante volte il prezzo è salito | 52.1% |
| Brier Kronos / frequenza storica / moneta | 0.3275 / 0.2515 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 49.6% (atteso 80%) |
| Calibrazione walk-forward (417 casi) | Brier 0.3263 → 0.2625 (frequenza storica 0.2516); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 51 | 3.7% | 52.9% |
| 10-20% | 51 | 14.1% | 54.9% |
| 20-30% | 67 | 23.7% | 50.7% |
| 30-40% | 76 | 33.4% | 53.9% |
| 40-50% | 69 | 43.6% | 43.5% |
| 50-60% | 59 | 53.7% | 57.6% |
| 60-70% | 49 | 62.9% | 53.1% |
| 70-80% | 29 | 74.0% | 51.7% |
| 80-90% | 40 | 84.2% | 52.5% |
| 90-100% | 27 | 94.4% | 51.9% |

Probabilità di chiudere in utile calcolata dalle traiettorie (518 casi): prevista 65.3%, reale 46.7%; Brier 0.2637 contro 0.2504 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 52.7% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 89 | 0.0% | 0.0% |
| 40-60% | 4 | 55.5% | 50.0% |
| 60-80% | 221 | 72.3% | 61.5% |
| 80-100% | 204 | 86.5% | 51.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 12 | 16.7% | -0.774% | -1.074% | [-2.01%, +0.07%] | -12.9% | -12.9% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 273 | 49.1% | -0.170% | -0.470% | [-0.66%, -0.26%] | -128.2% | -128.2% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 518 | 46.7% | -0.110% | -0.410% | [-0.53%, -0.29%] | -212.5% | -212.5% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 187 | 43.3% | -0.202% | -0.502% | [-0.93%, -0.11%] | -93.9% | -93.9% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 518 | 44.6% | -0.091% | -0.391% | [-0.63%, -0.16%] | -202.4% | -202.4% | svantaggio dimostrato |
| Momentum | 518 | 42.7% | +0.053% | -0.247% | [-0.47%, -0.03%] | -128.1% | -128.1% | svantaggio dimostrato |
| Sempre long | 518 | 44.8% | -0.069% | -0.369% | [-0.61%, -0.13%] | -191.0% | -191.0% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.54%, +0.24%]. Buy & hold nello stesso periodo: -30.0% lordo, -30.3% netto.

### ETHUSDT 1d

490 previsioni dal 01/07/2025 al 02/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 53.2% (IC 95% [44.5, 61.7]) |
| Momentum sugli stessi punti | 52.0% (differenza IC [-10.1, 12.4]) |
| Quante volte il prezzo è salito | 48.6% |
| Brier Kronos / frequenza storica / moneta | 0.3537 / 0.2643 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.16, -0.02] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 48.0% (atteso 80%) |
| Calibrazione walk-forward (383 casi) | Brier 0.3266 → 0.2762 (frequenza storica 0.2553); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 130 | 3.4% | 47.7% |
| 10-20% | 75 | 14.0% | 46.7% |
| 20-30% | 47 | 23.8% | 44.7% |
| 30-40% | 20 | 34.3% | 50.0% |
| 40-50% | 23 | 44.0% | 34.8% |
| 50-60% | 17 | 53.9% | 35.3% |
| 60-70% | 16 | 64.4% | 37.5% |
| 70-80% | 31 | 74.9% | 48.4% |
| 80-90% | 62 | 84.3% | 53.2% |
| 90-100% | 69 | 94.4% | 60.9% |

Probabilità di chiudere in utile calcolata dalle traiettorie (490 casi): prevista 85.1%, reale 56.5%; Brier 0.346 contro 0.2585 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 92.7% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 4 | 0.0% | 0.0% |
| 40-60% | 5 | 56.4% | 80.0% |
| 60-80% | 114 | 73.6% | 67.5% |
| 80-100% | 367 | 90.0% | 53.4% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 53 | 56.6% | +1.885% | +1.586% | [-0.75%, +4.34%] | +84.0% | +56.3% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 454 | 54.6% | +0.374% | +0.074% | [-0.91%, +1.05%] | +33.4% | +22.4% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 490 | 56.5% | +0.379% | +0.079% | [-0.84%, +0.99%] | +38.5% | +25.8% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 347 | 50.4% | +0.155% | -0.145% | [-2.03%, +1.67%] | -50.5% | -50.5% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 490 | 50.0% | -0.297% | -0.597% | [-2.19%, +1.03%] | -292.6% | -292.6% | vantaggio NON dimostrato |
| Momentum | 490 | 50.4% | +0.474% | +0.174% | [-1.05%, +1.52%] | +85.1% | +57.0% | vantaggio NON dimostrato |
| Sempre long | 490 | 46.3% | +0.181% | -0.119% | [-1.79%, +1.74%] | -58.3% | -58.3% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-3.11%, +1.36%]. Buy & hold nello stesso periodo: -19.0% lordo, -19.3% netto.

### ETHUSDT 1h

546 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.5% (IC 95% [46.1, 54.4]) |
| Momentum sugli stessi punti | 52.5% (differenza IC [-9.0, 4.7]) |
| Quante volte il prezzo è salito | 51.5% |
| Brier Kronos / frequenza storica / moneta | 0.325 / 0.2517 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 51.8% (atteso 80%) |
| Calibrazione walk-forward (446 casi) | Brier 0.3205 → 0.2542 (frequenza storica 0.2507); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 46 | 3.3% | 52.2% |
| 10-20% | 51 | 13.6% | 51.0% |
| 20-30% | 63 | 24.3% | 49.2% |
| 30-40% | 71 | 33.7% | 50.7% |
| 40-50% | 79 | 44.2% | 53.2% |
| 50-60% | 72 | 53.6% | 54.2% |
| 60-70% | 54 | 64.0% | 55.6% |
| 70-80% | 35 | 73.8% | 45.7% |
| 80-90% | 34 | 84.9% | 55.9% |
| 90-100% | 41 | 95.4% | 43.9% |

Probabilità di chiudere in utile calcolata dalle traiettorie (546 casi): prevista 51.1%, reale 36.1%; Brier 0.218 contro 0.2334 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 38.1% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 188 | 0.0% | 0.0% |
| 40-60% | 2 | 56.0% | 100.0% |
| 60-80% | 212 | 71.2% | 61.3% |
| 80-100% | 144 | 88.1% | 45.1% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 18 | 5.6% | -0.990% | -1.290% | [-1.73%, -0.89%] | -23.2% | -23.2% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 208 | 44.7% | -0.122% | -0.422% | [-0.58%, -0.27%] | -87.7% | -87.7% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 546 | 36.1% | -0.048% | -0.348% | [-0.42%, -0.28%] | -189.9% | -189.9% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 184 | 32.6% | -0.207% | -0.507% | [-0.74%, -0.27%] | -93.3% | -93.3% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 546 | 35.5% | -0.131% | -0.431% | [-0.56%, -0.31%] | -235.4% | -235.4% | svantaggio dimostrato |
| Momentum | 546 | 38.3% | +0.168% | -0.132% | [-0.26%, +0.00%] | -72.1% | -72.1% | vantaggio NON dimostrato |
| Sempre long | 546 | 38.6% | -0.028% | -0.328% | [-0.46%, -0.20%] | -178.9% | -178.9% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.52%, -0.10%]. Buy & hold nello stesso periodo: -14.6% lordo, -14.9% netto.

### ETHUSDT 4h

510 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 51.2% (IC 95% [46.4, 55.9]) |
| Momentum sugli stessi punti | 48.8% (differenza IC [-5.3, 10.0]) |
| Quante volte il prezzo è salito | 51.4% |
| Brier Kronos / frequenza storica / moneta | 0.3212 / 0.2524 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.04] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 52.2% (atteso 80%) |
| Calibrazione walk-forward (410 casi) | Brier 0.3137 → 0.2624 (frequenza storica 0.2512); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 65 | 4.6% | 47.7% |
| 10-20% | 65 | 13.7% | 43.1% |
| 20-30% | 63 | 23.9% | 54.0% |
| 30-40% | 51 | 34.2% | 45.1% |
| 40-50% | 57 | 44.0% | 59.6% |
| 50-60% | 41 | 53.2% | 51.2% |
| 60-70% | 56 | 64.5% | 57.1% |
| 70-80% | 45 | 73.8% | 60.0% |
| 80-90% | 31 | 82.8% | 45.2% |
| 90-100% | 36 | 94.7% | 50.0% |

Probabilità di chiudere in utile calcolata dalle traiettorie (510 casi): prevista 75.6%, reale 55.3%; Brier 0.29 contro 0.2502 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 69.6% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 28 | 0.0% | 0.0% |
| 40-60% | 1 | 58.0% | 100.0% |
| 60-80% | 233 | 72.4% | 63.1% |
| 80-100% | 248 | 87.2% | 54.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 14 | 50.0% | +0.194% | -0.106% | [-1.41%, +1.23%] | -1.5% | -1.5% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 355 | 54.1% | -0.099% | -0.399% | [-0.66%, -0.15%] | -141.6% | -141.6% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 510 | 55.3% | -0.108% | -0.408% | [-0.60%, -0.22%] | -207.9% | -207.9% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 209 | 46.9% | -0.193% | -0.493% | [-1.06%, +0.06%] | -103.0% | -103.0% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 510 | 46.5% | -0.063% | -0.363% | [-0.69%, -0.03%] | -185.3% | -185.3% | svantaggio dimostrato |
| Momentum | 510 | 43.1% | +0.053% | -0.247% | [-0.55%, +0.05%] | -126.1% | -126.1% | vantaggio NON dimostrato |
| Sempre long | 510 | 46.3% | +0.005% | -0.295% | [-0.67%, +0.08%] | -150.6% | -150.6% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.64%, +0.40%]. Buy & hold nello stesso periodo: -14.6% lordo, -14.8% netto.

### SOLUSDT 1d

490 previsioni dal 01/07/2025 al 02/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 51.4% (IC 95% [42.7, 60.2]) |
| Momentum sugli stessi punti | 55.3% (differenza IC [-16.0, 8.0]) |
| Quante volte il prezzo è salito | 46.5% |
| Brier Kronos / frequenza storica / moneta | 0.382 / 0.2592 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.20, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 41.4% (atteso 80%) |
| Calibrazione walk-forward (383 casi) | Brier 0.3655 → 0.3118 (frequenza storica 0.2584); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 121 | 3.5% | 45.5% |
| 10-20% | 50 | 13.0% | 42.0% |
| 20-30% | 21 | 22.3% | 57.1% |
| 30-40% | 16 | 33.6% | 37.5% |
| 40-50% | 13 | 43.8% | 46.2% |
| 50-60% | 24 | 53.0% | 37.5% |
| 60-70% | 27 | 63.3% | 48.1% |
| 70-80% | 36 | 74.1% | 44.4% |
| 80-90% | 54 | 83.9% | 51.9% |
| 90-100% | 128 | 96.0% | 48.4% |

Probabilità di chiudere in utile calcolata dalle traiettorie (490 casi): prevista 86.7%, reale 55.9%; Brier 0.3666 contro 0.2533 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 91.8% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 5 | 0.0% | 0.0% |
| 20-40% | 1 | 30.0% | 100.0% |
| 40-60% | 6 | 52.3% | 100.0% |
| 60-80% | 80 | 72.5% | 71.2% |
| 80-100% | 398 | 91.3% | 52.8% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 83 | 51.8% | +0.139% | -0.161% | [-2.45%, +2.29%] | -13.4% | -13.4% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 450 | 55.6% | +0.304% | +0.004% | [-1.04%, +1.12%] | +2.0% | +1.3% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 490 | 55.9% | +0.165% | -0.135% | [-1.20%, +0.90%] | -66.2% | -66.2% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 360 | 51.1% | +0.097% | -0.203% | [-2.17%, +1.64%] | -73.1% | -73.1% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 490 | 49.4% | -0.147% | -0.447% | [-2.05%, +1.15%] | -218.8% | -218.8% | vantaggio NON dimostrato |
| Momentum | 490 | 53.9% | +0.960% | +0.660% | [-0.72%, +2.01%] | +323.6% | +216.8% | vantaggio NON dimostrato |
| Sempre long | 490 | 45.1% | -0.331% | -0.631% | [-2.48%, +1.26%] | -309.0% | -309.0% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-3.61%, +1.28%]. Buy & hold nello stesso periodo: -45.6% lordo, -45.9% netto.

### SOLUSDT 1h

559 previsioni dal 01/07/2025 al 10/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 46.0% (IC 95% [41.9, 50.2]) |
| Momentum sugli stessi punti | 51.8% (differenza IC [-12.6, 0.5]) |
| Quante volte il prezzo è salito | 48.8% |
| Brier Kronos / frequenza storica / moneta | 0.346 / 0.2517 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.12, -0.07] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 48.7% (atteso 80%) |
| Calibrazione walk-forward (459 casi) | Brier 0.344 → 0.2537 (frequenza storica 0.2508); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 64 | 3.5% | 53.1% |
| 10-20% | 43 | 13.8% | 55.8% |
| 20-30% | 57 | 24.4% | 47.4% |
| 30-40% | 66 | 33.8% | 51.5% |
| 40-50% | 71 | 44.0% | 54.9% |
| 50-60% | 66 | 54.2% | 40.9% |
| 60-70% | 58 | 63.9% | 51.7% |
| 70-80% | 52 | 73.8% | 48.1% |
| 80-90% | 39 | 83.8% | 48.7% |
| 90-100% | 43 | 95.5% | 32.6% |

Probabilità di chiudere in utile calcolata dalle traiettorie (559 casi): prevista 58.0%, reale 40.3%; Brier 0.2457 contro 0.242 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 46.0% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 148 | 0.0% | 0.0% |
| 40-60% | 1 | 54.0% | 0.0% |
| 60-80% | 226 | 71.6% | 62.8% |
| 80-100% | 184 | 88.0% | 45.1% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 16 | 43.8% | +0.334% | +0.034% | [-0.88%, +0.93%] | +0.5% | +0.4% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 257 | 46.7% | -0.173% | -0.473% | [-0.64%, -0.31%] | -121.6% | -121.6% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 559 | 40.3% | -0.098% | -0.398% | [-0.49%, -0.31%] | -222.7% | -222.7% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 198 | 36.9% | -0.235% | -0.535% | [-0.79%, -0.28%] | -106.0% | -106.0% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 559 | 36.5% | -0.180% | -0.480% | [-0.62%, -0.33%] | -268.1% | -268.1% | svantaggio dimostrato |
| Momentum | 559 | 44.0% | +0.177% | -0.123% | [-0.26%, +0.02%] | -68.6% | -68.6% | vantaggio NON dimostrato |
| Sempre long | 559 | 41.1% | -0.057% | -0.357% | [-0.50%, -0.21%] | -199.4% | -199.4% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.59%, -0.11%]. Buy & hold nello stesso periodo: -43.1% lordo, -43.4% netto.

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

