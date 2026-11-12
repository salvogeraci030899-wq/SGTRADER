# Laboratorio strategie

Generato il 2026-11-12T09:19:06+00:00 · 56 prove in questa esecuzione, 56 registrate in tutto.

- **Ricerca** solo sullo storico prima del 2025-11-11; da lì in poi è **sigillato** per la prova finale.
- **Costi** (scenario principale: futures, ordini a mercato): 0.11% per lato più funding. "Netto" = dopo questi costi, tasse escluse.
- **Funding**: Bitget pubblica solo gli ultimi mesi. Per i trade più vecchi vale un'ipotesi prudente: il long paga 0.01% ogni 8 ore, lo short non riceve nulla.
- **Oltre il mercato**: netto del trade meno quello che avrebbe reso la semplice esposizione (direzione x durata x rendimento medio della coin). Misura la scelta dei momenti, non il rialzo del mercato. Intervallo, p, metà e coin si riferiscono a questa misura.
- **Candidata** = netto positivo, e netto oltre il mercato che supera la correzione per prove multiple (falsi positivi attesi 10%) **e** stabile (positivo in entrambe le metà del periodo e su almeno 2 coin su 3).
- **Portafoglio**: la strategia sulle tre coin insieme con le regole dell'esecutore (rischio 0,5% a trade sullo stop iniziale, leva massima 3x, esposizione 1,5x, massimo 3 posizioni): rendimento annuo composto e drawdown massimo, misurati alla chiusura dei trade.
- Una candidata non è un segnale valido: deve ancora superare la prova finale e poi la prova dal vivo senza soldi.
- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.

**Candidate in attesa della prova finale: nessuna.** **Confermate: nessuna.** **Non confermate: big_candle_trail:1d.**

### Timeframe 1d

| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | Portafoglio: annuo / max DD | Oltre il mercato | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Esito |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| app_breakout_trail | trend | 42 | 40.5% | 31.7 candele | +3.183% | +1.0% / -3.1% | +5.477% | [-4.68%, +17.25%] | 0.1771 | +24.31% / +0.34% | +1.30% / +7.05% / +10.46% | no |
| donchian20_turtle | trend | 179 | 36.3% | 22.2 candele | +5.262% | +11.0% / -10.9% | +4.535% | [-1.05%, +13.74%] | 0.1117 | +14.43% / -0.09% | +2.70% / +7.46% / +3.25% | no |
| big_candle_trail | volatilità | 187 | 45.5% | 12.0 candele | +3.819% | +9.1% / -4.5% | +3.686% | [+1.48%, +6.21%] | 0.0014 | +6.40% / +1.78% | +1.85% / +5.31% / +4.57% | bocciata alla prova finale |
| donchian20_calm | trend | 119 | 42.0% | 17.5 candele | +4.027% | +5.2% / -7.5% | +3.140% | [-0.41%, +7.72%] | 0.0658 | +9.51% / -0.60% | +2.14% / +5.12% / +1.25% | no |
| donchian55 | trend | 111 | 39.6% | 22.0 candele | +3.218% | +3.8% / -4.8% | +2.960% | [-1.06%, +8.06%] | 0.1094 | +6.56% / +0.51% | +1.48% / +3.61% / +4.55% | no |
| donchian20_regime | trend | 147 | 38.1% | 19.1 candele | +2.364% | +4.0% / -9.2% | +2.152% | [-1.74%, +6.50%] | 0.1600 | +6.12% / -0.29% | +0.56% / +2.76% / +3.91% | no |
| donchian20_long | trend | 115 | 41.7% | 17.4 candele | +4.950% | +5.6% / -5.4% | +1.954% | [-2.21%, +5.99%] | 0.1840 | +4.80% / +0.19% | -0.41% / +4.35% / +2.30% | no |
| big_candle | volatilità | 247 | 52.6% | 3.9 candele | +1.871% | +4.8% / -3.4% | +1.785% | [+0.42%, +3.21%] | 0.0064 | +2.94% / +0.86% | +1.05% / +2.00% / +3.19% | no |
| donchian20_oi | funding | 104 | 37.5% | 18.9 candele | +3.259% | +4.2% / -7.4% | +1.755% | [-2.35%, +6.05%] | 0.2018 | +4.21% / +0.34% | +0.87% / +2.60% / +2.24% | no |
| donchian20 | trend | 192 | 35.9% | 19.6 candele | +1.746% | +4.2% / -11.3% | +1.743% | [-1.41%, +5.09%] | 0.1597 | +5.14% / -0.25% | +0.61% / +2.05% / +3.35% | no |
| ema_pullback | trend | 159 | 34.0% | 22.4 candele | +2.180% | +3.2% / -6.7% | +1.361% | [-2.60%, +6.43%] | 0.2744 | +4.08% / -0.33% | +0.63% / +2.19% / +1.20% | no |
| tsmom30 | momentum | 889 | 50.1% | 6.8 candele | +0.848% | +4.6% / -6.2% | +0.759% | [-0.07%, +1.57%] | 0.0363 | +1.56% / +0.20% | +0.58% / +0.83% / +0.97% | no |
| tsmom_combo | momentum | 669 | 51.1% | 6.7 candele | +0.935% | +3.8% / -5.4% | +0.696% | [-0.30%, +1.71%] | 0.0878 | +1.37% / +0.24% | +0.39% / +0.91% / +0.87% | no |
| tsmom30_long | momentum | 420 | 51.7% | 6.7 candele | +1.639% | +3.8% / -3.9% | +0.486% | [-0.81%, +1.77%] | 0.2356 | +1.49% / -0.18% | +0.24% / +0.95% / +0.04% | no |
| crowd_fade | funding | 151 | 46.4% | 6.7 candele | -0.083% | -0.4% / -7.1% | +0.397% | [-1.48%, +2.31%] | 0.3453 | +3.08% / -1.10% | -0.08% / +0.79% / +0.66% | no |
| relstrength30 | forza relativa | 519 | 47.6% | 6.7 candele | +0.267% | +0.9% / -3.4% | +0.283% | [-0.49%, +1.06%] | 0.2400 | +0.31% / +0.26% | +0.00% / -0.51% / +1.33% | no |
| tsmom90 | momentum | 898 | 47.6% | 6.7 candele | +0.181% | +1.2% / -9.6% | -0.052% | [-0.90%, +0.81%] | 0.5482 | +0.18% / -0.21% | +0.00% / -0.09% / -0.08% | no |
| relstrength90 | forza relativa | 480 | 46.7% | 6.6 candele | -0.207% | -1.1% / -6.5% | -0.213% | [-0.93%, +0.51%] | 0.7181 | -0.21% / -0.22% | -0.44% / -0.70% / +0.54% | no |
| relstrength30_long | forza relativa | 275 | 47.3% | 6.7 candele | +0.980% | +1.8% / -5.5% | -0.241% | [-1.55%, +1.13%] | 0.6349 | -1.12% / +0.57% | -1.04% / -0.73% / +1.33% | no |
| bollinger_revert | ritorno alla media | 111 | 52.3% | 4.5 candele | -0.324% | -0.5% / -4.0% | -0.424% | [-2.43%, +1.71%] | 0.6533 | -2.04% / +0.53% | -0.12% / -2.74% / +4.04% | no |
| funding_fade | funding | 225 | 44.0% | 6.6 candele | -0.657% | -1.2% / -8.5% | -0.693% | [-2.19%, +0.85%] | 0.8006 | -0.49% / -0.88% | -0.97% / -1.00% / +0.13% | no |
| rsi2_pullback | ritorno alla media | 308 | 50.3% | 4.7 candele | -0.633% | -1.4% / -8.9% | -0.752% | [-2.00%, +0.51%] | 0.8849 | -1.08% / -0.54% | +0.00% / -1.45% / -0.91% | no |

### Timeframe 4h

| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | Portafoglio: annuo / max DD | Oltre il mercato | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Esito |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| app_breakout_trail | trend | 354 | 35.3% | 23.0 candele | +0.618% | +5.9% / -8.7% | +0.959% | [-0.02%, +1.92%] | 0.0263 | +2.54% / +0.16% | +1.88% / +0.17% / +1.05% | no |
| donchian20_regime | trend | 930 | 39.9% | 20.8 candele | +0.753% | +16.5% / -11.2% | +0.721% | [+0.16%, +1.29%] | 0.0070 | +0.82% / +0.65% | +0.57% / +0.74% / +0.92% | no |
| ema_pullback | trend | 941 | 35.4% | 25.6 candele | +0.606% | +13.1% / -15.5% | +0.566% | [-0.06%, +1.17%] | 0.0362 | +0.82% / +0.39% | +0.49% / +0.34% / +1.07% | no |
| donchian55 | trend | 712 | 37.6% | 21.5 candele | +0.594% | +9.7% / -13.3% | +0.520% | [-0.14%, +1.19%] | 0.0598 | +0.48% / +0.55% | +0.22% / +0.59% / +0.88% | no |
| donchian20_oi | funding | 573 | 38.6% | 21.8 candele | +0.558% | +10.1% / -9.1% | +0.462% | [-0.18%, +1.11%] | 0.0890 | +0.26% / +0.60% | -0.09% / +0.30% / +1.45% | no |
| donchian20_turtle | trend | 1203 | 31.4% | 22.4 candele | +0.442% | +19.0% / -19.2% | +0.374% | [-0.18%, +0.95%] | 0.0944 | +0.62% / +0.20% | +0.34% / +0.30% / +0.54% | no |
| big_candle_trail | volatilità | 1442 | 37.8% | 11.6 candele | +0.271% | +17.5% / -13.9% | +0.274% | [-0.07%, +0.64%] | 0.0656 | +0.38% / +0.20% | +0.11% / +0.34% / +0.49% | no |
| donchian20 | trend | 1203 | 38.0% | 21.2 candele | +0.294% | +14.1% / -12.0% | +0.259% | [-0.26%, +0.79%] | 0.1643 | +0.20% / +0.31% | +0.10% / +0.18% / +0.65% | no |
| big_candle | volatilità | 1906 | 48.2% | 4.1 candele | +0.244% | +15.0% / -18.1% | +0.243% | [+0.04%, +0.44%] | 0.0086 | +0.42% / +0.12% | +0.20% / +0.22% / +0.38% | no |
| donchian20_calm | trend | 826 | 36.1% | 18.1 candele | +0.151% | +6.4% / -16.3% | +0.075% | [-0.42%, +0.61%] | 0.3886 | +0.44% / -0.19% | -0.05% / +0.29% / -0.06% | no |
| tsmom_combo | momentum | 4797 | 45.1% | 6.7 candele | -0.019% | -1.1% / -28.3% | -0.031% | [-0.18%, +0.11%] | 0.6521 | +0.02% / -0.07% | -0.10% / -0.05% / +0.12% | no |
| tsmom30_long | momentum | 2592 | 47.6% | 6.7 candele | +0.166% | +5.2% / -14.5% | -0.039% | [-0.25%, +0.18%] | 0.6364 | +0.14% / -0.18% | -0.12% / +0.05% / -0.04% | no |
| relstrength90 | forza relativa | 3169 | 47.9% | 6.7 candele | -0.053% | -6.4% / -33.3% | -0.048% | [-0.16%, +0.06%] | 0.8027 | +0.01% / -0.10% | -0.23% / -0.03% / +0.09% | no |
| tsmom30 | momentum | 6004 | 45.0% | 6.7 candele | -0.053% | -3.6% / -47.0% | -0.062% | [-0.20%, +0.07%] | 0.8080 | +0.06% / -0.15% | -0.09% / -0.12% / +0.08% | no |
| donchian20_long | trend | 676 | 38.5% | 20.7 candele | +0.540% | +11.7% / -16.4% | -0.093% | [-0.71%, +0.61%] | 0.6057 | +0.25% / -0.35% | +0.00% / +0.05% / -0.48% | no |
| crowd_fade | funding | 310 | 42.9% | 6.8 candele | -0.186% | -0.3% / -6.8% | -0.106% | [-0.60%, +0.42%] | 0.6615 | +0.55% / -0.51% | -0.00% / +0.30% / -0.56% | no |
| tsmom90 | momentum | 6038 | 45.8% | 6.7 candele | -0.098% | -8.0% / -47.5% | -0.110% | [-0.24%, +0.02%] | 0.9447 | -0.11% / -0.11% | -0.16% / -0.12% / +0.00% | no |
| relstrength30 | forza relativa | 3384 | 45.8% | 6.7 candele | -0.134% | -11.7% / -43.3% | -0.131% | [-0.24%, -0.01%] | 0.9874 | -0.09% / -0.17% | -0.26% / -0.35% / +0.17% | no |
| rsi2_pullback | ritorno alla media | 1919 | 48.6% | 4.8 candele | -0.144% | -5.8% / -34.8% | -0.145% | [-0.34%, +0.04%] | 0.9317 | -0.26% / -0.07% | -0.26% / -0.20% / +0.15% | no |
| bollinger_revert | ritorno alla media | 723 | 48.7% | 4.8 candele | -0.244% | -3.2% / -25.8% | -0.246% | [-0.55%, +0.07%] | 0.9377 | -0.61% / -0.01% | -0.37% / -0.30% / +0.07% | no |
| relstrength30_long | forza relativa | 1831 | 47.0% | 6.7 candele | -0.031% | -4.2% / -24.1% | -0.249% | [-0.48%, +0.01%] | 0.9778 | -0.32% / -0.18% | -0.26% / -0.37% / -0.13% | no |
| funding_fade | funding | 1120 | 45.4% | 6.6 candele | -0.307% | -5.0% / -27.2% | -0.325% | [-0.66%, +0.01%] | 0.9731 | -0.23% / -0.43% | -0.16% / -0.29% / -0.57% | no |

### Timeframe 1h

| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | Portafoglio: annuo / max DD | Oltre il mercato | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Esito |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| app_breakout_trail | trend | 1447 | 33.6% | 22.7 candele | -0.050% | +1.5% / -26.5% | +0.039% | [-0.21%, +0.30%] | 0.3805 | -0.05% / +0.09% | -0.21% / +0.21% / +0.14% | no |
| ema_pullback | trend | 4197 | 32.6% | 23.6 candele | -0.041% | -10.3% / -75.8% | -0.046% | [-0.19%, +0.09%] | 0.7445 | +0.13% / -0.16% | -0.11% / -0.04% / +0.06% | no |
| donchian20_calm | trend | 3077 | 30.8% | 17.9 candele | -0.061% | -9.1% / -80.8% | -0.079% | [-0.20%, +0.05%] | 0.8904 | +0.16% / -0.24% | -0.10% / -0.02% / -0.13% | no |
| donchian55 | trend | 2782 | 31.5% | 23.5 candele | -0.071% | +4.9% / -38.1% | -0.081% | [-0.25%, +0.09%] | 0.8228 | -0.04% / -0.11% | -0.15% / +0.05% / -0.17% | no |
| donchian20 | trend | 4941 | 31.8% | 21.2 candele | -0.128% | -8.9% / -78.7% | -0.132% | [-0.25%, -0.01%] | 0.9878 | -0.01% / -0.21% | -0.19% / -0.06% / -0.16% | no |
| rsi2_pullback | ritorno alla media | 7493 | 45.9% | 4.8 candele | -0.140% | -32.6% / -94.3% | -0.141% | [-0.19%, -0.09%] | 1.0000 | -0.11% / -0.16% | -0.17% / -0.18% / -0.04% | no |
| donchian20_long | trend | 2636 | 32.4% | 21.3 candele | +0.022% | +2.7% / -56.3% | -0.145% | [-0.30%, +0.03%] | 0.9558 | +0.14% / -0.33% | -0.13% / -0.08% / -0.26% | no |
| big_candle | volatilità | 7250 | 39.2% | 3.9 candele | -0.148% | -44.0% / -98.7% | -0.148% | [-0.20%, -0.10%] | 1.0000 | -0.11% / -0.17% | -0.16% / -0.13% / -0.15% | no |
| tsmom90 | momentum | 24583 | 41.3% | 6.7 candele | -0.160% | -69.1% / -100.0% | -0.162% | [-0.20%, -0.13%] | 1.0000 | -0.15% / -0.17% | -0.19% / -0.15% / -0.13% | no |
| tsmom30_long | momentum | 10499 | 41.0% | 6.7 candele | -0.133% | -36.8% / -96.4% | -0.185% | [-0.24%, -0.13%] | 1.0000 | -0.14% / -0.22% | -0.20% / -0.20% / -0.14% | no |
| tsmom30 | momentum | 24515 | 39.8% | 6.7 candele | -0.197% | -73.4% / -100.0% | -0.198% | [-0.23%, -0.16%] | 1.0000 | -0.20% / -0.20% | -0.21% / -0.20% / -0.18% | no |
| bollinger_revert | ritorno alla media | 2783 | 46.5% | 4.7 candele | -0.209% | -18.1% / -76.5% | -0.212% | [-0.29%, -0.13%] | 1.0000 | -0.23% / -0.20% | -0.26% / -0.24% / -0.09% | no |

### Prove finali sui mesi sigillati

| Prova | Aperta il | Trade | Netto medio | Oltre il mercato | IC 95% | p | Esito |
|---|---|---|---|---|---|---|---|
| big_candle_trail:1d | 2026-11-11 | 33 | +0.808% | +0.793% | [-4.46%, +7.20%] | 0.3990 | non confermata |

### Le strategie

- **donchian20** (trend): Long se la chiusura supera il massimo delle 20 candele precedenti, short sotto il minimo. Stop 2 ATR, poi stop che segue a 3 ATR, massimo 60 candele.
- **donchian55** (trend): Come donchian20 ma su 55 candele (rotture più rare e più importanti), massimo 120 candele.
- **donchian20_long** (trend): Solo la parte long di donchian20 (utilizzabile anche in spot).
- **donchian20_calm** (trend): donchian20 solo quando la volatilità (ATR in % del prezzo) è sotto la sua mediana delle ultime 100 candele: rotture che partono da una fase calma.
- **ema_pullback** (trend): Con EMA50 sopra EMA200, long quando la chiusura torna sopra l'EMA20 dopo esserne scesa sotto (speculare per lo short). Stop 2 ATR, stop che segue a 3 ATR, massimo 60 candele.
- **tsmom30** (momentum): Direzione del rendimento delle ultime 30 candele, tenuta 7 candele, stop 3 ATR.
- **tsmom90** (momentum): Come tsmom30 ma sul rendimento delle ultime 90 candele.
- **tsmom30_long** (momentum): Solo long quando il rendimento a 30 candele è positivo e il prezzo è sopra la media a 200.
- **rsi2_pullback** (ritorno alla media): Sopra la media a 200: long se RSI(2) < 10. Sotto: short se RSI(2) > 90. Tenuta 5 candele, stop 3 ATR.
- **bollinger_revert** (ritorno alla media): Long se la chiusura è sotto la banda inferiore di Bollinger (20, 2) ma sopra la media a 200; short speculare. Tenuta 5 candele, stop 3 ATR.
- **big_candle** (volatilità): Segue la direzione di una candela il cui corpo supera 1,5 volte l'ATR precedente. Tenuta 5 candele, stop 1,5 ATR, target 3 ATR.
- **app_breakout_trail** (trend): La regola Breakout della pagina Segnali (rottura a 20 candele con volume, RSI e EMA200), ma lasciata correre: stop 2 ATR, stop che segue a 3 ATR, massimo 60 candele.
- **donchian20_regime** (trend): donchian20 con filtro di regime: long solo sopra la media a 200, short solo sotto. Stesse uscite di donchian20.
- **donchian20_turtle** (trend): Ingressi di donchian20, uscita classica 'a canale': si esce quando la chiusura rompe il minimo (long) o il massimo (short) delle 10 candele precedenti. Stop 2 ATR, massimo 120 candele.
- **big_candle_trail** (volatilità): Ingressi di big_candle ma lasciati correre: stop 1,5 ATR, stop che segue a 3 ATR, massimo 20 candele.
- **tsmom_combo** (momentum): Long se i rendimenti a 30 e a 90 candele sono entrambi positivi, short se entrambi negativi. Tenuta 7 candele, stop 3 ATR.
- **relstrength30** (forza relativa): Long la coin con il rendimento a 30 candele più alto delle tre, short quella con il più basso. Tenuta 7 candele, stop 3 ATR.
- **relstrength90** (forza relativa): Come relstrength30 ma sul rendimento a 90 candele.
- **relstrength30_long** (forza relativa): Solo la parte long di relstrength30: compra la coin più forte delle tre.
- **funding_fade** (funding): Contro la folla: short quando il funding degli ultimi 7 giorni è nel 10% più alto dell'ultimo anno (troppi long a leva), long quando è nel 10% più basso. Tenuta 7 candele, stop 3 ATR.
- **donchian20_oi** (funding): Rotture di donchian20 solo se l'open interest è cresciuto negli ultimi 7 giorni (soldi nuovi che entrano). Uscite di donchian20.
- **crowd_fade** (funding): Contro la folla: short quando la quota di conti long è molto sopra la sua media a 30 giorni (z > 2), long quando è molto sotto (z < -2). Tenuta 7 candele, stop 3 ATR.
