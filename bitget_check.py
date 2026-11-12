"""Verifica del collegamento a Bitget in SOLA LETTURA: nessun ordine, nessuna modifica al conto.

Controlla che le chiavi (segreti BITGET_*) funzionino e che la firma delle richieste sia corretta,
leggendo il patrimonio del conto futures USDT, le posizioni aperte e le regole dei contratti.
Non stampa mai le chiavi. Si avvia dal workflow "Verifica Bitget".
"""
import os
import sys

from bitget_client import BitgetClient, BitgetError
from executor import contract_specs
from kronos_core import ALL_ASSETS


def main():
    missing = [k for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE") if not os.environ.get(k)]
    if missing:
        print(f"Segreti mancanti: {', '.join(missing)}.")
        return 1
    client = BitgetClient.from_env()
    print(f"Conto: {'DEMO' if client.demo else 'REALE'} (variabile BITGET_DEMO={os.environ.get('BITGET_DEMO', '1')})")
    ok = True
    try:
        print(f"Patrimonio futures USDT: {client.equity():,.2f} USDT")
    except BitgetError as e:
        ok = False
        print(f"Lettura del patrimonio FALLITA: {e}")
        if client.demo:
            print("Se la chiave è del conto reale, imposta la variabile del repository BITGET_DEMO=0.")
        else:
            print("Se la chiave è del conto demo, imposta BITGET_DEMO=1. Controlla anche che la chiave abbia il permesso Futures.")
    try:
        bal = client.spot_balances()
        parts = []
        for coin, qty in sorted(bal.items()):
            px = client.spot_price_usdt(coin)
            parts.append(f"{coin} {qty:g}" + (f" (~{qty * px:,.2f} USDT)" if px else ""))
        print("Conto spot: " + (", ".join(parts) or "vuoto"))
    except BitgetError as e:
        print(f"Lettura del conto spot non riuscita: {e} (serve il permesso di lettura dello spot)")
    try:
        acc = client.all_balances_usdt()
        print("Tutti i conti (USDT): " + (", ".join(f"{k} {v:,.2f}" for k, v in sorted(acc.items())) or "nessuno")
              + f" · totale {sum(acc.values()):,.2f}")
    except BitgetError as e:
        print(f"Saldo di tutti i conti non leggibile: {e}")
    try:
        pos = client.positions()
        print("Posizioni aperte: " + (", ".join(f"{s} {p['side']} {p['size']}" for s, p in pos.items()) or "nessuna"))
        try:
            for sym in ("BTCUSDT", "SOLUSDT"):
                print(f"Spot {sym}: regole {client.spot_symbol(sym)} · ordini a scatto in attesa {len(client.spot_plan_orders(sym))}")
            print(f"Spot SOL disponibile: {client.spot_available('SOL')}")
            for sym in ("BTCUSDT", "ETHUSDT", "SOLUSDT"):
                fills = client.spot_fills_raw(sym, 20) or []
                # solo i NOMI dei campi e i lati, per verificare il formato
                print(f"Eseguiti spot {sym}: {len(fills)}" + (f" · campi: {', '.join(sorted(fills[0].keys()))} · lati: {sorted(set(str(f.get('side')) for f in fills))}"
                      f" · feeDetail: {fills[0].get('feeDetail')}" if fills else ""))
        except Exception as e:
            print(f"Lettura spot non riuscita: {e}")
        try:
            print(f"Modalità delle posizioni: {client.pos_mode('BTCUSDT')}")
        except Exception as e:
            print(f"Modalità delle posizioni non leggibile: {e}")
        try:
            raw = client.history_raw(5)
            # solo i NOMI dei campi della prima riga, per verificare il formato (nessun valore)
            print(f"Storico posizioni chiuse: {len(raw)} righe lette" + (f" · campi: {', '.join(sorted(raw[0].keys()))}" if raw else ""))
            for h in client.closed_positions(5):
                print(f"  chiusa {h['symbol']} {h['side']} {h['size']}: entrata {h['entry']} uscita {h['exit']}, netto {h['net']} USDT")
        except Exception as e:
            print(f"Storico posizioni chiuse non leggibile: {e}")
    except BitgetError as e:
        ok = False
        print(f"Lettura delle posizioni FALLITA: {e}")
    for s in ALL_ASSETS:
        spec = contract_specs(s)
        print(f"Contratto {s}: " + (f"quantità minima {spec['min_size']}, decimali quantità {spec['volume_place']}, decimali prezzo {spec['price_place']}" if spec else "non disponibile"))
    print("ESITO: collegamento a Bitget OK (nessun ordine inviato)." if ok else "ESITO: collegamento a Bitget NON riuscito.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
