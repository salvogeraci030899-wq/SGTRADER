# Laboratorio strategie

Generato il 2026-11-12T23:29:06+00:00 · 56 prove in questa esecuzione, 56 registrate in tutto.

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
| donchian20_turtle | trend | 382 | 34.3% | 22.6 candele | +4.636% | +14.8% / -8.0% | +4.191% | [-0.43%, +10.01%] | 0.0572 | +11.19% / +1.84% | +2.70% / +7.46% / +3.25% / +7.81% / +7.46% / +0.88% / +3.02% / -1.22% | no |
| big_candle_trail | volatilità | 389 | 42.9% | 11.4 candele | +3.251% | +10.3% / -8.1% | +3.244% | [+1.07%, +5.67%] | 0.0023 | +7.13% / +1.57% | +1.85% / +5.31% / +4.57% / +6.28% / +2.32% / -0.29% / +2.45% / +1.26% | bocciata alla prova finale |
| donchian20_calm | trend | 268 | 39.6% | 17.5 candele | +3.371% | +5.3% / -9.0% | +3.129% | [-0.22%, +6.60%] | 0.0374 | +7.30% / +1.42% | +2.14% / +5.12% / +1.25% / +7.39% / +3.49% / +0.79% / +0.08% / +0.77% | no |
| app_breakout_trail | trend | 114 | 38.6% | 27.2 candele | +1.019% | +1.0% / -6.4% | +3.102% | [-4.04%, +11.46%] | 0.2274 | +8.91% / +1.30% | +1.30% / +7.05% / +10.46% / +1.05% / -0.08% / +0.61% / -0.47% / +9.66% | no |
| donchian20_long | trend | 244 | 40.6% | 15.2 candele | +5.339% | +9.0% / -6.1% | +3.096% | [-1.08%, +7.19%] | 0.0732 | +6.41% / +1.84% | -0.41% / +4.35% / +2.30% / +11.52% / +4.74% / -0.80% / +2.95% / -0.39% | no |
| donchian20_regime | trend | 312 | 36.9% | 18.6 candele | +2.249% | +6.8% / -7.8% | +2.406% | [-1.32%, +6.49%] | 0.1185 | +8.13% / +0.36% | +0.56% / +2.76% / +3.91% / +6.09% / +4.02% / -2.30% / +6.03% / -0.19% | no |
| donchian20 | trend | 403 | 36.0% | 19.5 candele | +1.786% | +7.0% / -7.8% | +2.118% | [-0.91%, +5.36%] | 0.0969 | +6.13% / +0.59% | +0.61% / +2.05% / +3.35% / +7.85% / +3.61% / -1.30% / +1.35% / -1.43% | no |
| donchian55 | trend | 232 | 36.2% | 19.4 candele | +1.965% | +6.5% / -4.1% | +2.013% | [-1.84%, +6.65%] | 0.1829 | +7.98% / -0.21% | +1.48% / +3.61% / +4.55% / +8.32% / +0.34% / -1.57% / +2.96% / -4.40% | no |
| big_candle | volatilità | 523 | 52.0% | 3.7 candele | +1.609% | +8.1% / -6.5% | +1.542% | [+0.31%, +2.72%] | 0.0055 | +3.45% / +0.68% | +1.05% / +2.00% / +3.19% / +3.14% / -0.70% / +1.63% / +1.22% / +0.36% | no |
| donchian20_oi | funding | 250 | 37.2% | 16.7 candele | +2.012% | +2.3% / -7.9% | +1.127% | [-2.27%, +4.54%] | 0.2596 | +0.45% / +1.45% | +0.87% / +2.60% / +2.24% / +2.66% / +0.99% / -1.09% / +1.25% / +0.14% | no |
| crowd_fade | funding | 385 | 48.6% | 6.8 candele | +0.790% | +1.5% / -4.1% | +1.061% | [-0.31%, +2.44%] | 0.0664 | +2.15% / +0.55% | -0.08% / +0.79% / +0.66% / +4.33% / +1.21% / +0.66% / +2.06% / -1.05% | no |
| ema_pullback | trend | 322 | 34.8% | 24.3 candele | +1.165% | +3.8% / -8.5% | +0.848% | [-2.90%, +5.53%] | 0.3488 | +6.56% / -1.33% | +0.63% / +2.19% / +1.20% / +3.03% / +1.71% / -0.42% / -2.53% / -1.40% | no |
| tsmom_combo | momentum | 1494 | 49.2% | 6.7 candele | +0.757% | +4.6% / -5.7% | +0.634% | [-0.27%, +1.56%] | 0.0865 | +1.74% / +0.21% | +0.39% / +0.91% / +0.87% / +0.51% / +1.64% / -0.01% / -0.23% / +0.88% | no |
| tsmom30 | momentum | 1951 | 48.0% | 6.7 candele | +0.477% | +4.9% / -8.5% | +0.447% | [-0.32%, +1.19%] | 0.1277 | +1.66% / -0.05% | +0.58% / +0.83% / +0.97% / +0.80% / +0.32% / +0.08% / -1.25% / +0.30% | no |
| relstrength30 | forza relativa | 519 | 47.6% | 6.7 candele | +0.267% | +0.9% / -3.4% | +0.283% | [-0.49%, +1.06%] | 0.2400 | +0.31% / +0.26% | +0.00% / -0.51% / +1.33% / — / — / — / — / — | no |
| tsmom30_long | momentum | 843 | 48.2% | 6.7 candele | +1.285% | +4.0% / -8.6% | +0.270% | [-1.05%, +1.65%] | 0.3516 | +1.75% / -0.23% | +0.24% / +0.95% / +0.04% / +0.35% / -0.04% / -0.59% / +0.04% / +0.52% | no |
| tsmom90 | momentum | 1970 | 46.1% | 6.7 candele | -0.001% | +0.9% / -14.3% | -0.136% | [-0.90%, +0.64%] | 0.6360 | +0.13% / -0.25% | +0.00% / -0.09% / -0.08% / -0.80% / +0.69% / -0.70% / -0.20% / +0.29% | no |
| relstrength90 | forza relativa | 480 | 46.7% | 6.6 candele | -0.207% | -1.1% / -6.5% | -0.213% | [-0.93%, +0.51%] | 0.7181 | -0.21% / -0.22% | -0.44% / -0.70% / +0.54% / — / — / — / — / — | no |
| relstrength30_long | forza relativa | 275 | 47.3% | 6.7 candele | +0.980% | +1.8% / -5.5% | -0.241% | [-1.55%, +1.13%] | 0.6349 | -1.12% / +0.57% | -1.04% / -0.73% / +1.33% / — / — / — / — / — | no |
| funding_fade | funding | 537 | 46.7% | 6.6 candele | -0.498% | -0.8% / -7.8% | -0.543% | [-1.86%, +0.72%] | 0.7890 | -0.85% / -0.34% | -0.97% / -1.00% / +0.13% / -0.66% / -0.49% / -0.29% / +0.10% / -0.56% | no |
| rsi2_pullback | ritorno alla media | 676 | 48.8% | 4.7 candele | -1.053% | -3.0% / -18.2% | -1.138% | [-2.11%, -0.12%] | 0.9892 | -0.69% / -1.31% | +0.00% / -1.45% / -0.91% / -1.97% / -1.19% / -0.51% / -2.11% / -1.41% | no |
| bollinger_revert | ritorno alla media | 241 | 47.3% | 4.5 candele | -1.259% | -2.0% / -11.8% | -1.266% | [-2.96%, +0.53%] | 0.9235 | -1.11% / -1.33% | -0.12% / -2.74% / +4.04% / -1.56% / -2.37% / -1.97% / -3.63% / -0.48% | no |

### Timeframe 4h

| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | Portafoglio: annuo / max DD | Oltre il mercato | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Esito |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| donchian20_regime | trend | 2100 | 37.1% | 20.1 candele | +0.421% | +21.2% / -10.2% | +0.448% | [-0.02%, +0.93%] | 0.0365 | +0.89% / +0.26% | +0.57% / +0.74% / +0.92% / +0.53% / +0.31% / +0.11% / +0.36% / -0.21% | no |
| app_breakout_trail | trend | 816 | 35.8% | 23.5 candele | -0.040% | +5.1% / -20.6% | +0.313% | [-0.42%, +1.02%] | 0.2111 | +0.96% / +0.07% | +1.88% / +0.17% / +1.05% / -0.61% / +0.93% / -0.88% / +0.68% / -1.10% | no |
| donchian20_oi | funding | 1418 | 36.7% | 20.2 candele | +0.316% | +6.6% / -22.1% | +0.302% | [-0.21%, +0.87%] | 0.1431 | -0.13% / +0.55% | -0.09% / +0.30% / +1.45% / -0.06% / +0.49% / +0.04% / +0.99% / -0.41% | no |
| donchian20_turtle | trend | 2703 | 30.9% | 22.0 candele | +0.312% | +21.8% / -19.8% | +0.284% | [-0.21%, +0.79%] | 0.1327 | +0.80% / +0.07% | +0.34% / +0.30% / +0.54% / +0.87% / +0.39% / +0.09% / -0.25% / -0.29% | no |
| donchian55 | trend | 1573 | 36.0% | 20.3 candele | +0.242% | +13.2% / -14.6% | +0.231% | [-0.30%, +0.77%] | 0.2038 | -0.01% / +0.34% | +0.22% / +0.59% / +0.88% / -0.36% / +0.44% / -0.09% / +1.06% / -0.68% | no |
| big_candle_trail | volatilità | 3054 | 36.5% | 11.2 candele | +0.154% | +10.9% / -30.9% | +0.172% | [-0.16%, +0.50%] | 0.1540 | +0.12% / +0.19% | +0.11% / +0.34% / +0.49% / -0.07% / -0.20% / +0.18% / +0.10% / +0.47% | no |
| ema_pullback | trend | 2187 | 34.1% | 25.2 candele | +0.136% | +8.4% / -24.7% | +0.149% | [-0.37%, +0.70%] | 0.2911 | +0.29% / +0.09% | +0.49% / +0.34% / +1.07% / -0.54% / -0.41% / +0.04% / +0.01% / +0.24% | no |
| donchian20 | trend | 2713 | 36.0% | 20.5 candele | +0.101% | +15.6% / -17.5% | +0.113% | [-0.31%, +0.54%] | 0.3038 | +0.15% / +0.10% | +0.10% / +0.18% / +0.65% / -0.02% / +0.08% / +0.08% / +0.24% / -0.33% | no |
| big_candle | volatilità | 3964 | 46.0% | 4.0 candele | +0.097% | +7.0% / -35.6% | +0.099% | [-0.10%, +0.30%] | 0.1566 | +0.34% / -0.00% | +0.20% / +0.22% / +0.38% / +0.15% / -0.43% / -0.17% / -0.17% / +0.37% | no |
| crowd_fade | funding | 860 | 46.5% | 6.8 candele | +0.047% | +0.3% / -9.0% | +0.083% | [-0.28%, +0.46%] | 0.3328 | +0.34% / -0.05% | -0.00% / +0.30% / -0.56% / +0.80% / -0.16% / -0.25% / +0.92% / -0.35% | no |
| donchian20_calm | trend | 1821 | 34.3% | 17.5 candele | +0.098% | +11.2% / -16.7% | +0.064% | [-0.37%, +0.53%] | 0.3866 | +0.31% / -0.05% | -0.05% / +0.29% / -0.06% / -0.54% / +0.99% / -0.26% / +0.39% / +0.01% | no |
| relstrength90 | forza relativa | 3169 | 47.9% | 6.7 candele | -0.053% | -6.4% / -33.3% | -0.048% | [-0.16%, +0.06%] | 0.8027 | +0.01% / -0.10% | -0.23% / -0.03% / +0.09% / — / — / — / — / — | no |
| tsmom_combo | momentum | 10706 | 45.2% | 6.7 candele | -0.051% | +0.5% / -25.3% | -0.050% | [-0.19%, +0.09%] | 0.7577 | -0.01% / -0.07% | -0.10% / -0.05% / +0.12% / -0.01% / +0.09% / -0.21% / -0.05% / -0.17% | no |
| rsi2_pullback | ritorno alla media | 4281 | 48.0% | 4.8 candele | -0.078% | -8.5% / -47.9% | -0.071% | [-0.25%, +0.11%] | 0.7779 | -0.07% / -0.07% | -0.26% / -0.20% / +0.15% / -0.02% / +0.09% / -0.27% / +0.11% / +0.06% | no |
| tsmom30_long | momentum | 5392 | 46.3% | 6.7 candele | +0.107% | +3.1% / -29.8% | -0.073% | [-0.29%, +0.14%] | 0.7430 | +0.10% / -0.15% | -0.12% / +0.05% / -0.04% / +0.01% / +0.01% / -0.24% / -0.06% / -0.23% | no |
| tsmom30 | momentum | 13425 | 45.7% | 6.8 candele | -0.073% | -2.9% / -44.1% | -0.075% | [-0.20%, +0.05%] | 0.8748 | +0.00% / -0.11% | -0.09% / -0.12% / +0.08% / +0.03% / -0.01% / -0.21% / -0.04% / -0.23% | no |
| tsmom90 | momentum | 13503 | 46.2% | 6.7 candele | -0.116% | -8.9% / -54.0% | -0.115% | [-0.23%, +0.00%] | 0.9676 | -0.11% / -0.12% | -0.16% / -0.12% / +0.00% / -0.05% / +0.04% / -0.24% / -0.01% / -0.33% | no |
| relstrength30 | forza relativa | 3384 | 45.8% | 6.7 candele | -0.134% | -11.7% / -43.3% | -0.131% | [-0.24%, -0.01%] | 0.9874 | -0.09% / -0.17% | -0.26% / -0.35% / +0.17% / — / — / — / — / — | no |
| bollinger_revert | ritorno alla media | 1562 | 49.4% | 4.8 candele | -0.161% | -5.8% / -35.3% | -0.154% | [-0.43%, +0.15%] | 0.8563 | -0.37% / -0.06% | -0.37% / -0.30% / +0.07% / -0.06% / -0.14% / -0.20% / -0.11% / +0.10% | no |
| relstrength30_long | forza relativa | 1831 | 47.0% | 6.7 candele | -0.031% | -4.2% / -24.1% | -0.249% | [-0.48%, +0.01%] | 0.9778 | -0.32% / -0.18% | -0.26% / -0.37% / -0.13% / — / — / — / — / — | no |
| donchian20_long | trend | 1529 | 35.0% | 18.5 candele | +0.231% | +12.1% / -19.6% | -0.262% | [-0.82%, +0.35%] | 0.8081 | +0.04% / -0.39% | +0.00% / +0.05% / -0.48% / +0.10% / -0.84% / -0.00% / +0.03% / -1.25% | no |
| funding_fade | funding | 2734 | 46.9% | 6.7 candele | -0.343% | -8.2% / -39.3% | -0.355% | [-0.65%, -0.07%] | 0.9918 | -0.39% / -0.33% | -0.16% / -0.29% / -0.57% / -0.60% / -0.26% / -0.31% / -0.26% / -0.31% | no |

### Timeframe 1h

| Strategia | Famiglia | Trade | Vincenti | Durata media | Netto medio | Portafoglio: annuo / max DD | Oltre il mercato | IC 95% | p | Metà 1 / Metà 2 | BTC / ETH / SOL | Esito |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| app_breakout_trail | trend | 3418 | 32.8% | 22.8 candele | -0.140% | -2.5% / -46.2% | -0.052% | [-0.27%, +0.17%] | 0.6759 | -0.15% / -0.01% | -0.21% / +0.21% / +0.14% / -0.06% / -0.14% / -0.23% / +0.10% / -0.27% | no |
| ema_pullback | trend | 9595 | 32.1% | 23.5 candele | -0.109% | -3.1% / -69.2% | -0.104% | [-0.23%, +0.01%] | 0.9497 | +0.06% / -0.17% | -0.11% / -0.04% / +0.06% / -0.15% / -0.24% / -0.16% / -0.01% / -0.16% | no |
| donchian55 | trend | 6246 | 31.4% | 22.7 candele | -0.107% | -0.5% / -65.2% | -0.105% | [-0.26%, +0.05%] | 0.9041 | -0.22% / -0.06% | -0.15% / +0.05% / -0.17% / -0.32% / +0.03% / -0.17% / +0.13% / -0.16% | no |
| rsi2_pullback | ritorno alla media | 16974 | 46.3% | 4.8 candele | -0.118% | -44.0% / -98.6% | -0.117% | [-0.16%, -0.08%] | 1.0000 | -0.10% / -0.13% | -0.17% / -0.18% / -0.04% / -0.06% / -0.04% / -0.14% / -0.08% / -0.18% | no |
| donchian20_calm | trend | 7029 | 30.5% | 18.4 candele | -0.105% | -9.4% / -83.1% | -0.118% | [-0.23%, -0.01%] | 0.9808 | +0.06% / -0.20% | -0.10% / -0.02% / -0.13% / -0.12% / -0.15% / -0.35% / -0.04% / -0.08% | no |
| donchian20 | trend | 11092 | 32.0% | 21.3 candele | -0.131% | -11.6% / -84.1% | -0.130% | [-0.23%, -0.02%] | 0.9896 | -0.02% / -0.18% | -0.19% / -0.06% / -0.16% / -0.12% / -0.11% / -0.24% / -0.11% / -0.05% | no |
| big_candle | volatilità | 15300 | 39.2% | 3.9 candele | -0.167% | -61.1% / -99.9% | -0.166% | [-0.22%, -0.11%] | 1.0000 | -0.13% / -0.18% | -0.16% / -0.13% / -0.15% / -0.24% / -0.23% / -0.17% / -0.14% / -0.10% | no |
| tsmom90 | momentum | 55123 | 42.0% | 6.7 candele | -0.171% | -74.9% / -100.0% | -0.172% | [-0.20%, -0.14%] | 1.0000 | -0.15% / -0.18% | -0.19% / -0.15% / -0.13% / -0.18% / -0.17% / -0.20% / -0.16% / -0.18% | no |
| donchian20_long | trend | 5918 | 31.9% | 20.8 candele | -0.032% | -0.2% / -64.7% | -0.176% | [-0.33%, -0.02%] | 0.9841 | +0.01% / -0.25% | -0.13% / -0.08% / -0.26% / -0.21% / -0.16% / -0.29% / -0.12% / -0.19% | no |
| bollinger_revert | ritorno alla media | 6122 | 47.3% | 4.8 candele | -0.181% | -26.9% / -89.8% | -0.182% | [-0.25%, -0.11%] | 1.0000 | -0.21% / -0.17% | -0.26% / -0.24% / -0.09% / -0.19% / -0.12% / -0.21% / -0.11% / -0.13% | no |
| tsmom30_long | momentum | 22457 | 41.7% | 6.7 candele | -0.150% | -46.0% / -98.8% | -0.197% | [-0.25%, -0.15%] | 1.0000 | -0.16% / -0.21% | -0.20% / -0.20% / -0.14% / -0.20% / -0.21% / -0.23% / -0.20% / -0.20% | no |
| tsmom30 | momentum | 55041 | 40.5% | 6.7 candele | -0.209% | -77.7% / -100.0% | -0.209% | [-0.24%, -0.18%] | 1.0000 | -0.20% / -0.21% | -0.21% / -0.20% / -0.18% / -0.21% / -0.20% / -0.25% / -0.18% / -0.24% | no |

### Prove finali sui mesi sigillati

| Prova | Aperta il | Trade | Netto medio | Oltre il mercato | IC 95% | p | Esito |
|---|---|---|---|---|---|---|---|
| big_candle_trail:1d | 2026-11-11 | 73 | +0.374% | +0.363% | [-4.09%, +5.75%] | 0.4450 | non confermata |

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
- **app_breakout_trail** (trend): La regola Breakout di Mercato → Segnali (rottura a 20 candele con volume, RSI e EMA200), ma lasciata correre: stop 2 ATR, stop che segue a 3 ATR, massimo 60 candele.
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
