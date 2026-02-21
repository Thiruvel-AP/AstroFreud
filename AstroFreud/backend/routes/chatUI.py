from fastapi import APIRouter
from services.session_store import session_store
from models.request_models import ChatRequest
import datetime
from Agents.Memory import ARESState
from Agents.CoreAgent import build_ares_graph

router = APIRouter()


def _resolve_identity(identity: str, token: str) -> str:
    identity = (identity or "").strip()
    if identity and identity not in ("Unknown", "Unknown Personnel", "Error"):
        return identity
    return f"unknown_{token}" if token else f"unknown_{datetime.now().strftime('%Y%m%d%H%M%S')}"

def _fresh_state(session_key: str, display_identity: str) -> ARESState:
    return ARESState(
        session_key=session_key,
        display_identity=display_identity,
        phase="init",
        current_q_index=0,
        qa_store={},
        followup_question="",
        followup_count=0,
        final_report="",
        overall_situation="low",
        user_answer="",
        reply="",
        is_done=False,
        score_result={},
        is_relevant=False,
        psych_result={},
        pending_log=None,
    )

@router.post("/chat")
async def chat(req: ChatRequest, identity: str = "Unknown", token: str = ""):

    # ───────Build the graph───────────────────────────────────────────────
    ares_graph = build_ares_graph()

    # ── resolve identity ──────────────────────────────────────────────────────
    session_key      = _resolve_identity(identity, token)
    display_identity = (
        identity
        if identity not in ("Unknown", "Unknown Personnel", "Error", "")
        else session_key
    )

    # ── load or create LangGraph state ───────────────────────────────────────
    state: ARESState = session_store.get(session_key) or _fresh_state(session_key, display_identity)

    # ── inject this turn's user message ──────────────────────────────────────
    user_answer = req.messages[-1].content if req.messages else ""
    state = {**state, "user_answer": user_answer}

    # ── run the graph (single turn) ───────────────────────────────────────────
    result: ARESState = ares_graph.invoke(state)

    # ── persist or wipe session ───────────────────────────────────────────────
    if result.get("is_done"):
        print(f"[ARES] Session complete for {session_key}.")
        session_store.delete(session_key)
    else:
        session_store.set(session_key, result)

    return {
        "identity": display_identity,
        "message":  result["reply"],
        "phase":    result["phase"],
    }