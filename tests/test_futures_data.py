"""Test dei dati futures (Bitget simulato). `python3 tests/test_futures_data.py` oppure pytest."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import futures_data as fd  # noqa: E402

H = 3600
NOW = 1_700_000_000 // H * H + 600


def fake(oi="1000", fail=(), ls_path="/api/v2/mix/market/account-long-short"):
    def get(path, **params):
        if any(x in path for x in fail):
            raise RuntimeError("giù")
        if path.endswith("/ticker"):
            return [{"lastPr": "50010", "markPrice": "50000", "indexPrice": "49950", "fundingRate": "0.0001", "holdingAmount": oi}]
        if path.endswith("/current-fund-rate"):
            return [{"fundingRate": "0.00012", "fundingRateInterval": "8", "nextUpdate": str((NOW + H) * 1000)}]
        if path.endswith("/open-interest"):
            return {"openInterestList": [{"symbol": params["symbol"], "size": "900"}], "ts": "1"}
        if path == ls_path:
            long_key, short_key = next((l, s) for p, l, s, _ in fd.LONG_SHORT_SOURCES if p == path)
            return [{long_key: "0.5", short_key: "0.5", "ts": "1"}, {long_key: "0.6", short_key: "0.4", "ts": "2"}]
        raise RuntimeError("endpoint sconosciuto")
    return get


def test_fotografia_completa():
    s = fd.fetch_snapshot("BTCUSDT", fake())
    assert s["errors"] == [] and s["mark"] == 50000 and s["index"] == 49950 and s["last"] == 50010
    assert s["funding_rate_pct"] == 0.012 and s["funding_interval_h"] == 8 and s["next_funding_ts"] == NOW + H
    assert s["premium_pct"] == 0.1001 and s["open_interest"] == 1000 and s["open_interest_usd"] == 50_000_000
    assert s["long_pct"] == 60.0 and s["short_pct"] == 40.0 and s["long_short_basis"] == "conti"  # riga più recente


def test_campi_indipendenti_e_ripieghi():
    # funding dedicato giù: resta quello del ticker; long/short giù ovunque: campo vuoto, il resto c'è
    s = fd.fetch_snapshot("BTCUSDT", fake(fail=("current-fund-rate", "long-short")))
    assert s["funding_rate_pct"] == 0.01 and s["funding_interval_h"] is None and s["long_pct"] is None
    assert s["mark"] == 50000 and len(s["errors"]) == 1 + len(fd.LONG_SHORT_SOURCES)
    # ticker giù: open interest dall'endpoint dedicato, niente prezzo mark
    s = fd.fetch_snapshot("BTCUSDT", fake(fail=("/ticker",)))
    assert s["mark"] is None and s["open_interest"] == 900 and s["open_interest_usd"] is None and s["funding_rate_pct"] == 0.012
    # il primo endpoint long/short non risponde: si usa il successivo
    s = fd.fetch_snapshot("BTCUSDT", fake(ls_path="/api/v2/mix/market/position-long-short"))
    assert s["long_pct"] == 60.0 and s["long_short_basis"] == "posizioni" and s["errors"] == []


def test_raccolta_oraria_e_storico():
    with tempfile.TemporaryDirectory() as d:
        snap, hist = os.path.join(d, "f.json"), os.path.join(d, "h.jsonl")
        assert fd.collect(NOW, fake(), snap, hist) is True
        assert fd.collect(NOW + 900, fake(), snap, hist) is False          # stessa ora: niente di nuovo
        assert len(fd.load_history(hist)) == 3
        assert fd.collect(NOW + 24 * H, fake(oi="1100"), snap, hist) is True
        rows = fd.load_history(hist)
        assert len(rows) == 6 and rows[:3] == fd.load_history(hist)[:3]     # solo aggiunte
        data = json.load(open(snap))
        btc = data["symbols"]["BTCUSDT"]
        assert btc["open_interest_change_24h_pct"] == 10.0 and "errors" not in btc and data["product_type"] == "USDT-FUTURES"
        # Bitget giù del tutto: nessuna riga vuota, file invariati
        before = open(hist).read()
        assert fd.collect(NOW + 30 * H, fake(fail=("/",)), snap, hist) is False
        assert open(hist).read() == before and json.load(open(snap)) == data


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
