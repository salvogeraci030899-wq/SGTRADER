"""Test dell'esecutore e del client Bitget (Bitget simulato). `python3 tests/test_executor.py` oppure pytest."""
import base64
import hashlib
import hmac
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import automation as au  # noqa: E402
import bitget_client as bg  # noqa: E402
import executor as ex  # noqa: E402

D = 86400
NOW = datetime(2026, 12, 1, 0, 30, tzinfo=timezone.utc)
T_SIGNAL = int(NOW.timestamp()) // D * D - D          # candela di ieri: si entra alla sua chiusura (mezzanotte)
SPECS = lambda s: {"volume_place": 3, "price_place": 1, "min_size": 0.001}


def trade(symbol="BTCUSDT", direction=1, entry=100_000.0, stop=98_000.0, t=T_SIGNAL, open_=True):
    return {"id": f"big_candle_trail:1d:{symbol}:{t}", "symbol": symbol, "t": t, "t_entry": t + D, "dir": direction,
            "entry": entry, "stop": stop, "open": open_, "gross": 0.0}


def setup(trades, mode="live", cfg_extra=None):
    cfg = {"strategies": {"big_candle_trail:1d": mode}, "emergency": False, "risk": {}}
    cfg.update(cfg_extra or {})
    ledger = {"strategies": {"big_candle_trail:1d": {"mode": mode, "trades": trades}}}
    return cfg, ledger


def go(cfg, ledger, path, client=None, now=NOW, notes=None):
    return ex.run(cfg, ledger, client, "demo" if client else "simulata", path, now=now, notify=(notes.append if notes is not None else None), specs_fn=SPECS)


def test_dimensionamento():
    risk = ex.risk_config({})
    # patrimonio 10.000, rischio 0,5% = 50 USDT, stop al 2%: nominale 2.500 -> 0,025 BTC
    size, why = ex.size_position(10_000, 100_000, 98_000, risk, 0, SPECS(""))
    assert size == 0.025 and why == ""
    # stop strettissimo: la leva massima (3x) taglia a 30.000, poi l'esposizione totale (1,5x) a 15.000
    size, _ = ex.size_position(10_000, 100_000, 99_990, risk, 0, SPECS(""))
    assert size == 0.15
    size, _ = ex.size_position(10_000, 100_000, 99_990, dict(risk, max_exposure_x=3.0, max_leverage=2), 0, SPECS(""))
    assert size == 0.2                                                    # qui decide la leva
    # esposizione totale: 1,5x = 15.000, già 14.000 aperti -> restano 1.000
    size, _ = ex.size_position(10_000, 100_000, 98_000, risk, 14_000, SPECS(""))
    assert size == 0.01
    assert ex.size_position(10_000, 100_000, 98_000, risk, 15_000, SPECS(""))[1] == "esposizione totale al massimo"
    assert ex.size_position(10, 100_000, 98_000, risk, 0, SPECS(""))[1] == "quantità sotto il minimo del contratto"
    assert ex.size_position(10_000, 100_000, 100_000, risk, 0, SPECS(""))[1] == "stop uguale all'ingresso"


def test_ciclo_apertura_e_chiusura_simulato():
    with tempfile.TemporaryDirectory() as d:
        path, notes = os.path.join(d, "live.json"), []
        cfg, ledger = setup([trade()], cfg_extra={"risk": {"dry_run_equity": 10_000}})
        assert go(cfg, ledger, path, notes=notes) is True
        st = json.load(open(path))
        p = st["positions"][trade()["id"]]
        assert p["status"] == "open" and p["size"] == 0.025 and p["stop"] == 98_000.0 and p["side"] == "long" and st["mode"] == "simulata"
        assert st["simulated"]["positions"] == {"BTCUSDT": {"side": "long", "size": 0.025}}
        assert len(notes) == 1 and "SIMULATA" in notes[0] and "Aperta BTCUSDT LONG" in notes[0]
        # stesso giro: nessun doppione
        assert go(cfg, ledger, path, notes=notes) is False and len(notes) == 1
        # il trade su carta si chiude: si chiude anche la posizione
        cfg, ledger = setup([trade(open_=False)], cfg_extra={"risk": {"dry_run_equity": 10_000}})
        go(cfg, ledger, path, notes=notes)
        st = json.load(open(path))
        assert st["positions"][trade()["id"]]["status"] == "closed" and st["simulated"]["positions"] == {} and "Chiusa BTCUSDT" in notes[-1]


def test_solo_strategie_live():
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "live.json")
        cfg, ledger = setup([trade()], mode="paper")
        go(cfg, ledger, path)
        assert json.load(open(path))["positions"] == {}
        # live nel registro ma non più live in automation.json: nessun ingresso
        cfg, ledger = setup([trade()])
        cfg["strategies"] = {}
        go(cfg, ledger, path)
        assert json.load(open(path))["positions"] == {}


def test_ingressi_rifiutati():
    with tempfile.TemporaryDirectory() as d:
        path, notes = os.path.join(d, "live.json"), []
        old = trade(t=T_SIGNAL - 3 * D)
        cfg, ledger = setup([old, trade(), trade(symbol="BTCUSDT", t=T_SIGNAL + 1), trade("ETHUSDT", -1, 3000, 3060), trade("SOLUSDT", 1, 150, 145)],
                            cfg_extra={"risk": {"dry_run_equity": 10_000, "max_open_positions": 2}})
        go(cfg, ledger, path, notes=notes)
        pos = json.load(open(path))["positions"]
        assert pos[old["id"]]["status"] == "skipped" and "troppo vecchio" in pos[old["id"]]["reason"]
        assert pos[trade()["id"]]["status"] == "open"
        assert pos[trade(t=T_SIGNAL + 1)["id"]]["reason"] == "già una posizione su questa coin"
        assert pos[trade("ETHUSDT")["id"]]["status"] == "open" and pos[trade("ETHUSDT")["id"]]["side"] == "short"
        assert pos[trade("SOLUSDT")["id"]]["reason"] == "numero massimo di posizioni"
        assert sum("NON aperta" in n for n in notes) == 3


def test_perdita_giornaliera():
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "live.json")
        client = bg.DryRunClient(10_000)
        cfg, ledger = setup([], cfg_extra={"risk": {"max_daily_loss_pct": 3}})
        go(cfg, ledger, path, client)
        client._equity = 9_600                                               # -4% nel giorno
        cfg, ledger = setup([trade()], cfg_extra={"risk": {"max_daily_loss_pct": 3}})
        go(cfg, ledger, path, client)
        st = json.load(open(path))
        assert st["day"]["blocked"] is True and st["positions"][trade()["id"]]["reason"] == "limite di perdita giornaliera"
        # il giorno dopo si riparte
        tomorrow = datetime(2026, 12, 2, 0, 30, tzinfo=timezone.utc)
        cfg, ledger = setup([trade(t=T_SIGNAL + D)])
        go(cfg, ledger, path, client, now=tomorrow)
        assert json.load(open(path))["positions"][trade(t=T_SIGNAL + D)["id"]]["status"] == "open"


def test_riconciliazione_e_sblocco():
    with tempfile.TemporaryDirectory() as d:
        path, notes = os.path.join(d, "live.json"), []
        client = bg.DryRunClient(10_000)
        client._positions = {"ETHUSDT": {"side": "long", "size": 1.0}}           # posizione aperta a mano su Bitget
        cfg, ledger = setup([trade()])
        go(cfg, ledger, path, client, notes=notes)
        st = json.load(open(path))
        assert st["halted"] is True and st["positions"] == {} and "bloccato" in notes[-1]
        assert not any(c[0] == "open" for c in client.calls)
        # sistemato su Bitget e sbloccato dall'app: riparte
        client._positions = {}
        cfg_file = os.path.join(d, "automation.json")
        json.dump({"strategies": {}, "emergency": False, "history": []}, open(cfg_file, "w"))
        au.run(["resume"], cfg_file, os.path.join(d, "none.json"), state_path=path)
        go(cfg, ledger, path, client, notes=notes)
        assert json.load(open(path))["positions"][trade()["id"]]["status"] == "open"


def test_emergenza_chiude_tutto():
    with tempfile.TemporaryDirectory() as d:
        path, notes = os.path.join(d, "live.json"), []
        client = bg.DryRunClient(10_000)
        cfg, ledger = setup([trade(), trade("ETHUSDT", -1, 3000, 3060)])
        go(cfg, ledger, path, client)
        assert set(client.positions()) == {"BTCUSDT", "ETHUSDT"}
        cfg["emergency"] = True
        go(cfg, ledger, path, client, notes=notes)
        st = json.load(open(path))
        assert client.positions() == {} and st["halted"] is True and all(p["status"] == "closed" for p in st["positions"].values())
        assert "Emergenza: chiuse 2" in notes[-1]
        # emergenza tolta (anche se lo sblocco dall'app è arrivato prima del salvataggio del blocco):
        # al giro dopo l'esecutore riparte da solo, senza riaprire i trade già chiusi
        cfg["emergency"] = False
        go(cfg, ledger, path, client)
        st = json.load(open(path))
        assert st["halted"] is False and st["events"][-1]["kind"] in ("unhalt", "skip") and client.positions() == {}
        # il blocco per posizioni diverse dal previsto invece resta
        client._positions["SOLUSDT"] = {"side": "long", "size": 1.0}
        go(cfg, ledger, path, client)
        go(cfg, ledger, path, client)
        assert json.load(open(path))["halted"] is True and json.load(open(path))["halt_reason"] == "mismatch"


def test_client_vero_solo_con_tutto_in_ordine():
    keys = {"BITGET_API_KEY": "k", "BITGET_API_SECRET": "s", "BITGET_API_PASSPHRASE": "p"}
    saved = {k: os.environ.pop(k, None) for k in list(keys) + ["BITGET_DEMO"]}
    try:
        assert ex.make_client({"risk": {"trading_enabled": True}}) == (None, "simulata")      # niente chiavi
        os.environ.update(keys)
        assert ex.make_client({"risk": {"trading_enabled": False}}) == (None, "simulata")     # interruttore spento
        assert ex.make_client({"risk": {"trading_enabled": True}, "emergency": True}) == (None, "simulata")
        os.environ["BITGET_DEMO"] = "1"
        client, mode = ex.make_client({"risk": {"trading_enabled": True}})
        assert isinstance(client, bg.BitgetClient) and client.demo and mode == "demo"
        os.environ["BITGET_DEMO"] = "0"
        assert ex.make_client({"risk": {"trading_enabled": True}})[1] == "reale"
    finally:
        for k, v in saved.items():
            os.environ.pop(k, None)
            if v is not None:
                os.environ[k] = v


class FakeResponse:
    def __init__(self, status, data):
        self.status_code, self._data = status, data

    def json(self):
        return self._data


class FakeSession:
    def __init__(self, responses):
        self.responses, self.calls = list(responses), []

    def request(self, method, url, headers=None, data=None, timeout=None):
        self.calls.append({"method": method, "url": url, "headers": headers, "data": data})
        return self.responses.pop(0)


def test_client_firma_e_richieste():
    # firma: base64(hmac_sha256(secret, timestamp + metodo + percorso + ?query + corpo))
    expected = base64.b64encode(hmac.new(b"s3cr3t", b"1700000000000GET/api/v2/mix/position/all-position?marginCoin=USDT&productType=USDT-FUTURES",
                                         hashlib.sha256).digest()).decode()
    assert bg.sign("s3cr3t", "1700000000000", "get", "/api/v2/mix/position/all-position", "marginCoin=USDT&productType=USDT-FUTURES") == expected
    sess = FakeSession([
        FakeResponse(200, {"code": "00000", "data": [{"symbol": "BTCUSDT", "holdSide": "long", "total": "0.025", "openPriceAvg": "70000", "unrealizedPL": "12.5", "leverage": "3"}, {"symbol": "ETHUSDT", "holdSide": "short", "total": "0"}]}),
        FakeResponse(200, {"code": "00000", "data": {"orderId": "1"}}),
        FakeResponse(200, {"code": "40001", "msg": "errore"}),
        FakeResponse(200, {"code": "00000", "data": [{"marginCoin": "USDT", "accountEquity": "1234.5"}]}),
    ])
    c = bg.BitgetClient("key", "s3cr3t", "pass", demo=True, session=sess, clock=lambda: 1_700_000_000)
    pos = c.positions()
    assert list(pos) == ["BTCUSDT"] and pos["BTCUSDT"]["side"] == "long" and pos["BTCUSDT"]["size"] == 0.025
    assert pos["BTCUSDT"]["entry"] == 70000.0 and pos["BTCUSDT"]["upl"] == 12.5 and pos["BTCUSDT"]["mark"] is None
    h = sess.calls[0]["headers"]
    assert sess.calls[0]["url"] == "https://api.bitget.com/api/v2/mix/position/all-position?marginCoin=USDT&productType=USDT-FUTURES"
    assert h["ACCESS-KEY"] == "key" and h["ACCESS-PASSPHRASE"] == "pass" and h["ACCESS-TIMESTAMP"] == "1700000000000" and h["ACCESS-SIGN"] == expected
    assert h["paptrading"] == "1"                                                               # conto demo
    c.open_position("BTCUSDT", "long", 0.025, 98000.0, client_oid="abc")
    body = json.loads(sess.calls[1]["data"])
    assert body["side"] == "buy" and body["tradeSide"] == "open" and body["orderType"] == "market" and body["marginMode"] == "isolated"
    assert body["presetStopLossPrice"] == "98000.0" and body["size"] == "0.025" and body["clientOid"] == "abc"
    assert sess.calls[1]["headers"]["ACCESS-SIGN"] == bg.sign("s3cr3t", "1700000000000", "POST", "/api/v2/mix/order/place-order", "", sess.calls[1]["data"])
    try:
        c.close_position("BTCUSDT", "long")
        raise AssertionError("un errore di Bitget deve fermare l'operazione")
    except bg.BitgetError as e:
        assert "40001" in str(e)
    assert c.equity() == 1234.5
    assert bg.round_down(0.02599, 3) == 0.025


def test_comandi_rischio_e_interruttore():
    with tempfile.TemporaryDirectory() as d:
        cfg_file, summ = os.path.join(d, "automation.json"), os.path.join(d, "lab.json")
        json.dump({"confirmed": []}, open(summ, "w"))
        assert "-> 1.0" in au.run(["risk", "risk_per_trade_pct", "1"], cfg_file, summ)
        for argv, text in ((["risk", "risk_per_trade_pct", "5"], "tra 0.1 e 2"), (["risk", "max_leverage", "2.5"], "intero"),
                           (["risk", "max_leverage", "20"], "tra 1 e 5"), (["risk", "boh", "1"], "sconosciuto"), (["trading", "forse"], "on oppure off")):
            try:
                au.run(argv, cfg_file, summ)
                raise AssertionError(argv)
            except au.CommandError as e:
                assert text in str(e), (argv, str(e))
        assert "ABILITATI" in au.run(["trading", "on"], cfg_file, summ)
        c = json.load(open(cfg_file))
        assert c["risk"] == {"risk_per_trade_pct": 1.0, "trading_enabled": True}
        au.run(["emergency"], cfg_file, summ)
        assert json.load(open(cfg_file))["risk"]["trading_enabled"] is False                   # l'emergenza spegne anche gli ordini veri
        try:
            au.run(["trading", "on"], cfg_file, summ)
            raise AssertionError("durante l'emergenza non si accende")
        except au.CommandError:
            pass


def test_lettura_conto_sola_lettura():
    class Fake:
        demo = False
        def __init__(self, fail=False):
            self.fail, self.orders = fail, 0
        def equity(self):
            if self.fail:
                raise bg.BitgetError("40014 chiave scaduta")
            return 123.456
        def positions(self):
            return {"BTCUSDT": {"side": "long", "size": 0.01}}
        def open_position(self, *a, **k):
            self.orders += 1
    saved = {k: os.environ.pop(k, None) for k in ("BITGET_API_KEY", "BITGET_API_SECRET", "BITGET_API_PASSPHRASE")}
    try:
        with tempfile.TemporaryDirectory() as d:
            path, msgs = os.path.join(d, "live.json"), []
            assert ex.account_snapshot(path) == {"connected": False, "reason": "chiavi non impostate"}
            os.environ.update({"BITGET_API_KEY": "k", "BITGET_API_SECRET": "s", "BITGET_API_PASSPHRASE": "p"})
            ok = Fake()
            a = ex.account_snapshot(path, ok, NOW, msgs.append)
            assert a["connected"] and a["equity"] == 123.46 and a["positions"] == 1 and not a["demo"] and ok.orders == 0
            assert json.load(open(path))["account"]["equity"] == 123.46
            class WithSpot(Fake):
                def spot_balances(self):
                    return {"USDT": 500.0, "BTC": 0.01, "XYZ": 3.0}
                def spot_price_usdt(self, coin):
                    return {"USDT": 1.0, "BTC": 70000.0}.get(coin)
            s = ex.account_snapshot(path, WithSpot(), NOW, msgs.append)
            assert s["spot_usdt"] == 1200.0 and s["total_usdt"] == 1323.46, s                     # 500 + 0,01*70000; XYZ senza prezzo
            assert [c["coin"] for c in s["spot_coins"]] == ["BTC", "USDT", "XYZ"] and s["spot_coins"][2]["usdt"] is None
            class WithAll(WithSpot):
                def all_balances_usdt(self):
                    return {"spot": 1200.0, "futures": 123.456, "earn": 500.0}
            a2 = ex.account_snapshot(path, WithAll(), NOW, msgs.append)
            assert a2["total_usdt"] == 1823.46 and a2["accounts_usdt"]["earn"] == 500.0, a2
            assert a2["positions_detail"][0]["symbol"] == "BTCUSDT" and a2["day"] == NOW.strftime("%Y-%m-%d")
            # variazione di oggi: rispetto alla prima lettura del giorno
            class Richer(WithAll):
                def all_balances_usdt(self):
                    return {"spot": 1200.0, "futures": 223.456, "earn": 500.0}
            a3 = ex.account_snapshot(path, Richer(), NOW, msgs.append)
            assert a3["day_start_total"] == a2["day_start_total"] == 123.46 and a3["day_change"] == 1800.0, a3   # base: prima lettura del giorno
            b = ex.account_snapshot(path, Fake(fail=True), NOW, msgs.append)
            assert not b["connected"] and "scaduta" in b["reason"] and len(msgs) == 1        # avviso al passaggio ok -> errore
            ex.account_snapshot(path, Fake(fail=True), NOW, msgs.append)
            assert len(msgs) == 1                                                            # una volta sola
    finally:
        for k, v in saved.items():
            os.environ.pop(k, None)
            if v is not None:
                os.environ[k] = v


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
