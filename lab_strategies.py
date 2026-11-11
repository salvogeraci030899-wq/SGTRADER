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
"""
import numpy as np

STRATEGIES = {}


def strategy(name, family, description, exit):
    def register(fn):
        assert name not in STRATEGIES, f"strategia duplicata: {name}"
        STRATEGIES[name] = {"name": name, "family": family, "description": description, "exit": exit, "fn": fn}
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
