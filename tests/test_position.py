"""Test dei comandi sulle posizioni reali (position_cmd.py) con un Bitget finto. `python3 tests/test_position.py`."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import executor  # noqa: E402
import position_cmd as pc  # noqa: E402

executor.contract_specs = lambda s: {"price_place": 1, "volume_place": 4, "min_size": 0.0001}


class Fake:
    demo = False

    def __init__(self, positions):
        self._pos = positions
        self.calls = []

    def positions(self):
        return {s: dict(p) for s, p in self._pos.items()}

    def equity(self):
        return 500.0

    def close_position(self, symbol, side):
        self.calls.append(("close", symbol, side))
        self._pos.pop(symbol, None)

    def set_tpsl(self, symbol, side, kind, price):
        self.calls.append((kind, symbol, side, price))

    def cancel_all_tpsl(self, symbol, only=None):
        self.calls.append(("clear", symbol) if only is None else ("un" + only, symbol))
        return 2 if only is None else (1 if only == "tp" else 0)

    def tpsl_orders(self, symbol=None):
        return {"BTCUSDT": {"tp": {"price": 72000.0}}}


POS = {"BTCUSDT": {"side": "long", "size": 0.01, "entry": 70000.0, "mark": 71000.0, "liq": 50000.0, "upl": 10.0}}


def rejected(argv, client, text, path):
    try:
        pc.run(argv, client=client, state_path=path)
    except pc.CommandError as e:
        assert text in str(e), (str(e), text)
        return
    raise AssertionError(f"doveva essere rifiutato: {argv}")


def test_regole_e_ordini():
    with tempfile.TemporaryDirectory() as d:
        path, notes = os.path.join(d, "live.json"), []
        c = Fake(dict(POS))
        assert "Take profit di BTC LONG impostato su Bitget a 72.000,1" in pc.run(["tp", "BTCUSDT", "long", "72000.123"], client=c, notify=notes.append, state_path=path)
        assert c.calls[-1] == ("tp", "BTCUSDT", "long", 72000.1) and "REALE" in notes[-1]                     # arrotondato al contratto
        pc.run(["sl", "BTCUSDT", "long", "69000"], client=c, state_path=path)
        assert c.calls[-1] == ("sl", "BTCUSDT", "long", 69000.0)
        rejected(["tp", "BTCUSDT", "long", "70500"], c, "va sopra il prezzo attuale", path)                   # TP di un long sotto il mark
        rejected(["sl", "BTCUSDT", "long", "71500"], c, "va sotto il prezzo attuale", path)                   # scatterebbe subito
        rejected(["sl", "BTCUSDT", "long", "49000"], c, "oltre la liquidazione", path)
        rejected(["tp", "BTCUSDT", "short", "60000"], c, "non c'è una posizione SHORT", path)
        rejected(["tp", "ETHUSDT", "long", "3000"], c, "non c'è una posizione LONG su ETHUSDT", path)
        rejected(["buy", "BTCUSDT", "long"], c, "Azione sconosciuta", path)
        rejected(["tp", "BTCUSDT", "long"], c, "Prezzo mancante", path)
        assert len([x for x in c.calls if x[0] in ("tp", "sl", "close")]) == 2                               # i rifiutati non mandano nulla
        st = json.load(open(path))
        assert st["account"]["positions_detail"][0]["tp"] == 72000.0                                         # TP letto dall'exchange


def test_chiusura_allinea_l_esecutore():
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "live.json")
        json.dump({"positions": {"x": {"symbol": "BTCUSDT", "side": "long", "status": "open", "size": 0.01, "entry": 70000}}, "day": {}, "halted": False, "events": []}, open(path, "w"))
        c = Fake(dict(POS))
        assert "Chiusa a mercato BTC LONG" in pc.run(["close", "BTCUSDT", "long"], client=c, state_path=path)
        st = json.load(open(path))
        assert st["positions"]["x"]["status"] == "closed" and st["positions"]["x"]["close_reason"] == "MANUALE (assistente)"
        assert st["events"][-1]["kind"] == "manual" and c.calls == [("close", "BTCUSDT", "long")]
        # lo stesso aggiornamento rifatto dal workflow sulla versione più recente non chiude altro e non manda ordini
        pc.sync_executor("BTCUSDT", "long", "close", path)
        assert json.load(open(path))["events"][-1]["action"] == "close"


def test_esito_salvato_anche_se_fallito():
    with tempfile.TemporaryDirectory() as d:
        path, res = os.path.join(d, "live.json"), os.path.join(d, "res.json")
        json.dump({"positions": {"x": {"symbol": "BTCUSDT", "side": "long", "status": "open"}}, "day": {}, "halted": False, "events": []}, open(path, "w"))
        pc.write_result(False, "Comando NON eseguito: niente posizione", res)
        os.environ["REQ"] = "abc123xyz"
        try:
            pc.sync_only(["close", "BTCUSDT", "long"], state_path=path, result_path=res)
        finally:
            del os.environ["REQ"]
        st = json.load(open(path))
        ev = st["events"][-1]
        assert ev["ok"] is False and ev["req"] == "abc123xyz" and "NON eseguito" in ev["msg"]
        assert st["positions"]["x"]["status"] == "open"                                    # fallito: non si chiude nulla
        # file dell'esito mancante: evento comunque registrato, senza chiudere
        pc.sync_only(["close", "BTCUSDT", "long"], state_path=path, result_path=os.path.join(d, "manca.json"))
        st = json.load(open(path))
        assert st["events"][-1]["ok"] is False and st["positions"]["x"]["status"] == "open"
        # riuscito: chiude; un codice non valido non viene salvato
        pc.write_result(True, "Chiusa a mercato BTC LONG su Bitget.", res)
        os.environ["REQ"] = "../x"
        try:
            pc.sync_only(["close", "BTCUSDT", "long"], state_path=path, result_path=res)
        finally:
            del os.environ["REQ"]
        st = json.load(open(path))
        assert st["events"][-1]["ok"] is True and "req" not in st["events"][-1] and st["positions"]["x"]["status"] == "closed"


def test_togli_solo_tp_o_sl():
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "live.json")
        json.dump({"positions": {}, "day": {}, "halted": False, "events": []}, open(path, "w"))
        c = Fake(dict(POS))
        assert pc.run(["untp", "BTCUSDT", "long"], client=c, state_path=path) == "Tolto il take profit di BTC LONG su Bitget."
        assert "non aveva uno stop loss" in pc.run(["unsl", "BTCUSDT", "long"], client=c, state_path=path)
        assert c.calls == [("untp", "BTCUSDT"), ("unsl", "BTCUSDT")]
        rejected(["unsl", "BTCUSDT", "short"], Fake(dict(POS)), "non c'è una posizione SHORT", path)


def test_rilettura_salvata_solo_se_cambia():
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "live.json")
        json.dump({"positions": {}, "day": {}, "halted": False, "events": []}, open(path, "w"))
        c = Fake(dict(POS))
        assert "riletto" in pc.run(["refresh", "BTCUSDT", "long"], client=c, state_path=path)
        st = json.load(open(path))
        assert st["account"]["positions"] == 1 and c.calls == [] and st["events"] == []      # nessun ordine, nessun evento
        text = open(path).read()
        # stessa posizione, PnL diverso: file intatto (niente commit e niente pubblicazione)
        c._pos["BTCUSDT"]["upl"] = 25.0
        assert not pc.refresh_if_changed(path, c) and open(path).read() == text
        # posizione chiusa a mano su Bitget: salvato
        c._pos = {}
        assert pc.refresh_if_changed(path, c) and json.load(open(path))["account"]["positions"] == 0


def test_client_tpsl_richieste():
    import bitget_client as bg

    class Resp:
        def __init__(self, data):
            self.status_code, self._d = 200, {"code": "00000", "data": data}

        def json(self):
            return self._d

    class Sess:
        def __init__(self, replies):
            self.replies, self.calls = list(replies), []

        def request(self, method, url, headers=None, data=None, timeout=None):
            self.calls.append((method, url, json.loads(data) if data else None))
            return Resp(self.replies.pop(0))

    pending = {"entrustedList": [{"symbol": "BTCUSDT", "planType": "pos_profit", "orderId": "111", "triggerPrice": "71000", "posSide": "long"}]}
    sess = Sess([pending, {}, {"orderId": "222"}])
    c = bg.BitgetClient("k", "s", "p", session=sess)
    c.set_tpsl("BTCUSDT", "long", "tp", 72000.5)
    (m1, u1, _), (m2, u2, b2), (m3, u3, b3) = sess.calls
    assert m1 == "GET" and "/api/v2/mix/order/orders-plan-pending" in u1 and "planType=profit_loss" in u1
    assert u2.endswith("/api/v2/mix/order/cancel-plan-order") and b2["orderIdList"] == [{"orderId": "111"}] and b2["planType"] == "pos_profit"
    assert u3.endswith("/api/v2/mix/order/place-tpsl-order")
    assert {k: b3[k] for k in ("planType", "triggerPrice", "triggerType", "executePrice", "holdSide", "symbol")} == \
        {"planType": "pos_profit", "triggerPrice": "72000.5", "triggerType": "mark_price", "executePrice": "0", "holdSide": "long", "symbol": "BTCUSDT"}
    # stop loss senza ordini esistenti: niente cancellazione
    sess2 = Sess([{"entrustedList": []}, {"orderId": "333"}])
    bg.BitgetClient("k", "s", "p", session=sess2).set_tpsl("ETHUSDT", "short", "sl", 2500)
    assert [u.rsplit("/", 1)[-1].split("?")[0] for _, u, _ in sess2.calls] == ["orders-plan-pending", "place-tpsl-order"]
    assert sess2.calls[1][2]["planType"] == "pos_loss" and sess2.calls[1][2]["holdSide"] == "short"


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
