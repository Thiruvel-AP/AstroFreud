from Agents.Memory import ARESState
from Agents.Model import model_chat
from Agents.Prompts import (
    psychological_agent, scoring_eval_prompt, scoring_prompt
)
from services.criticality import decisionMaking
from services.database_retrieval import retrieval_by_identity, retrieval_last3_by_identity, insertion
from langchain_core.messages import SystemMessage
from Agents.Helper import _build_qa_row, _overall_situation
import datetime

# ────PRE-DEFINED QUESTIONS─────────────────────────────────────────────────────────────
PREDEFINED_QUESTIONS = [
    "How has your sleep quality been over the last two cycles?",
    "Are you experiencing any difficulty focusing on mission objectives?",
    "Do you feel a sense of disconnection from the crew or mission control?",
    "How would you describe your emotional state compared to mission launch day?",
]
TOTAL_QUESTIONS = len(PREDEFINED_QUESTIONS)

# ──────────Max Follow-ups───────────────────────────────────────────────────
MAX_FOLLOWUPS = 5

# ──────────LLM tool call───────────────────────────────────────────────────
llm = model_chat()

# ───Agentic Nodes──────────────────────────────────────────────────────────
# Scoring agent 
def run_score_agent(question: str, answer: str) -> dict:
    prompt        = scoring_prompt(question=question, answer=answer)
    response      = llm.invoke([SystemMessage(content=prompt)])
    response_text = response.content.strip()
    try:
        score = int(response_text.split("/")[0].strip())
    except (ValueError, IndexError):
        score = 5
    situation, condition = decisionMaking(score)
    return {"score": score, "situation": situation, "condition": condition}

# Score evaluating agent 
def run_score_eval_agent(question: str, answer: str, identity: str = "Unknown") -> bool:
    last_row      = retrieval_by_identity(identity)
    prev_question = last_row['question'].iloc[0] if not last_row.empty else ""
    prev_answer   = last_row['answer'].iloc[0]   if not last_row.empty else ""

    last3 = retrieval_last3_by_identity(identity)
    if not last3.empty and last3['question'].nunique() == 1 and len(last3) == 3:
        return True

    prompt   = scoring_eval_prompt(
        question_curr=question,
        question_prev=str(prev_question),
        answer_curr=answer,
        answer_prev=str(prev_answer),
    )
    response = llm.invoke([SystemMessage(content=prompt)])
    return response.content.strip().lower() == "true"

# Psychological Agent 
def run_psychologist_agent(
    qa_store:          dict,
    followup_question: str  = "",
    followup_answer:   str  = "",
    overall_situation: str  = "low",
    force_verdict:     bool = False,   # True → override LLM and demand a verdict
) -> dict:
    prompt_input = [
        {
            "question":  v.get("question"),
            "answer":    v.get("answer"),
            "score":     v.get("score"),
            "situation": v.get("situation"),
            "condition": v.get("condition"),
        }
        for v in qa_store.values()
    ]

    followup_context = ""
    if followup_question and followup_answer:
        followup_context = (
            f"\nFollow-up Question: {followup_question}"
            f"\nCrew Response: {followup_answer}"
        )

    prompt   = psychological_agent(
        input=prompt_input,
        followup_context=followup_context,
        overall_situation=overall_situation,
        force_verdict=force_verdict,
    )
    response = llm.invoke([SystemMessage(content=prompt)])
    content  = response.content.strip()

    if content.startswith("FOLLOWUP:") and not force_verdict:
        return {"type": "followup", "content": content.replace("FOLLOWUP:", "").strip()}
    # Strip either prefix cleanly
    content = content.replace("VERDICT:", "").replace("FOLLOWUP:", "").strip()
    return {"type": "verdict", "content": content}

# ── 3-A  init ─────────────────────────────────────────────────────────────────
def node_init(state: ARESState) -> ARESState:
    """Emit the very first predefined question."""
    idx      = 0
    question = PREDEFINED_QUESTIONS[idx]
    return {
        **state,
        "current_q_index": idx,
        "qa_store": {
            idx: {"question": question, "answer": None,
                  "score": None, "situation": None, "condition": None}
        },
        "phase": "questioning",
        "reply": question,
    }


# ── 3-B  check relevance ─────────────────────────────────────────────────────
def node_check_relevance(state: ARESState) -> ARESState:
    """Run the score-eval agent to decide if the user's answer is on-topic."""
    idx      = state["current_q_index"]
    question = PREDEFINED_QUESTIONS[idx]
    relevant = run_score_eval_agent(
        question=question,
        answer=state["user_answer"],
        identity=state["display_identity"],
    )
    return {**state, "is_relevant": relevant}


# ── 3-C  score answer ─────────────────────────────────────────────────────────
def node_score_answer(state: ARESState) -> ARESState:
    """Run the scoring agent on the current answer."""
    idx      = state["current_q_index"]
    question = PREDEFINED_QUESTIONS[idx]
    result   = run_score_agent(question=question, answer=state["user_answer"])
    return {**state, "score_result": result}


# ── 3-D  store answer & advance index ────────────────────────────────────────
def node_store_and_advance(state: ARESState) -> ARESState:
    """Persist scored answer into qa_store and increment the question pointer."""
    idx      = state["current_q_index"]
    question = PREDEFINED_QUESTIONS[idx]
    scored   = state["score_result"]

    updated_qa = {
        **state["qa_store"],
        idx: {
            "question":  question,
            "answer":    state["user_answer"],
            "score":     scored["score"],
            "situation": scored["situation"],
            "condition": scored["condition"],
        },
    }
    new_index = idx + 1
    return {
        **state,
        "qa_store":         updated_qa,
        "current_q_index":  new_index,
        "pending_log":      {          # mark this row for Excel flush later
            "idx": idx,
            "qa":  updated_qa[idx],
        },
    }


# ── 3-E  ask next predefined question ────────────────────────────────────────
def node_ask_next_question(state: ARESState) -> ARESState:
    """Emit the next hardcoded question and register its slot in qa_store."""
    idx      = state["current_q_index"]
    question = PREDEFINED_QUESTIONS[idx]
    updated_qa = {
        **state["qa_store"],
        idx: {"question": question, "answer": None,
              "score": None, "situation": None, "condition": None},
    }
    return {
        **state,
        "qa_store": updated_qa,
        "phase":    "questioning",
        "reply":    question,
    }


# ── 3-F  evaluate overall situation ──────────────────────────────────────────
def node_evaluate_situation(state: ARESState) -> ARESState:
    """Derive overall situation from all scored answers."""
    situation = _overall_situation(state["qa_store"])
    print(f"[ARES] {state['session_key']} overall situation: {situation}")
    return {**state, "overall_situation": situation}


# ── 3-G  run psychologist (post-questioning / forced verdict) ─────────────────
def node_run_psychologist(state: ARESState) -> ARESState:
    """
    First call to the psychologist after all 4 questions are answered.
    Low  → immediate warm close.
    Mod/High → starts follow-up or delivers verdict right away.
    """
    result = run_psychologist_agent(
        qa_store=state["qa_store"],
        overall_situation=state["overall_situation"],
    )
    return {**state, "psych_result": result}


# ── 3-H  start follow-up ──────────────────────────────────────────────────────
def node_start_followup(state: ARESState) -> ARESState:
    """Transition into the follow-up phase with the first follow-up question."""
    content = state["psych_result"]["content"]
    return {
        **state,
        "followup_question": content,
        "followup_count":    1,
        "phase":             "followup",
        "reply":             content,
    }


# ── 3-I  process follow-up answer ────────────────────────────────────────────
def node_process_followup(state: ARESState) -> ARESState:
    """
    Feed the user's follow-up answer back to the psychologist.
    If the budget is exhausted, force a verdict.
    """
    budget_hit = state["followup_count"] >= MAX_FOLLOWUPS
    result     = run_psychologist_agent(
        qa_store=state["qa_store"],
        followup_question=state["followup_question"],
        followup_answer=state["user_answer"],
        overall_situation=state["overall_situation"],
        force_verdict=budget_hit,
    )

    # If the LLM still wants to ask but budget is exhausted → force verdict
    if result["type"] == "followup" and budget_hit:
        result = run_psychologist_agent(
            qa_store=state["qa_store"],
            followup_question=state["followup_question"],
            followup_answer=state["user_answer"],
            overall_situation=state["overall_situation"],
            force_verdict=True,
        )

    return {**state, "psych_result": result}


# ── 3-J  continue follow-up ───────────────────────────────────────────────────
def node_continue_followup(state: ARESState) -> ARESState:
    """Emit the next follow-up question and increment the counter."""
    content = state["psych_result"]["content"]
    return {
        **state,
        "followup_question": content,
        "followup_count":    state["followup_count"] + 1,
        "phase":             "followup",
        "reply":             content,
    }


# ── 3-K  emit verdict ─────────────────────────────────────────────────────────
def node_emit_verdict(state: ARESState) -> ARESState:
    """Deliver the psychologist's final assessment and close the session."""
    content = state["psych_result"]["content"]
    return {
        **state,
        "reply":        content,
        "final_report": content,
        "is_done":      True,
        "phase":        "done",
    }


# ── 3-L  irrelevant answer ────────────────────────────────────────────────────
def node_irrelevant_answer(state: ARESState) -> ARESState:
    """Re-ask the same question when the user's answer is off-topic."""
    idx      = state["current_q_index"]
    question = PREDEFINED_QUESTIONS[idx]
    return {
        **state,
        "reply": (
            "I'm sorry, I didn't quite understand that. "
            f"Could you answer more specifically?\n\n{question}"
        ),
    }


# ── 3-M  log to Excel ─────────────────────────────────────────────────────────
def node_log_entry(state: ARESState) -> ARESState:
    """Flush the pending Q&A row to Excel (non-blocking best-effort)."""
    log = state.get("pending_log")
    if log:
        try:
            qa = log["qa"]
            insertion({
                "identity":              state["display_identity"],
                "question":              qa.get("question",  ""),
                "answer":                qa.get("answer",    ""),
                "psychological_session": state.get("final_report", ""),
                "Score":                 qa.get("score",     ""),
                "Condition":             qa.get("condition", ""),
                "situation":             qa.get("situation", ""),
                "timeStamp":             datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            })
        except Exception as e:
            print(f"[ARES] Excel logging error: {e}")
    return {**state, "pending_log": None}


# ── 3-N  already-done guard ───────────────────────────────────────────────────
def node_session_closed(state: ARESState) -> ARESState:
    return {
        **state,
        "reply": "This session has concluded. A new evaluation will begin on your next check-in.",
    }
