"""Strategie del laboratorio: ognuna è una funzione che riceve gli indicatori di una coppia e
restituisce, candela per candela, il segnale alla chiusura (+1 long, -1 short, 0 niente).

Per aggiungerne una: scrivere la funzione, decorarla con @strategy indicando famiglia, descrizione
e regole di uscita, e lanciare il workflow "Laboratorio strategie". Non serve toccare il motore.

REGOLE DEL LABORATORIO (servono a non ingannarsi da soli):
- i parametri si decidono PRIMA di vedere i risultati e non si ritoccano: una variante è una
  strategia nuova con un nome nuovo, e conta come una prova in più;
- ogni strategia provata resta nel registro (lab_registry.json), anche se scartata: più prove
  si fanno, più alta diventa la soglia per dire "candidata";
- gli ultimi mesi di storico sono sigillati (strategy_lab.HOLDOUT_START): servono per una sola
  prova finale a regole congelate.

Uscite (campo `exit`), tutte in multipli dell'ATR(14) alla candela d'ingresso:
  stop_atr    stop iniziale                      target_atr  target (None = nessuno)
  trail_atr   stop che segue il prezzo (None)    max_hold    durata massima in candele
  channel_exit  N: si esce se la chiusura rompe il minimo (long) o il massimo (short) delle N candele precedenti
`tfs` limita i timeframe su cui la strategia viene provata (ogni timeframe è una prova in più).
"""
import numpy as np

STRATEGIES = {}


def strategy(name, family, description, exit, tfs=None):
    def register(fn):
        assert name not in STRATEGIES, f"strategia duplicata: {name}"
        STRATEGIES[name] = {"name": name, "family": family, "description": description, "fn": fn, "tfs": tfs,
                            "exit": {"target_atr": None, "trail_atr": None, "channel_exit": None, **exit}}
        return fn
    return register


def _cross_up(a, b):
    """True dove a passa da sotto/uguale a sopra b proprio su questa candela."""
    out = np.zeros(len(a), dtype=bool)
    out[1:] = (a[1:] > b[1:]) & (a[:-1] <= b[:-1])
    return out


TREND_EXIT = {"stop_atr": 2.0, "target_atr": None, "trail_atr": 3.0, "max_hold": 60}


# ---------- Trend following: rottura dei massimi/minimi ----------
@strategy("donchian20", "trend", "Long se la chiusura supera il massimo delle 20 candele precedenti, short sotto il minimo. "
          "Stop 2 ATR, poi stop che segue a 3 ATR, massimo 60 candele.", TREND_EXIT)
def donchian20(x):
    return np.where(x["close"] > x["high_max"](20), 1, np.where(x["close"] < x["low_min"](20), -1, 0))


@strategy("donchian55", "trend", "Come donchian20 ma su 55 candele (rotture più rare e più importanti), massimo 120 candele.",
          {**TREND_EXIT, "max_hold": 120})
def donchian55(x):
    return np.where(x["close"] > x["high_max"](55), 1, np.where(x["close"] < x["low_min"](55), -1, 0))


@strategy("donchian20_long", "trend", "Solo la parte long di donchian20 (utilizzabile anche in spot).", TREND_EXIT)
def donchian20_long(x):
    return np.where(x["close"] > x["high_max"](20), 1, 0)


@strategy("donchian20_calm", "trend", "donchian20 solo quando la volatilità (ATR in % del prezzo) è sotto la sua mediana "
          "delle ultime 100 candele: rotture che partono da una fase calma.", TREND_EXIT)
def donchian20_calm(x):
    calm = x["atr_pct"] < x["median"](x["atr_pct"], 100)
    return np.where(calm, donchian20(x), 0)


# ---------- Trend following: medie mobili ----------
@strategy("ema_pullback", "trend", "Con EMA50 sopra EMA200, long quando la chiusura torna sopra l'EMA20 dopo esserne scesa sotto "
          "(speculare per lo short). Stop 2 ATR, stop che segue a 3 ATR, massimo 60 candele.", TREND_EXIT)
def ema_pullback(x):
    e20, e50, e200, c = x["ema"](20), x["ema"](50), x["ema"](200), x["close"]
    return np.where((e50 > e200) & _cross_up(c, e20), 1, np.where((e50 < e200) & _cross_up(-c, -e20), -1, 0))


# ---------- Momentum di serie storica ----------
MOM_EXIT = {"stop_atr": 3.0, "target_atr": None, "trail_atr": None, "max_hold": 7}


@strategy("tsmom30", "momentum", "Direzione del rendimento delle ultime 30 candele, tenuta 7 candele, stop 3 ATR.", MOM_EXIT)
def tsmom30(x):
    return np.sign(x["ret"](30)).astype(int)


@strategy("tsmom90", "momentum", "Come tsmom30 ma sul rendimento delle ultime 90 candele.", MOM_EXIT)
def tsmom90(x):
    return np.sign(x["ret"](90)).astype(int)


@strategy("tsmom30_long", "momentum", "Solo long quando il rendimento a 30 candele è positivo e il prezzo è sopra la media a 200.", MOM_EXIT)
def tsmom30_long(x):
    return np.where((x["ret"](30) > 0) & (x["close"] > x["sma"](200)), 1, 0)


# ---------- Ritorno alla media ----------
REV_EXIT = {"stop_atr": 3.0, "target_atr": None, "trail_atr": None, "max_hold": 5}


@strategy("rsi2_pullback", "ritorno alla media", "Sopra la media a 200: long se RSI(2) < 10. Sotto: short se RSI(2) > 90. "
          "Tenuta 5 candele, stop 3 ATR.", REV_EXIT)
def rsi2_pullback(x):
    r, c, s200 = x["rsi"](2), x["close"], x["sma"](200)
    return np.where((c > s200) & (r < 10), 1, np.where((c < s200) & (r > 90), -1, 0))


@strategy("bollinger_revert", "ritorno alla media", "Long se la chiusura è sotto la banda inferiore di Bollinger (20, 2) ma sopra la "
          "media a 200; short speculare. Tenuta 5 candele, stop 3 ATR.", REV_EXIT)
def bollinger_revert(x):
    c, mid, sd, s200 = x["close"], x["sma"](20), x["std"](20), x["sma"](200)
    return np.where((c < mid - 2 * sd) & (c > s200), 1, np.where((c > mid + 2 * sd) & (c < s200), -1, 0))


# ---------- Espansione di volatilità ----------
@strategy("big_candle", "volatilità", "Segue la direzione di una candela il cui corpo supera 1,5 volte l'ATR precedente. "
          "Tenuta 5 candele, stop 1,5 ATR, target 3 ATR.", {"stop_atr": 1.5, "target_atr": 3.0, "trail_atr": None, "max_hold": 5})
def big_candle(x):
    body = x["close"] - x["open"]
    prev_atr = np.concatenate([[np.nan], x["atr"][:-1]])
    return np.where(body > 1.5 * prev_atr, 1, np.where(body < -1.5 * prev_atr, -1, 0))


# ---------- Le regole dell'app, con uscite da trend ----------
@strategy("app_breakout_trail", "trend", "La regola Breakout della pagina Segnali (rottura a 20 candele con volume, RSI e EMA200), "
          "ma lasciata correre: stop 2 ATR, stop che segue a 3 ATR, massimo 60 candele.", TREND_EXIT)
def app_breakout_trail(x):
    return x["app"]("breakout")


# =====================================================================
# SECONDA SERIE (dichiarata l'11/11/2026, prima di vederne i risultati).
# Solo 1d e 4h: sull'1h la prima serie ha mostrato che i costi superano il movimento medio.
# =====================================================================
SLOW = ("1d", "4h")


@strategy("donchian20_regime", "trend", "donchian20 con filtro di regime: long solo sopra la media a 200, short solo sotto. "
          "Stesse uscite di donchian20.", TREND_EXIT, tfs=SLOW)
def donchian20_regime(x):
    c, s200 = x["close"], x["sma"](200)
    return np.where((c > x["high_max"](20)) & (c > s200), 1, np.where((c < x["low_min"](20)) & (c < s200), -1, 0))


@strategy("donchian20_turtle", "trend", "Ingressi di donchian20, uscita classica 'a canale': si esce quando la chiusura rompe il "
          "minimo (long) o il massimo (short) delle 10 candele precedenti. Stop 2 ATR, massimo 120 candele.",
          {"stop_atr": 2.0, "channel_exit": 10, "max_hold": 120}, tfs=SLOW)
def donchian20_turtle(x):
    return donchian20(x)


@strategy("big_candle_trail", "volatilità", "Ingressi di big_candle ma lasciati correre: stop 1,5 ATR, stop che segue a 3 ATR, "
          "massimo 20 candele.", {"stop_atr": 1.5, "trail_atr": 3.0, "max_hold": 20}, tfs=SLOW)
def big_candle_trail(x):
    return big_candle(x)


@strategy("tsmom_combo", "momentum", "Long se i rendimenti a 30 e a 90 candele sono entrambi positivi, short se entrambi negativi. "
          "Tenuta 7 candele, stop 3 ATR.", MOM_EXIT, tfs=SLOW)
def tsmom_combo(x):
    r30, r90 = x["ret"](30), x["ret"](90)
    return np.where((r30 > 0) & (r90 > 0), 1, np.where((r30 < 0) & (r90 < 0), -1, 0))


# =====================================================================
# TERZA SERIE (dichiarata l'11/11/2026, prima di vederne i risultati): forza relativa.
# Confronta le tre coin nello stesso istante: long la più forte, short la più debole.
# È informazione nuova rispetto alle serie precedenti, che guardavano ogni coin da sola, e in buona
# parte neutrale rispetto al mercato (un long e uno short insieme). Solo 1d e 4h.
# =====================================================================
REL_EXIT = {"stop_atr": 3.0, "max_hold": 7}


@strategy("relstrength30", "forza relativa", "Long la coin con il rendimento a 30 candele più alto delle tre, short quella con il più "
          "basso. Tenuta 7 candele, stop 3 ATR.", REL_EXIT, tfs=SLOW)
def relstrength30(x):
    return x["rank_ret"](30)


@strategy("relstrength90", "forza relativa", "Come relstrength30 ma sul rendimento a 90 candele.", REL_EXIT, tfs=SLOW)
def relstrength90(x):
    return x["rank_ret"](90)


@strategy("relstrength30_long", "forza relativa", "Solo la parte long di relstrength30: compra la coin più forte delle tre.",
          REL_EXIT, tfs=SLOW)
def relstrength30_long(x):
    return np.where(x["rank_ret"](30) > 0, 1, 0)


# =====================================================================
# QUARTA SERIE (dichiarata l'11/11/2026, prima di vederne i risultati): funding, open interest e
# posizionamento dei trader (archivio pubblico di Binance, futures_archive.py). Informazione nuova:
# non viene dai prezzi. Solo 1d e 4h. I dati di un giorno si usano solo dopo la sua chiusura.
# =====================================================================
@strategy("funding_fade", "funding", "Contro la folla: short quando il funding degli ultimi 7 giorni è nel 10% più alto "
          "dell'ultimo anno (troppi long a leva), long quando è nel 10% più basso. Tenuta 7 candele, stop 3 ATR.", REL_EXIT, tfs=SLOW)
def funding_fade(x):
    r = x["feat"]("funding_7d_rank")
    return np.where(r >= 0.9, -1, np.where(r <= 0.1, 1, 0))


@strategy("donchian20_oi", "funding", "Rotture di donchian20 solo se l'open interest è cresciuto negli ultimi 7 giorni "
          "(soldi nuovi che entrano). Uscite di donchian20.", TREND_EXIT, tfs=SLOW)
def donchian20_oi(x):
    return np.where(x["feat"]("oi_chg_7d") > 0, donchian20(x), 0)


@strategy("crowd_fade", "funding", "Contro la folla: short quando la quota di conti long è molto sopra la sua media a 30 giorni "
          "(z > 2), long quando è molto sotto (z < -2). Tenuta 7 candele, stop 3 ATR.", REL_EXIT, tfs=SLOW)
def crowd_fade(x):
    z = x["feat"]("ls_z_30")
    return np.where(z > 2, -1, np.where(z < -2, 1, 0))
