from Agents.Memory import ARESState
import datetime 

def _overall_situation(qa_store: dict) -> str:
    situations = [v.get("situation", "low") for v in qa_store.values() if v.get("situation")]
    if "high"     in situations: return "high"
    if "moderate" in situations: return "moderate"
    return "low"


def _build_qa_row(state: ARESState) -> dict:
    idx   = state["current_q_index"] - 1          # already advanced before logging
    entry = state["qa_store"].get(idx, {})
    return {
        "identity":              state["display_identity"],
        "question":              entry.get("question",  ""),
        "answer":                entry.get("answer",    ""),
        "psychological_session": state.get("final_report", ""),
        "Score":                 entry.get("score",     ""),
        "Condition":             entry.get("condition", ""),
        "situation":             entry.get("situation", ""),
        "timeStamp":             datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }