# Validazione storica delle strategie tecniche

Generato il 2026-11-11T01:33:36+00:00 · orizzonte 7 candele · piano: stop 1.5 x ATR, target 1.5 x il rischio.

- **Costi**: commissione 0.1% e slippage 0.05% per lato. "Netto" = dopo questi costi. Tasse 33% applicate una volta al guadagno complessivo (le perdite compensano i guadagni).
- **Giudizio**: un vantaggio è dimostrato solo se l'intero intervallo di confidenza al 95% del netto medio è sopra zero.
- **Prima/seconda metà**: netto medio (e numero di trade) nelle due metà del periodo; un risultato che cambia segno non è stabile.
- Regole fisse, non adattate ai dati; i parametri sono però valori noti scelti conoscendo il passato.
- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.

### Timeframe 1d (BTC, ETH e SOL insieme)

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 79 | 59.5% | +1.966% | [-0.39%, +4.22%] | vantaggio NON dimostrato | +3.657% (34) | +0.688% (45) | +3.045% [+0.53%, +5.35%] |
| Mean Reversion | 93 | 49.5% | +0.800% | [-0.86%, +2.58%] | vantaggio NON dimostrato | +0.553% (39) | +0.979% (54) | +1.776% [-0.95%, +5.00%] |
| MA Crossover | 655 | 45.2% | -0.019% | [-0.71%, +0.72%] | vantaggio NON dimostrato | +0.315% (296) | -0.295% (359) | +0.724% [-0.23%, +1.69%] |
| Consenso (almeno 2 su 3) | 58 | 62.1% | +2.783% | [-0.32%, +5.38%] | vantaggio NON dimostrato | +3.552% (28) | +2.065% (30) | +3.822% [+0.37%, +6.97%] |
| Momentum (confronto) | 953 | 44.9% | -0.244% | [-0.81%, +0.34%] | vantaggio NON dimostrato | +0.067% (405) | -0.474% (548) | -0.263% [-1.05%, +0.52%] |
| Sempre long (confronto) | 953 | 46.1% | +0.118% | [-0.48%, +0.78%] | vantaggio NON dimostrato | +0.404% (405) | -0.093% (548) | +0.600% [-0.33%, +1.50%] |

### Timeframe 4h (BTC, ETH e SOL insieme)

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 621 | 44.6% | +0.050% | [-0.30%, +0.41%] | vantaggio NON dimostrato | +0.135% (174) | +0.017% (447) | +0.105% [-0.35%, +0.54%] |
| Mean Reversion | 1032 | 41.6% | -0.317% | [-0.52%, -0.12%] | svantaggio dimostrato | -0.249% (387) | -0.359% (645) | -0.288% [-0.55%, +0.00%] |
| MA Crossover | 4501 | 43.4% | -0.145% | [-0.27%, -0.02%] | svantaggio dimostrato | -0.100% (1965) | -0.180% (2536) | -0.108% [-0.27%, +0.05%] |
| Consenso (almeno 2 su 3) | 435 | 43.4% | -0.162% | [-0.55%, +0.25%] | vantaggio NON dimostrato | +0.129% (130) | -0.286% (305) | -0.049% [-0.58%, +0.50%] |
| Momentum (confronto) | 6651 | 41.3% | -0.297% | [-0.39%, -0.20%] | svantaggio dimostrato | -0.299% (2866) | -0.296% (3785) | -0.268% [-0.39%, -0.14%] |
| Sempre long (confronto) | 6651 | 42.6% | -0.256% | [-0.36%, -0.15%] | svantaggio dimostrato | -0.217% (2866) | -0.286% (3785) | -0.132% [-0.28%, -0.00%] |

### Timeframe 1h (BTC, ETH e SOL insieme)

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 2495 | 38.2% | -0.271% | [-0.36%, -0.18%] | svantaggio dimostrato | -0.200% (716) | -0.299% (1779) | -0.258% [-0.38%, -0.14%] |
| Mean Reversion | 6449 | 38.2% | -0.338% | [-0.38%, -0.30%] | svantaggio dimostrato | -0.398% (2480) | -0.301% (3969) | -0.342% [-0.39%, -0.29%] |
| MA Crossover | 18169 | 37.9% | -0.258% | [-0.29%, -0.23%] | svantaggio dimostrato | -0.223% (7934) | -0.285% (10235) | -0.240% [-0.28%, -0.20%] |
| Consenso (almeno 2 su 3) | 1679 | 40.4% | -0.185% | [-0.30%, -0.06%] | svantaggio dimostrato | -0.070% (518) | -0.237% (1161) | -0.160% [-0.32%, -0.01%] |
| Momentum (confronto) | 27209 | 36.9% | -0.290% | [-0.31%, -0.27%] | svantaggio dimostrato | -0.270% (11744) | -0.306% (15465) | -0.292% [-0.32%, -0.26%] |
| Sempre long (confronto) | 27209 | 38.3% | -0.300% | [-0.33%, -0.27%] | svantaggio dimostrato | -0.302% (11744) | -0.298% (15465) | -0.263% [-0.30%, -0.23%] |

### BTCUSDT 1d

Dal 19/05/2019 al 09/11/2026, 2732 candele. Buy & hold nel periodo: +834.8% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 29 | 37.9% | -0.629% | [-2.82%, +1.63%] | campione insufficiente | +0.232% (14) | -1.433% (15) | +0.256% [-2.06%, +2.64%] |
| Mean Reversion | 40 | 52.5% | +0.245% | [-1.70%, +2.12%] | vantaggio NON dimostrato | -1.591% (18) | +1.746% (22) | +1.109% [-1.96%, +4.20%] |
| MA Crossover | 271 | 46.1% | -0.101% | [-0.85%, +0.66%] | vantaggio NON dimostrato | -0.151% (139) | -0.048% (132) | +0.384% [-0.60%, +1.43%] |
| Consenso (almeno 2 su 3) | 21 | 47.6% | -0.177% | [-2.60%, +2.32%] | campione insufficiente | -0.716% (10) | +0.313% (11) | +0.950% [-2.15%, +3.88%] |
| Momentum (confronto) | 390 | 44.9% | -0.194% | [-0.83%, +0.46%] | vantaggio NON dimostrato | +0.442% (195) | -0.831% (195) | -0.495% [-1.29%, +0.33%] |
| Sempre long (confronto) | 390 | 47.2% | +0.333% | [-0.29%, +1.00%] | vantaggio NON dimostrato | +0.673% (195) | -0.006% (195) | +0.618% [-0.19%, +1.45%] |

### BTCUSDT 4h

Dal 12/09/2018 al 10/11/2026, 17889 candele. Buy & hold nel periodo: +1076.5% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 207 | 42.5% | -0.116% | [-0.45%, +0.24%] | vantaggio NON dimostrato | -0.039% (65) | -0.151% (142) | +0.211% [-0.31%, +0.78%] |
| Mean Reversion | 463 | 41.5% | -0.273% | [-0.47%, -0.07%] | svantaggio dimostrato | -0.356% (197) | -0.211% (266) | -0.248% [-0.52%, +0.02%] |
| MA Crossover | 1742 | 41.9% | -0.195% | [-0.31%, -0.07%] | svantaggio dimostrato | -0.170% (882) | -0.220% (860) | -0.128% [-0.30%, +0.05%] |
| Consenso (almeno 2 su 3) | 143 | 46.2% | -0.003% | [-0.45%, +0.45%] | vantaggio NON dimostrato | +0.453% (46) | -0.219% (97) | +0.392% [-0.32%, +1.15%] |
| Momentum (confronto) | 2555 | 39.1% | -0.330% | [-0.43%, -0.22%] | svantaggio dimostrato | -0.384% (1278) | -0.275% (1277) | -0.270% [-0.40%, -0.13%] |
| Sempre long (confronto) | 2555 | 41.9% | -0.229% | [-0.33%, -0.13%] | svantaggio dimostrato | -0.199% (1278) | -0.259% (1277) | -0.144% [-0.28%, -0.02%] |

### BTCUSDT 1h

Dal 06/08/2018 al 11/11/2026, 72453 candele. Buy & hold nel periodo: +935.6% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 890 | 38.9% | -0.234% | [-0.33%, -0.14%] | svantaggio dimostrato | -0.185% (298) | -0.258% (592) | -0.202% [-0.32%, -0.08%] |
| Mean Reversion | 2766 | 35.8% | -0.340% | [-0.38%, -0.30%] | svantaggio dimostrato | -0.366% (1216) | -0.320% (1550) | -0.359% [-0.42%, -0.30%] |
| MA Crossover | 7026 | 35.4% | -0.279% | [-0.31%, -0.25%] | svantaggio dimostrato | -0.267% (3508) | -0.292% (3518) | -0.267% [-0.30%, -0.23%] |
| Consenso (almeno 2 su 3) | 609 | 42.4% | -0.133% | [-0.26%, -0.01%] | svantaggio dimostrato | +0.029% (211) | -0.219% (398) | -0.060% [-0.21%, +0.09%] |
| Momentum (confronto) | 10350 | 34.6% | -0.296% | [-0.32%, -0.27%] | svantaggio dimostrato | -0.298% (5175) | -0.294% (5175) | -0.282% [-0.32%, -0.25%] |
| Sempre long (confronto) | 10350 | 36.2% | -0.297% | [-0.32%, -0.27%] | svantaggio dimostrato | -0.306% (5175) | -0.288% (5175) | -0.263% [-0.30%, -0.23%] |

### ETHUSDT 1d

Dal 01/06/2019 al 09/11/2026, 2719 candele. Buy & hold nel periodo: +655.4% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 26 | 69.2% | +1.469% | [-2.04%, +4.81%] | campione insufficiente | +1.667% (14) | +1.239% (12) | +4.100% [+0.37%, +8.15%] |
| Mean Reversion | 38 | 42.1% | +0.044% | [-1.99%, +2.27%] | vantaggio NON dimostrato | +0.619% (18) | -0.474% (20) | +0.954% [-1.80%, +4.00%] |
| MA Crossover | 248 | 43.5% | -0.029% | [-1.01%, +1.06%] | vantaggio NON dimostrato | +0.637% (135) | -0.826% (113) | +0.480% [-0.88%, +1.91%] |
| Consenso (almeno 2 su 3) | 16 | 68.8% | +2.454% | [-2.96%, +7.62%] | campione insufficiente | +0.889% (11) | +5.898% (5) | +6.722% [+1.28%, +12.49%] |
| Momentum (confronto) | 369 | 43.6% | -0.432% | [-1.23%, +0.41%] | vantaggio NON dimostrato | -0.064% (185) | -0.802% (184) | -0.166% [-1.29%, +0.96%] |
| Sempre long (confronto) | 369 | 47.7% | +0.378% | [-0.42%, +1.19%] | vantaggio NON dimostrato | +0.998% (185) | -0.246% (184) | +0.970% [-0.15%, +2.10%] |

### ETHUSDT 4h

Dal 12/09/2018 al 10/11/2026, 17814 candele. Buy & hold nel periodo: +1096.7% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 245 | 44.1% | +0.120% | [-0.36%, +0.59%] | vantaggio NON dimostrato | +0.500% (83) | -0.075% (162) | +0.189% [-0.38%, +0.77%] |
| Mean Reversion | 361 | 41.3% | -0.453% | [-0.74%, -0.15%] | svantaggio dimostrato | -0.555% (151) | -0.380% (210) | -0.524% [-0.90%, -0.12%] |
| MA Crossover | 1707 | 43.6% | -0.107% | [-0.28%, +0.07%] | vantaggio NON dimostrato | -0.013% (842) | -0.199% (865) | -0.131% [-0.35%, +0.09%] |
| Consenso (almeno 2 su 3) | 180 | 40.6% | -0.167% | [-0.72%, +0.42%] | vantaggio NON dimostrato | +0.311% (64) | -0.430% (116) | +0.160% [-0.51%, +0.86%] |
| Momentum (confronto) | 2500 | 41.8% | -0.275% | [-0.41%, -0.14%] | svantaggio dimostrato | -0.211% (1222) | -0.337% (1278) | -0.256% [-0.43%, -0.08%] |
| Sempre long (confronto) | 2500 | 43.5% | -0.252% | [-0.38%, -0.12%] | svantaggio dimostrato | -0.225% (1222) | -0.277% (1278) | -0.099% [-0.27%, +0.07%] |

### ETHUSDT 1h

Dal 06/08/2018 al 11/11/2026, 72149 candele. Buy & hold nel periodo: +399.7% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 933 | 37.6% | -0.266% | [-0.39%, -0.14%] | svantaggio dimostrato | -0.286% (340) | -0.255% (593) | -0.257% [-0.42%, -0.09%] |
| Mean Reversion | 2339 | 39.2% | -0.355% | [-0.41%, -0.30%] | svantaggio dimostrato | -0.436% (1011) | -0.293% (1328) | -0.342% [-0.42%, -0.26%] |
| MA Crossover | 6775 | 38.2% | -0.264% | [-0.31%, -0.22%] | svantaggio dimostrato | -0.216% (3410) | -0.312% (3365) | -0.243% [-0.30%, -0.19%] |
| Consenso (almeno 2 su 3) | 616 | 38.6% | -0.221% | [-0.37%, -0.07%] | svantaggio dimostrato | -0.266% (236) | -0.194% (380) | -0.200% [-0.41%, +0.02%] |
| Momentum (confronto) | 10216 | 37.1% | -0.286% | [-0.32%, -0.25%] | svantaggio dimostrato | -0.268% (5041) | -0.304% (5175) | -0.282% [-0.32%, -0.24%] |
| Sempre long (confronto) | 10216 | 39.0% | -0.300% | [-0.33%, -0.27%] | svantaggio dimostrato | -0.300% (5041) | -0.300% (5175) | -0.263% [-0.30%, -0.22%] |

### SOLUSDT 1d

Dal 16/04/2022 al 09/11/2026, 1665 candele. Buy & hold nel periodo: -21.7% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 24 | 75.0% | +5.639% | [+0.80%, +10.36%] | campione insufficiente | +8.221% (12) | +3.057% (12) | +5.272% [-0.02%, +9.95%] |
| Mean Reversion | 15 | 60.0% | +4.199% | [-0.22%, +8.80%] | campione insufficiente | +12.571% (6) | -1.383% (9) | +5.639% [-2.00%, +15.02%] |
| MA Crossover | 136 | 46.3% | +0.163% | [-1.46%, +1.70%] | vantaggio NON dimostrato | +1.002% (61) | -0.519% (75) | +1.847% [-0.27%, +4.05%] |
| Consenso (almeno 2 su 3) | 21 | 71.4% | +5.994% | [+0.64%, +11.23%] | campione insufficiente | +8.561% (11) | +3.169% (10) | +4.484% [-1.56%, +9.95%] |
| Momentum (confronto) | 194 | 47.4% | +0.014% | [-1.28%, +1.38%] | vantaggio NON dimostrato | -0.360% (75) | +0.250% (119) | +0.019% [-1.67%, +1.79%] |
| Sempre long (confronto) | 194 | 40.7% | -0.809% | [-2.19%, +0.50%] | vantaggio NON dimostrato | -1.742% (75) | -0.222% (119) | -0.140% [-1.95%, +1.45%] |

### SOLUSDT 4h

Dal 11/08/2021 al 10/11/2026, 11481 candele. Buy & hold nel periodo: +95.9% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 169 | 47.9% | +0.151% | [-0.61%, +0.93%] | vantaggio NON dimostrato | +0.653% (58) | -0.111% (111) | -0.148% [-1.11%, +0.88%] |
| Mean Reversion | 208 | 42.3% | -0.180% | [-0.75%, +0.36%] | vantaggio NON dimostrato | +0.210% (91) | -0.484% (117) | +0.033% [-0.62%, +0.70%] |
| MA Crossover | 1052 | 45.6% | -0.123% | [-0.39%, +0.15%] | vantaggio NON dimostrato | +0.038% (518) | -0.278% (534) | -0.036% [-0.36%, +0.31%] |
| Consenso (almeno 2 su 3) | 112 | 44.6% | -0.357% | [-1.33%, +0.73%] | vantaggio NON dimostrato | +0.515% (41) | -0.860% (71) | -0.950% [-2.22%, +0.33%] |
| Momentum (confronto) | 1596 | 43.9% | -0.280% | [-0.50%, -0.06%] | svantaggio dimostrato | -0.364% (775) | -0.201% (821) | -0.282% [-0.55%, -0.01%] |
| Sempre long (confronto) | 1596 | 42.4% | -0.308% | [-0.51%, -0.09%] | svantaggio dimostrato | -0.306% (775) | -0.310% (821) | -0.166% [-0.43%, +0.10%] |

### SOLUSDT 1h

Dal 04/07/2021 al 11/11/2026, 46818 candele. Buy & hold nel periodo: +137.6% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 672 | 38.1% | -0.326% | [-0.52%, -0.13%] | svantaggio dimostrato | -0.337% (235) | -0.320% (437) | -0.335% [-0.59%, -0.09%] |
| Mean Reversion | 1344 | 41.4% | -0.304% | [-0.40%, -0.21%] | svantaggio dimostrato | -0.297% (608) | -0.310% (736) | -0.304% [-0.42%, -0.19%] |
| MA Crossover | 4368 | 41.4% | -0.214% | [-0.28%, -0.15%] | svantaggio dimostrato | -0.167% (2193) | -0.261% (2175) | -0.193% [-0.28%, -0.11%] |
| Consenso (almeno 2 su 3) | 454 | 40.3% | -0.205% | [-0.48%, +0.06%] | vantaggio NON dimostrato | -0.230% (165) | -0.191% (289) | -0.241% [-0.57%, +0.11%] |
| Momentum (confronto) | 6643 | 40.1% | -0.287% | [-0.34%, -0.24%] | svantaggio dimostrato | -0.247% (3291) | -0.327% (3352) | -0.324% [-0.39%, -0.26%] |
| Sempre long (confronto) | 6643 | 40.7% | -0.304% | [-0.36%, -0.25%] | svantaggio dimostrato | -0.286% (3291) | -0.321% (3352) | -0.262% [-0.33%, -0.20%] |

