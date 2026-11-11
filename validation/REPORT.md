# Validazione storica di Kronos

Generato il 2026-11-11T06:58:17+00:00 · modello Kronos-small · orizzonte 7 candele.

- **Fuori campione**: solo previsioni successive alla data di pubblicazione dei pesi del modello su Hugging Face (30/06/2025).
- **Costi**: commissione 0.1% e slippage 0.05% per lato. "Netto" = dopo questi costi. Tasse 33% applicate una volta al guadagno complessivo (le perdite compensano i guadagni).
- **Intervalli di confidenza** al 95% con bootstrap a blocchi di tempo: un vantaggio è dimostrato solo se l'intero intervallo è sopra zero.
- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.

### Tutte le coppie

3701 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.6% (IC 95% [47.1, 54.1]) |
| Momentum sugli stessi punti | 50.8% (differenza IC [-5.2, 5.0]) |
| Quante volte il prezzo è salito | 49.5% |
| Brier Kronos / frequenza storica / moneta | 0.3445 / 0.2539 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.12, -0.06] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 48.4% (atteso 80%) |
| Calibrazione walk-forward (3578 casi) | Brier 0.3392 → 0.2583 (frequenza storica 0.2554); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 583 | 3.6% | 48.9% |
| 10-20% | 407 | 13.7% | 46.7% |
| 20-30% | 358 | 24.1% | 48.3% |
| 30-40% | 335 | 33.7% | 51.9% |
| 40-50% | 330 | 44.1% | 50.0% |
| 50-60% | 312 | 53.9% | 48.1% |
| 60-70% | 290 | 63.8% | 52.8% |
| 70-80% | 317 | 74.1% | 49.5% |
| 80-90% | 311 | 83.9% | 51.8% |
| 90-100% | 458 | 95.6% | 49.1% |

Probabilità di chiudere in utile calcolata dalle traiettorie (3701 casi): prevista 70.1%, reale 48.9%; Brier 0.2834 contro 0.2515 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 66.0% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 556 | 0.0% | 0.0% |
| 20-40% | 1 | 30.0% | 100.0% |
| 40-60% | 24 | 55.1% | 75.0% |
| 60-80% | 1223 | 72.2% | 65.1% |
| 80-100% | 1897 | 89.4% | 52.3% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 246 | 47.2% | +0.308% | +0.008% | [-1.26%, +1.49%] | +2.1% | +1.4% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 2442 | 53.7% | +0.134% | -0.166% | [-0.62%, +0.28%] | -404.8% | -404.8% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 3701 | 48.9% | +0.061% | -0.239% | [-0.54%, +0.06%] | -884.5% | -884.5% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 1828 | 46.0% | +0.008% | -0.292% | [-1.11%, +0.53%] | -534.3% | -534.3% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 3701 | 43.8% | -0.053% | -0.353% | [-0.86%, +0.14%] | -1306.8% | -1306.8% | vantaggio NON dimostrato |
| Momentum | 3701 | 44.0% | +0.203% | -0.097% | [-0.53%, +0.34%] | -357.7% | -357.7% | vantaggio NON dimostrato |
| Sempre long | 3701 | 42.7% | -0.086% | -0.386% | [-1.04%, +0.26%] | -1429.7% | -1429.7% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-1.05%, +0.51%]. Buy & hold nello stesso periodo: -29.5% lordo, -29.8% netto.

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

1083 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.8% (IC 95% [47.0, 54.7]) |
| Momentum sugli stessi punti | 47.7% (differenza IC [-3.6, 9.5]) |
| Quante volte il prezzo è salito | 51.1% |
| Brier Kronos / frequenza storica / moneta | 0.33 / 0.2524 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 48.0% (atteso 80%) |
| Calibrazione walk-forward (982 casi) | Brier 0.3232 → 0.258 (frequenza storica 0.2527); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 122 | 4.5% | 52.5% |
| 10-20% | 125 | 14.0% | 50.4% |
| 20-30% | 126 | 24.0% | 47.6% |
| 30-40% | 133 | 33.7% | 51.1% |
| 40-50% | 126 | 43.7% | 49.2% |
| 50-60% | 111 | 53.7% | 54.1% |
| 60-70% | 94 | 63.4% | 54.3% |
| 70-80% | 97 | 74.4% | 53.6% |
| 80-90% | 72 | 83.4% | 50.0% |
| 90-100% | 77 | 94.7% | 48.1% |

Probabilità di chiudere in utile calcolata dalle traiettorie (1083 casi): prevista 72.4%, reale 53.8%; Brier 0.2774 contro 0.2497 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 63.9% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 103 | 0.0% | 0.0% |
| 40-60% | 5 | 55.2% | 60.0% |
| 60-80% | 471 | 72.6% | 66.5% |
| 80-100% | 504 | 87.1% | 53.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 17 | 41.2% | +0.382% | +0.082% | [-1.04%, +1.36%] | +1.4% | +0.9% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 692 | 54.2% | -0.065% | -0.365% | [-0.60%, -0.16%] | -252.5% | -252.5% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 1083 | 53.8% | -0.068% | -0.368% | [-0.52%, -0.22%] | -399.0% | -399.0% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 422 | 43.6% | -0.103% | -0.403% | [-0.84%, +0.01%] | -170.2% | -170.2% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 1083 | 45.3% | +0.061% | -0.239% | [-0.49%, +0.01%] | -259.2% | -259.2% | vantaggio NON dimostrato |
| Momentum | 1083 | 42.5% | -0.155% | -0.455% | [-0.70%, -0.19%] | -492.9% | -492.9% | svantaggio dimostrato |
| Sempre long | 1083 | 45.9% | -0.049% | -0.349% | [-0.66%, -0.04%] | -377.9% | -377.9% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.27%, +0.65%]. Buy & hold nello stesso periodo: -29.1% lordo, -29.4% netto.

### Timeframe 1h

1148 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: svantaggio dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 48.5% (IC 95% [44.8, 52.1]) |
| Momentum sugli stessi punti | 50.6% (differenza IC [-8.2, 3.9]) |
| Quante volte il prezzo è salito | 51.3% |
| Brier Kronos / frequenza storica / moneta | 0.3304 / 0.2517 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.06] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 53.1% (atteso 80%) |
| Calibrazione walk-forward (1047 casi) | Brier 0.3264 → 0.2547 (frequenza storica 0.2514); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 107 | 3.4% | 56.1% |
| 10-20% | 103 | 13.4% | 47.6% |
| 20-30% | 131 | 24.5% | 48.9% |
| 30-40% | 149 | 33.7% | 54.4% |
| 40-50% | 154 | 44.3% | 53.9% |
| 50-60% | 140 | 54.1% | 49.3% |
| 60-70% | 120 | 63.9% | 57.5% |
| 70-80% | 100 | 73.9% | 48.0% |
| 80-90% | 68 | 84.2% | 52.9% |
| 90-100% | 76 | 95.1% | 39.5% |

Probabilità di chiudere in utile calcolata dalle traiettorie (1148 casi): prevista 48.0%, reale 33.7%; Brier 0.204 contro 0.2252 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 35.6% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 438 | 0.0% | 0.0% |
| 40-60% | 7 | 56.0% | 71.4% |
| 60-80% | 426 | 71.1% | 59.9% |
| 80-100% | 277 | 88.2% | 45.8% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 34 | 23.5% | -0.477% | -0.777% | [-1.27%, -0.26%] | -26.4% | -26.4% | svantaggio dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 409 | 45.2% | -0.110% | -0.410% | [-0.56%, -0.25%] | -167.5% | -167.5% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 1148 | 33.7% | -0.052% | -0.352% | [-0.41%, -0.29%] | -403.8% | -403.8% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 372 | 34.1% | -0.120% | -0.420% | [-0.62%, -0.20%] | -156.2% | -156.2% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 1148 | 34.8% | -0.099% | -0.399% | [-0.51%, -0.29%] | -457.7% | -457.7% | svantaggio dimostrato |
| Momentum | 1148 | 36.9% | +0.079% | -0.221% | [-0.34%, -0.11%] | -253.4% | -253.4% | svantaggio dimostrato |
| Sempre long | 1148 | 37.4% | -0.022% | -0.322% | [-0.45%, -0.20%] | -369.3% | -369.3% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.36%, +0.00%]. Buy & hold nello stesso periodo: -27.1% lordo, -27.4% netto.

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

373 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 49.6% (IC 95% [44.7, 54.5]) |
| Momentum sugli stessi punti | 48.5% (differenza IC [-7.1, 9.0]) |
| Quante volte il prezzo è salito | 51.5% |
| Brier Kronos / frequenza storica / moneta | 0.3148 / 0.2518 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.09, -0.04] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 57.4% (atteso 80%) |
| Calibrazione walk-forward (273 casi) | Brier 0.3218 → 0.2617 (frequenza storica 0.2509); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 23 | 4.1% | 52.2% |
| 10-20% | 37 | 13.5% | 40.5% |
| 20-30% | 51 | 24.7% | 43.1% |
| 30-40% | 51 | 33.8% | 60.8% |
| 40-50% | 51 | 45.1% | 56.9% |
| 50-60% | 39 | 54.7% | 56.4% |
| 60-70% | 39 | 63.7% | 56.4% |
| 70-80% | 37 | 73.9% | 48.6% |
| 80-90% | 20 | 84.9% | 50.0% |
| 90-100% | 25 | 94.3% | 44.0% |

Probabilità di chiudere in utile calcolata dalle traiettorie (373 casi): prevista 36.6%, reale 26.8%; Brier 0.1522 contro 0.2049 della frequenza storica → vantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 24.4% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 193 | 0.0% | 0.0% |
| 40-60% | 4 | 56.5% | 75.0% |
| 60-80% | 120 | 70.6% | 60.0% |
| 80-100% | 56 | 88.3% | 44.6% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 7 | 28.6% | -0.402% | -0.702% | [-1.41%, +0.19%] | -4.9% | -4.9% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 91 | 42.9% | -0.085% | -0.385% | [-0.57%, -0.18%] | -35.0% | -35.0% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 373 | 26.8% | -0.006% | -0.306% | [-0.36%, -0.25%] | -114.2% | -114.2% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 109 | 33.0% | -0.069% | -0.369% | [-0.57%, -0.17%] | -40.2% | -40.2% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 373 | 32.7% | -0.054% | -0.354% | [-0.45%, -0.26%] | -132.2% | -132.2% | svantaggio dimostrato |
| Momentum | 373 | 31.1% | +0.027% | -0.273% | [-0.37%, -0.17%] | -101.7% | -101.7% | svantaggio dimostrato |
| Sempre long | 373 | 31.1% | -0.051% | -0.351% | [-0.45%, -0.26%] | -131.1% | -131.1% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.23%, +0.07%]. Buy & hold nello stesso periodo: -28.9% lordo, -29.1% netto.

### BTCUSDT 4h

352 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 49.6% (IC 95% [44.3, 54.5]) |
| Momentum sugli stessi punti | 48.7% (differenza IC [-7.6, 9.6]) |
| Quante volte il prezzo è salito | 51.7% |
| Brier Kronos / frequenza storica / moneta | 0.335 / 0.253 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.11, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 46.6% (atteso 80%) |
| Calibrazione walk-forward (252 casi) | Brier 0.3155 → 0.2537 (frequenza storica 0.2509); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 33 | 4.3% | 57.6% |
| 10-20% | 36 | 14.3% | 58.3% |
| 20-30% | 43 | 24.0% | 51.2% |
| 30-40% | 54 | 33.0% | 59.3% |
| 40-50% | 44 | 43.9% | 34.1% |
| 50-60% | 45 | 53.5% | 53.3% |
| 60-70% | 31 | 62.6% | 48.4% |
| 70-80% | 21 | 74.1% | 47.6% |
| 80-90% | 24 | 83.7% | 50.0% |
| 90-100% | 21 | 94.3% | 57.1% |

Probabilità di chiudere in utile calcolata dalle traiettorie (352 casi): prevista 64.4%, reale 44.0%; Brier 0.271 contro 0.2482 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 53.1% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 64 | 0.0% | 0.0% |
| 40-60% | 2 | 55.0% | 0.0% |
| 60-80% | 150 | 72.1% | 61.3% |
| 80-100% | 136 | 86.3% | 46.3% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 5 | 20.0% | -0.259% | -0.559% | [-1.53%, +0.67%] | -2.8% | -2.8% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 187 | 48.1% | -0.178% | -0.478% | [-0.69%, -0.28%] | -89.4% | -89.4% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 352 | 44.0% | -0.143% | -0.443% | [-0.58%, -0.32%] | -156.0% | -156.0% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 125 | 40.8% | -0.101% | -0.401% | [-0.76%, -0.04%] | -50.1% | -50.1% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 352 | 41.8% | -0.060% | -0.360% | [-0.59%, -0.14%] | -126.6% | -126.6% | svantaggio dimostrato |
| Momentum | 352 | 43.2% | +0.010% | -0.290% | [-0.52%, -0.07%] | -102.2% | -102.2% | svantaggio dimostrato |
| Sempre long | 352 | 43.2% | -0.072% | -0.372% | [-0.59%, -0.15%] | -131.0% | -131.0% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.45%, +0.33%]. Buy & hold nello stesso periodo: -30.0% lordo, -30.3% netto.

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

381 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 49.6% (IC 95% [44.5, 55.0]) |
| Momentum sugli stessi punti | 53.4% (differenza IC [-12.1, 4.9]) |
| Quante volte il prezzo è salito | 52.2% |
| Brier Kronos / frequenza storica / moneta | 0.3303 / 0.252 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.11, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 51.4% (atteso 80%) |
| Calibrazione walk-forward (281 casi) | Brier 0.3362 → 0.259 (frequenza storica 0.2506); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 34 | 2.9% | 58.8% |
| 10-20% | 38 | 13.4% | 47.4% |
| 20-30% | 47 | 24.3% | 51.1% |
| 30-40% | 49 | 33.8% | 51.0% |
| 40-50% | 53 | 44.0% | 54.7% |
| 50-60% | 50 | 53.6% | 54.0% |
| 60-70% | 36 | 64.4% | 58.3% |
| 70-80% | 26 | 74.2% | 42.3% |
| 80-90% | 23 | 84.5% | 56.5% |
| 90-100% | 25 | 95.3% | 44.0% |

Probabilità di chiudere in utile calcolata dalle traiettorie (381 casi): prevista 50.4%, reale 33.9%; Brier 0.2245 contro 0.2269 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 37.0% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 134 | 0.0% | 0.0% |
| 40-60% | 2 | 56.0% | 100.0% |
| 60-80% | 148 | 71.3% | 57.4% |
| 80-100% | 97 | 88.2% | 43.3% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 15 | 6.7% | -0.961% | -1.261% | [-1.82%, -0.79%] | -18.9% | -18.9% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 141 | 42.6% | -0.108% | -0.408% | [-0.61%, -0.22%] | -57.5% | -57.5% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 381 | 33.9% | -0.063% | -0.363% | [-0.45%, -0.28%] | -138.3% | -138.3% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 129 | 30.2% | -0.120% | -0.420% | [-0.68%, -0.17%] | -54.2% | -54.2% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 381 | 33.6% | -0.087% | -0.387% | [-0.53%, -0.24%] | -147.5% | -147.5% | svantaggio dimostrato |
| Momentum | 381 | 37.3% | +0.151% | -0.149% | [-0.29%, -0.01%] | -56.7% | -56.7% | svantaggio dimostrato |
| Sempre long | 381 | 38.8% | -0.001% | -0.301% | [-0.45%, -0.16%] | -114.8% | -114.8% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.47%, -0.01%]. Buy & hold nello stesso periodo: -11.6% lordo, -11.9% netto.

### ETHUSDT 4h

332 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.9% (IC 95% [45.1, 56.5]) |
| Momentum sugli stessi punti | 48.1% (differenza IC [-6.5, 12.3]) |
| Quante volte il prezzo è salito | 50.9% |
| Brier Kronos / frequenza storica / moneta | 0.3214 / 0.2543 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.10, -0.03] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 51.2% (atteso 80%) |
| Calibrazione walk-forward (232 casi) | Brier 0.3139 → 0.2568 (frequenza storica 0.2512); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 41 | 5.0% | 48.8% |
| 10-20% | 44 | 13.5% | 45.5% |
| 20-30% | 37 | 24.2% | 48.6% |
| 30-40% | 33 | 34.7% | 42.4% |
| 40-50% | 38 | 43.9% | 63.2% |
| 50-60% | 28 | 53.6% | 53.6% |
| 60-70% | 34 | 64.0% | 55.9% |
| 70-80% | 32 | 74.4% | 53.1% |
| 80-90% | 22 | 82.7% | 50.0% |
| 90-100% | 23 | 95.0% | 47.8% |

Probabilità di chiudere in utile calcolata dalle traiettorie (332 casi): prevista 75.8%, reale 56.0%; Brier 0.2902 contro 0.2491 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 68.4% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 16 | 0.0% | 0.0% |
| 40-60% | 1 | 58.0% | 100.0% |
| 60-80% | 155 | 72.2% | 63.9% |
| 80-100% | 160 | 87.1% | 53.8% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 6 | 50.0% | +0.601% | +0.301% | [-1.30%, +1.91%] | +1.8% | +1.2% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 227 | 54.2% | -0.032% | -0.332% | [-0.64%, -0.04%] | -75.3% | -75.3% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 332 | 56.0% | -0.067% | -0.367% | [-0.57%, -0.16%] | -121.9% | -121.9% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 137 | 43.1% | -0.168% | -0.468% | [-1.02%, +0.08%] | -64.2% | -64.2% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 332 | 45.5% | -0.030% | -0.330% | [-0.71%, +0.03%] | -109.5% | -109.5% | vantaggio NON dimostrato |
| Momentum | 332 | 41.6% | -0.101% | -0.401% | [-0.74%, -0.03%] | -133.0% | -133.0% | svantaggio dimostrato |
| Sempre long | 332 | 46.1% | -0.006% | -0.306% | [-0.66%, +0.07%] | -101.7% | -101.7% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.55%, +0.66%]. Buy & hold nello stesso periodo: -14.6% lordo, -14.8% netto.

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

394 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 46.5% (IC 95% [41.3, 51.4]) |
| Momentum sugli stessi punti | 49.9% (differenza IC [-11.7, 4.9]) |
| Quante volte il prezzo è salito | 50.3% |
| Brier Kronos / frequenza storica / moneta | 0.3452 / 0.2517 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.12, -0.07] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 50.8% (atteso 80%) |
| Calibrazione walk-forward (294 casi) | Brier 0.3537 → 0.2586 (frequenza storica 0.2517); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 50 | 3.5% | 56.0% |
| 10-20% | 28 | 13.4% | 57.1% |
| 20-30% | 33 | 24.4% | 54.5% |
| 30-40% | 49 | 33.5% | 51.0% |
| 40-50% | 50 | 43.8% | 50.0% |
| 50-60% | 51 | 54.2% | 39.2% |
| 60-70% | 45 | 63.8% | 57.8% |
| 70-80% | 37 | 73.6% | 51.4% |
| 80-90% | 25 | 83.3% | 52.0% |
| 90-100% | 26 | 95.5% | 30.8% |

Probabilità di chiudere in utile calcolata dalle traiettorie (394 casi): prevista 56.5%, reale 40.1%; Brier 0.2332 contro 0.2419 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 44.9% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 111 | 0.0% | 0.0% |
| 40-60% | 1 | 54.0% | 0.0% |
| 60-80% | 158 | 71.3% | 62.0% |
| 80-100% | 124 | 88.2% | 48.4% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 12 | 41.7% | +0.084% | -0.216% | [-1.12%, +0.65%] | -2.6% | -2.6% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 177 | 48.6% | -0.124% | -0.424% | [-0.61%, -0.24%] | -75.0% | -75.0% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 394 | 40.1% | -0.084% | -0.384% | [-0.48%, -0.28%] | -151.3% | -151.3% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 134 | 38.8% | -0.162% | -0.462% | [-0.77%, -0.14%] | -61.9% | -61.9% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 394 | 37.8% | -0.152% | -0.452% | [-0.61%, -0.29%] | -178.0% | -178.0% | svantaggio dimostrato |
| Momentum | 394 | 42.1% | +0.059% | -0.241% | [-0.40%, -0.08%] | -95.0% | -95.0% | svantaggio dimostrato |
| Sempre long | 394 | 41.9% | -0.013% | -0.313% | [-0.48%, -0.16%] | -123.5% | -123.5% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.48%, +0.04%]. Buy & hold nello stesso periodo: -40.8% lordo, -41.1% netto.

### SOLUSDT 4h

399 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 51.9% (IC 95% [46.9, 57.1]) |
| Momentum sugli stessi punti | 46.6% (differenza IC [-3.1, 13.6]) |
| Quante volte il prezzo è salito | 50.6% |
| Brier Kronos / frequenza storica / moneta | 0.3328 / 0.2517 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.11, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 46.6% (atteso 80%) |
| Calibrazione walk-forward (299 casi) | Brier 0.3398 → 0.2564 (frequenza storica 0.2512); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 48 | 4.1% | 52.1% |
| 10-20% | 45 | 14.2% | 48.9% |
| 20-30% | 46 | 23.9% | 43.5% |
| 30-40% | 46 | 33.7% | 47.8% |
| 40-50% | 44 | 43.4% | 52.3% |
| 50-60% | 38 | 54.1% | 55.3% |
| 60-70% | 29 | 63.7% | 58.6% |
| 70-80% | 44 | 74.5% | 56.8% |
| 80-90% | 26 | 83.8% | 50.0% |
| 90-100% | 33 | 94.8% | 42.4% |

Probabilità di chiudere in utile calcolata dalle traiettorie (399 casi): prevista 76.6%, reale 60.7%; Brier 0.2724 contro 0.2433 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 69.7% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 23 | 0.0% | 0.0% |
| 40-60% | 2 | 54.0% | 100.0% |
| 60-80% | 166 | 73.5% | 73.5% |
| 80-100% | 208 | 87.7% | 56.7% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 6 | 50.0% | +0.696% | +0.396% | [-2.21%, +3.14%] | +2.4% | +1.6% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 278 | 58.3% | -0.015% | -0.315% | [-0.61%, -0.02%] | -87.7% | -87.7% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 399 | 60.7% | -0.003% | -0.303% | [-0.51%, -0.10%] | -121.1% | -121.1% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 160 | 46.2% | -0.049% | -0.349% | [-0.91%, +0.22%] | -55.9% | -55.9% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 399 | 48.4% | +0.242% | -0.058% | [-0.43%, +0.31%] | -23.0% | -23.0% | vantaggio NON dimostrato |
| Momentum | 399 | 42.6% | -0.346% | -0.646% | [-1.01%, -0.28%] | -257.7% | -257.7% | svantaggio dimostrato |
| Sempre long | 399 | 48.1% | -0.064% | -0.364% | [-0.75%, +0.02%] | -145.2% | -145.2% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.08%, +1.21%]. Buy & hold nello stesso periodo: -42.7% lordo, -43.0% netto.

