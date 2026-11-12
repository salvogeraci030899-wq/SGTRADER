"""Test dell'agente gestore (agent.py) e delle sue impostazioni (automation.set_agent)."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import agent  # noqa: E402
import automation  # noqa: E402
import lab_strategies  # noqa: E402

PLAIN = [k for k, s in lab_strategies.STRATEGIES.items() if s.get("family") not in ("forza relativa", "funding") and (s.get("tfs") is None or "1d" in s["tfs"])]
A, B, C = f"{PLAIN[0]}:1d", f"{PLAIN[1]}:1d", f"{PLAIN[2]}:1d"
H4 = next(f"{k}:4h" for k, s in lab_strategies.STRATEGIES.items() if s.get("family") not in ("forza relativa", "funding") and (s.get("tfs") is None or "4h" in s["tfs"]))
REL = next((f"{k}:1d" for k, s in lab_strategies.STRATEGIES.items() if s.get("family") == "forza relativa"), None)


def _setup(strategies=None, candidates=(), confirmed=(), paper=None, state=None, emergency=False, agent_cfg=None, trading=False, history=None, holdout=()):
    d = tempfile.mkdtemp()
    p = lambda n: os.path.join(d, n)  # noqa: E731
    cfg = {"paper_start": "2026-11-01", "emergency": emergency, "strategies": strategies or {}, "history": history or [], "risk": {"trading_enabled": trading}}
    if agent_cfg:
        cfg["agent"] = agent_cfg
    json.dump(cfg, open(p("automation.json"), "w"))
    results = {k: {"n": 100, "excess_avg_pct": 2.0} for k in set(candidates) | set(confirmed) | set(strategies or {})}
    for k in holdout:
        results[k]["holdout"] = {"confirmed": k in confirmed}
    json.dump({"results": results, "candidates": list(candidates), "confirmed": list(confirmed)}, open(p("lab_summary.json"), "w"))
    json.dump({"strategies": paper or {}}, open(p("paper_trades.json"), "w"))
    if state is not None:
        json.dump(state, open(p("agent_state.json"), "w"))
    return p


def _run(p, ai=lambda f: (None, None), full=False, capital=lambda *a: None):
    sent = []
    st = agent.run(sent.append, cfg_path=p("automation.json"), summary_path=p("lab_summary.json"), paper_path=p("paper_trades.json"),
                   state_path=p("agent_state.json"), ai=ai, full_report=full, live_path=p("live_trades.json"), capital=capital)
    return st, json.load(open(p("automation.json"))), sent


def stats(n, avg, verdict):
    return {"stats": {"n": n, "open": 0, "avg_net_pct": avg, "win_rate": 50.0, "vs_backtest": {"verdict": verdict}}}


# ---------- carta ----------
def test_mette_su_carta_le_candidate_e_avvisa():
    p = _setup(candidates=[A, B])
    st, cfg, sent = _run(p)
    assert cfg["strategies"] == {A: "paper", B: "paper"}
    assert all(h["by"] == "agent" and h["to"] == "paper" for h in cfg["history"])
    assert sorted(st["added"]) == sorted([A, B]) and len(sent) == 1 and "Messa su carta" in sent[0]
    assert [e["kind"] for e in st["log"]] == ["on", "on"]


def test_nessun_messaggio_se_non_cambia_niente_tranne_la_domenica():
    p = _setup(strategies={A: "paper"}, candidates=[A])
    _, _, sent = _run(p)
    assert sent == []
    _, _, sent = _run(p, full=True)
    assert len(sent) == 1 and "rapporto" in sent[0]


def test_spegne_solo_le_sue_quando_la_carta_va_male():
    p = _setup(strategies={A: "paper", B: "paper"}, candidates=[A, B], paper={A: stats(15, -1.5, "sotto"), B: stats(15, -1.5, "sotto")}, state={"added": [A]})
    st, cfg, _ = _run(p)
    assert A not in cfg["strategies"] and cfg["strategies"].get(B) == "paper"
    assert any("decidi tu" in f for f in st["facts"]) and A not in st["added"]


def test_spegne_le_sue_non_piu_candidate():
    p = _setup(strategies={A: "paper"}, candidates=[], state={"added": [A]})
    _, cfg, _ = _run(p)
    assert cfg["strategies"] == {}


def test_stile_giornaliero_sceglie_solo_4h_e_1h():
    p = _setup(candidates=[A, H4], agent_cfg={"style": "giornaliero"})
    _, cfg, _ = _run(p)
    assert cfg["strategies"] == {H4: "paper"}
    p = _setup(candidates=[A], agent_cfg={"style": "giornaliero"})
    st, cfg, _ = _run(p)
    assert cfg["strategies"] == {} and any("giornaliera" in f for f in st["facts"])


def test_autonomia_spenta_non_tocca_nulla():
    p = _setup(candidates=[A], agent_cfg={"autonomy": "off"})
    st, cfg, _ = _run(p, full=True)
    assert cfg["strategies"] == {} and any("Autonomia spenta" in f for f in st["facts"])


def test_emergenza_nessuna_accensione():
    p = _setup(candidates=[A], emergency=True)
    st, cfg, _ = _run(p)
    assert cfg["strategies"] == {} and "Emergenza" in st["facts"][0]


def test_limite_di_sei_e_dati_mancanti():
    many = {f"{k}:1d": "paper" for k in PLAIN[3:9]}
    p = _setup(strategies=many, candidates=[A] + ([REL] if REL else []))
    st, cfg, _ = _run(p)
    assert A not in cfg["strategies"] and any("già 6" in f for f in st["facts"])
    if REL:
        assert any("dati che la carta non riceve" in f for f in st["facts"])


# ---------- prova finale e reale ----------
def test_pronta_per_la_prova_finale():
    p = _setup(strategies={A: "paper", B: "paper"}, candidates=[A, B], paper={A: stats(25, 1.0, "in_linea"), B: stats(5, 2.0, "pochi_trade")})
    cfg = json.load(open(p("automation.json")))
    assert agent.unseal_plan(cfg, json.load(open(p("lab_summary.json"))), json.load(open(p("paper_trades.json")))) == [A]
    st, _, _ = _run(p)
    assert any("prova finale" in f for f in st["facts"]) and st["proposals"] == []
    # già provata: non si riprova
    p = _setup(strategies={A: "paper"}, candidates=[A], paper={A: stats(25, 1.0, "in_linea")}, holdout=[A])
    assert agent.unseal_plan(json.load(open(p("automation.json"))), json.load(open(p("lab_summary.json"))), json.load(open(p("paper_trades.json")))) == []


def test_autonomia_carta_propone_non_esegue():
    p = _setup(strategies={A: "paper"}, confirmed=[A], paper={A: stats(25, 1.2, "in_linea")}, trading=True)
    st, cfg, sent = _run(p)
    assert cfg["strategies"][A] == "paper" and [x["key"] for x in st["proposals"]] == [A]
    assert "proposta per il reale" in sent[0]
    _, _, sent = _run(p)                       # stessa proposta il giorno dopo: niente doppione
    assert sent == []


def test_autonomia_reale_porta_al_reale_solo_con_interruttore():
    p = _setup(strategies={A: "paper"}, confirmed=[A], paper={A: stats(25, 1.2, "in_linea")}, agent_cfg={"autonomy": "live"}, trading=False)
    st, cfg, _ = _run(p)
    assert cfg["strategies"][A] == "paper" and any("interruttore" in f for f in st["facts"])
    p = _setup(strategies={A: "paper"}, confirmed=[A], paper={A: stats(25, 1.2, "in_linea")}, agent_cfg={"autonomy": "live"}, trading=True)
    st, cfg, sent = _run(p)
    assert cfg["strategies"][A] == "live" and cfg["history"][-1]["by"] == "agent"
    assert "Ordini veri da ora" in sent[0] and st["log"][-1]["kind"] == "promote"


def test_mai_reale_senza_prova_finale():
    p = _setup(strategies={A: "paper"}, candidates=[A], paper={A: stats(40, 2.0, "sopra")}, agent_cfg={"autonomy": "live"}, trading=True)
    _, cfg, _ = _run(p)
    assert cfg["strategies"][A] == "paper"


def test_dal_reale_torna_su_carta_se_peggiora():
    hist = [{"cmd": "set", "key": A, "from": "paper", "to": "live", "by": "agent"}]
    p = _setup(strategies={A: "live"}, confirmed=[A], paper={A: stats(30, -0.8, "sotto")}, agent_cfg={"autonomy": "live"}, trading=True, history=hist)
    st, cfg, sent = _run(p)
    assert cfg["strategies"][A] == "paper" and "Tornata su carta" in sent[0]


# ---------- impostazioni ----------
def test_impostazioni_agente():
    cfg = automation.load("/nonexistent.json")
    automation.set_agent(cfg, "profile", "prudente")
    assert cfg["risk"]["risk_per_trade_pct"] == 0.25 and cfg["risk"]["daily_target_pct"] == 1.0
    automation.set_agent(cfg, "style", "giornaliero")
    assert automation.agent_config(cfg)["style"] == "giornaliero"
    for f, v in (("autonomy", "boh"), ("profile", "folle"), ("style", "x"), ("colore", "blu")):
        try:
            automation.set_agent(cfg, f, v)
            raise AssertionError()
        except automation.CommandError:
            pass
    cfg["emergency"] = True
    try:
        automation.set_agent(cfg, "autonomy", "live")
        raise AssertionError()
    except automation.CommandError:
        pass


def test_ridurre_autonomia_riporta_su_carta_le_sue():
    cfg = {"emergency": False, "strategies": {A: "live", B: "live"}, "history": [{"cmd": "set", "key": A, "from": "paper", "to": "live", "by": "agent"}], "agent": {"autonomy": "live"}}
    msg = automation.set_agent(cfg, "autonomy", "paper")
    assert cfg["strategies"] == {A: "paper", B: "live"} and A in msg       # B l'avevi messa tu


def test_rapporto_ai_usato_se_presente():
    p = _setup(candidates=[A])
    st, _, sent = _run(p, ai=lambda f: ("Rapporto breve.", "modello-x"))
    assert st["report"] == "Rapporto breve." and st["report_model"] == "modello-x" and "Rapporto breve." in sent[0]


def test_scelta_modello():
    assert agent._pick_model(["whisper-large", "llama-3.3-70b-versatile", "openai/gpt-oss-120b"]) == "openai/gpt-oss-120b"
    assert agent._pick_model(["whisper-large"]) is None

# ---------- limite di perdita per strategia ----------
def ptrade(t_exit, net, entry=100.0, stop=95.0):
    return {"open": False, "t_exit": t_exit, "net": net, "entry": entry, "stop": stop}


def test_drawdown_strategia_in_patrimonio():
    cfg = {"risk": {"risk_per_trade_pct": 0.5}, "history": [{"cmd": "set", "key": A, "to": "live", "at": "2026-11-01T00:00:00+00:00"}]}
    since = 1793491200     # 2026-11-01
    # stop al 5%: un trade a -5% vale -1R = -0,5% del patrimonio. +2R, poi -1R x 4 -> dal massimo -2%
    trades = [ptrade(since - 10, -50.0)] + [ptrade(since + 10, 10.0)] + [ptrade(since + 20 + i, -5.0) for i in range(4)]
    dd, n = agent.strategy_drawdown(cfg, {"strategies": {A: {"trades": trades}}}, A)
    assert n == 5 and dd == 2.0                                                  # il trade di prima del reale non conta


def test_reale_torna_su_carta_oltre_il_limite_anche_senza_autonomia():
    since = "2026-11-01T00:00:00+00:00"
    hist = [{"cmd": "set", "key": A, "from": "paper", "to": "live", "at": since}]
    trades = [ptrade(1793491200 + i, -5.0) for i in range(12)]                   # -12R x 0,5% = -6% (limite bilanciato 5%)
    paper = {A: {"trades": trades, "stats": {"n": 12, "avg_net_pct": -5.0, "vs_backtest": {"verdict": "in_linea"}}}}
    p = _setup(strategies={A: "live"}, confirmed=[A], paper=paper, agent_cfg={"autonomy": "off"}, trading=True, history=hist)
    cfg0 = json.load(open(p("automation.json"))); cfg0["risk"].update(risk_per_trade_pct=0.5, max_strategy_dd_pct=5.0)
    json.dump(cfg0, open(p("automation.json"), "w"))
    st, cfg, sent = _run(p)
    assert cfg["strategies"][A] == "paper" and "oltre il limite" in sent[0]


# ---------- capitale ----------
def test_capitale_troppo_piccolo():
    cfg = {"risk": {"risk_per_trade_pct": 0.5, "max_leverage": 3}}
    live = {"account": {"connected": True, "equity": 16.0}}
    specs = {"BTCUSDT": {"min_size": 0.0001}, "ETHUSDT": {"min_size": 0.01}, "SOLUSDT": {"min_size": 0.1}}
    prices = {"BTCUSDT": 100000.0, "ETHUSDT": 3500.0, "SOLUSDT": 160.0}
    cap = agent.capital_check(cfg, live, {"strategies": {}}, price_fn=prices.get, specs_fn=specs.get)
    assert cap["stop_pct"] == 5.0 and cap["symbols"]["SOLUSDT"]["min_usdt"] == 16.0
    assert cap["symbols"]["SOLUSDT"]["needed"] == 160.0 and not any(v["ok"] for v in cap["symbols"].values())
    f = agent.capital_facts(cap)
    assert len(f) == 1 and "troppo poco" in f[0] and "~100 USDT (BTC)" in f[0], f
    # trade su carta: SOL con stop al 5% (16 USDT: posizione 1,6 USDT < 0,1 SOL) e BTC con stop all'1% (1000 USDT: sì)
    paper = {"strategies": {A: {"trades": [{"symbol": "SOLUSDT", "t": 1, "entry": 160.0, "stop": 152.0}, {"symbol": "BTCUSDT", "t": 2, "entry": 100000.0, "stop": 99000.0}]}}}
    assert agent.capital_check(cfg, live, paper, price_fn=prices.get, specs_fn=specs.get)["paper_feasible"] == [0, 2]
    assert "ne avrebbe aperti 0" in agent.capital_facts(agent.capital_check(cfg, live, paper, price_fn=prices.get, specs_fn=specs.get))[0]
    big = {"account": {"connected": True, "equity": 1000.0}}
    c2 = agent.capital_check(cfg, big, paper, price_fn=prices.get, specs_fn=specs.get)
    assert c2["paper_feasible"] == [2, 2]                     # 1000 USDT: SOL 0,416 e BTC 0,005 sopra i minimi
    live["account"]["equity"] = 1000.0
    assert agent.capital_facts(agent.capital_check(cfg, live, {"strategies": {}}, price_fn=prices.get, specs_fn=specs.get)) == []
    assert agent.capital_check(cfg, {"account": {"connected": False}}, {}) is None


def test_avviso_capitale_una_volta():
    p = _setup(strategies={A: "paper"}, candidates=[A])
    cap = lambda *a: {"equity": 16, "stop_pct": 5, "risk_pct": 0.5, "symbols": {"SOLUSDT": {"min_usdt": 16, "needed": 160, "ok": False}}}  # noqa: E731
    st, _, sent = _run(p, capital=cap)
    assert len(sent) == 1 and "troppo poco" in sent[0] and st["capital"]["equity"] == 16
    _, _, sent = _run(p, capital=cap)
    assert sent == []


def test_rendimento_su_carta():
    paper = {"strategies": {A: {"trades": [ptrade(1, 10.0), ptrade(2, -5.0), ptrade(3, 5.0), {"open": True}]}}}
    assert agent.paper_performance({"risk": {"risk_per_trade_pct": 0.5}}, paper) == (1.0, 3, 0.5)
    assert any("Su carta in totale: +1.00%" in f for f in agent.facts_text({"strategies": {}}, paper, {k: [] for k in ("off", "on", "promote", "demote", "proposals", "notes")}, []))


# ---------- osservazione ----------
def _obs_setup(**kw):
    p = _setup(**kw)
    sm = json.load(open(p("lab_summary.json")))
    sm["results"][B] = {"n": 120, "excess_avg_pct": 1.5, "excess_p": 0.05, "stable": True}
    sm["results"][C] = {"n": 120, "excess_avg_pct": 1.0, "excess_p": 0.20, "stable": True}
    sm["results"][PLAIN[3] + ":1d"] = {"n": 120, "excess_avg_pct": 3.0, "excess_p": 0.01, "stable": False}     # instabile
    sm["results"][PLAIN[4] + ":1d"] = {"n": 20, "excess_avg_pct": 5.0, "excess_p": 0.01, "stable": True}      # pochi trade
    json.dump(sm, open(p("lab_summary.json"), "w"))
    return p


def test_osservazione_riempie_fino_a_quattro():
    p = _obs_setup(strategies={A: "paper"}, candidates=[A])
    st, cfg, sent = _run(p)
    assert cfg["strategies"] == {A: "paper", B: "paper", C: "paper"}
    assert sorted(st["observing"]) == sorted([B, C]) and "in osservazione" in sent[0]
    assert [e["kind"] for e in st["log"]] == ["observe", "observe"]


def test_osservazione_niente_prova_finale_ne_reale():
    paper = {B: stats(30, 2.0, "in_linea")}
    p = _obs_setup(strategies={B: "paper"}, paper=paper, agent_cfg={"autonomy": "live"}, trading=True, state={"added": [B], "observing": [B]})
    cfg = json.load(open(p("automation.json")))
    assert agent.unseal_plan(cfg, json.load(open(p("lab_summary.json"))), json.load(open(p("paper_trades.json")))) == []
    _, cfg, _ = _run(p)
    assert cfg["strategies"][B] == "paper"


def test_osservazione_finisce_se_non_piu_promettente():
    p = _obs_setup(strategies={B: "paper"}, state={"added": [B], "observing": [B]})
    sm = json.load(open(p("lab_summary.json"))); sm["results"][B]["stable"] = False; json.dump(sm, open(p("lab_summary.json"), "w"))
    st, cfg, _ = _run(p)
    assert B not in cfg["strategies"] and B not in st["observing"]


def test_osservata_diventa_candidata():
    p = _obs_setup(strategies={B: "paper"}, candidates=[B], state={"added": [B], "observing": [B]})
    st, cfg, _ = _run(p)
    assert cfg["strategies"][B] == "paper" and B not in st["observing"]


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
