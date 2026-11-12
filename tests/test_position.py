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


def test_ordine_manuale():
    class C(Fake):
        def __init__(self, positions, mode="one_way_mode"):
            super().__init__(positions); self.mode = mode
        def equity(self):
            return 16.0
        def pos_mode(self, symbol):
            return self.mode
        def setup_symbol(self, symbol, leverage, side=None):
            self.calls.append(("setup", symbol, leverage, side))
        def open_position(self, symbol, side, size, stop_price, client_oid=None, take_price=None, one_way=False):
            self.calls.append(("open", symbol, side, size, stop_price, take_price, one_way))
    specs = lambda s: {"volume_place": 1, "price_place": 3, "min_size": 0.1}
    mark = lambda s: 84.0
    with tempfile.TemporaryDirectory() as d:
        path, cfgp = os.path.join(d, "live.json"), os.path.join(d, "auto.json")
        json.dump({"positions": {}, "day": {}, "halted": False, "events": []}, open(path, "w"))
        def go(argv, client, cfg=None):
            json.dump(cfg or {"risk": {"trading_enabled": True, "max_leverage": 3}}, open(cfgp, "w"))
            return pc.open_position(argv, client, None, path, cfgp, mark, specs)
        c = C({})
        msg = go(["open", "SOLUSDT", "long", "82", "0.15", "3", "88"], c)
        assert "Aperta SOL LONG 0,1 a mercato" in msg and "leva 3x" in msg and "target 88" in msg
        assert c.calls == [("setup", "SOLUSDT", 3, "long"), ("open", "SOLUSDT", "long", 0.1, 82.0, 88.0, True)]   # quantità arrotondata al passo
        assert json.load(open(path))["events"][-1]["action"] == "open"
        def no(argv, text, client=None, cfg=None):
            client = client or C({})
            try:
                go(argv, client, cfg)
            except pc.CommandError as e:
                assert text in str(e), (str(e), text)
                assert not any(x[0] == "open" for x in client.calls)
                return
            raise AssertionError(f"doveva essere rifiutato: {argv}")
        no(["open", "SOLUSDT", "long", "82", "0.1", "3"], "modalità Reale è spenta", cfg={"risk": {"trading_enabled": False}})
        no(["open", "SOLUSDT", "long", "82", "0.1", "3"], "Emergenza", cfg={"emergency": True, "risk": {"trading_enabled": True}})
        no(["open", "SOLUSDT", "long", "82", "0.1", "3"], "già una posizione", client=C({"SOLUSDT": {"side": "short", "size": 0.1}}))
        no(["open", "SOLUSDT", "long", "82", "0.1", "5"], "Leva fuori dai limiti")
        no(["open", "SOLUSDT", "long", "", "0.1", "3"], "stop loss è obbligatorio")
        no(["open", "SOLUSDT", "long", "85", "0.1", "3"], "va sotto il prezzo attuale")
        no(["open", "SOLUSDT", "short", "83", "0.1", "3"], "va sopra il prezzo attuale")
        no(["open", "SOLUSDT", "long", "82", "0.1", "3", "80"], "target di un LONG va sopra")
        no(["open", "SOLUSDT", "long", "50", "0.1", "3"], "oltre la liquidazione")
        no(["open", "SOLUSDT", "long", "82", "0.05", "3"], "Quantità troppo piccola")
        no(["open", "SOLUSDT", "long", "82", "1", "1"], "oltre il 90% del conto")
        no(["open", "SOLUSDT", "long", "70", "0.5", "3"], "oltre il limite")
        no(["open", "PEPEUSDT", "long", "82", "0.1", "3"], "Coin o direzione")
        # modalità hedge: l'ordine porta tradeSide (one_way False)
        c = C({}, mode="hedge_mode")
        go(["open", "SOLUSDT", "short", "86", "0.1", "2"], c)
        assert c.calls[-1] == ("open", "SOLUSDT", "short", 0.1, 86.0, None, False)


class SpotFake:
    """Bitget finto per lo spot: saldi, ordini IOC eseguiti al prezzo, ordini a scatto."""
    demo = False

    def __init__(self, usdt=50.0, sol=0.0, price=84.0, fill=True):
        self.bal = {"USDT": usdt, "SOL": sol}
        self.px, self.fill, self.plans, self.calls, self.n = price, fill, [], [], 0

    def spot_symbol(self, symbol):
        return {"qty_place": 3, "price_place": 2, "min_qty": 0.001, "min_usdt": 1.0}

    def spot_price_usdt(self, coin):
        return self.px if coin == "SOL" else 1.0

    def spot_available(self, coin):
        return self.bal.get(coin, 0.0)

    def all_balances_usdt(self):
        return {"spot": self.bal["USDT"] + self.bal["SOL"] * self.px, "futures": 16.0}

    def spot_order(self, symbol, side, qty, limit_price, client_oid=None):
        self.calls.append(("order", side, qty, limit_price))
        if not self.fill:
            return
        if side == "buy":
            self.bal["USDT"] -= qty * self.px; self.bal["SOL"] += qty
        else:
            self.bal["SOL"] -= qty; self.bal["USDT"] += qty * self.px

    def spot_plan_orders(self, symbol):
        return list(self.plans)

    def spot_plan_sell(self, symbol, trigger_price, qty, client_oid=None):
        self.n += 1
        self.plans.append({"orderId": str(self.n), "side": "sell", "price": trigger_price, "size": qty})
        self.calls.append(("plan", trigger_price, qty))

    def spot_cancel_plan(self, order_id):
        self.plans = [o for o in self.plans if o["orderId"] != order_id]
        self.calls.append(("cancel", order_id))

    def positions(self):
        return {}

    def equity(self):
        return 16.0


def test_spot():
    on = {"risk": {"trading_enabled": True, "max_daily_loss_pct": 3.0}}
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "live.json")
        json.dump({"positions": {}, "day": {}, "halted": False, "events": []}, open(path, "w"))
        c = SpotFake()
        msg = pc.spot_command("open", "SOLUSDT", ["open", "SOLUSDT", "long", "82", "0.1", "", "90"], c, on, path)
        assert "Comprati 0,1 SOL spot a circa 84" in msg and "stop 82" in msg and "target 90" in msg, msg
        assert c.calls[0] == ("order", "buy", 0.1, 84.42)                                   # IOC con tetto +0,5%
        assert [x for x in c.calls if x[0] == "plan"] == [("plan", 82.0, 0.1), ("plan", 90.0, 0.1)]
        assert json.load(open(path))["spot_entries"]["SOLUSDT"]["entry"] == 84.0
        # nuovo stop: sostituisce il vecchio
        msg = pc.spot_command("sl", "SOLUSDT", ["sl", "SOLUSDT", "long", "80"], c, on, path)
        assert "Stop di SOL spot impostato su Bitget a 80" in msg and sorted(o["price"] for o in c.plans) == [80.0, 90.0]
        # togli il target
        assert "Tolti 1" in pc.spot_command("untp", "SOLUSDT", ["untp", "SOLUSDT", "long"], c, on, path) and [o["price"] for o in c.plans] == [80.0]
        # vendi tutto: annulla gli ordini a scatto e vende con un minimo -0,5%
        msg = pc.spot_command("close", "SOLUSDT", ["close", "SOLUSDT", "long"], c, on, path)
        assert "Venduti 0,1 SOL" in msg and c.plans == [] and c.calls[-1] == ("order", "sell", 0.1, 83.58)
        assert "SOLUSDT" not in json.load(open(path))["spot_entries"]
        # rifiuti
        def no(argv, text, client=None, cfg=on):
            try:
                pc.spot_command(argv[0], "SOLUSDT", argv, client or SpotFake(), cfg, path)
            except pc.CommandError as e:
                assert text in str(e), (str(e), text)
                return
            raise AssertionError(argv)
        no(["open", "SOLUSDT", "long", "82", "0.1"], "modalità Reale è spenta", cfg={"risk": {"trading_enabled": False}})
        no(["open", "SOLUSDT", "long", "", "0.1"], "stop loss è obbligatorio")
        no(["open", "SOLUSDT", "long", "86", "0.1"], "stop va sotto")
        no(["open", "SOLUSDT", "long", "82", "0.1", "", "80"], "target va sopra")
        no(["open", "SOLUSDT", "long", "82", "0.001"], "troppo piccolo")
        no(["open", "SOLUSDT", "long", "82", "1"], "Trasferisci USDT", client=SpotFake(usdt=20))
        no(["open", "SOLUSDT", "long", "60", "0.5"], "oltre il limite")
        no(["close", "SOLUSDT", "long"], "non c'è SOL da vendere")
        no(["sl", "SOLUSDT", "long", "80"], "niente da proteggere")
        # prezzo mosso oltre lo 0,5%: nessun acquisto, nessuno stop
        c2 = SpotFake(fill=False)
        assert "NON eseguito" in pc.spot_command("open", "SOLUSDT", ["open", "SOLUSDT", "long", "82", "0.1"], c2, on, path) and c2.plans == []


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
