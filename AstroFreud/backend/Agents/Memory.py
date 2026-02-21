from typing import TypedDict, Optional

class ARESState(TypedDict):
    # ── identity ──────────────────────────────────────────────────────────────
    session_key:      str
    display_identity: str

    # ── conversation bookkeeping ──────────────────────────────────────────────
    # "init" | "questioning" | "followup" | "done"
    phase:            str            
    current_q_index:  int
    # {idx: {question, answer, score, situation, condition}}
    qa_store:         dict           
    followup_question: str
    followup_count:   int
    final_report:     str
     # "low" | "moderate" | "high"
    overall_situation: str          

    # ── per-turn I/O ──────────────────────────────────────────────────────────
    user_answer:      str
    reply:            str
    is_done:          bool

    # ── intermediate node outputs ─────────────────────────────────────────────
     # {score, situation, condition}
    score_result:     dict          
    is_relevant:      bool
     # {type, content}
    psych_result:     dict          
    # Q&A row waiting to be flushed to Excel
    pending_log:      Optional[dict] 
