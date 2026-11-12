# Validazione storica delle strategie tecniche

Generato il 2026-11-12T21:32:25+00:00 · orizzonte 7 candele · piano: stop 1.5 x ATR, target 1.5 x il rischio.

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
| Breakout | 624 | 44.4% | +0.034% | [-0.30%, +0.40%] | vantaggio NON dimostrato | +0.135% (174) | -0.005% (450) | +0.091% [-0.36%, +0.56%] |
| Mean Reversion | 1032 | 41.6% | -0.317% | [-0.52%, -0.12%] | svantaggio dimostrato | -0.249% (387) | -0.359% (645) | -0.288% [-0.55%, +0.00%] |
| MA Crossover | 4507 | 43.5% | -0.142% | [-0.27%, -0.02%] | svantaggio dimostrato | -0.097% (1968) | -0.178% (2539) | -0.106% [-0.26%, +0.06%] |
| Consenso (almeno 2 su 3) | 438 | 43.2% | -0.183% | [-0.61%, +0.23%] | vantaggio NON dimostrato | +0.129% (130) | -0.315% (308) | -0.068% [-0.62%, +0.48%] |
| Momentum (confronto) | 6656 | 41.3% | -0.297% | [-0.39%, -0.21%] | svantaggio dimostrato | -0.297% (2869) | -0.297% (3787) | -0.267% [-0.39%, -0.14%] |
| Sempre long (confronto) | 6656 | 42.6% | -0.257% | [-0.36%, -0.16%] | svantaggio dimostrato | -0.218% (2869) | -0.287% (3787) | -0.133% [-0.27%, +0.01%] |

### Timeframe 1h (BTC, ETH e SOL insieme)

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 2497 | 38.2% | -0.271% | [-0.36%, -0.18%] | svantaggio dimostrato | -0.201% (717) | -0.299% (1780) | -0.258% [-0.37%, -0.15%] |
| Mean Reversion | 6450 | 38.2% | -0.338% | [-0.38%, -0.30%] | svantaggio dimostrato | -0.398% (2482) | -0.301% (3968) | -0.342% [-0.40%, -0.29%] |
| MA Crossover | 18188 | 37.9% | -0.258% | [-0.29%, -0.23%] | svantaggio dimostrato | -0.224% (7939) | -0.284% (10249) | -0.240% [-0.28%, -0.20%] |
| Consenso (almeno 2 su 3) | 1681 | 40.5% | -0.186% | [-0.30%, -0.07%] | svantaggio dimostrato | -0.070% (518) | -0.237% (1163) | -0.160% [-0.32%, -0.00%] |
| Momentum (confronto) | 27227 | 36.9% | -0.290% | [-0.31%, -0.27%] | svantaggio dimostrato | -0.270% (11753) | -0.305% (15474) | -0.292% [-0.32%, -0.26%] |
| Sempre long (confronto) | 27227 | 38.3% | -0.300% | [-0.33%, -0.27%] | svantaggio dimostrato | -0.302% (11753) | -0.298% (15474) | -0.263% [-0.30%, -0.23%] |

### BTCUSDT 1d

Dal 19/05/2019 al 11/11/2026, 2734 candele. Buy & hold nel periodo: +815.7% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 29 | 37.9% | -0.629% | [-2.82%, +1.63%] | campione insufficiente | +0.232% (14) | -1.433% (15) | +0.256% [-2.06%, +2.64%] |
| Mean Reversion | 40 | 52.5% | +0.245% | [-1.70%, +2.12%] | vantaggio NON dimostrato | -1.591% (18) | +1.746% (22) | +1.109% [-1.96%, +4.20%] |
| MA Crossover | 271 | 46.1% | -0.101% | [-0.85%, +0.66%] | vantaggio NON dimostrato | -0.151% (139) | -0.048% (132) | +0.384% [-0.60%, +1.43%] |
| Consenso (almeno 2 su 3) | 21 | 47.6% | -0.177% | [-2.60%, +2.32%] | campione insufficiente | -0.716% (10) | +0.313% (11) | +0.950% [-2.15%, +3.88%] |
| Momentum (confronto) | 390 | 44.9% | -0.194% | [-0.83%, +0.46%] | vantaggio NON dimostrato | +0.442% (195) | -0.831% (195) | -0.495% [-1.29%, +0.33%] |
| Sempre long (confronto) | 390 | 47.2% | +0.333% | [-0.29%, +1.00%] | vantaggio NON dimostrato | +0.673% (195) | -0.006% (195) | +0.618% [-0.19%, +1.45%] |

### BTCUSDT 4h

Dal 12/09/2018 al 12/11/2026, 17900 candele. Buy & hold nel periodo: +1043.0% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 208 | 42.3% | -0.127% | [-0.48%, +0.21%] | vantaggio NON dimostrato | -0.039% (65) | -0.167% (143) | +0.201% [-0.34%, +0.73%] |
| Mean Reversion | 463 | 41.5% | -0.273% | [-0.47%, -0.07%] | svantaggio dimostrato | -0.356% (197) | -0.211% (266) | -0.248% [-0.52%, +0.02%] |
| MA Crossover | 1744 | 42.0% | -0.193% | [-0.32%, -0.06%] | svantaggio dimostrato | -0.171% (883) | -0.217% (861) | -0.126% [-0.30%, +0.04%] |
| Consenso (almeno 2 su 3) | 144 | 45.8% | -0.019% | [-0.45%, +0.40%] | vantaggio NON dimostrato | +0.420% (47) | -0.232% (97) | +0.376% [-0.31%, +1.07%] |
| Momentum (confronto) | 2557 | 39.1% | -0.329% | [-0.43%, -0.22%] | svantaggio dimostrato | -0.382% (1279) | -0.277% (1278) | -0.269% [-0.41%, -0.14%] |
| Sempre long (confronto) | 2557 | 41.8% | -0.230% | [-0.33%, -0.14%] | svantaggio dimostrato | -0.200% (1279) | -0.261% (1278) | -0.146% [-0.27%, -0.02%] |

### BTCUSDT 1h

Dal 06/08/2018 al 12/11/2026, 72497 candele. Buy & hold nel periodo: +906.2% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 891 | 38.9% | -0.233% | [-0.33%, -0.14%] | svantaggio dimostrato | -0.185% (298) | -0.257% (593) | -0.202% [-0.32%, -0.09%] |
| Mean Reversion | 2767 | 35.8% | -0.340% | [-0.38%, -0.30%] | svantaggio dimostrato | -0.366% (1216) | -0.320% (1551) | -0.360% [-0.42%, -0.30%] |
| MA Crossover | 7033 | 35.4% | -0.279% | [-0.31%, -0.25%] | svantaggio dimostrato | -0.268% (3510) | -0.291% (3523) | -0.267% [-0.31%, -0.22%] |
| Consenso (almeno 2 su 3) | 610 | 42.5% | -0.133% | [-0.26%, -0.01%] | svantaggio dimostrato | +0.029% (211) | -0.219% (399) | -0.059% [-0.21%, +0.10%] |
| Momentum (confronto) | 10356 | 34.6% | -0.296% | [-0.32%, -0.27%] | svantaggio dimostrato | -0.298% (5178) | -0.294% (5178) | -0.282% [-0.32%, -0.25%] |
| Sempre long (confronto) | 10356 | 36.2% | -0.297% | [-0.32%, -0.27%] | svantaggio dimostrato | -0.305% (5178) | -0.288% (5178) | -0.263% [-0.30%, -0.23%] |

### ETHUSDT 1d

Dal 01/06/2019 al 11/11/2026, 2721 candele. Buy & hold nel periodo: +650.0% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 26 | 69.2% | +1.469% | [-2.04%, +4.81%] | campione insufficiente | +1.667% (14) | +1.239% (12) | +4.100% [+0.37%, +8.15%] |
| Mean Reversion | 38 | 42.1% | +0.044% | [-1.99%, +2.27%] | vantaggio NON dimostrato | +0.619% (18) | -0.474% (20) | +0.954% [-1.80%, +4.00%] |
| MA Crossover | 248 | 43.5% | -0.029% | [-1.01%, +1.06%] | vantaggio NON dimostrato | +0.637% (135) | -0.826% (113) | +0.480% [-0.88%, +1.91%] |
| Consenso (almeno 2 su 3) | 16 | 68.8% | +2.454% | [-2.96%, +7.62%] | campione insufficiente | +0.889% (11) | +5.898% (5) | +6.722% [+1.28%, +12.49%] |
| Momentum (confronto) | 369 | 43.6% | -0.432% | [-1.23%, +0.41%] | vantaggio NON dimostrato | -0.064% (185) | -0.802% (184) | -0.166% [-1.29%, +0.96%] |
| Sempre long (confronto) | 369 | 47.7% | +0.378% | [-0.42%, +1.19%] | vantaggio NON dimostrato | +0.998% (185) | -0.246% (184) | +0.970% [-0.15%, +2.10%] |

### ETHUSDT 4h

Dal 12/09/2018 al 12/11/2026, 17825 candele. Buy & hold nel periodo: +1075.9% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 246 | 43.9% | +0.104% | [-0.37%, +0.57%] | vantaggio NON dimostrato | +0.500% (83) | -0.097% (163) | +0.176% [-0.36%, +0.75%] |
| Mean Reversion | 361 | 41.3% | -0.453% | [-0.74%, -0.15%] | svantaggio dimostrato | -0.555% (151) | -0.380% (210) | -0.524% [-0.90%, -0.12%] |
| MA Crossover | 1709 | 43.7% | -0.105% | [-0.27%, +0.07%] | vantaggio NON dimostrato | -0.014% (843) | -0.193% (866) | -0.129% [-0.35%, +0.09%] |
| Consenso (almeno 2 su 3) | 181 | 40.3% | -0.186% | [-0.74%, +0.40%] | vantaggio NON dimostrato | +0.311% (64) | -0.458% (117) | +0.143% [-0.55%, +0.78%] |
| Momentum (confronto) | 2501 | 41.8% | -0.277% | [-0.40%, -0.14%] | svantaggio dimostrato | -0.211% (1223) | -0.339% (1278) | -0.257% [-0.43%, -0.08%] |
| Sempre long (confronto) | 2501 | 43.5% | -0.250% | [-0.38%, -0.12%] | svantaggio dimostrato | -0.225% (1223) | -0.275% (1278) | -0.098% [-0.28%, +0.08%] |

### ETHUSDT 1h

Dal 06/08/2018 al 12/11/2026, 72193 candele. Buy & hold nel periodo: +391.6% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 934 | 37.6% | -0.268% | [-0.39%, -0.15%] | svantaggio dimostrato | -0.286% (340) | -0.257% (594) | -0.256% [-0.42%, -0.10%] |
| Mean Reversion | 2339 | 39.2% | -0.355% | [-0.41%, -0.30%] | svantaggio dimostrato | -0.436% (1011) | -0.293% (1328) | -0.342% [-0.42%, -0.26%] |
| MA Crossover | 6781 | 38.2% | -0.264% | [-0.31%, -0.22%] | svantaggio dimostrato | -0.217% (3411) | -0.311% (3370) | -0.243% [-0.30%, -0.19%] |
| Consenso (almeno 2 su 3) | 617 | 38.6% | -0.223% | [-0.38%, -0.07%] | svantaggio dimostrato | -0.266% (236) | -0.197% (381) | -0.199% [-0.42%, +0.02%] |
| Momentum (confronto) | 10222 | 37.2% | -0.286% | [-0.32%, -0.25%] | svantaggio dimostrato | -0.268% (5044) | -0.303% (5178) | -0.282% [-0.32%, -0.24%] |
| Sempre long (confronto) | 10222 | 39.0% | -0.300% | [-0.33%, -0.27%] | svantaggio dimostrato | -0.299% (5044) | -0.301% (5178) | -0.264% [-0.31%, -0.22%] |

### SOLUSDT 1d

Dal 16/04/2022 al 11/11/2026, 1667 candele. Buy & hold nel periodo: -22.3% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 24 | 75.0% | +5.639% | [+0.80%, +10.36%] | campione insufficiente | +8.221% (12) | +3.057% (12) | +5.272% [-0.02%, +9.95%] |
| Mean Reversion | 15 | 60.0% | +4.199% | [-0.22%, +8.80%] | campione insufficiente | +12.571% (6) | -1.383% (9) | +5.639% [-2.00%, +15.02%] |
| MA Crossover | 136 | 46.3% | +0.163% | [-1.46%, +1.70%] | vantaggio NON dimostrato | +1.002% (61) | -0.519% (75) | +1.847% [-0.27%, +4.05%] |
| Consenso (almeno 2 su 3) | 21 | 71.4% | +5.994% | [+0.64%, +11.23%] | campione insufficiente | +8.561% (11) | +3.169% (10) | +4.484% [-1.56%, +9.95%] |
| Momentum (confronto) | 194 | 47.4% | +0.014% | [-1.28%, +1.38%] | vantaggio NON dimostrato | -0.360% (75) | +0.250% (119) | +0.019% [-1.67%, +1.79%] |
| Sempre long (confronto) | 194 | 40.7% | -0.809% | [-2.19%, +0.50%] | vantaggio NON dimostrato | -1.742% (75) | -0.222% (119) | -0.140% [-1.95%, +1.45%] |

### SOLUSDT 4h

Dal 11/08/2021 al 12/11/2026, 11492 candele. Buy & hold nel periodo: +91.9% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 170 | 47.6% | +0.128% | [-0.62%, +0.87%] | vantaggio NON dimostrato | +0.653% (58) | -0.143% (112) | -0.167% [-1.14%, +0.84%] |
| Mean Reversion | 208 | 42.3% | -0.180% | [-0.75%, +0.36%] | vantaggio NON dimostrato | +0.210% (91) | -0.484% (117) | +0.033% [-0.62%, +0.70%] |
| MA Crossover | 1054 | 45.7% | -0.119% | [-0.38%, +0.16%] | vantaggio NON dimostrato | +0.029% (519) | -0.262% (535) | -0.033% [-0.37%, +0.31%] |
| Consenso (almeno 2 su 3) | 113 | 44.2% | -0.387% | [-1.38%, +0.60%] | vantaggio NON dimostrato | +0.515% (41) | -0.900% (72) | -0.971% [-2.27%, +0.44%] |
| Momentum (confronto) | 1598 | 44.0% | -0.277% | [-0.49%, -0.06%] | svantaggio dimostrato | -0.363% (776) | -0.196% (822) | -0.280% [-0.55%, -0.02%] |
| Sempre long (confronto) | 1598 | 42.3% | -0.310% | [-0.51%, -0.10%] | svantaggio dimostrato | -0.306% (776) | -0.313% (822) | -0.169% [-0.43%, +0.09%] |

### SOLUSDT 1h

Dal 04/07/2021 al 12/11/2026, 46862 candele. Buy & hold nel periodo: +132.4% lordo.

| Strategia | Trade | Vincenti | Netto medio (piano) | IC 95% | Giudizio | Prima metà | Seconda metà | Netto medio (solo direzione) |
|---|---|---|---|---|---|---|---|---|
| Breakout | 672 | 38.1% | -0.326% | [-0.52%, -0.13%] | svantaggio dimostrato | -0.337% (235) | -0.320% (437) | -0.335% [-0.59%, -0.09%] |
| Mean Reversion | 1344 | 41.4% | -0.304% | [-0.40%, -0.21%] | svantaggio dimostrato | -0.297% (608) | -0.310% (736) | -0.304% [-0.42%, -0.19%] |
| MA Crossover | 4374 | 41.4% | -0.214% | [-0.28%, -0.14%] | svantaggio dimostrato | -0.165% (2196) | -0.263% (2178) | -0.193% [-0.27%, -0.11%] |
| Consenso (almeno 2 su 3) | 454 | 40.3% | -0.205% | [-0.48%, +0.06%] | vantaggio NON dimostrato | -0.230% (165) | -0.191% (289) | -0.241% [-0.57%, +0.11%] |
| Momentum (confronto) | 6649 | 40.1% | -0.288% | [-0.34%, -0.24%] | svantaggio dimostrato | -0.249% (3294) | -0.325% (3355) | -0.325% [-0.39%, -0.26%] |
| Sempre long (confronto) | 6649 | 40.7% | -0.304% | [-0.36%, -0.25%] | svantaggio dimostrato | -0.285% (3294) | -0.322% (3355) | -0.263% [-0.33%, -0.20%] |

