from Agents.Memory import ARESState
from Agents.AgenticNodes import TOTAL_QUESTIONS

def route_by_phase(state: ARESState) -> str:
    """Entry router — dispatch based on current phase."""
    phase = state.get("phase", "init")
    if phase == "init":        return "init"
    if phase == "questioning": return "check_relevance"
    if phase == "followup":    return "process_followup"
    return "session_closed"   # "done" or unknown


def route_after_relevance(state: ARESState) -> str:
    return "score_answer" if state["is_relevant"] else "irrelevant_answer"


def route_after_advance(state: ARESState) -> str:
    """After storing an answer: more questions to ask, or evaluate overall?"""
    return "ask_next_question" if state["current_q_index"] < TOTAL_QUESTIONS else "evaluate_situation"


def route_after_psychologist(state: ARESState) -> str:
    """After the first psychologist call: low→verdict, followup/verdict→appropriate node."""
    situation = state["overall_situation"]
    if situation == "low":
        return "emit_verdict"
    result_type = state["psych_result"]["type"]
    return "start_followup" if result_type == "followup" else "emit_verdict"


def route_after_followup(state: ARESState) -> str:
    """After processing a follow-up answer: continue or close?"""
    result_type = state["psych_result"]["type"]
    return "continue_followup" if result_type == "followup" else "emit_verdict"
