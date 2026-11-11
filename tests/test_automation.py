"""Test dei comandi dell'automazione. `python3 tests/test_automation.py` oppure pytest."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import automation as au  # noqa: E402


def paths(d, confirmed=()):
    cfg, summ = os.path.join(d, "automation.json"), os.path.join(d, "lab_summary.json")
    json.dump({"confirmed": list(confirmed)}, open(summ, "w"))
    return cfg, summ


def rejected(argv, cfg, summ, text):
    try:
        au.run(argv, cfg, summ)
    except au.CommandError as e:
        assert text in str(e), (str(e), text)
        return
    raise AssertionError(f"doveva essere rifiutato: {argv}")


def test_accendere_spegnere_e_registro():
    with tempfile.TemporaryDirectory() as d:
        cfg, summ = paths(d)
        assert "off -> paper" in au.run(["set", "big_candle_trail:1d", "paper"], cfg, summ)
        c = json.load(open(cfg))
        assert c["strategies"] == {"big_candle_trail:1d": "paper"} and c["paper_start"] and c["emergency"] is False
        assert c["history"][-1]["cmd"] == "set" and c["history"][-1]["to"] == "paper"
        start = c["paper_start"]
        au.run(["set", "big_candle_trail:1d", "off"], cfg, summ)
        c = json.load(open(cfg))
        assert c["strategies"] == {} and c["paper_start"] == start and len(c["history"]) == 2   # la data di partenza non cambia


def test_regole_di_sicurezza():
    with tempfile.TemporaryDirectory() as d:
        cfg, summ = paths(d)
        rejected(["set", "big_candle_trail:1d", "live"], cfg, summ, "non è confermata")
        rejected(["set", "inesistente:1d", "paper"], cfg, summ, "sconosciuta")
        rejected(["set", "big_candle_trail:1h", "paper"], cfg, summ, "non è stata provata")      # provata solo su 1d e 4h
        rejected(["set", "big_candle_trail:1d", "acceso"], cfg, summ, "Stato sconosciuto")
        rejected(["set", "relstrength30:1d", "paper"], cfg, summ, "prova su carta non riceve")
        rejected(["set", "funding_fade:1d", "paper"], cfg, summ, "prova su carta non riceve")
        rejected(["set", "big_candle_trail", "paper"], cfg, summ, "formato")
        rejected(["boh"], cfg, summ, "non valido")
        assert not os.path.exists(cfg)                                                         # nessun comando rifiutato scrive il file
    with tempfile.TemporaryDirectory() as d:
        cfg, summ = paths(d, confirmed=["big_candle_trail:1d"])
        assert "-> live" in au.run(["set", "big_candle_trail:1d", "live"], cfg, summ)         # confermata: il reale è ammesso


def test_emergenza():
    with tempfile.TemporaryDirectory() as d:
        cfg, summ = paths(d)
        au.run(["set", "big_candle_trail:1d", "paper"], cfg, summ)
        au.run(["set", "donchian55:4h", "paper"], cfg, summ)
        assert "spente 2" in au.run(["emergency"], cfg, summ)
        c = json.load(open(cfg))
        assert c["strategies"] == {} and c["emergency"] is True and c["history"][-1]["turned_off"] == ["big_candle_trail:1d", "donchian55:4h"]
        rejected(["set", "big_candle_trail:1d", "paper"], cfg, summ, "Emergenza attiva")
        assert "off" in au.run(["set", "big_candle_trail:1d", "off"], cfg, summ)               # spegnere resta sempre possibile
        au.run(["resume"], cfg, summ)
        c = json.load(open(cfg))
        assert c["emergency"] is False and c["strategies"] == {}                               # sbloccare non riaccende nulla
        rejected(["resume"], cfg, summ, "non è bloccata")


def test_registro_limitato():
    with tempfile.TemporaryDirectory() as d:
        cfg, summ = paths(d)
        for i in range(au.HISTORY_MAX + 20):
            au.run(["set", "big_candle_trail:1d", "paper" if i % 2 == 0 else "off"], cfg, summ)
        assert len(json.load(open(cfg))["history"]) == au.HISTORY_MAX


def test_massimo_sei_strategie():
    with tempfile.TemporaryDirectory() as d:
        cfg, summ = paths(d)
        keys = ["big_candle_trail:1d", "big_candle_trail:4h", "donchian20:1d", "donchian20:4h", "donchian20:1h", "tsmom30:1d"]
        for k in keys:
            au.run(["set", k, "paper"], cfg, summ)
        rejected(["set", "tsmom90:1d", "paper"], cfg, summ, "Al massimo 6")
        assert "paper -> paper" in au.run(["set", "donchian20:1d", "paper"], cfg, summ)        # una già accesa si può riconfermare
        au.run(["set", "donchian20:1h", "off"], cfg, summ)
        assert "off -> paper" in au.run(["set", "tsmom90:1d", "paper"], cfg, summ)           # spenta una, si può aggiungerne un'altra
        assert len(json.load(open(cfg))["strategies"]) == 6


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
