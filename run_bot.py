import json
import os
import sys
import tempfile
from datetime import datetime, timezone, timedelta

import requests

from kronos_core import (
    ALL_ASSETS, ALL_TIMEFRAMES, TF_DELTA, LOOKBACK, ATR_PERIOD, ATR_MULT, MIN_RR, MODEL_NAME,
    signal_from_prob, get_historical_data, klines_to_df, compute_atr, build_trade_plan,
    load_predictor, generate_monte_carlo_forecast,
)

# =========================
# CONFIGURAZIONE (i parametri della strategia stanno in kronos_core.py)
# =========================
SYMBOL_ENV = os.environ.get("SYMBOL", "ALL")
TIMEFRAME_ENV = os.environ.get("TIMEFRAME", "ALL")
N_SAMPLES = int(os.environ.get("N_SAMPLES", "20"))  # più campioni = probabilità meno "a scalini" (ma più lento)

# Filtro timeframe concordi: ignora i dati degli altri timeframe più vecchi di X ore
MAX_OTHER_TF_AGE_HOURS = 48

# Isteresi: dopo un alert, lo stato torna NEUTRO solo se la probabilità rientra in questa fascia.
# Evita alert ripetuti quando i campioni oscillano intorno alla soglia (es. 15% -> 25% -> 10%).
RESET_LOW, RESET_HIGH = 30, 70

# FORCE=1 ricalcola sempre (usato dalle esecuzioni manuali); altrimenti salta se non c'è una nuova candela chiusa
FORCE = os.environ.get("FORCE", "0") == "1"

ASSETS_TO_RUN = ALL_ASSETS if SYMBOL_ENV == "ALL" else [SYMBOL_ENV]
TIMEFRAMES_TO_RUN = ALL_TIMEFRAMES if TIMEFRAME_ENV == "ALL" else [TIMEFRAME_ENV]

# Telegram
TG_TOKEN = os.environ.get("TELEGRAM_TOKEN")
TG_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")


# =========================
# UTILITY
# =========================
def send_telegram_alert(text):
    """Ritorna True solo se il messaggio è stato inviato davvero."""
    if not TG_TOKEN or not TG_CHAT_ID:
        return False
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    payload = {"chat_id": TG_CHAT_ID, "text": text, "parse_mode": "Markdown"}
    try:
        r = requests.post(url, json=payload, timeout=10)
        r.raise_for_status()
        return True
    except Exception as e:
        print(f"Errore invio Telegram: {e}")
        return False


def get_live_price(symbol, fallback):
    """Prezzo attuale dal ticker Bitget; se fallisce usa l'ultima chiusura."""
    try:
        r = requests.get(
            "https://api.bitget.com/api/v2/spot/market/tickers",
            params={"symbol": symbol}, timeout=10
        )
        r.raise_for_status()
        price = float(r.json()["data"][0]["lastPr"])
        # sanity check: scarta valori assurdi
        if price > 0 and abs(price / fallback - 1) < 0.25:
            return price
    except Exception as e:
        print(f"Errore ticker Bitget {symbol}: {e}")
    return fallback


def build_reasoning(data, plan):
    """Commento deterministico (niente LLM): evita interpretazioni sbagliate delle probabilità."""
    prob_up = data['prob_up']
    prob_down = round(100 - prob_up, 1)
    if plan['bias'] == 'NEUTRO':
        head = f"Segnale neutro: rialzo {prob_up}% / ribasso {prob_down}%, nessun vantaggio statistico chiaro."
    else:
        agree = prob_up if plan['bias'] == 'LONG' else prob_down
        head = f"{plan['bias']}: il modello vede questa direzione nel {agree}% delle simulazioni."
    p10 = data['band_lower'][-1]['value']
    p90 = data['band_upper'][-1]['value']
    text = (f"{head} Target {plan['reward_pct']}% dalla mediana prevista, rischio {plan['risk_pct']}% "
            f"(stop {ATR_MULT:g}x ATR): R/R 1:{plan['rr']:g}. Fascia P10-P90 a fine previsione ${p10:,.2f}-${p90:,.2f}.")
    if plan['bias'] != 'NEUTRO' and not plan['tradeable']:
        text += f" Non operativo: R/R sotto 1:{MIN_RR:g}."
    return text


# =========================
# PAYLOAD
# =========================
def generate_payload(predictor, df, symbol, freq):
    context_df = df.tail(LOOKBACK).copy()
    forecast, band_upper, band_lower, prob_up = generate_monte_carlo_forecast(predictor, context_df, freq, N_SAMPLES)

    historical = [{
        "time": int(row['time'].timestamp()), "open": float(row['open']),
        "high": float(row['high']), "low": float(row['low']), "close": float(row['close'])
    } for _, row in context_df.iterrows()]

    last_close = float(context_df['close'].iloc[-1])
    live_price = get_live_price(symbol, last_close)
    atr = compute_atr(context_df)

    base_data = {
        "status": "live", "last_update": datetime.now(timezone.utc).isoformat(),
        "current_price": live_price,
        "last_close": last_close,
        "last_candle_time": int(context_df['time'].iloc[-1].timestamp()),
        "prob_up": prob_up,
        "n_samples": N_SAMPLES,
        "historical": historical, "forecast": forecast,
        "band_upper": band_upper, "band_lower": band_lower,
        "model": MODEL_NAME
    }

    plan = build_trade_plan(live_price, atr, prob_up, forecast)
    plan["reasoning"] = build_reasoning(base_data, plan)
    base_data["ai_plan"] = plan
    return base_data


# =========================
# ALERT (candela chiusa + timeframe concordi)
# =========================
def other_timeframe_signals(dashboard_data, symbol, tf):
    """Segnali degli altri timeframe dello stesso asset (solo dati recenti)."""
    result = {}
    now = datetime.now(timezone.utc)
    for other in ALL_TIMEFRAMES:
        if other == tf:
            continue
        entry = dashboard_data.get(f"{symbol}_{other}")
        if not entry or "prob_up" not in entry:
            continue
        try:
            updated = datetime.fromisoformat(entry["last_update"])
            if updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            if now - updated > timedelta(hours=MAX_OTHER_TF_AGE_HOURS):
                continue
        except Exception:
            continue
        result[other] = signal_from_prob(entry["prob_up"])
    return result


def build_alert_text(symbol, tf, payload, signal, others):
    plan = payload['ai_plan']
    prob_up = payload['prob_up']
    prob_down = round(100 - prob_up, 1)
    candle_dt = datetime.fromtimestamp(payload['last_candle_time'], tz=timezone.utc) + TF_DELTA[tf].to_pytimedelta()
    sign_stop = "-" if signal == "LONG" else "+"
    sign_tp = "+" if signal == "LONG" else "-"

    text = f"🚨 *NUOVO SEGNALE: {symbol} ({tf})*\n\n"
    text += f"📊 *Prob. rialzo:* {prob_up}% | *ribasso:* {prob_down}%\n"
    text += f"🧭 *Direzione:* {signal}\n"
    text += f"💰 *Prezzo:* ${payload['current_price']:,.2f}\n\n"
    text += f"🎯 *Entry:* ${plan['entry']:,.2f}\n"
    text += f"🛑 *Stop Loss:* ${plan['stop_loss']:,.2f} ({sign_stop}{plan['risk_pct']}%)\n"
    text += f"✅ *Take Profit:* ${plan['take_profit']:,.2f} ({sign_tp}{plan['reward_pct']}%)\n"
    text += f"⚖️ *R/R:* 1:{plan['rr']:g} | *ATR:* ${plan['atr']:,.2f}\n\n"
    if others:
        others_txt = ", ".join(f"{k} {v}" for k, v in others.items())
        text += f"🔗 *Altri timeframe:* {others_txt}\n"
    text += f"🕯 Ultima candela chiusa alle: {candle_dt.strftime('%d/%m %H:%M')} UTC"
    return text


def process_alerts(processed, dashboard_data, alerts_state):
    for symbol, tf in processed:
        key = f"{symbol}_{tf}"
        payload = dashboard_data[key]
        if "last_candle_time" not in payload or "risk_pct" not in payload.get("ai_plan", {}):
            continue  # voce vecchia, verrà ricalcolata al prossimo run
        current_signal = signal_from_prob(payload['prob_up'])
        last_signal = alerts_state.get(key, "NEUTRO")

        if current_signal == "NEUTRO":
            if RESET_LOW < payload['prob_up'] < RESET_HIGH:
                alerts_state[key] = "NEUTRO"
            continue
        if current_signal == last_signal:
            continue  # anti-spam: segnale già notificato

        if not payload['ai_plan'].get('tradeable', False):
            print(f"Segnale {key} {current_signal} non operativo (R/R {payload['ai_plan'].get('rr')}), nessun alert.")
            continue

        others = other_timeframe_signals(dashboard_data, symbol, tf)
        opposite = "SHORT" if current_signal == "LONG" else "LONG"
        conflicts = [k for k, v in others.items() if v == opposite]
        if conflicts:
            print(f"Segnale {key} {current_signal} sospeso: timeframe in conflitto {conflicts}")
            continue  # lo stato non cambia: riproverà alla prossima esecuzione

        text = build_alert_text(symbol, tf, payload, current_signal, others)
        if send_telegram_alert(text):
            alerts_state[key] = current_signal


# =========================
# MAIN
# =========================
def load_json(path):
    """File assente -> {} (primo avvio). File presente ma illeggibile -> stop:
    ripartire da {} cancellerebbe la dashboard e farebbe ripartire tutti gli alert."""
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("il contenuto non è un oggetto JSON")
        return data
    except Exception as e:
        sys.exit(f"ERRORE: {path} esiste ma non è leggibile ({e}). Interrompo per non sovrascrivere lo stato.")


def save_json(path, data):
    """Scrittura atomica: il file finale è sempre o la versione vecchia o quella nuova completa."""
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def main():
    print(f"Avvio elaborazione per: {ASSETS_TO_RUN} su {TIMEFRAMES_TO_RUN}")
    dashboard_data = load_json("dashboard.json")
    alerts_state = load_json("alerts_state.json")
    alerts_before = dict(alerts_state)

    predictor = None  # caricato solo se c'è almeno una nuova candela da calcolare
    processed = []
    for symbol in ASSETS_TO_RUN:
        for tf in TIMEFRAMES_TO_RUN:
            print(f"--> Calcolo {symbol} su {tf}...")
            klines = get_historical_data(symbol, tf)
            if not klines:
                continue

            df = klines_to_df(klines, tf, closed_only=True)
            if len(df) < ATR_PERIOD + 50:
                print(f"Dati insufficienti per {symbol} {tf}, salto.")
                continue

            key = f"{symbol}_{tf}"
            last_candle_ts = int(df['time'].iloc[-1].timestamp())
            prev = dashboard_data.get(key)

            # Nessuna nuova candela chiusa: niente modello, aggiorno solo prezzo e piano
            if (not FORCE and prev and prev.get("last_candle_time") == last_candle_ts
                    and "ai_plan" in prev and "tradeable" in prev["ai_plan"]):
                live = get_live_price(symbol, float(df['close'].iloc[-1]))
                old_plan = prev["ai_plan"]
                new_plan = build_trade_plan(live, old_plan["atr"], prev["prob_up"], prev["forecast"])
                new_plan["reasoning"] = build_reasoning(prev, new_plan)
                prev["current_price"] = live
                prev["ai_plan"] = new_plan
                prev["last_update"] = datetime.now(timezone.utc).isoformat()
                print(f"    Nessuna nuova candela chiusa per {key}, salto il modello.")
                continue

            if predictor is None:
                print("Caricamento Modello...")
                predictor = load_predictor()

            payload = generate_payload(predictor, df, symbol, tf)
            dashboard_data[key] = payload
            processed.append((symbol, tf))

    # Alert in un secondo passaggio, quando tutti i timeframe sono aggiornati.
    # Controllo tutte le coppie presenti (non solo quelle ricalcolate) così un segnale
    # sospeso per conflitto può partire appena il conflitto sparisce; alerts_state evita i doppioni.
    to_check = [(s, t) for s in ASSETS_TO_RUN for t in TIMEFRAMES_TO_RUN
                if f"{s}_{t}" in dashboard_data]
    process_alerts(to_check, dashboard_data, alerts_state)

    # Salvo (e quindi il workflow fa commit) solo se c'è qualcosa di nuovo: una candela ricalcolata
    # o uno stato alert cambiato. Il solo aggiornamento del prezzo live non genera un commit:
    # il frontend prende già il prezzo live da Bitget.
    alerts_changed = alerts_state != alerts_before
    if not processed and not alerts_changed:
        print("Nessuna nuova candela e nessun cambio di stato alert: file non modificati.")
        return

    # Prima lo stato alert: se qualcosa va storto dopo, almeno non si ripete un alert già inviato.
    save_json("alerts_state.json", alerts_state)
    save_json("dashboard.json", dashboard_data)
    print("✅ dashboard.json e alerts_state.json aggiornati!")


if __name__ == "__main__":
    main()
