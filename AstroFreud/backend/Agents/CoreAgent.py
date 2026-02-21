import sys
import os
from langchain_core.messages import SystemMessage
from langgraph.graph import StateGraph, END
from Agents.Memory import ARESState
from Agents.AgenticNodes import (
    node_init, node_check_relevance, node_score_answer, node_store_and_advance, node_log_entry, node_ask_next_question, 
    node_evaluate_situation, node_run_psychologist, node_start_followup, node_process_followup, node_continue_followup, 
    node_emit_verdict, node_irrelevant_answer, node_session_closed
)
from Agents.AgenticEdges import (
    route_by_phase, route_after_relevance, route_after_followup, route_after_psychologist, route_after_advance
)

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

def build_ares_graph() -> StateGraph:
    g = StateGraph(ARESState)

    # ── register nodes ──────────────────────────────────────────────────────
    g.add_node("init",               node_init)
    g.add_node("check_relevance",    node_check_relevance)
    g.add_node("score_answer",       node_score_answer)
    g.add_node("store_and_advance",  node_store_and_advance)
    g.add_node("log_entry",          node_log_entry)
    g.add_node("ask_next_question",  node_ask_next_question)
    g.add_node("evaluate_situation", node_evaluate_situation)
    g.add_node("run_psychologist",   node_run_psychologist)
    g.add_node("start_followup",     node_start_followup)
    g.add_node("process_followup",   node_process_followup)
    g.add_node("continue_followup",  node_continue_followup)
    g.add_node("emit_verdict",       node_emit_verdict)
    g.add_node("irrelevant_answer",  node_irrelevant_answer)
    g.add_node("session_closed",     node_session_closed)

    # ── entry: dynamic dispatch based on phase ───────────────────────────────
    g.set_conditional_entry_point(
        route_by_phase,
        {
            "init":           "init",
            "check_relevance": "check_relevance",
            "process_followup": "process_followup",
            "session_closed": "session_closed",
        },
    )

    # ── init ─────────────────────────────────────────────────────────────────
    g.add_edge("init", END)

    # ── questioning pipeline ──────────────────────────────────────────────────
    g.add_conditional_edges(
        "check_relevance",
        route_after_relevance,
        {"score_answer": "score_answer", "irrelevant_answer": "irrelevant_answer"},
    )
    g.add_edge("irrelevant_answer",  END)
    g.add_edge("score_answer",       "store_and_advance")
    g.add_edge("store_and_advance",  "log_entry")

    g.add_conditional_edges(
        "log_entry",
        route_after_advance,
        {
            "ask_next_question":  "ask_next_question",
            "evaluate_situation": "evaluate_situation",
        },
    )
    g.add_edge("ask_next_question",  END)

    # ── situation → psychologist ──────────────────────────────────────────────
    g.add_edge("evaluate_situation", "run_psychologist")

    g.add_conditional_edges(
        "run_psychologist",
        route_after_psychologist,
        {"start_followup": "start_followup", "emit_verdict": "emit_verdict"},
    )
    g.add_edge("start_followup", END)

    # ── follow-up pipeline ───────────────────────────────────────────────────
    g.add_conditional_edges(
        "process_followup",
        route_after_followup,
        {"continue_followup": "continue_followup", "emit_verdict": "emit_verdict"},
    )
    g.add_edge("continue_followup", END)

    # ── verdict / session close ──────────────────────────────────────────────
    g.add_edge("emit_verdict",   END)
    g.add_edge("session_closed", END)

    return g.compile()
