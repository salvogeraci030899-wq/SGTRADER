"""Test dei dati futures (Bitget simulato). `python3 tests/test_futures_data.py` oppure pytest."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import futures_data as fd  # noqa: E402

H = 3600
NOW = 1_700_000_000 // H * H + 600


def fake(oi="1000", fail=(), flaky=None):
    """flaky: percorso che fallisce solo alla prima chiamata (limite di frequenza)."""
    seen = set()

    def get(path, **params):
        if any(x in path for x in fail) or (path == flaky and path not in seen and not seen.add(path)):
            raise RuntimeError("giù")
        if path.endswith("/ticker"):
            return [{"lastPr": "50010", "markPrice": "50000", "indexPrice": "49950", "fundingRate": "0.0001", "holdingAmount": oi}]
        if path.endswith("/current-fund-rate"):
            return [{"fundingRate": "0.00012", "fundingRateInterval": "8", "nextUpdate": str((NOW + H) * 1000)}]
        if path.endswith("/open-interest"):
            return {"openInterestList": [{"symbol": params["symbol"], "size": "900"}], "ts": "1"}
        if path.endswith("/account-long-short"):
            return [{"longAccountRatio": "0.5", "shortAccountRatio": "0.5", "ts": "1"}, {"longAccountRatio": "0.6", "shortAccountRatio": "0.4", "ts": "2"}]
        if path.endswith("/position-long-short"):
            return [{"longPositionRatio": "0.52", "shortPositionRatio": "0.48", "ts": "2"}]
        raise RuntimeError("endpoint sconosciuto")
    return get


def test_fotografia_completa():
    s = fd.fetch_snapshot("BTCUSDT", fake(), pause=0)
    assert s["errors"] == [] and s["mark"] == 50000 and s["index"] == 49950 and s["last"] == 50010
    assert s["funding_rate_pct"] == 0.012 and s["funding_interval_h"] == 8 and s["next_funding_ts"] == NOW + H
    assert s["premium_pct"] == 0.1001 and s["open_interest"] == 1000 and s["open_interest_usd"] == 50_000_000
    assert s["long_accounts_pct"] == 60.0 and s["long_positions_pct"] == 52.0  # riga più recente; misure separate


def test_campi_indipendenti_e_ripieghi():
    # funding dedicato giù: resta quello del ticker; long/short giù ovunque: campo vuoto, il resto c'è
    s = fd.fetch_snapshot("BTCUSDT", fake(fail=("current-fund-rate", "long-short")), pause=0)
    assert s["funding_rate_pct"] == 0.01 and s["funding_interval_h"] is None
    assert s["long_accounts_pct"] is None and s["long_positions_pct"] is None
    assert s["mark"] == 50000 and len(s["errors"]) == 1 + len(fd.LONG_SHORT_SOURCES)
    # ticker giù: open interest dall'endpoint dedicato, niente prezzo mark
    s = fd.fetch_snapshot("BTCUSDT", fake(fail=("/ticker",)), pause=0)
    assert s["mark"] is None and s["open_interest"] == 900 and s["open_interest_usd"] is None and s["funding_rate_pct"] == 0.012
    # una misura long/short giù: l'altra resta, e non prende il suo posto
    s = fd.fetch_snapshot("BTCUSDT", fake(fail=("account-long-short",)), pause=0)
    assert s["long_accounts_pct"] is None and s["long_positions_pct"] == 52.0 and len(s["errors"]) == 1
    # limite di frequenza: la prima chiamata fallisce, il secondo tentativo riesce
    s = fd.fetch_snapshot("BTCUSDT", fake(flaky="/api/v2/mix/market/account-long-short"), pause=0)
    assert s["long_accounts_pct"] == 60.0 and s["errors"] == []


def test_raccolta_oraria_e_storico():
    with tempfile.TemporaryDirectory() as d:
        snap, hist = os.path.join(d, "f.json"), os.path.join(d, "h.jsonl")
        assert fd.collect(NOW, fake(), snap, hist, pause=0) is True
        assert fd.collect(NOW + 900, fake(), snap, hist, pause=0) is False          # stessa ora: niente di nuovo
        assert len(fd.load_history(hist)) == 3
        assert fd.collect(NOW + 24 * H, fake(oi="1100"), snap, hist, pause=0) is True
        rows = fd.load_history(hist)
        assert len(rows) == 6 and rows[:3] == fd.load_history(hist)[:3]     # solo aggiunte
        data = json.load(open(snap))
        btc = data["symbols"]["BTCUSDT"]
        assert btc["open_interest_change_24h_pct"] == 10.0 and "errors" not in btc and data["product_type"] == "USDT-FUTURES"
        # Bitget giù del tutto: nessuna riga vuota, file invariati
        before = open(hist).read()
        assert fd.collect(NOW + 30 * H, fake(fail=("/",)), snap, hist, pause=0) is False
        assert open(hist).read() == before and json.load(open(snap)) == data


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
