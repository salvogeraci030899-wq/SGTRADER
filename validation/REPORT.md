# Validazione storica di Kronos

Generato il 2026-11-11T01:10:58+00:00 · modello Kronos-small · orizzonte 7 candele.

- **Fuori campione**: solo previsioni successive alla data di pubblicazione dei pesi del modello su Hugging Face (30/06/2025).
- **Costi**: commissione 0.1% e slippage 0.05% per lato. "Netto" = dopo questi costi. Tasse 33% applicate una volta al guadagno complessivo (le perdite compensano i guadagni).
- **Intervalli di confidenza** al 95% con bootstrap a blocchi di tempo: un vantaggio è dimostrato solo se l'intero intervallo è sopra zero.
- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.

### Tutte le coppie

2159 previsioni dal 01/07/2025 al 09/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.2% (IC 95% [46.4, 54.2]) |
| Momentum sugli stessi punti | 51.3% (differenza IC [-6.4, 4.2]) |
| Quante volte il prezzo è salito | 48.9% |
| Brier Kronos / frequenza storica / moneta | 0.3442 / 0.2547 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.12, -0.06] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 47.7% (atteso 80%) |
| Calibrazione walk-forward (2043 casi) | Brier 0.3365 → 0.2596 (frequenza storica 0.2548); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 363 | 3.7% | 47.4% |
| 10-20% | 252 | 13.6% | 46.8% |
| 20-30% | 206 | 24.1% | 47.6% |
| 30-40% | 182 | 33.7% | 52.7% |
| 40-50% | 192 | 44.1% | 52.6% |
| 50-60% | 182 | 53.9% | 47.3% |
| 60-70% | 156 | 63.9% | 44.9% |
| 70-80% | 181 | 73.9% | 47.0% |
| 80-90% | 176 | 84.0% | 51.1% |
| 90-100% | 269 | 95.5% | 52.0% |

Probabilità di chiudere in utile calcolata dalle traiettorie (2159 casi): prevista 70.6%, reale 49.5%; Brier 0.2808 contro 0.2521 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 67.3% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 316 | 0.0% | 0.0% |
| 40-60% | 16 | 54.6% | 87.5% |
| 60-80% | 708 | 72.2% | 64.4% |
| 80-100% | 1119 | 89.7% | 53.5% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 162 | 54.3% | +1.085% | +0.785% | [-0.66%, +2.24%] | +127.2% | +85.2% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 1453 | 55.1% | +0.324% | +0.024% | [-0.47%, +0.54%] | +34.9% | +23.4% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 2159 | 49.5% | +0.192% | -0.108% | [-0.44%, +0.23%] | -232.6% | -232.6% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 1101 | 47.7% | +0.214% | -0.086% | [-0.95%, +0.80%] | -94.6% | -94.6% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 2159 | 44.0% | +0.028% | -0.272% | [-0.82%, +0.26%] | -588.2% | -588.2% | vantaggio NON dimostrato |
| Momentum | 2159 | 44.5% | +0.242% | -0.058% | [-0.57%, +0.44%] | -124.7% | -124.7% | vantaggio NON dimostrato |
| Sempre long | 2159 | 42.2% | -0.171% | -0.471% | [-1.20%, +0.26%] | -1017.3% | -1017.3% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-1.07%, +0.62%]. Buy & hold nello stesso periodo: -29.5% lordo, -29.8% netto.

### Timeframe 1d

941 previsioni dal 01/07/2025 al 02/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 54.1% (IC 95% [47.0, 61.4]) |
| Momentum sugli stessi punti | 52.3% (differenza IC [-7.3, 11.5]) |
| Quante volte il prezzo è salito | 46.7% |
| Brier Kronos / frequenza storica / moneta | 0.3528 / 0.2643 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.15, -0.02] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 44.8% (atteso 80%) |
| Calibrazione walk-forward (825 casi) | Brier 0.3375 → 0.2949 (frequenza storica 0.2574); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 235 | 3.4% | 43.8% |
| 10-20% | 112 | 13.7% | 43.8% |
| 20-30% | 66 | 23.6% | 42.4% |
| 30-40% | 37 | 33.9% | 45.9% |
| 40-50% | 31 | 44.0% | 32.3% |
| 50-60% | 40 | 53.6% | 35.0% |
| 60-70% | 45 | 63.8% | 44.4% |
| 70-80% | 75 | 74.1% | 46.7% |
| 80-90% | 107 | 84.1% | 50.5% |
| 90-100% | 193 | 95.9% | 56.5% |

Probabilità di chiudere in utile calcolata dalle traiettorie (941 casi): prevista 85.4%, reale 59.0%; Brier 0.3316 contro 0.2509 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 91.2% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 11 | 0.0% | 0.0% |
| 40-60% | 11 | 54.2% | 90.9% |
| 60-80% | 215 | 73.1% | 70.2% |
| 80-100% | 704 | 90.9% | 56.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 134 | 59.0% | +1.308% | +1.008% | [-0.69%, +2.70%] | +135.1% | +90.5% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 858 | 58.2% | +0.609% | +0.309% | [-0.54%, +1.11%] | +264.9% | +177.5% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 941 | 59.0% | +0.535% | +0.235% | [-0.54%, +0.97%] | +221.1% | +148.2% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 665 | 53.1% | +0.435% | +0.135% | [-1.26%, +1.54%] | +89.7% | +60.1% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 941 | 51.5% | +0.169% | -0.131% | [-1.24%, +1.04%] | -123.7% | -123.7% | vantaggio NON dimostrato |
| Momentum | 941 | 49.9% | +0.573% | +0.273% | [-0.81%, +1.36%] | +257.2% | +172.3% | vantaggio NON dimostrato |
| Sempre long | 941 | 44.6% | -0.254% | -0.554% | [-2.17%, +1.12%] | -520.9% | -520.9% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-2.28%, +1.40%]. Buy & hold nello stesso periodo: -31.7% lordo, -32.0% netto.

### Timeframe 4h

598 previsioni dal 01/07/2025 al 07/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 47.8% (IC 95% [42.9, 52.7]) |
| Momentum sugli stessi punti | 49.3% (differenza IC [-9.9, 7.5]) |
| Quante volte il prezzo è salito | 51.3% |
| Brier Kronos / frequenza storica / moneta | 0.343 / 0.2555 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.12, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 45.2% (atteso 80%) |
| Calibrazione walk-forward (496 casi) | Brier 0.3371 → 0.2623 (frequenza storica 0.2528); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 73 | 4.7% | 50.7% |
| 10-20% | 78 | 13.8% | 56.4% |
| 20-30% | 67 | 24.3% | 50.7% |
| 30-40% | 71 | 33.2% | 53.5% |
| 40-50% | 71 | 43.7% | 52.1% |
| 50-60% | 70 | 53.7% | 60.0% |
| 60-70% | 50 | 63.8% | 40.0% |
| 70-80% | 47 | 73.8% | 44.7% |
| 80-90% | 34 | 83.5% | 44.1% |
| 90-100% | 37 | 94.2% | 51.4% |

Probabilità di chiudere in utile calcolata dalle traiettorie (598 casi): prevista 71.6%, reale 51.0%; Brier 0.2866 contro 0.2519 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 62.5% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 61 | 0.0% | 0.0% |
| 40-60% | 3 | 55.3% | 66.7% |
| 60-80% | 265 | 72.5% | 62.3% |
| 80-100% | 269 | 87.2% | 51.3% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 8 | 50.0% | +0.689% | +0.389% | [-1.04%, +2.17%] | +3.1% | +2.1% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 374 | 52.4% | -0.114% | -0.414% | [-0.71%, -0.12%] | -155.0% | -155.0% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 598 | 51.0% | -0.126% | -0.426% | [-0.64%, -0.23%] | -254.5% | -254.5% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 235 | 41.7% | -0.132% | -0.432% | [-0.92%, +0.07%] | -101.4% | -101.4% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 598 | 42.3% | +0.018% | -0.282% | [-0.60%, +0.04%] | -168.8% | -168.8% | vantaggio NON dimostrato |
| Momentum | 598 | 43.6% | -0.142% | -0.442% | [-0.78%, -0.08%] | -264.3% | -264.3% | svantaggio dimostrato |
| Sempre long | 598 | 45.5% | -0.080% | -0.380% | [-0.76%, +0.07%] | -227.4% | -227.4% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.47%, +0.74%]. Buy & hold nello stesso periodo: -26.4% lordo, -26.7% netto.

### Timeframe 1h

620 previsioni dal 03/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 46.5% (IC 95% [41.7, 51.1]) |
| Momentum sugli stessi punti | 51.8% (differenza IC [-13.2, 2.3]) |
| Quante volte il prezzo è salito | 50.0% |
| Brier Kronos / frequenza storica / moneta | 0.3324 / 0.2525 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.11, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 54.5% (atteso 80%) |
| Calibrazione walk-forward (519 casi) | Brier 0.3299 → 0.258 (frequenza storica 0.252); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 55 | 3.3% | 58.2% |
| 10-20% | 62 | 13.1% | 40.3% |
| 20-30% | 73 | 24.5% | 49.3% |
| 30-40% | 74 | 34.0% | 55.4% |
| 40-50% | 90 | 44.4% | 60.0% |
| 50-60% | 72 | 54.2% | 41.7% |
| 60-70% | 61 | 64.1% | 49.2% |
| 70-80% | 59 | 73.8% | 49.2% |
| 80-90% | 35 | 84.1% | 60.0% |
| 90-100% | 39 | 94.9% | 30.8% |

Probabilità di chiudere in utile calcolata dalle traiettorie (620 casi): prevista 47.0%, reale 33.7%; Brier 0.198 contro 0.227 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 35.6% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 244 | 0.0% | 0.0% |
| 40-60% | 2 | 56.0% | 100.0% |
| 60-80% | 228 | 71.0% | 61.4% |
| 80-100% | 146 | 88.1% | 45.9% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 20 | 25.0% | -0.252% | -0.552% | [-1.05%, +0.00%] | -11.0% | -11.0% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 221 | 48.0% | -0.039% | -0.339% | [-0.55%, -0.14%] | -74.9% | -74.9% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 620 | 33.7% | -0.021% | -0.321% | [-0.41%, -0.23%] | -199.2% | -199.2% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 201 | 36.8% | -0.112% | -0.412% | [-0.70%, -0.14%] | -82.9% | -82.9% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 620 | 34.4% | -0.177% | -0.477% | [-0.64%, -0.33%] | -295.7% | -295.7% | svantaggio dimostrato |
| Momentum | 620 | 36.9% | +0.110% | -0.190% | [-0.34%, -0.05%] | -117.6% | -117.6% | svantaggio dimostrato |
| Sempre long | 620 | 35.3% | -0.134% | -0.434% | [-0.61%, -0.27%] | -269.0% | -269.0% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.54%, -0.03%]. Buy & hold nello stesso periodo: -30.4% lordo, -30.7% netto.

### BTCUSDT 1d

247 previsioni dal 01/07/2025 al 01/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 52.0% (IC 95% [42.8, 60.8]) |
| Momentum sugli stessi punti | 49.6% (differenza IC [-9.7, 14.7]) |
| Quante volte il prezzo è salito | 46.2% |
| Brier Kronos / frequenza storica / moneta | 0.3545 / 0.2551 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.18, -0.03] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 44.5% (atteso 80%) |
| Calibrazione walk-forward (144 casi) | Brier 0.3723 → 0.3034 (frequenza storica 0.2539); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 56 | 3.6% | 39.3% |
| 10-20% | 24 | 15.1% | 45.8% |
| 20-30% | 14 | 24.1% | 42.9% |
| 30-40% | 11 | 33.5% | 54.5% |
| 40-50% | 5 | 45.6% | 60.0% |
| 50-60% | 11 | 54.2% | 27.3% |
| 60-70% | 16 | 64.4% | 43.8% |
| 70-80% | 26 | 73.4% | 46.2% |
| 80-90% | 31 | 83.6% | 54.8% |
| 90-100% | 53 | 97.2% | 50.9% |

Probabilità di chiudere in utile calcolata dalle traiettorie (247 casi): prevista 84.8%, reale 59.9%; Brier 0.3193 contro 0.2449 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 88.7% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 4 | 0.0% | 0.0% |
| 60-80% | 68 | 73.0% | 72.1% |
| 80-100% | 175 | 91.2% | 56.6% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 34 | 58.8% | -0.232% | -0.532% | [-2.33%, +1.28%] | -18.1% | -18.1% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 219 | 59.8% | +0.336% | +0.036% | [-0.66%, +0.74%] | +7.8% | +5.2% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 247 | 59.9% | +0.272% | -0.028% | [-0.65%, +0.60%] | -6.9% | -6.9% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 168 | 54.8% | +0.109% | -0.191% | [-1.40%, +1.03%] | -32.2% | -32.2% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 247 | 50.6% | +0.186% | -0.114% | [-1.10%, +0.89%] | -28.3% | -28.3% | vantaggio NON dimostrato |
| Momentum | 247 | 45.7% | +0.083% | -0.217% | [-1.10%, +0.68%] | -53.5% | -53.5% | vantaggio NON dimostrato |
| Sempre long | 247 | 43.3% | -0.352% | -0.652% | [-1.81%, +0.66%] | -161.1% | -161.1% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-1.57%, +1.66%]. Buy & hold nello stesso periodo: -30.5% lordo, -30.8% netto.

### BTCUSDT 1h

208 previsioni dal 03/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 48.3% (IC 95% [41.5, 55.1]) |
| Momentum sugli stessi punti | 51.2% (differenza IC [-13.5, 7.2]) |
| Quante volte il prezzo è salito | 51.0% |
| Brier Kronos / frequenza storica / moneta | 0.3105 / 0.2524 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.09, -0.02] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 60.1% (atteso 80%) |
| Calibrazione walk-forward (108 casi) | Brier 0.3341 → 0.2622 (frequenza storica 0.2519); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 10 | 4.2% | 50.0% |
| 10-20% | 26 | 13.2% | 34.6% |
| 20-30% | 31 | 24.6% | 45.2% |
| 30-40% | 26 | 34.3% | 65.4% |
| 40-50% | 32 | 45.2% | 62.5% |
| 50-60% | 20 | 55.7% | 55.0% |
| 60-70% | 18 | 64.3% | 38.9% |
| 70-80% | 21 | 73.9% | 52.4% |
| 80-90% | 9 | 84.9% | 66.7% |
| 90-100% | 15 | 93.7% | 40.0% |

Probabilità di chiudere in utile calcolata dalle traiettorie (208 casi): prevista 35.2%, reale 28.4%; Brier 0.1335 contro 0.2155 della frequenza storica → vantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 25.0% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 111 | 0.0% | 0.0% |
| 60-80% | 69 | 70.3% | 65.2% |
| 80-100% | 28 | 88.5% | 50.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 2 | 50.0% | -0.102% | -0.402% | n/d | -0.8% | -0.8% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 52 | 51.9% | +0.028% | -0.272% | [-0.54%, -0.03%] | -14.2% | -14.2% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 208 | 28.4% | +0.040% | -0.260% | [-0.34%, -0.18%] | -54.0% | -54.0% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 63 | 39.7% | +0.018% | -0.282% | [-0.54%, -0.03%] | -17.7% | -17.7% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 208 | 33.7% | -0.066% | -0.366% | [-0.50%, -0.23%] | -76.1% | -76.1% | svantaggio dimostrato |
| Momentum | 208 | 31.2% | +0.029% | -0.271% | [-0.40%, -0.14%] | -56.3% | -56.3% | svantaggio dimostrato |
| Sempre long | 208 | 28.4% | -0.122% | -0.422% | [-0.55%, -0.29%] | -87.8% | -87.8% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.28%, +0.09%]. Buy & hold nello stesso periodo: -30.8% lordo, -31.1% netto.

### BTCUSDT 4h

198 previsioni dal 01/07/2025 al 07/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 45.0% (IC 95% [37.7, 52.4]) |
| Momentum sugli stessi punti | 48.7% (differenza IC [-15.2, 7.8]) |
| Quante volte il prezzo è salito | 53.0% |
| Brier Kronos / frequenza storica / moneta | 0.3504 / 0.253 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.14, -0.06] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 46.0% (atteso 80%) |
| Calibrazione walk-forward (98 casi) | Brier 0.323 → 0.2599 (frequenza storica 0.25); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 20 | 4.4% | 55.0% |
| 10-20% | 25 | 14.5% | 56.0% |
| 20-30% | 26 | 23.8% | 61.5% |
| 30-40% | 27 | 32.9% | 70.4% |
| 40-50% | 22 | 43.5% | 36.4% |
| 50-60% | 28 | 53.1% | 57.1% |
| 60-70% | 18 | 63.3% | 33.3% |
| 70-80% | 12 | 73.5% | 33.3% |
| 80-90% | 12 | 83.5% | 50.0% |
| 90-100% | 8 | 92.5% | 62.5% |

Probabilità di chiudere in utile calcolata dalle traiettorie (198 casi): prevista 64.9%, reale 40.9%; Brier 0.2892 contro 0.2446 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 54.5% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 34 | 0.0% | 0.0% |
| 40-60% | 1 | 58.0% | 0.0% |
| 60-80% | 90 | 72.4% | 53.3% |
| 80-100% | 73 | 85.8% | 45.2% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 2 | 50.0% | +1.030% | +0.730% | n/d | +1.5% | +1.0% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 108 | 47.2% | -0.174% | -0.474% | [-0.75%, -0.20%] | -51.2% | -51.2% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 198 | 40.9% | -0.207% | -0.507% | [-0.69%, -0.34%] | -100.4% | -100.4% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 73 | 39.7% | -0.102% | -0.402% | [-0.88%, +0.06%] | -29.4% | -29.4% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 198 | 36.4% | -0.161% | -0.461% | [-0.78%, -0.18%] | -91.2% | -91.2% | svantaggio dimostrato |
| Momentum | 198 | 41.4% | -0.076% | -0.376% | [-0.67%, -0.07%] | -74.4% | -74.4% | svantaggio dimostrato |
| Sempre long | 198 | 42.4% | -0.095% | -0.395% | [-0.70%, -0.09%] | -78.2% | -78.2% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.60%, +0.42%]. Buy & hold nello stesso periodo: -27.9% lordo, -28.2% netto.

### ETHUSDT 1d

350 previsioni dal 01/07/2025 al 02/11/2026. **Segnali operativi: vantaggio dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 55.5% (IC 95% [47.0, 63.7]) |
| Momentum sugli stessi punti | 51.4% (differenza IC [-8.2, 15.4]) |
| Quante volte il prezzo è salito | 47.7% |
| Brier Kronos / frequenza storica / moneta | 0.3405 / 0.2636 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.14, -0.01] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 48.0% (atteso 80%) |
| Calibrazione walk-forward (245 casi) | Brier 0.325 → 0.253 (frequenza storica 0.254); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 93 | 3.3% | 47.3% |
| 10-20% | 51 | 13.8% | 43.1% |
| 20-30% | 37 | 24.1% | 43.2% |
| 30-40% | 14 | 34.7% | 50.0% |
| 40-50% | 18 | 43.3% | 22.2% |
| 50-60% | 13 | 54.0% | 30.8% |
| 60-70% | 10 | 63.8% | 50.0% |
| 70-80% | 20 | 74.6% | 45.0% |
| 80-90% | 39 | 84.5% | 46.2% |
| 90-100% | 55 | 94.5% | 69.1% |

Probabilità di chiudere in utile calcolata dalle traiettorie (350 casi): prevista 85.0%, reale 58.6%; Brier 0.3303 contro 0.254 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 92.3% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 3 | 0.0% | 0.0% |
| 40-60% | 5 | 56.4% | 80.0% |
| 60-80% | 87 | 73.6% | 69.0% |
| 80-100% | 255 | 90.5% | 55.3% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 39 | 64.1% | +2.996% | +2.696% | [+0.36%, +5.45%] | +105.2% | +70.5% | vantaggio dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 323 | 56.7% | +0.690% | +0.390% | [-0.65%, +1.40%] | +126.0% | +84.4% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 350 | 58.6% | +0.685% | +0.385% | [-0.58%, +1.33%] | +134.6% | +90.2% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 246 | 51.6% | +0.660% | +0.360% | [-1.66%, +2.21%] | +88.5% | +59.3% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 350 | 51.7% | +0.064% | -0.236% | [-1.94%, +1.42%] | -82.7% | -82.7% | vantaggio NON dimostrato |
| Momentum | 350 | 49.1% | +0.342% | +0.042% | [-1.15%, +1.34%] | +14.7% | +9.9% | vantaggio NON dimostrato |
| Sempre long | 350 | 45.7% | +0.003% | -0.297% | [-2.04%, +1.58%] | -103.8% | -103.8% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-2.65%, +1.80%]. Buy & hold nello stesso periodo: -19.0% lordo, -19.3% netto.

### ETHUSDT 1h

215 previsioni dal 03/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 47.6% (IC 95% [40.9, 54.8]) |
| Momentum sugli stessi punti | 53.8% (differenza IC [-17.1, 5.2]) |
| Quante volte il prezzo è salito | 50.7% |
| Brier Kronos / frequenza storica / moneta | 0.3402 / 0.2523 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.13, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 51.2% (atteso 80%) |
| Calibrazione walk-forward (115 casi) | Brier 0.3428 → 0.2524 (frequenza storica 0.2519); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 19 | 2.6% | 57.9% |
| 10-20% | 23 | 12.6% | 52.2% |
| 20-30% | 24 | 23.8% | 41.7% |
| 30-40% | 25 | 33.4% | 52.0% |
| 40-50% | 32 | 44.0% | 59.4% |
| 50-60% | 28 | 53.5% | 50.0% |
| 60-70% | 20 | 64.6% | 55.0% |
| 70-80% | 17 | 73.3% | 41.2% |
| 80-90% | 15 | 84.5% | 60.0% |
| 90-100% | 12 | 95.5% | 25.0% |

Probabilità di chiudere in utile calcolata dalle traiettorie (215 casi): prevista 51.3%, reale 34.0%; Brier 0.2316 contro 0.2269 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 36.7% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 73 | 0.0% | 0.0% |
| 40-60% | 2 | 56.0% | 100.0% |
| 60-80% | 84 | 71.5% | 54.8% |
| 80-100% | 56 | 87.9% | 44.6% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 11 | 9.1% | -0.759% | -1.059% | [-1.57%, -0.57%] | -11.7% | -11.7% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 79 | 44.3% | -0.103% | -0.403% | [-0.66%, -0.16%] | -31.9% | -31.9% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 215 | 34.0% | -0.061% | -0.361% | [-0.47%, -0.25%] | -77.7% | -77.7% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 75 | 30.7% | -0.185% | -0.485% | [-0.85%, -0.11%] | -36.3% | -36.3% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 215 | 33.5% | -0.203% | -0.503% | [-0.70%, -0.31%] | -108.1% | -108.1% | svantaggio dimostrato |
| Momentum | 215 | 39.1% | +0.218% | -0.082% | [-0.28%, +0.11%] | -17.6% | -17.6% | vantaggio NON dimostrato |
| Sempre long | 215 | 38.1% | -0.097% | -0.397% | [-0.59%, -0.20%] | -85.5% | -85.5% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.76%, -0.08%]. Buy & hold nello stesso periodo: -17.0% lordo, -17.3% netto.

### ETHUSDT 4h

166 previsioni dal 03/07/2025 al 05/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 47.6% (IC 95% [39.6, 54.9]) |
| Momentum sugli stessi punti | 49.4% (differenza IC [-14.6, 9.8]) |
| Quante volte il prezzo è salito | 50.6% |
| Brier Kronos / frequenza storica / moneta | 0.3387 / 0.2534 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.13, -0.04] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 47.6% (atteso 80%) |
| Calibrazione walk-forward (66 casi) | Brier 0.3265 → 0.2541 (frequenza storica 0.252); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 22 | 5.3% | 54.5% |
| 10-20% | 24 | 13.0% | 54.2% |
| 20-30% | 18 | 24.9% | 44.4% |
| 30-40% | 18 | 34.7% | 44.4% |
| 40-50% | 20 | 44.6% | 60.0% |
| 50-60% | 12 | 54.5% | 66.7% |
| 60-70% | 16 | 64.5% | 37.5% |
| 70-80% | 15 | 73.7% | 46.7% |
| 80-90% | 12 | 83.0% | 33.3% |
| 90-100% | 9 | 95.8% | 66.7% |

Probabilità di chiudere in utile calcolata dalle traiettorie (166 casi): prevista 75.0%, reale 50.6%; Brier 0.314 contro 0.2544 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 67.5% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 9 | 0.0% | 0.0% |
| 60-80% | 82 | 72.1% | 58.5% |
| 80-100% | 75 | 87.3% | 48.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 4 | 50.0% | +0.984% | +0.684% | n/d | +2.7% | +1.8% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 112 | 48.2% | -0.298% | -0.598% | [-1.03%, -0.18%] | -67.0% | -67.0% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 166 | 50.6% | -0.253% | -0.553% | [-0.87%, -0.25%] | -91.8% | -91.8% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 69 | 39.1% | -0.341% | -0.641% | [-1.34%, +0.10%] | -44.2% | -44.2% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 166 | 43.4% | -0.032% | -0.332% | [-0.89%, +0.25%] | -55.2% | -55.2% | vantaggio NON dimostrato |
| Momentum | 166 | 44.6% | -0.108% | -0.408% | [-0.97%, +0.14%] | -67.8% | -67.8% | vantaggio NON dimostrato |
| Sempre long | 166 | 47.0% | +0.120% | -0.180% | [-0.75%, +0.39%] | -30.0% | -30.0% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.88%, +1.07%]. Buy & hold nello stesso periodo: -12.6% lordo, -12.9% netto.

### SOLUSDT 1d

344 previsioni dal 01/07/2025 al 02/11/2026. **Segnali operativi: vantaggio NON dimostrato.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 54.2% (IC 95% [44.8, 63.4]) |
| Momentum sugli stessi punti | 55.1% (differenza IC [-13.2, 11.7]) |
| Quante volte il prezzo è salito | 45.9% |
| Brier Kronos / frequenza storica / moneta | 0.3639 / 0.2606 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.19, -0.02] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 41.9% (atteso 80%) |
| Calibrazione walk-forward (238 casi) | Brier 0.3587 → 0.298 (frequenza storica 0.2533); dopo la calibrazione: svantaggio dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 86 | 3.5% | 43.0% |
| 10-20% | 37 | 12.8% | 43.2% |
| 20-30% | 15 | 21.7% | 40.0% |
| 30-40% | 12 | 33.5% | 33.3% |
| 40-50% | 8 | 44.5% | 37.5% |
| 50-60% | 16 | 53.0% | 43.8% |
| 60-70% | 19 | 63.4% | 42.1% |
| 70-80% | 29 | 74.3% | 48.3% |
| 80-90% | 37 | 84.1% | 51.4% |
| 90-100% | 85 | 96.0% | 51.8% |

Probabilità di chiudere in utile calcolata dalle traiettorie (344 casi): prevista 86.1%, reale 58.7%; Brier 0.3418 contro 0.2498 della frequenza storica → svantaggio dimostrato. Valore atteso netto positivo secondo il modello nel 91.9% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 4 | 0.0% | 0.0% |
| 40-60% | 6 | 52.3% | 100.0% |
| 60-80% | 60 | 72.5% | 70.0% |
| 80-100% | 274 | 91.1% | 56.2% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 61 | 55.7% | +1.087% | +0.787% | [-1.51%, +2.90%] | +48.0% | +32.2% | vantaggio NON dimostrato |
| Kronos: piano solo se valore atteso netto > 0 | 316 | 58.5% | +0.715% | +0.415% | [-0.65%, +1.59%] | +131.1% | +87.8% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 344 | 58.7% | +0.572% | +0.272% | [-0.81%, +1.33%] | +93.5% | +62.6% | vantaggio NON dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 251 | 53.4% | +0.433% | +0.133% | [-1.76%, +2.10%] | +33.3% | +22.3% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 344 | 52.0% | +0.263% | -0.037% | [-1.72%, +1.61%] | -12.7% | -12.7% | vantaggio NON dimostrato |
| Momentum | 344 | 53.8% | +1.160% | +0.860% | [-0.63%, +2.31%] | +295.9% | +198.3% | vantaggio NON dimostrato |
| Sempre long | 344 | 44.5% | -0.444% | -0.744% | [-2.64%, +1.21%] | -256.0% | -256.0% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-3.42%, +1.46%]. Buy & hold nello stesso periodo: -45.6% lordo, -45.9% netto.

### SOLUSDT 1h

197 previsioni dal 03/07/2025 al 09/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 43.5% (IC 95% [36.6, 50.8]) |
| Momentum sugli stessi punti | 50.3% (differenza IC [-17.8, 4.7]) |
| Quante volte il prezzo è salito | 48.2% |
| Brier Kronos / frequenza storica / moneta | 0.347 / 0.2521 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.13, -0.06] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 52.3% (atteso 80%) |
| Calibrazione walk-forward (97 casi) | Brier 0.3635 → 0.2639 (frequenza storica 0.252); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 26 | 3.5% | 61.5% |
| 10-20% | 13 | 13.8% | 30.8% |
| 20-30% | 18 | 25.2% | 66.7% |
| 30-40% | 23 | 34.3% | 47.8% |
| 40-50% | 26 | 43.9% | 57.7% |
| 50-60% | 24 | 53.9% | 20.8% |
| 60-70% | 23 | 63.4% | 52.2% |
| 70-80% | 21 | 74.1% | 52.4% |
| 80-90% | 11 | 82.9% | 54.5% |
| 90-100% | 12 | 95.7% | 25.0% |

Probabilità di chiudere in utile calcolata dalle traiettorie (197 casi): prevista 54.8%, reale 39.1%; Brier 0.2294 contro 0.2406 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 45.7% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 60 | 0.0% | 0.0% |
| 60-80% | 75 | 71.1% | 65.3% |
| 80-100% | 62 | 88.1% | 45.2% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 7 | 42.9% | +0.503% | +0.203% | [-0.65%, +1.09%] | +1.4% | +0.9% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 90 | 48.9% | -0.021% | -0.321% | [-0.58%, -0.08%] | -28.9% | -28.9% | svantaggio dimostrato |
| Kronos: piano su ogni previsione | 197 | 39.1% | -0.043% | -0.343% | [-0.48%, -0.20%] | -67.5% | -67.5% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 63 | 41.3% | -0.157% | -0.457% | [-0.88%, -0.06%] | -28.8% | -28.8% | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 197 | 36.0% | -0.266% | -0.566% | [-0.80%, -0.34%] | -111.5% | -111.5% | svantaggio dimostrato |
| Momentum | 197 | 40.6% | +0.079% | -0.221% | [-0.46%, +0.02%] | -43.6% | -43.6% | vantaggio NON dimostrato |
| Sempre long | 197 | 39.6% | -0.186% | -0.486% | [-0.73%, -0.25%] | -95.7% | -95.7% | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.72%, +0.04%]. Buy & hold nello stesso periodo: -43.3% lordo, -43.6% netto.

### SOLUSDT 4h

234 previsioni dal 01/07/2025 al 07/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.2% (IC 95% [44.1, 56.8]) |
| Momentum sugli stessi punti | 49.8% (differenza IC [-10.0, 10.5]) |
| Quante volte il prezzo è salito | 50.4% |
| Brier Kronos / frequenza storica / moneta | 0.3397 / 0.2523 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.13, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 42.7% (atteso 80%) |
| Calibrazione walk-forward (134 casi) | Brier 0.3389 → 0.264 (frequenza storica 0.2516); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 31 | 4.5% | 45.2% |
| 10-20% | 29 | 13.9% | 58.6% |
| 20-30% | 23 | 24.3% | 43.5% |
| 30-40% | 26 | 32.6% | 42.3% |
| 40-50% | 29 | 43.2% | 58.6% |
| 50-60% | 30 | 53.9% | 60.0% |
| 60-70% | 16 | 63.7% | 50.0% |
| 70-80% | 20 | 74.0% | 50.0% |
| 80-90% | 10 | 84.0% | 50.0% |
| 90-100% | 20 | 94.1% | 40.0% |

Probabilità di chiudere in utile calcolata dalle traiettorie (234 casi): prevista 74.9%, reale 59.8%; Brier 0.2651 contro 0.2495 della frequenza storica → vantaggio NON dimostrato. Valore atteso netto positivo secondo il modello nel 65.8% dei casi.

| Prob. di utile prevista | Casi | Prevista | Reale |
|---|---|---|---|
| 0-20% | 18 | 0.0% | 0.0% |
| 40-60% | 2 | 54.0% | 100.0% |
| 60-80% | 93 | 72.8% | 74.2% |
| 80-100% | 121 | 88.0% | 57.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto medio | IC 95% netto | Somma netta | Somma dopo le tasse | Giudizio |
|---|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 2 | 50.0% | -0.243% | -0.543% | n/d | -1.1% | -1.1% | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 154 | 59.1% | +0.061% | -0.239% | [-0.63%, +0.16%] | -36.8% | -36.8% | vantaggio NON dimostrato |
| Kronos: piano su ogni previsione | 234 | 59.8% | +0.034% | -0.266% | [-0.55%, -0.00%] | -62.3% | -62.3% | svantaggio dimostrato |
| Kronos: segnali tenuti a fine orizzonte | 93 | 45.2% | +0.000% | -0.300% | [-1.03%, +0.46%] | -27.9% | -27.9% | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 234 | 46.6% | +0.204% | -0.096% | [-0.58%, +0.37%] | -22.4% | -22.4% | vantaggio NON dimostrato |
| Momentum | 234 | 44.9% | -0.222% | -0.522% | [-0.99%, -0.04%] | -122.1% | -122.1% | svantaggio dimostrato |
| Sempre long | 234 | 47.0% | -0.210% | -0.510% | [-0.97%, +0.01%] | -119.3% | -119.3% | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.45%, +1.25%]. Buy & hold nello stesso periodo: -38.6% lordo, -38.9% netto.

