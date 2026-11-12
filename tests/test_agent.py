"""Test dell'agente selezionatore (agent.py): regole fisse, mai il reale da solo."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import agent  # noqa: E402
import lab_strategies  # noqa: E402

PLAIN = [k for k, s in lab_strategies.STRATEGIES.items() if s.get("family") not in ("forza relativa", "funding")]
A, B, C = f"{PLAIN[0]}:1d", f"{PLAIN[1]}:1d", f"{PLAIN[2]}:1d"
REL = next((f"{k}:1d" for k, s in lab_strategies.STRATEGIES.items() if s.get("family") == "forza relativa"), None)


def _setup(strategies=None, candidates=(), confirmed=(), paper=None, state=None, emergency=False):
    d = tempfile.mkdtemp()
    p = lambda n: os.path.join(d, n)  # noqa: E731
    json.dump({"paper_start": "2026-11-01", "emergency": emergency, "strategies": strategies or {}, "history": []}, open(p("automation.json"), "w"))
    results = {k: {"n": 100, "excess_avg_pct": 2.0} for k in set(candidates) | set(confirmed) | set(strategies or {})}
    json.dump({"results": results, "candidates": list(candidates), "confirmed": list(confirmed)}, open(p("lab_summary.json"), "w"))
    json.dump({"strategies": paper or {}}, open(p("paper_trades.json"), "w"))
    if state is not None:
        json.dump(state, open(p("agent_state.json"), "w"))
    return p


def _run(p, ai=lambda f: (None, None)):
    sent = []
    st = agent.run(sent.append, cfg_path=p("automation.json"), summary_path=p("lab_summary.json"), paper_path=p("paper_trades.json"),
                   state_path=p("agent_state.json"), ai=ai)
    return st, json.load(open(p("automation.json"))), sent


def stats(n, avg, verdict):
    return {"stats": {"n": n, "open": 0, "avg_net_pct": avg, "win_rate": 50.0, "vs_backtest": {"verdict": verdict}}}


def test_mette_su_carta_le_candidate():
    p = _setup(candidates=[A, B])
    st, cfg, sent = _run(p)
    assert cfg["strategies"] == {A: "paper", B: "paper"}
    assert all(h["by"] == "agent" and h["to"] == "paper" for h in cfg["history"])
    assert sorted(st["added"]) == sorted([A, B]) and sent and "Nessun ordine vero" in sent[0]


def test_mai_il_reale_da_solo_ma_proposta():
    p = _setup(strategies={A: "paper"}, confirmed=[A], paper={A: stats(25, 1.2, "in_linea")})
    st, cfg, sent = _run(p)
    assert cfg["strategies"][A] == "paper"                    # resta su carta
    assert [x["key"] for x in st["proposals"]] == [A]
    assert "proposta per il reale" in sent[0]


def test_niente_proposta_senza_prova_finale_o_pochi_trade():
    p = _setup(strategies={A: "paper", B: "paper"}, confirmed=[B], candidates=[A], paper={A: stats(30, 1.0, "in_linea"), B: stats(5, 2.0, "pochi_trade")})
    st, _, _ = _run(p)
    assert st["proposals"] == []
    assert any("prova finale" in f for f in st["facts"])


def test_spegne_solo_le_sue_quando_la_carta_va_male():
    p = _setup(strategies={A: "paper", B: "paper"}, candidates=[A, B], paper={A: stats(15, -1.5, "sotto"), B: stats(15, -1.5, "sotto")}, state={"added": [A]})
    st, cfg, _ = _run(p)
    assert A not in cfg["strategies"] and cfg["strategies"].get(B) == "paper"     # B l'hai accesa tu
    assert any("decidi tu" in f for f in st["facts"])
    assert A not in st["added"]


def test_spegne_le_sue_non_piu_candidate():
    p = _setup(strategies={A: "paper"}, candidates=[], state={"added": [A]})
    _, cfg, _ = _run(p)
    assert cfg["strategies"] == {}


def test_emergenza_nessuna_modifica():
    p = _setup(candidates=[A], emergency=True)
    st, cfg, sent = _run(p)
    assert cfg["strategies"] == {} and "Emergenza" in st["facts"][0]


def test_limite_di_sei_e_dati_mancanti():
    many = {f"{k}:1d": "paper" for k in PLAIN[3:9]}
    p = _setup(strategies=many, candidates=[A] + ([REL] if REL else []))
    st, cfg, _ = _run(p)
    assert A not in cfg["strategies"] and any("già 6" in f for f in st["facts"])
    if REL:
        assert any("dati che la carta non riceve" in f for f in st["facts"])


def test_rapporto_ai_usato_se_presente():
    p = _setup(candidates=[A])
    st, _, sent = _run(p, ai=lambda f: ("Rapporto breve.", "modello-x"))
    assert st["report"] == "Rapporto breve." and st["report_model"] == "modello-x" and "Rapporto breve." in sent[0]


def test_scelta_modello():
    assert agent._pick_model(["whisper-large", "llama-3.3-70b-versatile", "openai/gpt-oss-120b"]) == "openai/gpt-oss-120b"
    assert agent._pick_model(["whisper-large"]) is None


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} test superati")
