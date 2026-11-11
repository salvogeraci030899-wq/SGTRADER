# Laboratorio strategie

Generato il 2026-11-11T01:32:56+00:00 · 36 prove in questa esecuzione, 36 registrate in tutto.

- **Ricerca** solo sullo storico prima del 2025-11-11; da lì in poi è **sigillato** per la prova finale.
- **Costi** (scenario principale: futures, ordini a mercato): 0.11% per lato più funding. "Netto" = dopo questi costi, tasse escluse.
- **Funding**: Bitget pubblica solo gli ultimi mesi. Per i trade più vecchi vale un'ipotesi prudente: il long paga 0.01% ogni 8 ore, lo short non riceve nulla.
- **Candidata** = netto positivo che supera la correzione per prove multiple (falsi positivi attesi 10%) **e** stabile (positiva in entrambe le metà del periodo e su almeno 2 coin su 3).
- **Netto annuo per coin**: somma dei netti divisa per anni e coin, senza leva e senza reinvestire. Indicativo.
- Una candidata non è un segnale valido: deve ancora superare la prova finale e poi la prova dal vivo senza soldi.
- I risultati passati non garantiscono quelli futuri. Non è consulenza finanziaria.

**Candidate: nessuna.** **Confermate dalla prova finale: nessuna.**

### Timeframe 1d

| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Netto annuo per coin | Esito |
|---|---|---|---|---|---|---|---|---|---|---|---|
| donchian20_long | trend | 115 | 41.7% | 17.4 candele | +4.920% | [+0.58%, +9.28%] | 0.0156 | +7.46% / +3.35% | +2.29% / +6.83% / +6.77% | +29.6% | no |
| donchian20_calm | trend | 119 | 42.0% | 17.5 candele | +4.006% | [+0.44%, +8.16%] | 0.0217 | +10.21% / +0.37% | +3.46% / +5.97% / +1.41% | +25.2% | no |
| donchian55 | trend | 111 | 39.6% | 22.0 candele | +3.197% | [-0.99%, +8.51%] | 0.0996 | +6.31% / +1.07% | +2.14% / +3.63% / +4.39% | +18.7% | no |
| app_breakout_trail | trend | 42 | 40.5% | 31.7 candele | +3.172% | [-6.41%, +13.98%] | 0.2803 | +18.73% / -1.07% | +1.15% / +3.38% / +6.25% | +7.1% | no |
| ema_pullback | trend | 159 | 34.0% | 22.4 candele | +2.159% | [-1.52%, +6.90%] | 0.1568 | +4.90% / +0.45% | +2.35% / +3.04% / +0.21% | +17.8% | no |
| big_candle | volatilità | 247 | 52.6% | 3.9 candele | +1.854% | [+0.49%, +3.25%] | 0.0047 | +2.90% / +1.01% | +1.12% / +1.99% / +3.46% | +23.9% | no |
| donchian20 | trend | 192 | 35.9% | 19.6 candele | +1.729% | [-1.48%, +5.14%] | 0.1700 | +4.97% / -0.17% | +1.14% / +1.76% / +2.81% | +17.4% | no |
| tsmom30_long | momentum | 420 | 51.4% | 6.7 candele | +1.609% | [+0.30%, +2.89%] | 0.0088 | +2.48% / +1.03% | +1.21% / +1.97% / +1.71% | +34.9% | no |
| tsmom30 | momentum | 889 | 50.1% | 6.8 candele | +0.832% | [+0.01%, +1.64%] | 0.0253 | +1.64% / +0.28% | +0.69% / +0.88% / +1.00% | +38.1% | no |
| tsmom90 | momentum | 898 | 47.6% | 6.7 candele | +0.163% | [-0.65%, +1.04%] | 0.3530 | +0.30% / +0.07% | +0.21% / +0.13% / +0.12% | +7.6% | no |
| bollinger_revert | ritorno alla media | 111 | 51.4% | 4.5 candele | -0.341% | [-2.38%, +1.82%] | 0.6231 | -2.18% / +0.74% | -0.03% / -2.65% / +4.08% | -2.0% | no |
| rsi2_pullback | ritorno alla media | 308 | 49.7% | 4.7 candele | -0.650% | [-1.88%, +0.58%] | 0.8523 | -1.08% / -0.38% | +0.20% / -1.33% / -1.05% | -10.4% | no |

### Timeframe 4h

| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Netto annuo per coin | Esito |
|---|---|---|---|---|---|---|---|---|---|---|---|
| app_breakout_trail | trend | 354 | 35.3% | 23.0 candele | +0.616% | [-0.36%, +1.54%] | 0.1020 | +2.20% / -0.19% | +1.57% / -0.09% / +0.50% | +10.2% | no |
| ema_pullback | trend | 941 | 35.4% | 25.6 candele | +0.603% | [-0.03%, +1.22%] | 0.0299 | +0.90% / +0.40% | +0.52% / +0.39% / +1.09% | +26.4% | no |
| donchian55 | trend | 712 | 37.6% | 21.5 candele | +0.591% | [-0.09%, +1.28%] | 0.0422 | +0.59% / +0.59% | +0.29% / +0.72% / +0.86% | +19.7% | no |
| donchian20_long | trend | 676 | 38.5% | 20.7 candele | +0.535% | [-0.12%, +1.25%] | 0.0682 | +0.83% / +0.31% | +0.52% / +0.61% / +0.42% | +16.9% | no |
| donchian20 | trend | 1203 | 38.0% | 21.2 candele | +0.292% | [-0.23%, +0.83%] | 0.1353 | +0.23% / +0.33% | +0.14% / +0.24% / +0.62% | +16.4% | no |
| big_candle | volatilità | 1906 | 48.2% | 4.1 candele | +0.240% | [+0.04%, +0.44%] | 0.0094 | +0.42% / +0.12% | +0.19% / +0.22% / +0.39% | +21.4% | no |
| tsmom30_long | momentum | 2592 | 47.6% | 6.7 candele | +0.157% | [-0.05%, +0.37%] | 0.0794 | +0.32% / +0.03% | +0.04% / +0.22% / +0.27% | +19.0% | no |
| donchian20_calm | trend | 826 | 36.1% | 18.1 candele | +0.149% | [-0.36%, +0.69%] | 0.2896 | +0.54% / -0.13% | +0.02% / +0.41% / -0.05% | +5.7% | no |
| tsmom30 | momentum | 6004 | 45.0% | 6.7 candele | -0.058% | [-0.20%, +0.08%] | 0.7924 | +0.07% / -0.15% | -0.08% / -0.12% / +0.07% | -16.3% | no |
| tsmom90 | momentum | 6038 | 45.7% | 6.7 candele | -0.103% | [-0.23%, +0.03%] | 0.9310 | -0.09% / -0.11% | -0.15% / -0.12% / +0.00% | -29.0% | no |
| rsi2_pullback | ritorno alla media | 1919 | 48.6% | 4.8 candele | -0.148% | [-0.34%, +0.03%] | 0.9370 | -0.25% / -0.08% | -0.26% / -0.21% / +0.14% | -13.3% | no |
| bollinger_revert | ritorno alla media | 723 | 48.7% | 4.8 candele | -0.249% | [-0.55%, +0.07%] | 0.9403 | -0.60% / -0.01% | -0.36% / -0.31% / +0.06% | -8.4% | no |

### Timeframe 1h

| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Netto annuo per coin | Esito |
|---|---|---|---|---|---|---|---|---|---|---|---|
| donchian20_long | trend | 2636 | 32.4% | 21.3 candele | +0.021% | [-0.14%, +0.20%] | 0.4058 | +0.31% / -0.17% | -0.00% / +0.07% / -0.02% | +2.5% | no |
| ema_pullback | trend | 4197 | 32.6% | 23.6 candele | -0.041% | [-0.19%, +0.09%] | 0.7206 | +0.15% / -0.17% | -0.10% / -0.04% / +0.05% | -7.9% | no |
| app_breakout_trail | trend | 1447 | 33.6% | 22.7 candele | -0.050% | [-0.29%, +0.21%] | 0.6520 | -0.13% / -0.01% | -0.29% / +0.13% / +0.02% | -3.3% | no |
| donchian20_calm | trend | 3077 | 30.8% | 17.9 candele | -0.062% | [-0.19%, +0.07%] | 0.8305 | +0.19% / -0.23% | -0.08% / -0.01% / -0.12% | -8.7% | no |
| donchian55 | trend | 2782 | 31.5% | 23.5 candele | -0.072% | [-0.24%, +0.10%] | 0.7938 | -0.02% / -0.11% | -0.15% / +0.07% / -0.18% | -9.2% | no |
| donchian20 | trend | 4941 | 31.8% | 21.2 candele | -0.128% | [-0.24%, -0.01%] | 0.9853 | +0.00% / -0.21% | -0.18% / -0.06% / -0.16% | -29.1% | no |
| rsi2_pullback | ritorno alla media | 7493 | 45.9% | 4.8 candele | -0.140% | [-0.19%, -0.09%] | 1.0000 | -0.11% / -0.16% | -0.17% / -0.17% / -0.05% | -48.3% | no |
| tsmom30_long | momentum | 10499 | 40.7% | 6.7 candele | -0.142% | [-0.20%, -0.09%] | 1.0000 | -0.10% / -0.17% | -0.17% / -0.16% / -0.07% | -68.9% | no |
| big_candle | volatilità | 7250 | 39.2% | 3.9 candele | -0.148% | [-0.20%, -0.10%] | 1.0000 | -0.11% / -0.17% | -0.16% / -0.13% / -0.15% | -49.2% | no |
| tsmom90 | momentum | 24583 | 41.2% | 6.7 candele | -0.165% | [-0.20%, -0.13%] | 1.0000 | -0.15% / -0.18% | -0.19% / -0.16% / -0.13% | -185.9% | no |
| tsmom30 | momentum | 24515 | 39.6% | 6.7 candele | -0.202% | [-0.24%, -0.17%] | 1.0000 | -0.20% / -0.20% | -0.21% / -0.20% / -0.18% | -226.8% | no |
| bollinger_revert | ritorno alla media | 2783 | 46.5% | 4.7 candele | -0.209% | [-0.29%, -0.13%] | 1.0000 | -0.23% / -0.19% | -0.25% / -0.23% / -0.09% | -26.7% | no |

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
