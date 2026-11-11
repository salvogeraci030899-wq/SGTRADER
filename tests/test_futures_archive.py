"""Test dell'archivio futures (Binance simulato). `python3 tests/test_futures_archive.py` oppure pytest."""
import io
import os
import sys
import tempfile
import zipfile
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import futures_archive as fa  # noqa: E402
import lab_strategies as ls  # noqa: E402
import strategy_lab as lab  # noqa: E402

D = 86400


def zipped(text):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("f.csv", text)
    return buf.getvalue()


class Resp:
    def __init__(self, status, content=b""):
        self.status_code, self.content = status, content

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(self.status_code)


class FakeBinance:
    """Funding: 3 pagamenti al giorno da 0,01%. Metriche: open interest che cresce di 1 al giorno, quota long 1,5."""
    def __init__(self, first=date(2024, 1, 1), fail=()):
        self.first, self.fail, self.calls = first, set(fail), []

    def get(self, url, timeout=None):
        self.calls.append(url)
        if any(f in url for f in self.fail):
            return Resp(500)
        if "fundingRate" in url:
            y, m = map(int, url.split("-fundingRate-")[1][:7].split("-"))
            rows, d = ["calc_time,funding_interval_hours,last_funding_rate"], date(y, m, 1)
            while d.month == m:
                if d >= self.first:
                    for h in (0, 8, 16):
                        ts = int(datetime(d.year, d.month, d.day, h, tzinfo=timezone.utc).timestamp() * 1000)
                        rows.append(f"{ts},8,0.0001")
                d += timedelta(days=1)
            return Resp(200, zipped("\n".join(rows)))
        day = date.fromisoformat(url.split("-metrics-")[1][:10])
        if day < self.first:
            return Resp(404)
        n = (day - self.first).days
        rows = ["create_time,symbol,sum_open_interest,sum_open_interest_value,count_toptrader_long_short_ratio,"
                "sum_toptrader_long_short_ratio,count_long_short_ratio,sum_taker_long_short_vol_ratio"]
        rows += [f"{day} 00:{m:02d}:00,BTCUSDT,1,{1000 + n},1,1,1.5,1.1" for m in range(0, 60, 5)]
        return Resp(200, zipped("\n".join(rows)))


def test_scarico_e_aggiornamento():
    with tempfile.TemporaryDirectory() as d:
        api = FakeBinance(first=date(2024, 1, 10))
        n = fa.update("BTCUSDT", since=date(2024, 1, 1), until=date(2024, 2, 5), out_dir=d, session=api)
        df = fa.load("BTCUSDT", d)
        assert n == 27 and len(df) == 27 and df["date"].iloc[0] == "2024-01-10" and df["date"].iloc[-1] == "2024-02-05"
        row = df.iloc[0]
        assert abs(row["funding_pct"] - 0.03) < 1e-9 and row["oi_value"] == 1000 and row["ls_accounts"] == 1.5 and abs(row["taker_ratio"] - 1.1) < 1e-9
        # seconda esecuzione: scarica solo i giorni nuovi
        api.calls.clear()
        assert fa.update("BTCUSDT", since=date(2024, 1, 1), until=date(2024, 2, 7), out_dir=d, session=api) == 2
        assert sum("metrics" in u for u in api.calls) == 2 + 9          # i 9 giorni prima dell'inizio dell'archivio si riprovano
        assert len(fa.load("BTCUSDT", d)) == 29
        # errore di rete su un giorno: non viene registrato e si riprova la volta dopo
        bad = FakeBinance(first=date(2024, 1, 10), fail=("2024-02-08",))
        assert fa.update("BTCUSDT", since=date(2024, 1, 1), until=date(2024, 2, 9), out_dir=d, session=bad) == 1
        assert "2024-02-08" not in set(fa.load("BTCUSDT", d)["date"])


def daily(n=500, start="2023-01-01", seed=0):
    rng = np.random.default_rng(seed)
    days = pd.date_range(start, periods=n, freq="D")
    return pd.DataFrame({"date": days.strftime("%Y-%m-%d"), "funding_pct": rng.normal(0.03, 0.02, n),
                         "oi_value": 1e9 * np.exp(np.cumsum(rng.normal(0, 0.02, n))), "ls_accounts": rng.normal(1.5, 0.2, n),
                         "taker_ratio": 1.0})


def test_caratteristiche_e_niente_futuro():
    df = daily()
    f = fa.daily_features(df)
    assert abs(f["funding_7d"].iloc[10] - df["funding_pct"].iloc[4:11].sum()) < 1e-12
    assert np.isnan(f["funding_7d_rank"].iloc[100]) and 0 <= f["funding_7d_rank"].iloc[400] <= 1
    assert abs(f["oi_chg_7d"].iloc[20] - (df["oi_value"].iloc[20] / df["oi_value"].iloc[13] - 1)) < 1e-12
    # candele giornaliere: alla chiusura della candela del giorno k si conosce il giorno k (concluso a mezzanotte)
    t0 = int(pd.Timestamp("2023-03-01", tz="UTC").timestamp())
    times = np.array([t0 + i * D for i in range(5)])
    a = fa.align(f[["funding_7d"]], times, D)["funding_7d"]
    assert a[0] == f["funding_7d"].loc["2023-03-01"] and a[4] == f["funding_7d"].loc["2023-03-05"]
    # candele da 4 ore: fino alla mezzanotte si usa il giorno prima
    t4 = np.array([t0 + i * 4 * 3600 for i in range(7)])
    a4 = fa.align(f[["funding_7d"]], t4, 4 * 3600)["funding_7d"]
    assert all(a4[i] == f["funding_7d"].loc["2023-02-28"] for i in range(5)) and a4[5] == f["funding_7d"].loc["2023-03-01"]
    # prima dell'inizio dell'archivio: nessun valore
    assert np.isnan(fa.align(f[["funding_7d"]], np.array([t0 - 400 * D]), D)["funding_7d"][0])


def test_strategie_con_archivio_nel_laboratorio():
    arch = daily(n=900, start="2022-06-01", seed=3)
    feats = fa.daily_features(arch)
    n = 800
    t0 = int(pd.Timestamp("2022-07-01", tz="UTC").timestamp())
    rng = np.random.default_rng(5)
    c = 100 * np.exp(np.cumsum(rng.normal(0, 0.02, n)))
    o = np.concatenate([[100.0], c[:-1]])
    df = pd.DataFrame({"time": pd.to_datetime([t0 + i * D for i in range(n)], unit="s", utc=True), "open": o,
                       "high": np.maximum(o, c) * 1.01, "low": np.minimum(o, c) * 0.99, "close": c, "volume": 1.0})
    for name in ("funding_fade", "donchian20_oi", "crowd_fade"):
        spec = ls.STRATEGIES[name]
        assert spec["family"] == "funding" and spec["tfs"] == ("1d", "4h")
        with_data = lab.simulate(df, "1d", "BTCUSDT", spec, features=feats)
        assert with_data, name
        assert lab.simulate(df, "1d", "BTCUSDT", spec) == [], name             # senza archivio: nessun segnale
    # nessuna strategia guarda avanti: togliere i giorni futuri dall'archivio non cambia i segnali passati
    k = 600
    cut_time = df["time"].iloc[k]
    x_all = lab.indicators(df.iloc[:k + 1].reset_index(drop=True), "BTCUSDT", None, feats)
    feats_cut = fa.daily_features(arch[pd.to_datetime(arch["date"]) <= cut_time.tz_localize(None)])
    x_cut = lab.indicators(df.iloc[:k + 1].reset_index(drop=True), "BTCUSDT", None, feats_cut)
    for name in ("funding_fade", "donchian20_oi", "crowd_fade"):
        a, b = np.asarray(ls.STRATEGIES[name]["fn"](x_all)), np.asarray(ls.STRATEGIES[name]["fn"](x_cut))
        assert np.array_equal(a, b), name


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
