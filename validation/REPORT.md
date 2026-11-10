# Validazione storica di Kronos

Generato il 2026-11-10T17:49:00+00:00 · modello Kronos-small · orizzonte 7 candele.

- **Fuori campione**: solo previsioni successive alla data di pubblicazione dei pesi del modello su Hugging Face (30/06/2025).
- **Costi**: commissione 0.1% e slippage 0.05% per lato, tasse 33% sui trade in utile.
- **Intervalli di confidenza** al 95% con bootstrap a blocchi di tempo: un vantaggio è dimostrato solo se l'intero intervallo è sopra zero.
- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.

### Tutte le coppie

444 previsioni dal 03/07/2025 al 05/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 44.2% (IC 95% [37.9, 50.6]) |
| Momentum sugli stessi punti | 54.7% (differenza IC [-21.2, 0.0]) |
| Quante volte il prezzo è salito | 48.0% |
| Brier Kronos / frequenza storica / moneta | 0.3829 / 0.254 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.18, -0.08] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 47.1% (atteso 80%) |
| Calibrazione walk-forward (340 casi) | Brier 0.3751 → 0.2548 (frequenza storica 0.2537); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 72 | 3.7% | 54.2% |
| 10-20% | 55 | 14.1% | 49.1% |
| 20-30% | 40 | 23.8% | 57.5% |
| 30-40% | 44 | 33.7% | 56.8% |
| 40-50% | 36 | 44.3% | 50.0% |
| 50-60% | 40 | 54.1% | 47.5% |
| 60-70% | 39 | 63.7% | 41.0% |
| 70-80% | 29 | 74.6% | 41.4% |
| 80-90% | 40 | 83.9% | 37.5% |
| 90-100% | 49 | 95.8% | 38.8% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 25 | 44.0% | +0.464% | +0.164% | -0.441% | [-2.21%, +1.41%] | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 229 | 38.9% | -0.225% | -0.525% | -1.071% | [-2.02%, -0.19%] | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 444 | 37.8% | -0.225% | -0.525% | -0.996% | [-1.60%, -0.42%] | svantaggio dimostrato |
| Momentum | 444 | 46.6% | +0.159% | -0.141% | -0.665% | [-1.33%, -0.02%] | svantaggio dimostrato |
| Sempre long | 444 | 41.2% | -0.060% | -0.360% | -0.854% | [-1.70%, -0.00%] | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-1.53%, +0.75%]. Buy & hold nello stesso periodo: -32.8% lordo, -33.1% netto.

### Timeframe 1d

189 previsioni dal 07/07/2025 al 30/10/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 50.8% (IC 95% [41.0, 61.0]) |
| Momentum sugli stessi punti | 51.4% (differenza IC [-15.6, 13.9]) |
| Quante volte il prezzo è salito | 45.5% |
| Brier Kronos / frequenza storica / moneta | 0.364 / 0.2546 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.18, -0.03] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 43.4% (atteso 80%) |
| Calibrazione walk-forward (85 casi) | Brier 0.3422 → 0.2512 (frequenza storica 0.2524); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 43 | 3.1% | 39.5% |
| 10-20% | 20 | 14.4% | 50.0% |
| 20-30% | 12 | 22.8% | 41.7% |
| 30-40% | 11 | 34.9% | 54.5% |
| 40-50% | 6 | 43.7% | 50.0% |
| 50-60% | 9 | 53.6% | 44.4% |
| 60-70% | 12 | 63.0% | 41.7% |
| 70-80% | 17 | 75.1% | 52.9% |
| 80-90% | 22 | 84.1% | 45.5% |
| 90-100% | 37 | 96.1% | 45.9% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 19 | 57.9% | +0.925% | +0.625% | -0.171% | [-2.57%, +1.88%] | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 128 | 49.2% | +0.169% | -0.131% | -1.037% | [-2.68%, +0.49%] | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 189 | 48.1% | +0.128% | -0.172% | -1.093% | [-2.42%, +0.22%] | vantaggio NON dimostrato |
| Momentum | 189 | 48.1% | +0.034% | -0.266% | -1.171% | [-2.61%, +0.25%] | vantaggio NON dimostrato |
| Sempre long | 189 | 43.4% | -0.186% | -0.486% | -1.360% | [-3.23%, +0.36%] | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-2.42%, +2.57%]. Buy & hold nello stesso periodo: -37.0% lordo, -37.4% netto.

### Timeframe 4h

120 previsioni dal 13/07/2025 al 05/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 36.4% (IC 95% [26.0, 46.7]) |
| Momentum sugli stessi punti | 54.2% (differenza IC [-35.3, -0.8]) |
| Quante volte il prezzo è salito | 54.2% |
| Brier Kronos / frequenza storica / moneta | 0.4192 / 0.2545 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.24, -0.09] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 42.5% (atteso 80%) |
| Calibrazione walk-forward | storico concluso ancora troppo corto (20 casi) |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 15 | 5.5% | 73.3% |
| 10-20% | 21 | 14.2% | 57.1% |
| 20-30% | 13 | 24.5% | 61.5% |
| 30-40% | 13 | 32.2% | 76.9% |
| 40-50% | 11 | 43.5% | 54.5% |
| 50-60% | 17 | 54.2% | 58.8% |
| 60-70% | 9 | 63.1% | 33.3% |
| 70-80% | 4 | 73.5% | 0.0% |
| 80-90% | 12 | 82.8% | 25.0% |
| 90-100% | 5 | 96.4% | 40.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 56 | 28.6% | -1.066% | -1.366% | -1.468% | [-2.22%, -0.73%] | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 120 | 32.5% | -0.779% | -1.079% | -1.275% | [-1.82%, -0.74%] | svantaggio dimostrato |
| Momentum | 120 | 50.0% | +0.327% | +0.027% | -0.334% | [-0.96%, +0.25%] | vantaggio NON dimostrato |
| Sempre long | 120 | 47.5% | +0.290% | -0.010% | -0.366% | [-1.14%, +0.40%] | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-2.31%, +0.05%]. Buy & hold nello stesso periodo: -34.8% lordo, -35.1% netto.

### Timeframe 1h

135 previsioni dal 03/07/2025 al 01/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 41.8% (IC 95% [32.6, 50.8]) |
| Momentum sugli stessi punti | 59.7% (differenza IC [-34.4, -1.5]) |
| Quante volte il prezzo è salito | 45.9% |
| Brier Kronos / frequenza storica / moneta | 0.3772 / 0.2554 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.19, -0.06] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 56.3% (atteso 80%) |
| Calibrazione walk-forward (33 casi) | Brier 0.3958 → 0.2604 (frequenza storica 0.2522); dopo la calibrazione: vantaggio NON dimostrato |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 14 | 3.7% | 78.6% |
| 10-20% | 14 | 13.4% | 35.7% |
| 20-30% | 15 | 24.0% | 66.7% |
| 30-40% | 20 | 34.1% | 45.0% |
| 40-50% | 19 | 45.1% | 47.4% |
| 50-60% | 14 | 54.3% | 35.7% |
| 60-70% | 18 | 64.4% | 44.4% |
| 70-80% | 8 | 74.0% | 37.5% |
| 80-90% | 6 | 85.7% | 33.3% |
| 90-100% | 7 | 94.0% | 0.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 6 | 0.0% | -0.995% | -1.295% | -1.295% | n/d | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 45 | 22.2% | -0.299% | -0.599% | -0.672% | [-1.10%, -0.27%] | svantaggio dimostrato |
| Kronos: direzione su ogni previsione | 135 | 28.1% | -0.227% | -0.527% | -0.613% | [-0.88%, -0.37%] | svantaggio dimostrato |
| Momentum | 135 | 41.5% | +0.186% | -0.114% | -0.252% | [-0.50%, -0.01%] | svantaggio dimostrato |
| Sempre long | 135 | 32.6% | -0.194% | -0.494% | -0.580% | [-0.90%, -0.28%] | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.96%, +0.08%]. Buy & hold nello stesso periodo: -26.4% lordo, -26.8% netto.

### BTCUSDT 1d

74 previsioni dal 07/07/2025 al 30/10/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 51.4% (IC 95% [39.1, 63.0]) |
| Momentum sugli stessi punti | 45.8% (differenza IC [-13.9, 23.3]) |
| Quante volte il prezzo è salito | 43.2% |
| Brier Kronos / frequenza storica / moneta | 0.3448 / 0.2504 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.18, -0.01] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 47.3% (atteso 80%) |
| Calibrazione walk-forward | storico concluso ancora troppo corto (0 casi) |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 15 | 3.1% | 26.7% |
| 10-20% | 6 | 15.3% | 50.0% |
| 20-30% | 6 | 24.0% | 50.0% |
| 30-40% | 3 | 35.3% | 33.3% |
| 40-50% | 2 | 45.0% | 100.0% |
| 50-60% | 3 | 52.7% | 33.3% |
| 60-70% | 5 | 63.2% | 40.0% |
| 70-80% | 10 | 75.4% | 50.0% |
| 80-90% | 9 | 83.3% | 44.4% |
| 90-100% | 15 | 96.8% | 46.7% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 6 | 83.3% | +1.490% | +1.190% | +0.566% | [-1.48%, +2.13%] | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 47 | 53.2% | +0.445% | +0.145% | -0.542% | [-1.95%, +0.79%] | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 74 | 48.6% | +0.502% | +0.202% | -0.564% | [-1.88%, +0.59%] | vantaggio NON dimostrato |
| Momentum | 74 | 41.9% | +0.237% | -0.063% | -0.790% | [-2.01%, +0.46%] | vantaggio NON dimostrato |
| Sempre long | 74 | 39.2% | -0.466% | -0.766% | -1.380% | [-2.85%, +0.05%] | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-2.34%, +2.73%]. Buy & hold nello stesso periodo: -30.0% lordo, -30.3% netto.

### BTCUSDT 1h

36 previsioni dal 03/07/2025 al 01/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 36.1% (IC 95% [19.4, 50.0]) |
| Momentum sugli stessi punti | 61.1% (differenza IC [-47.2, 0.0]) |
| Quante volte il prezzo è salito | 47.2% |
| Brier Kronos / frequenza storica / moneta | 0.3518 / 0.2505 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.19, -0.02] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 66.7% (atteso 80%) |
| Calibrazione walk-forward | storico concluso ancora troppo corto (0 casi) |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 3 | 5.3% | 66.7% |
| 10-20% | 5 | 13.2% | 0.0% |
| 20-30% | 5 | 24.4% | 80.0% |
| 30-40% | 5 | 36.0% | 60.0% |
| 40-50% | 4 | 45.5% | 100.0% |
| 50-60% | 6 | 55.7% | 50.0% |
| 60-70% | 5 | 65.6% | 20.0% |
| 70-80% | 1 | 72.0% | 0.0% |
| 90-100% | 2 | 96.0% | 0.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 11 | 36.4% | +0.189% | -0.111% | -0.184% | [-0.50%, +0.21%] | campione insufficiente |
| Kronos: direzione su ogni previsione | 36 | 25.0% | -0.148% | -0.448% | -0.487% | [-0.70%, -0.29%] | svantaggio dimostrato |
| Momentum | 36 | 36.1% | -0.093% | -0.393% | -0.423% | [-0.68%, -0.20%] | svantaggio dimostrato |
| Sempre long | 36 | 30.6% | -0.084% | -0.384% | -0.422% | [-0.66%, -0.21%] | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-0.36%, +0.29%]. Buy & hold nello stesso periodo: -28.6% lordo, -28.9% netto.

### BTCUSDT 4h

50 previsioni dal 13/07/2025 al 05/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 37.5% (IC 95% [25.0, 50.0]) |
| Momentum sugli stessi punti | 52.1% (differenza IC [-35.4, 6.2]) |
| Quante volte il prezzo è salito | 58.0% |
| Brier Kronos / frequenza storica / moneta | 0.4144 / 0.2522 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.24, -0.08] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 50.0% (atteso 80%) |
| Calibrazione walk-forward | storico concluso ancora troppo corto (0 casi) |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 4 | 4.5% | 75.0% |
| 10-20% | 9 | 15.1% | 55.6% |
| 20-30% | 8 | 23.2% | 75.0% |
| 30-40% | 6 | 31.7% | 100.0% |
| 40-50% | 5 | 43.6% | 20.0% |
| 50-60% | 7 | 52.9% | 71.4% |
| 60-70% | 3 | 62.7% | 33.3% |
| 70-80% | 2 | 74.0% | 0.0% |
| 80-90% | 5 | 83.6% | 20.0% |
| 90-100% | 1 | 94.0% | 100.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 22 | 27.3% | -0.700% | -1.000% | -1.032% | [-1.79%, -0.45%] | campione insufficiente |
| Kronos: direzione su ogni previsione | 50 | 32.0% | -0.474% | -0.774% | -0.878% | [-1.40%, -0.40%] | svantaggio dimostrato |
| Momentum | 50 | 46.0% | -0.057% | -0.357% | -0.516% | [-1.04%, -0.04%] | svantaggio dimostrato |
| Sempre long | 50 | 44.0% | +0.043% | -0.257% | -0.431% | [-0.94%, +0.07%] | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-1.25%, +0.32%]. Buy & hold nello stesso periodo: -36.2% lordo, -36.5% netto.

### ETHUSDT 1d

53 previsioni dal 19/07/2025 al 30/10/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 51.9% (IC 95% [38.2, 66.7]) |
| Momentum sugli stessi punti | 55.8% (differenza IC [-23.5, 16.3]) |
| Quante volte il prezzo è salito | 45.3% |
| Brier Kronos / frequenza storica / moneta | 0.3705 / 0.2557 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.22, -0.01] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 41.5% (atteso 80%) |
| Calibrazione walk-forward | storico concluso ancora troppo corto (0 casi) |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 13 | 3.2% | 46.2% |
| 10-20% | 10 | 15.2% | 50.0% |
| 20-30% | 4 | 22.0% | 25.0% |
| 30-40% | 3 | 37.3% | 66.7% |
| 40-50% | 3 | 42.7% | 33.3% |
| 50-60% | 3 | 52.7% | 33.3% |
| 60-70% | 1 | 64.0% | 100.0% |
| 70-80% | 3 | 75.3% | 66.7% |
| 80-90% | 5 | 85.6% | 20.0% |
| 90-100% | 8 | 94.5% | 50.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 5 | 60.0% | +2.765% | +2.465% | +1.278% | [-1.82%, +4.21%] | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 39 | 43.6% | -0.539% | -0.839% | -1.746% | [-4.20%, +0.60%] | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 53 | 47.2% | -0.997% | -1.297% | -2.141% | [-4.60%, +0.10%] | vantaggio NON dimostrato |
| Momentum | 53 | 50.9% | -0.763% | -1.063% | -1.942% | [-4.27%, +0.14%] | vantaggio NON dimostrato |
| Sempre long | 53 | 45.3% | +0.249% | -0.051% | -1.104% | [-3.32%, +1.09%] | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-3.17%, +2.82%]. Buy & hold nello stesso periodo: -40.9% lordo, -41.2% netto.

### ETHUSDT 1h

49 previsioni dal 03/07/2025 al 01/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 42.9% (IC 95% [28.6, 57.1]) |
| Momentum sugli stessi punti | 55.1% (differenza IC [-38.8, 10.3]) |
| Quante volte il prezzo è salito | 46.9% |
| Brier Kronos / frequenza storica / moneta | 0.3842 / 0.2544 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.22, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 51.0% (atteso 80%) |
| Calibrazione walk-forward | storico concluso ancora troppo corto (0 casi) |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 5 | 2.4% | 80.0% |
| 10-20% | 6 | 13.0% | 50.0% |
| 20-30% | 4 | 23.0% | 50.0% |
| 30-40% | 8 | 34.0% | 50.0% |
| 40-50% | 7 | 44.9% | 42.9% |
| 50-60% | 5 | 53.2% | 40.0% |
| 60-70% | 6 | 65.7% | 50.0% |
| 70-80% | 3 | 74.7% | 66.7% |
| 80-90% | 3 | 86.7% | 0.0% |
| 90-100% | 2 | 92.0% | 0.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 3 | 0.0% | -1.451% | -1.751% | -1.751% | n/d | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 18 | 11.1% | -0.279% | -0.579% | -0.675% | [-1.31%, -0.03%] | campione insufficiente |
| Kronos: direzione su ogni previsione | 49 | 22.4% | -0.355% | -0.655% | -0.729% | [-1.10%, -0.38%] | svantaggio dimostrato |
| Momentum | 49 | 36.7% | +0.215% | -0.085% | -0.237% | [-0.59%, +0.10%] | vantaggio NON dimostrato |
| Sempre long | 49 | 28.6% | -0.249% | -0.549% | -0.633% | [-1.01%, -0.28%] | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-1.33%, +0.18%]. Buy & hold nello stesso periodo: -12.2% lordo, -12.5% netto.

### ETHUSDT 4h

35 previsioni dal 13/07/2025 al 01/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 34.3% (IC 95% [17.1, 48.6]) |
| Momentum sugli stessi punti | 54.3% (differenza IC [-45.7, 5.7]) |
| Quante volte il prezzo è salito | 51.4% |
| Brier Kronos / frequenza storica / moneta | 0.4283 / 0.2519 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.28, -0.08] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 40.0% (atteso 80%) |
| Calibrazione walk-forward | storico concluso ancora troppo corto (0 casi) |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 3 | 6.7% | 100.0% |
| 10-20% | 8 | 14.0% | 62.5% |
| 20-30% | 3 | 27.3% | 66.7% |
| 30-40% | 5 | 33.6% | 40.0% |
| 40-50% | 3 | 46.0% | 66.7% |
| 50-60% | 3 | 56.0% | 66.7% |
| 60-70% | 5 | 63.6% | 20.0% |
| 80-90% | 4 | 81.5% | 25.0% |
| 90-100% | 1 | 100.0% | 0.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 16 | 18.8% | -1.768% | -2.068% | -2.081% | [-3.17%, -1.08%] | campione insufficiente |
| Kronos: direzione su ogni previsione | 35 | 31.4% | -0.620% | -0.920% | -1.194% | [-2.24%, -0.07%] | svantaggio dimostrato |
| Momentum | 35 | 48.6% | +0.071% | -0.229% | -0.597% | [-1.96%, +0.48%] | vantaggio NON dimostrato |
| Sempre long | 35 | 48.6% | +0.630% | +0.330% | -0.130% | [-1.15%, +0.98%] | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-3.04%, +2.21%]. Buy & hold nello stesso periodo: -24.6% lordo, -24.9% netto.

### SOLUSDT 1d

62 previsioni dal 07/07/2025 al 30/10/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 49.2% (IC 95% [36.2, 61.6]) |
| Momentum sugli stessi punti | 54.1% (differenza IC [-23.3, 13.6]) |
| Quante volte il prezzo è salito | 48.4% |
| Brier Kronos / frequenza storica / moneta | 0.3813 / 0.2542 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.22, -0.03] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 40.3% (atteso 80%) |
| Calibrazione walk-forward | storico concluso ancora troppo corto (0 casi) |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 15 | 3.1% | 46.7% |
| 10-20% | 4 | 11.0% | 50.0% |
| 20-30% | 2 | 21.0% | 50.0% |
| 30-40% | 5 | 33.2% | 60.0% |
| 40-50% | 1 | 44.0% | 0.0% |
| 50-60% | 3 | 55.3% | 66.7% |
| 60-70% | 6 | 62.7% | 33.3% |
| 70-80% | 4 | 74.0% | 50.0% |
| 80-90% | 8 | 84.0% | 62.5% |
| 90-100% | 14 | 96.1% | 42.9% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 8 | 37.5% | -0.650% | -0.950% | -1.629% | [-4.96%, +2.17%] | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 42 | 50.0% | +0.519% | +0.219% | -0.934% | [-3.28%, +1.28%] | vantaggio NON dimostrato |
| Kronos: direzione su ogni previsione | 62 | 48.4% | +0.643% | +0.343% | -0.830% | [-2.48%, +0.84%] | vantaggio NON dimostrato |
| Momentum | 62 | 53.2% | +0.473% | +0.173% | -0.968% | [-2.66%, +0.80%] | vantaggio NON dimostrato |
| Sempre long | 62 | 46.8% | -0.223% | -0.523% | -1.556% | [-3.59%, +0.39%] | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-3.09%, +3.34%]. Buy & hold nello stesso periodo: -40.2% lordo, -40.5% netto.

### SOLUSDT 1h

50 previsioni dal 03/07/2025 al 01/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 44.9% (IC 95% [30.6, 59.2]) |
| Momentum sugli stessi punti | 63.3% (differenza IC [-40.8, 4.1]) |
| Quante volte il prezzo è salito | 44.0% |
| Brier Kronos / frequenza storica / moneta | 0.3886 / 0.2551 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.22, -0.05] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 54.0% (atteso 80%) |
| Calibrazione walk-forward | storico concluso ancora troppo corto (0 casi) |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 6 | 4.0% | 83.3% |
| 10-20% | 3 | 14.7% | 66.7% |
| 20-30% | 6 | 24.3% | 66.7% |
| 30-40% | 7 | 32.9% | 28.6% |
| 40-50% | 8 | 45.0% | 25.0% |
| 50-60% | 3 | 53.3% | 0.0% |
| 60-70% | 7 | 62.6% | 57.1% |
| 70-80% | 4 | 74.0% | 25.0% |
| 80-90% | 3 | 84.7% | 66.7% |
| 90-100% | 3 | 94.0% | 0.0% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 3 | 0.0% | -0.539% | -0.839% | -0.839% | n/d | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 16 | 25.0% | -0.657% | -0.957% | -1.005% | [-1.67%, -0.43%] | campione insufficiente |
| Kronos: direzione su ogni previsione | 50 | 36.0% | -0.159% | -0.459% | -0.590% | [-0.98%, -0.20%] | svantaggio dimostrato |
| Momentum | 50 | 50.0% | +0.357% | +0.057% | -0.144% | [-0.49%, +0.20%] | vantaggio NON dimostrato |
| Sempre long | 50 | 38.0% | -0.219% | -0.519% | -0.640% | [-1.04%, -0.25%] | svantaggio dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-1.33%, +0.27%]. Buy & hold nello stesso periodo: -38.6% lordo, -38.9% netto.

### SOLUSDT 4h

35 previsioni dal 13/07/2025 al 01/11/2026. **Segnali operativi: campione insufficiente.**

| Direzione e probabilità | Valore |
|---|---|
| Direzioni giuste di Kronos | 37.1% (IC 95% [20.0, 54.3]) |
| Momentum sugli stessi punti | 57.1% (differenza IC [-48.6, 8.6]) |
| Quante volte il prezzo è salito | 51.4% |
| Brier Kronos / frequenza storica / moneta | 0.4169 / 0.2519 / 0.25 |
| Vantaggio sul Brier (sopra 0 = meglio) | [-0.28, -0.06] → svantaggio dimostrato |
| Prezzo finale dentro la fascia P10-P90 | 34.3% (atteso 80%) |
| Calibrazione walk-forward | storico concluso ancora troppo corto (0 casi) |

| Fascia prob. rialzo | Casi | Prevista | Reale |
|---|---|---|---|
| 0-10% | 8 | 5.5% | 62.5% |
| 10-20% | 4 | 12.5% | 50.0% |
| 20-30% | 2 | 25.0% | 0.0% |
| 30-40% | 2 | 30.0% | 100.0% |
| 40-50% | 3 | 40.7% | 100.0% |
| 50-60% | 7 | 54.9% | 42.9% |
| 60-70% | 1 | 62.0% | 100.0% |
| 70-80% | 2 | 73.0% | 0.0% |
| 80-90% | 3 | 83.3% | 33.3% |
| 90-100% | 3 | 96.0% | 33.3% |

| Strategia | Trade | Vincenti | Lordo medio | Netto costi | Netto costi+tasse | IC 95% netto | Giudizio |
|---|---|---|---|---|---|---|---|
| Kronos: segnali operativi (stop e target) | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano solo se valore atteso netto > 0 | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: piano su ogni previsione | 0 | — | — | — | — | — | campione insufficiente |
| Kronos: segnali tenuti a fine orizzonte | 18 | 38.9% | -0.887% | -1.187% | -1.456% | [-2.87%, -0.13%] | campione insufficiente |
| Kronos: direzione su ogni previsione | 35 | 34.3% | -1.372% | -1.672% | -1.923% | [-3.12%, -0.86%] | svantaggio dimostrato |
| Momentum | 35 | 57.1% | +1.133% | +0.833% | +0.190% | [-0.80%, +1.19%] | vantaggio NON dimostrato |
| Sempre long | 35 | 51.4% | +0.302% | +0.002% | -0.509% | [-1.65%, +0.63%] | vantaggio NON dimostrato |

Kronos meno momentum, stessi punti, per trade: IC 95% [-4.99%, -0.28%]. Buy & hold nello stesso periodo: -43.4% lordo, -43.7% netto.

