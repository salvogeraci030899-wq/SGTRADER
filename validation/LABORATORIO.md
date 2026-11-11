# Laboratorio strategie

Generato il 2026-11-11T05:42:00+00:00 · 44 prove in questa esecuzione, 44 registrate in tutto.

- **Ricerca** solo sullo storico prima del 2025-11-11; da lì in poi è **sigillato** per la prova finale.
- **Costi** (scenario principale: futures, ordini a mercato): 0.11% per lato più funding. "Netto" = dopo questi costi, tasse escluse.
- **Funding**: Bitget pubblica solo gli ultimi mesi. Per i trade più vecchi vale un'ipotesi prudente: il long paga 0.01% ogni 8 ore, lo short non riceve nulla.
- **Oltre il mercato**: netto del trade meno quello che avrebbe reso la semplice esposizione (direzione x durata x rendimento medio della coin). Misura la scelta dei momenti, non il rialzo del mercato. Intervallo, p, metà e coin si riferiscono a questa misura.
- **Candidata** = netto positivo, e netto oltre il mercato che supera la correzione per prove multiple (falsi positivi attesi 10%) **e** stabile (positivo in entrambe le metà del periodo e su almeno 2 coin su 3).
- **Netto annuo per coin**: somma dei netti divisa per anni e coin, senza leva e senza reinvestire. Indicativo.
- Una candidata non è un segnale valido: deve ancora superare la prova finale e poi la prova dal vivo senza soldi.
- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.

**Candidate: big_candle_trail:1d.** **Confermate dalla prova finale: nessuna.**

### Timeframe 1d

| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | Netto annuo per coin | Oltre il mercato | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Esito |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| app_breakout_trail | trend | 42 | 40.5% | 31.7 candele | +3.172% | +7.1% | +5.467% | [-4.69%, +17.24%] | 0.1776 | +24.30% / +0.33% | +1.28% / +7.04% / +10.45% | no |
| donchian20_turtle | trend | 179 | 36.3% | 22.2 candele | +5.246% | +48.8% | +4.520% | [-1.06%, +13.72%] | 0.1125 | +14.41% / -0.10% | +2.68% / +7.45% / +3.23% | no |
| big_candle_trail | volatilità | 187 | 45.5% | 12.0 candele | +3.803% | +37.5% | +3.669% | [+1.46%, +6.19%] | 0.0015 | +6.39% / +1.77% | +1.84% / +5.30% / +4.54% | **CANDIDATA** |
| donchian20_calm | trend | 119 | 42.0% | 17.5 candele | +4.006% | +25.2% | +3.119% | [-0.44%, +7.70%] | 0.0671 | +9.49% / -0.62% | +2.12% / +5.10% / +1.24% | no |
| donchian55 | trend | 111 | 39.6% | 22.0 candele | +3.197% | +18.7% | +2.939% | [-1.08%, +8.04%] | 0.1110 | +6.53% / +0.49% | +1.46% / +3.59% / +4.53% | no |
| donchian20_regime | trend | 147 | 38.1% | 19.1 candele | +2.345% | +18.0% | +2.133% | [-1.75%, +6.47%] | 0.1621 | +6.10% / -0.31% | +0.54% / +2.74% / +3.89% | no |
| donchian20_long | trend | 115 | 41.7% | 17.4 candele | +4.920% | +29.6% | +1.924% | [-2.24%, +5.96%] | 0.1877 | +4.77% / +0.16% | -0.44% / +4.32% / +2.27% | no |
| big_candle | volatilità | 247 | 52.6% | 3.9 candele | +1.854% | +23.9% | +1.768% | [+0.40%, +3.19%] | 0.0068 | +2.92% / +0.84% | +1.03% / +1.98% / +3.17% | no |
| donchian20 | trend | 192 | 35.9% | 19.6 candele | +1.729% | +17.4% | +1.725% | [-1.42%, +5.07%] | 0.1621 | +5.12% / -0.27% | +0.59% / +2.03% / +3.33% | no |
| ema_pullback | trend | 159 | 34.0% | 22.4 candele | +2.159% | +17.8% | +1.341% | [-2.62%, +6.40%] | 0.2775 | +4.06% / -0.35% | +0.61% / +2.17% / +1.19% | no |
| tsmom30 | momentum | 889 | 50.1% | 6.8 candele | +0.832% | +38.1% | +0.743% | [-0.08%, +1.55%] | 0.0394 | +1.55% / +0.19% | +0.56% / +0.81% / +0.95% | no |
| tsmom_combo | momentum | 669 | 51.0% | 6.7 candele | +0.917% | +31.6% | +0.677% | [-0.32%, +1.69%] | 0.0936 | +1.35% / +0.23% | +0.37% / +0.90% / +0.86% | no |
| tsmom30_long | momentum | 420 | 51.4% | 6.7 candele | +1.609% | +34.9% | +0.456% | [-0.84%, +1.74%] | 0.2495 | +1.46% / -0.21% | +0.21% / +0.92% / +0.01% | no |
| tsmom90 | momentum | 898 | 47.6% | 6.7 candele | +0.163% | +7.6% | -0.070% | [-0.92%, +0.79%] | 0.5648 | +0.17% / -0.23% | -0.01% / -0.11% / -0.10% | no |
| bollinger_revert | ritorno alla media | 111 | 51.4% | 4.5 candele | -0.341% | -2.0% | -0.441% | [-2.45%, +1.69%] | 0.6591 | -2.06% / +0.51% | -0.14% / -2.75% / +4.02% | no |
| rsi2_pullback | ritorno alla media | 308 | 49.7% | 4.7 candele | -0.650% | -10.4% | -0.769% | [-2.01%, +0.49%] | 0.8903 | -1.10% / -0.56% | -0.02% / -1.47% / -0.92% | no |

### Timeframe 4h

| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | Netto annuo per coin | Oltre il mercato | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Esito |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| app_breakout_trail | trend | 354 | 35.3% | 23.0 candele | +0.616% | +10.2% | +0.957% | [-0.02%, +1.92%] | 0.0265 | +2.54% / +0.16% | +1.88% / +0.16% / +1.05% | no |
| donchian20_regime | trend | 930 | 39.9% | 20.8 candele | +0.750% | +32.6% | +0.718% | [+0.15%, +1.28%] | 0.0072 | +0.82% / +0.65% | +0.57% / +0.73% / +0.91% | no |
| ema_pullback | trend | 941 | 35.4% | 25.6 candele | +0.603% | +26.4% | +0.563% | [-0.06%, +1.16%] | 0.0368 | +0.82% / +0.39% | +0.49% / +0.34% / +1.06% | no |
| donchian55 | trend | 712 | 37.6% | 21.5 candele | +0.591% | +19.7% | +0.517% | [-0.14%, +1.19%] | 0.0609 | +0.48% / +0.55% | +0.22% / +0.59% / +0.88% | no |
| donchian20_turtle | trend | 1203 | 31.4% | 22.4 candele | +0.440% | +24.6% | +0.372% | [-0.19%, +0.95%] | 0.0959 | +0.61% / +0.20% | +0.34% / +0.30% / +0.54% | no |
| big_candle_trail | volatilità | 1442 | 37.8% | 11.6 candele | +0.269% | +18.1% | +0.272% | [-0.07%, +0.64%] | 0.0670 | +0.38% / +0.20% | +0.11% / +0.34% / +0.49% | no |
| donchian20 | trend | 1203 | 38.0% | 21.2 candele | +0.292% | +16.4% | +0.256% | [-0.26%, +0.79%] | 0.1667 | +0.19% / +0.30% | +0.10% / +0.18% / +0.64% | no |
| big_candle | volatilità | 1906 | 48.2% | 4.1 candele | +0.240% | +21.4% | +0.239% | [+0.04%, +0.43%] | 0.0096 | +0.41% / +0.12% | +0.20% / +0.21% / +0.38% | no |
| donchian20_calm | trend | 826 | 36.1% | 18.1 candele | +0.149% | +5.7% | +0.072% | [-0.43%, +0.61%] | 0.3924 | +0.44% / -0.19% | -0.05% / +0.29% / -0.06% | no |
| tsmom_combo | momentum | 4797 | 45.0% | 6.7 candele | -0.024% | -5.4% | -0.036% | [-0.19%, +0.11%] | 0.6756 | +0.02% / -0.07% | -0.10% / -0.06% / +0.12% | no |
| tsmom30_long | momentum | 2592 | 47.6% | 6.7 candele | +0.157% | +19.0% | -0.048% | [-0.26%, +0.17%] | 0.6680 | +0.13% / -0.19% | -0.13% / +0.04% / -0.05% | no |
| tsmom30 | momentum | 6004 | 45.0% | 6.7 candele | -0.058% | -16.3% | -0.067% | [-0.21%, +0.07%] | 0.8266 | +0.06% / -0.16% | -0.09% / -0.13% / +0.07% | no |
| donchian20_long | trend | 676 | 38.5% | 20.7 candele | +0.535% | +16.9% | -0.098% | [-0.72%, +0.60%] | 0.6109 | +0.24% / -0.35% | -0.00% / +0.04% / -0.49% | no |
| tsmom90 | momentum | 6038 | 45.7% | 6.7 candele | -0.103% | -29.0% | -0.115% | [-0.24%, +0.02%] | 0.9524 | -0.12% / -0.11% | -0.17% / -0.13% / -0.00% | no |
| rsi2_pullback | ritorno alla media | 1919 | 48.6% | 4.8 candele | -0.148% | -13.3% | -0.150% | [-0.34%, +0.04%] | 0.9381 | -0.26% / -0.07% | -0.27% / -0.21% / +0.15% | no |
| bollinger_revert | ritorno alla media | 723 | 48.7% | 4.8 candele | -0.249% | -8.4% | -0.251% | [-0.56%, +0.06%] | 0.9414 | -0.61% / -0.01% | -0.38% / -0.30% / +0.07% | no |

### Timeframe 1h

| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | Netto annuo per coin | Oltre il mercato | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Esito |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| app_breakout_trail | trend | 1447 | 33.6% | 22.7 candele | -0.050% | -3.3% | +0.039% | [-0.21%, +0.30%] | 0.3814 | -0.05% / +0.09% | -0.21% / +0.21% / +0.14% | no |
| ema_pullback | trend | 4197 | 32.6% | 23.6 candele | -0.041% | -7.9% | -0.046% | [-0.19%, +0.09%] | 0.7468 | +0.13% / -0.16% | -0.11% / -0.04% / +0.06% | no |
| donchian20_calm | trend | 3077 | 30.8% | 17.9 candele | -0.062% | -8.7% | -0.079% | [-0.20%, +0.05%] | 0.8922 | +0.16% / -0.24% | -0.10% / -0.03% / -0.13% | no |
| donchian55 | trend | 2782 | 31.5% | 23.5 candele | -0.072% | -9.2% | -0.082% | [-0.25%, +0.09%] | 0.8248 | -0.04% / -0.11% | -0.16% / +0.05% / -0.17% | no |
| donchian20 | trend | 4941 | 31.8% | 21.2 candele | -0.128% | -29.1% | -0.133% | [-0.25%, -0.01%] | 0.9881 | -0.01% / -0.21% | -0.19% / -0.06% / -0.16% | no |
| rsi2_pullback | ritorno alla media | 7493 | 45.9% | 4.8 candele | -0.140% | -48.3% | -0.141% | [-0.19%, -0.09%] | 1.0000 | -0.11% / -0.16% | -0.17% / -0.18% / -0.04% | no |
| donchian20_long | trend | 2636 | 32.4% | 21.3 candele | +0.021% | +2.5% | -0.146% | [-0.30%, +0.03%] | 0.9569 | +0.14% / -0.33% | -0.14% / -0.08% / -0.26% | no |
| big_candle | volatilità | 7250 | 39.2% | 3.9 candele | -0.148% | -49.2% | -0.148% | [-0.20%, -0.10%] | 1.0000 | -0.11% / -0.17% | -0.16% / -0.13% / -0.15% | no |
| tsmom90 | momentum | 24583 | 41.2% | 6.7 candele | -0.165% | -185.9% | -0.167% | [-0.20%, -0.13%] | 1.0000 | -0.15% / -0.18% | -0.19% / -0.16% / -0.13% | no |
| tsmom30_long | momentum | 10499 | 40.7% | 6.7 candele | -0.142% | -68.9% | -0.194% | [-0.25%, -0.14%] | 1.0000 | -0.15% / -0.23% | -0.21% / -0.21% / -0.14% | no |
| tsmom30 | momentum | 24515 | 39.6% | 6.7 candele | -0.202% | -226.8% | -0.203% | [-0.24%, -0.17%] | 1.0000 | -0.20% / -0.20% | -0.21% / -0.20% / -0.18% | no |
| bollinger_revert | ritorno alla media | 2783 | 46.5% | 4.7 candele | -0.209% | -26.7% | -0.212% | [-0.29%, -0.13%] | 1.0000 | -0.23% / -0.20% | -0.26% / -0.24% / -0.09% | no |

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
