# Validazione storica delle strategie tecniche

Generato il 2026-11-10T18:42:02+00:00 · orizzonte 7 candele · piano: stop 1.5 x ATR, target 1.5 x il rischio.

- **Costi**: commissione 0.1% e slippage 0.05% per lato, tasse 33% sui trade in utile.
- **Giudizio**: un vantaggio è dimostrato solo se l'intero intervallo di confidenza al 95% del netto medio è sopra zero.
- **Prima/seconda metà**: netto medio (e numero di trade) nelle due metà del periodo; un risultato che cambia segno non è stabile.
- Regole fisse, non adattate ai dati; i parametri sono però valori noti scelti conoscendo il passato.
- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.

### Timeframe 1d (BTC, ETH e SOL insieme)

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 79 | 59.5% | +0.339% | [-1.61%, +2.16%] | vantaggio NON dimostrato | +1.579% (34) | -0.597% (45) | +1.346% [-0.80%, +3.13%] |
| Mean Reversion | 93 | 49.5% | -0.294% | [-1.62%, +1.08%] | vantaggio NON dimostrato | -0.755% (39) | +0.039% (54) | +0.221% [-1.93%, +2.61%] |
| MA Crossover | 655 | 45.2% | -1.080% | [-1.67%, -0.47%] | svantaggio dimostrato | -0.959% (296) | -1.179% (359) | -0.604% [-1.41%, +0.19%] |
| Consenso (almeno 2 su 3) | 58 | 62.1% | +0.855% | [-1.62%, +2.95%] | vantaggio NON dimostrato | +1.249% (28) | +0.487% (30) | +1.785% [-1.01%, +4.18%] |
| Momentum (confronto) | 953 | 44.9% | -1.250% | [-1.74%, -0.77%] | svantaggio dimostrato | -1.150% (405) | -1.323% (548) | -1.424% [-2.09%, -0.77%] |
| Sempre long (confronto) | 953 | 46.1% | -0.950% | [-1.44%, -0.42%] | svantaggio dimostrato | -0.855% (405) | -1.021% (548) | -0.702% [-1.48%, +0.04%] |

### Timeframe 4h (BTC, ETH e SOL insieme)

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 621 | 44.6% | -0.454% | [-0.74%, -0.16%] | svantaggio dimostrato | -0.434% (174) | -0.462% (447) | -0.457% [-0.82%, -0.11%] |
| Mean Reversion | 1032 | 41.6% | -0.637% | [-0.80%, -0.48%] | svantaggio dimostrato | -0.643% (387) | -0.633% (645) | -0.655% [-0.88%, -0.42%] |
| MA Crossover | 4501 | 43.4% | -0.567% | [-0.67%, -0.46%] | svantaggio dimostrato | -0.606% (1965) | -0.536% (2536) | -0.589% [-0.73%, -0.46%] |
| Consenso (almeno 2 su 3) | 435 | 43.4% | -0.655% | [-0.99%, -0.32%] | svantaggio dimostrato | -0.482% (130) | -0.728% (305) | -0.626% [-1.07%, -0.18%] |
| Momentum (confronto) | 6651 | 41.3% | -0.680% | [-0.76%, -0.60%] | svantaggio dimostrato | -0.757% (2866) | -0.621% (3785) | -0.712% [-0.81%, -0.61%] |
| Sempre long (confronto) | 6651 | 42.6% | -0.643% | [-0.73%, -0.56%] | svantaggio dimostrato | -0.687% (2866) | -0.610% (3785) | -0.595% [-0.72%, -0.48%] |

### Timeframe 1h (BTC, ETH e SOL insieme)

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 2492 | 38.2% | -0.471% | [-0.55%, -0.39%] | svantaggio dimostrato | -0.456% (716) | -0.477% (1776) | -0.490% [-0.60%, -0.40%] |
| Mean Reversion | 6448 | 38.2% | -0.466% | [-0.50%, -0.43%] | svantaggio dimostrato | -0.544% (2478) | -0.417% (3970) | -0.489% [-0.53%, -0.44%] |
| MA Crossover | 18166 | 37.9% | -0.434% | [-0.46%, -0.41%] | svantaggio dimostrato | -0.443% (7934) | -0.428% (10232) | -0.442% [-0.48%, -0.41%] |
| Consenso (almeno 2 su 3) | 1676 | 40.4% | -0.416% | [-0.51%, -0.32%] | svantaggio dimostrato | -0.361% (518) | -0.440% (1158) | -0.430% [-0.56%, -0.30%] |
| Momentum (confronto) | 27206 | 36.9% | -0.455% | [-0.48%, -0.43%] | svantaggio dimostrato | -0.474% (11743) | -0.441% (15463) | -0.481% [-0.51%, -0.45%] |
| Sempre long (confronto) | 27206 | 38.3% | -0.461% | [-0.48%, -0.44%] | svantaggio dimostrato | -0.497% (11743) | -0.434% (15463) | -0.454% [-0.48%, -0.42%] |

### BTCUSDT 1d

Dal 19/05/2019 al 09/11/2026, 2732 candele. Buy & hold nel periodo: +834.8% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 29 | 37.9% | -1.369% | [-3.18%, +0.40%] | campione insufficiente | -0.700% (14) | -1.994% (15) | -0.533% [-2.40%, +1.32%] |
| Mean Reversion | 40 | 52.5% | -0.636% | [-2.28%, +0.94%] | vantaggio NON dimostrato | -2.365% (18) | +0.778% (22) | -0.197% [-2.67%, +2.15%] |
| MA Crossover | 271 | 46.1% | -0.934% | [-1.55%, -0.31%] | svantaggio dimostrato | -1.188% (139) | -0.665% (132) | -0.643% [-1.47%, +0.23%] |
| Consenso (almeno 2 su 3) | 21 | 47.6% | -0.966% | [-3.01%, +1.03%] | campione insufficiente | -1.479% (10) | -0.500% (11) | -0.058% [-2.53%, +2.22%] |
| Momentum (confronto) | 390 | 44.9% | -1.030% | [-1.57%, -0.51%] | svantaggio dimostrato | -0.667% (195) | -1.392% (195) | -1.401% [-2.08%, -0.71%] |
| Sempre long (confronto) | 390 | 47.2% | -0.586% | [-1.10%, -0.06%] | svantaggio dimostrato | -0.457% (195) | -0.716% (195) | -0.470% [-1.14%, +0.19%] |

### BTCUSDT 4h

Dal 12/09/2018 al 10/11/2026, 17887 candele. Buy & hold nel periodo: +1067.3% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 207 | 42.5% | -0.446% | [-0.72%, -0.16%] | svantaggio dimostrato | -0.442% (65) | -0.448% (142) | -0.246% [-0.66%, +0.19%] |
| Mean Reversion | 463 | 41.5% | -0.508% | [-0.68%, -0.34%] | svantaggio dimostrato | -0.635% (197) | -0.415% (266) | -0.527% [-0.77%, -0.30%] |
| MA Crossover | 1742 | 41.9% | -0.501% | [-0.60%, -0.39%] | svantaggio dimostrato | -0.553% (882) | -0.447% (860) | -0.496% [-0.64%, -0.35%] |
| Consenso (almeno 2 su 3) | 143 | 46.2% | -0.370% | [-0.74%, -0.00%] | svantaggio dimostrato | -0.056% (46) | -0.519% (97) | -0.144% [-0.71%, +0.46%] |
| Momentum (confronto) | 2555 | 39.1% | -0.609% | [-0.69%, -0.52%] | svantaggio dimostrato | -0.725% (1278) | -0.494% (1277) | -0.609% [-0.72%, -0.49%] |
| Sempre long (confronto) | 2555 | 41.9% | -0.519% | [-0.60%, -0.44%] | svantaggio dimostrato | -0.561% (1278) | -0.477% (1277) | -0.500% [-0.62%, -0.39%] |

### BTCUSDT 1h

Dal 06/08/2018 al 10/11/2026, 72446 candele. Buy & hold nel periodo: +932.1% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 889 | 38.8% | -0.380% | [-0.47%, -0.30%] | svantaggio dimostrato | -0.384% (297) | -0.378% (592) | -0.369% [-0.47%, -0.27%] |
| Mean Reversion | 2765 | 35.8% | -0.432% | [-0.47%, -0.40%] | svantaggio dimostrato | -0.477% (1215) | -0.396% (1550) | -0.466% [-0.52%, -0.42%] |
| MA Crossover | 7025 | 35.4% | -0.399% | [-0.43%, -0.37%] | svantaggio dimostrato | -0.422% (3508) | -0.375% (3517) | -0.409% [-0.44%, -0.38%] |
| Consenso (almeno 2 su 3) | 608 | 42.3% | -0.308% | [-0.42%, -0.20%] | svantaggio dimostrato | -0.216% (211) | -0.357% (397) | -0.264% [-0.39%, -0.14%] |
| Momentum (confronto) | 10349 | 34.6% | -0.412% | [-0.43%, -0.39%] | svantaggio dimostrato | -0.447% (5175) | -0.376% (5174) | -0.420% [-0.45%, -0.39%] |
| Sempre long (confronto) | 10349 | 36.1% | -0.409% | [-0.43%, -0.39%] | svantaggio dimostrato | -0.450% (5175) | -0.368% (5174) | -0.401% [-0.43%, -0.37%] |

### ETHUSDT 1d

Dal 01/06/2019 al 09/11/2026, 2719 candele. Buy & hold nel periodo: +655.4% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 26 | 69.2% | -0.007% | [-3.14%, +2.82%] | campione insufficiente | +0.284% (14) | -0.347% (12) | +2.207% [-0.80%, +5.26%] |
| Mean Reversion | 38 | 42.1% | -0.907% | [-2.51%, +0.89%] | vantaggio NON dimostrato | -0.723% (18) | -1.073% (20) | -0.335% [-2.54%, +2.08%] |
| MA Crossover | 248 | 43.5% | -1.177% | [-2.00%, -0.29%] | svantaggio dimostrato | -0.764% (135) | -1.671% (113) | -0.894% [-2.06%, +0.28%] |
| Consenso (almeno 2 su 3) | 16 | 68.8% | +0.427% | [-4.23%, +4.64%] | campione insufficiente | -0.830% (11) | +3.194% (5) | +4.010% [-0.29%, +8.23%] |
| Momentum (confronto) | 369 | 43.6% | -1.453% | [-2.10%, -0.78%] | svantaggio dimostrato | -1.345% (185) | -1.561% (184) | -1.450% [-2.41%, -0.53%] |
| Sempre long (confronto) | 369 | 47.7% | -0.776% | [-1.44%, -0.12%] | svantaggio dimostrato | -0.420% (185) | -1.135% (184) | -0.498% [-1.40%, +0.40%] |

### ETHUSDT 4h

Dal 12/09/2018 al 10/11/2026, 17812 candele. Buy & hold nel periodo: +1079.3% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 245 | 44.1% | -0.418% | [-0.80%, -0.03%] | svantaggio dimostrato | -0.177% (83) | -0.541% (162) | -0.377% [-0.84%, +0.09%] |
| Mean Reversion | 361 | 41.3% | -0.767% | [-1.01%, -0.52%] | svantaggio dimostrato | -0.924% (151) | -0.654% (210) | -0.873% [-1.21%, -0.52%] |
| MA Crossover | 1707 | 43.6% | -0.550% | [-0.69%, -0.41%] | svantaggio dimostrato | -0.575% (842) | -0.526% (865) | -0.627% [-0.81%, -0.45%] |
| Consenso (almeno 2 su 3) | 180 | 40.6% | -0.671% | [-1.13%, -0.19%] | svantaggio dimostrato | -0.364% (64) | -0.840% (116) | -0.427% [-0.98%, +0.13%] |
| Momentum (confronto) | 2500 | 41.8% | -0.672% | [-0.79%, -0.56%] | svantaggio dimostrato | -0.711% (1222) | -0.636% (1278) | -0.718% [-0.87%, -0.57%] |
| Sempre long (confronto) | 2500 | 43.5% | -0.653% | [-0.76%, -0.54%] | svantaggio dimostrato | -0.728% (1222) | -0.582% (1278) | -0.583% [-0.73%, -0.43%] |

### ETHUSDT 1h

Dal 06/08/2018 al 10/11/2026, 72142 candele. Buy & hold nel periodo: +394.6% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 932 | 37.7% | -0.468% | [-0.57%, -0.37%] | svantaggio dimostrato | -0.533% (340) | -0.431% (592) | -0.498% [-0.64%, -0.37%] |
| Mean Reversion | 2339 | 39.2% | -0.488% | [-0.54%, -0.44%] | svantaggio dimostrato | -0.592% (1011) | -0.410% (1328) | -0.500% [-0.57%, -0.43%] |
| MA Crossover | 6774 | 38.2% | -0.445% | [-0.48%, -0.41%] | svantaggio dimostrato | -0.450% (3409) | -0.440% (3365) | -0.453% [-0.50%, -0.41%] |
| Consenso (almeno 2 su 3) | 615 | 38.7% | -0.442% | [-0.57%, -0.31%] | svantaggio dimostrato | -0.519% (236) | -0.395% (379) | -0.474% [-0.67%, -0.29%] |
| Momentum (confronto) | 10215 | 37.2% | -0.455% | [-0.48%, -0.43%] | svantaggio dimostrato | -0.483% (5040) | -0.428% (5175) | -0.477% [-0.51%, -0.44%] |
| Sempre long (confronto) | 10215 | 39.0% | -0.464% | [-0.49%, -0.44%] | svantaggio dimostrato | -0.504% (5040) | -0.425% (5175) | -0.459% [-0.50%, -0.42%] |

### SOLUSDT 1d

Dal 16/04/2022 al 09/11/2026, 1665 candele. Buy & hold nel periodo: -21.7% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 24 | 75.0% | +2.780% | [-1.16%, +6.55%] | campione insufficiente | +4.371% (12) | +1.188% (12) | +2.685% [-1.92%, +6.49%] |
| Mean Reversion | 15 | 60.0% | +2.176% | [-1.19%, +5.64%] | campione insufficiente | +8.423% (6) | -1.989% (9) | +2.749% [-3.26%, +9.51%] |
| MA Crossover | 136 | 46.3% | -1.193% | [-2.55%, +0.07%] | vantaggio NON dimostrato | -0.704% (61) | -1.591% (75) | +0.002% [-1.68%, +1.72%] |
| Consenso (almeno 2 su 3) | 21 | 71.4% | +3.003% | [-1.24%, +7.19%] | campione insufficiente | +4.495% (11) | +1.361% (10) | +1.932% [-3.35%, +6.30%] |
| Momentum (confronto) | 194 | 47.4% | -1.305% | [-2.41%, -0.19%] | svantaggio dimostrato | -1.865% (75) | -0.952% (119) | -1.418% [-2.88%, +0.08%] |
| Sempre long (confronto) | 194 | 40.7% | -2.012% | [-3.16%, -0.95%] | svantaggio dimostrato | -3.080% (75) | -1.339% (119) | -1.558% [-3.08%, -0.25%] |

### SOLUSDT 4h

Dal 11/08/2021 al 10/11/2026, 11479 candele. Buy & hold nel periodo: +93.5% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 169 | 47.9% | -0.518% | [-1.16%, +0.11%] | vantaggio NON dimostrato | -0.199% (58) | -0.685% (111) | -0.832% [-1.61%, -0.02%] |
| Mean Reversion | 208 | 42.3% | -0.697% | [-1.16%, -0.26%] | svantaggio dimostrato | -0.484% (91) | -0.862% (117) | -0.561% [-1.10%, -0.02%] |
| MA Crossover | 1052 | 45.6% | -0.702% | [-0.92%, -0.47%] | svantaggio dimostrato | -0.666% (518) | -0.737% (534) | -0.682% [-0.95%, -0.39%] |
| Consenso (almeno 2 su 3) | 112 | 44.6% | -0.993% | [-1.82%, -0.10%] | svantaggio dimostrato | -0.396% (41) | -1.337% (71) | -1.562% [-2.65%, -0.54%] |
| Momentum (confronto) | 1596 | 43.9% | -0.805% | [-0.99%, -0.62%] | svantaggio dimostrato | -0.972% (775) | -0.647% (821) | -0.865% [-1.09%, -0.64%] |
| Sempre long (confronto) | 1596 | 42.4% | -0.824% | [-0.99%, -0.65%] | svantaggio dimostrato | -0.919% (775) | -0.735% (821) | -0.769% [-0.99%, -0.55%] |

### SOLUSDT 1h

Dal 04/07/2021 al 10/11/2026, 46811 candele. Buy & hold nel periodo: +135.3% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 671 | 38.0% | -0.595% | [-0.77%, -0.44%] | svantaggio dimostrato | -0.677% (235) | -0.550% (436) | -0.640% [-0.85%, -0.43%] |
| Mean Reversion | 1344 | 41.4% | -0.496% | [-0.57%, -0.42%] | svantaggio dimostrato | -0.531% (608) | -0.466% (736) | -0.516% [-0.61%, -0.42%] |
| MA Crossover | 4367 | 41.4% | -0.475% | [-0.54%, -0.42%] | svantaggio dimostrato | -0.486% (2193) | -0.465% (2174) | -0.479% [-0.56%, -0.41%] |
| Consenso (almeno 2 su 3) | 453 | 40.2% | -0.523% | [-0.75%, -0.30%] | svantaggio dimostrato | -0.628% (165) | -0.463% (288) | -0.591% [-0.88%, -0.31%] |
| Momentum (confronto) | 6642 | 40.1% | -0.524% | [-0.57%, -0.48%] | svantaggio dimostrato | -0.535% (3291) | -0.512% (3351) | -0.580% [-0.63%, -0.52%] |
| Sempre long (confronto) | 6642 | 40.7% | -0.538% | [-0.58%, -0.49%] | svantaggio dimostrato | -0.569% (3291) | -0.509% (3351) | -0.528% [-0.58%, -0.47%] |

