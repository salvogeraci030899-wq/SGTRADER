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
        pos = client.positions()
        print("Posizioni aperte: " + (", ".join(f"{s} {p['side']} {p['size']}" for s, p in pos.items()) or "nessuna"))
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
