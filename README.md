# AstroFreud: ARES Psychological Evaluation System

A **multi-modal AI system** for real-time astronaut psychological assessment combining **facial biometric identity verification** (DeepFace/Facenet512) with a **LangGraph-orchestrated multi-node interview pipeline** (Llama 3 via Ollama), a 5-dimension **psycholinguistic scoring model**, adaptive follow-up generation, and an **automated emergency alert system** that emails mission control when clinical thresholds are exceeded.

> Built with: `LangGraph` · `LangChain` · `DeepFace` · `Ollama (Llama 3)` · `FastAPI` · `OpenCV` · `React` · `Docker`

---

## What This Is

ARES conducts structured psychological check-ins with astronauts through two simultaneous modalities:

```
Webcam feed ──► ARESVision (face + emotion)
                      │
                      ▼ identity + mood + stress_index
                  /analyze endpoint
                      │
                      ▼ identity passed to
                  /chat endpoint ──► ARES LangGraph
                                          │
                  4 structured questions ◄┤
                  Relevance check         │ (Llama 3, temp=0)
                  Psycholinguistic score  │
                  Adaptive follow-up      │ (max 5 rounds)
                  Verdict generation      │
                                          ▼
                                    Excel log + email alert
                                    (if score ≥ 6: Call captain)
```

---

## Architecture

### Full Request Flow

```
Browser (React)
      │
      ├── POST /analyze      (base64 JPEG frame, every N seconds)
      │         │
      │         ▼
      │    ARESVision.analyze_crew(frame)
      │         ├── _preprocess()      grayscale guard, min 320px, YCrCb histogram equalization
      │         ├── _verify()          Facenet512 via MTCNN→OpenCV→SSD fallback chain
      │         │                      minimum distance across all face_db/vian_refs/ images
      │         │                      adaptive threshold [0.45, 0.65] self-corrects on confirmed hits
      │         ├── _analyze_emotion() DeepFace.analyze(actions=["emotion"])
      │         ├── _smooth_emotion()  3-frame rolling average + hard overrides
      │         │                       angry>15%, sad>10%, fear>12% → override average
      │         └── stress_index = Σ(score × weight × confidence/100)
      │              angry 14×1.2 | fear 16×1.3 | sad 12×1.1 | neutral 3×0.5 | happy 1×0.3
      │         → returns {identity, mood, score, stress_index, emotion_raw, emotion_avg}
      │
      └── POST /chat?identity=VIAN&token=abc123
                │
                ▼
           _resolve_identity()
                face verified → "VIAN"
                unverified    → f"unknown_{token}"
                │
                ▼
           session_store.get(session_key)
                → load ARESState from data/sessions.json
                → or _fresh_state() if new session
                │
                ▼
           build_ares_graph().invoke(state)
                │
                ▼
           [LangGraph pipeline  see below]
                │
                ▼
           if is_done:
                emailcond = decisionMakingForEmail(last_score)
                if emailcond: send_astro_email(recipient, report_path)
                session_store.delete(session_key)
           else:
                session_store.set(session_key, result)
                │
                ▼
           → {identity, message, phase}
```

---

## LangGraph State Machine (`CoreAgent.py`)

```
ARESState (TypedDict)
├── identity + session bookkeeping
├── phase: "init" | "questioning" | "followup" | "done"
├── current_q_index: int (0–3)
├── qa_store: {idx: {question, answer, score, situation, condition}}
├── followup_question + followup_count (max 5)
├── overall_situation: "low" | "moderate" | "high"
├── per-turn: user_answer, reply, is_done
└── intermediate: score_result, is_relevant, psych_result, pending_log


StateGraph (compiled)
        │
        ▼ set_conditional_entry_point → route_by_phase()
        │
        ├── phase="init"        → node_init
        │       emit PREDEFINED_QUESTIONS[0]
        │       register slot 0 in qa_store
        │       → END
        │
        ├── phase="questioning" → node_check_relevance
        │       run_score_eval_agent(question, answer, identity)
        │           checks last 3 rows per identity for repetition
        │           LLM: true/false relevance judgement
        │       │
        │       ├── irrelevant → node_irrelevant_answer → END
        │       │       "I'm sorry… Could you answer more specifically?"
        │       │       re-emit same question
        │       │
        │       └── relevant → node_score_answer
        │               run_score_agent(question, answer)
        │               LLM: <score>/20 via 5-dimension rubric
        │               decisionMaking(score):
        │                   1–5  → low  / "internal decision"
        │                   6–7  → moderate / "Call the captain"
        │                   8–20 → high / "Call the captain and the ground station"
        │               │
        │               ▼ node_store_and_advance
        │                   persist to qa_store[idx]
        │                   increment current_q_index
        │                   mark pending_log
        │               │
        │               ▼ node_log_entry
        │                   flush pending row to user_data.xlsx via openpyxl
        │               │
        │               ├── more questions → node_ask_next_question → END
        │               │       emit PREDEFINED_QUESTIONS[new_idx]
        │               │
        │               └── all 4 done → node_evaluate_situation
        │                       _overall_situation(): high > moderate > low (precedence)
        │                   │
        │                   ▼ node_run_psychologist
        │                       run_psychologist_agent(qa_store, overall_situation)
        │                   │
        │                   ├── low → emit_verdict → END
        │                   │       warm 2-3 sentence close
        │                   │
        │                   └── mod/high → start_followup → END
        │                           emit follow-up question
        │                           phase → "followup"
        │
        ├── phase="followup"    → node_process_followup
        │       followup_count >= MAX_FOLLOWUPS (5) → force_verdict=True
        │       run_psychologist_agent(..., force_verdict)
        │       if LLM returns FOLLOWUP: despite force → re-invoke with force=True
        │       │
        │       ├── FOLLOWUP: → node_continue_followup → END
        │       │       followup_count += 1
        │       │
        │       └── VERDICT:  → node_emit_verdict → END
        │               final_report = content
        │               is_done = True
        │               phase → "done"
        │
        └── phase="done"       → node_session_closed
                "This session has concluded…"
```

---

## Three LLM Prompts

All via `ChatOllama(model="llama3", temperature=0)`  deterministic output.

### 1. Relevance Evaluator (`scoring_eval_prompt`)

Binary `true`/`false` relevance judgement. Rules for `true`:
- Yes/no variations, any informal affirmation/negation
- Any feeling, emotion, or personal state word
- At least one word topically related to the question
- Short informal phrases relating to sleep, focus, crew, emotions

Rules for `false` (only):
- Completely random characters (`asdfgh`, `xyz123`)
- Entirely different language with no relation
- Blank or whitespace only

Also checks the last 3 rows per identity: if all 3 have the same question (repeated identical question detected), returns `True` regardless  prevents infinite re-prompting on genuinely ambiguous input.

### 2. Psycholinguistic Scorer (`scoring_prompt`)

**Psychological Intensity Score: 1–20 scale**

Five dimensions, 4 points each:

| Dimension | What it measures |
|---|---|
| **Emotional Valence** | Degree of negative/positive affect expressed |
| **Cognitive Distortion** | All-or-nothing thinking, catastrophizing, overgeneralization |
| **Functional Impact** | Interference with daily life or relationships |
| **Somatic/Behavioral Markers** | Physical symptoms (sleep, appetite) or high-risk behaviour |
| **Agency vs. Helplessness** | Perceived ability to influence the situation |

**Score bands:**

| Range | Classification |
|---|---|
| 1–5 | Low / Sub-Clinical  normal stressors, high agency |
| 6–10 | Mild / Moderate  noticeable distress, functional |
| 11–15 | Significant / Elevated  functional impairment |
| 16–19 | Severe / Clinical Concern  acute distress, loss of agency |
| 20 | Critical  immediate intervention |

Output format enforced: `<score>/20`  nothing else. Integer parsed via `int(response_text.split("/")[0].strip())`, falls back to `5` on parse failure.

### 3. Psychological Agent (`psychological_agent`)

Adaptive situational prompt with strict output format `FOLLOWUP: ...` or `VERDICT: ...`.

**Situation routing:**

- `low` → Forced `VERDICT:`  warm 2–3 sentence close, affirm resilience
- `moderate` → May ask follow-ups ONE AT A TIME; switch to verdict when sufficient
- `high` → Calm but urgent tone  confirm severity, don't panic; follow-ups or verdict

**Follow-up budget enforcement:** `force_verdict=True` injected at `followup_count >= 5`. If LLM still returns `FOLLOWUP:` despite this, the agent is invoked a second time with `force_verdict=True`  guarantees session termination.

**Strict formatting constraints:** No headers, no bullet points, no reasoning exposition, no section titles  direct conversational speech to the astronaut.

---

## ARES Vision Engine (`vision_engine.py`)

### Identity Verification

| Component | Implementation |
|---|---|
| **Model** | `Facenet512`  512-d embeddings (more accurate than 128-d Facenet on compressed webcam frames) |
| **Detector chain** | MTCNN → OpenCV → SSD (tried in order; never silently drops a frame) |
| **Multi-reference** | Loads all images from `face_db/vian_refs/`  minimum Euclidean distance across all references |
| **Threshold** | Starts at 0.55; adaptive: `clip(mean_verified_dist + 0.10, 0.45, 0.65)`, recalculates every 5 confirmed hits |

**Preprocessing pipeline:** null/grayscale/RGBA guard → upscale to min 320px → YCrCb histogram equalization (Y channel only, improves dim lighting) → `np.ascontiguousarray()`.

### Emotion Detection + Stress Index

**Emotion smoothing:** 3-frame rolling window (deque). Final dominant = `argmax` of per-emotion averages.

**Hard overrides**  prevent rolling average from burying strong single-frame signals:

| Emotion | Override threshold |
|---|---|
| angry | raw confidence > 15% |
| sad | raw confidence > 10% |
| fear | raw confidence > 12% |

**Weighted stress index:**

```
stress_index = Σ (score × weight × confidence/100)   for each emotion in STRESS_MATRIX

STRESS_MATRIX:
  angry:   score=14, weight=1.2
  fear:    score=16, weight=1.3  ← highest weight
  sad:     score=12, weight=1.1
  neutral: score=3,  weight=0.5
  happy:   score=1,  weight=0.3
```

Maximum possible stress index ≈ 21 (100% fear confidence). Returns both discrete `score` (for legacy consumers) and continuous `stress_index`.

---

## Criticality & Alert System

### Decision Rules (`configmap.yaml` + `criticality.py`)

| Score range | Situation | Condition |
|---|---|---|
| 1–5 | `low` | "internal decision" |
| 6–7 | `moderate` | "Call the captain" |
| 8–20 | `high` | "Call the captain and the ground station" |

`decisionMakingForEmail(score)`  regex pattern match on `\bCall the captain\b` (case-insensitive) in the condition string. Returns `True` if match → triggers email alert.

### Emergency Email (`emailingservice.py`)

When email condition is met:
1. `getSessionData(session_key)`  reads `data/sessions.json`, writes `data/{session_key}_report.txt`
2. `send_astro_email(recipient, file_path)`  SMTP over SSL (port 465), attaches report as PDF via `MIMEApplication`

Email subject: `"AstroFreud: Emergency Report"` · From: `"AstroFreud AI <...>"`

---

## Session & Data Persistence

### In-progress sessions (`services/session_store.py`)

- File: `data/sessions.json`  JSON keyed by `identity` (e.g. `"VIAN"` or `"unknown_abc123"`)
- Survives server restarts  no in-memory state lost on crash
- `_load_all()` silently returns `{}` on `JSONDecodeError` or missing file
- Session deleted on `is_done=True`, persisted on every other turn

### Completed session log (`services/database_retrieval.py`)

- File: `data/user_data.xlsx` via openpyxl
- Schema: `identity | question | answer | psychological_session | Score | Condition | situation | timeStamp`
- `retrieval_by_identity(identity)` → most recent row (sorted by `timeStamp` descending)
- `retrieval_last3_by_identity(identity)` → last 3 rows (used for repetition detection in relevance check)
- Auto-migration: renames legacy `Session_id` column to `identity` on first load
- Creates file + directory tree if missing

---

## API Surface

| Method | Endpoint | Input | Output |
|---|---|---|---|
| `POST` | `/analyze` | `{"image": "data:image/jpeg;base64,..."}` | `{identity, mood, score, message}` |
| `POST` | `/chat?identity=&token=` | `{"messages": [{"role": "user", "content": "..."}]}` | `{identity, message, phase}` |

---

## Configuration (`configs/configmap.yaml`)

```yaml
rules:              # criticality decision rules  configurable without code changes
database:           # Excel file path + filename
jsonPath:           # sessions.json path + filename
logging:            # backend.log + frontend.log paths
email:              # recipient address for emergency alerts
googleSearch:       # private key (currently unused in main pipeline)
```

All configuration loaded at runtime via `configLoader()` from `configs/configmap.yaml`  no hardcoded paths in business logic.

---

## Project Structure

```
AstroFreud/
├── Dockerfile                    # python:3.11-slim base
├── requirements.txt
├── backend/
│   ├── main.py                   # uvicorn entry  http://0.0.0.0:8000
│   ├── app.py                    # FastAPI factory  CORS + router registration
│   ├── vision_engine.py          # ARESVision  DeepFace/Facenet512 + emotion
│   ├── config_loader.py          # YAML configmap loader
│   ├── logger.py                 # Logging setup
│   ├── configs/
│   │   └── configmap.yaml        # Decision rules, DB path, email, logging
│   ├── models/
│   │   └── request_models.py     # Pydantic: ChatRequest, Message
│   ├── routes/
│   │   ├── analyzer.py           # POST /analyze  base64 frame → ARESVision
│   │   └── chatUI.py             # POST /chat  session mgmt + graph invoke + alert
│   ├── Agents/
│   │   ├── CoreAgent.py          # build_ares_graph()  LangGraph StateGraph (14 nodes)
│   │   ├── AgenticNodes.py       # All 14 node functions + 3 LLM agent runners
│   │   ├── AgenticEdges.py       # 5 conditional routing functions
│   │   ├── Memory.py             # ARESState TypedDict  full graph state schema
│   │   ├── Model.py              # ChatOllama(model="llama3", temperature=0)
│   │   ├── Prompts.py            # 3 LLM prompts: relevance, scorer, psychologist
│   │   └── Helper.py             # _overall_situation(), _build_qa_row()
│   ├── services/
│   │   ├── session_store.py      # SessionStore  JSON persistence (restart-safe)
│   │   ├── database_retrieval.py # Excel CRUD  openpyxl, auto-migration
│   │   ├── criticality.py        # decisionMaking() + decisionMakingForEmail()
│   │   └── emailingservice.py    # SMTP alert  MIMEMultipart with report attachment
│   └── data/
│       ├── sessions.json         # In-progress session states
│       ├── user_data.xlsx        # Completed session log
│       └── *_report.txt          # Per-session emergency report exports
└── frontend/
    └── agentic-friend-frontend/
        ├── src/
        │   ├── App.jsx            # Main React component  chat + webcam UI
        │   └── SpaceBackground.jsx # Space-themed animated background
        └── public/
            ├── intro.mp4          # Mission intro video
            └── logo.png
```

---

## Quickstart

### Prerequisites
- [Ollama](https://ollama.com) running locally with `llama3` pulled
- Python 3.11+, Node.js 18+
- Webcam for identity verification
- Gmail app password for email alerts (configure in `configmap.yaml`)

### Backend

```bash
cd AstroFreud/backend
pip install -r ../requirements.txt
# Pull face reference images into face_db/vian_refs/

# Start Ollama in another terminal
ollama run llama3

# Start ARES
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd AstroFreud/frontend
npm install
npm start
```

### Docker

```bash
docker build -t astrofreud .
docker run -p 8000:8000 astrofreud
```

---

## Security Note

> ⚠️ The current `configmap.yaml` and `emailingservice.py` contain hardcoded credentials (Gmail app password, Google Search private key, recipient email). These should be moved to environment variables or a secrets manager before any shared or production deployment.

---

## Sector Applications

| Sector | Application |
|---|---|
| **Healthcare & Clinical AI** | Direct application  multi-modal mental health triage, structured clinical interview automation, patient distress scoring, escalation-triggered alerting; LangGraph state machine pattern applies to any structured clinical assessment flow |
| **Technology / LLM Engineering** | Production LangGraph with 14 nodes, 5 conditional routers, deterministic LLM scoring, follow-up budget enforcement, and force-verdict fallback  reference architecture for any stateful conversational AI pipeline |
| **Finance & Risk** | Psycholinguistic scoring methodology transferable to earnings call sentiment analysis, customer distress detection in support transcripts, or compliance risk flagging from communication logs |

---

## Author

**Thiruvel Andagurunathan Pandian**  MSc Data Science, University of Bristol  
Building production agentic AI systems that combine multimodal sensing, LLM orchestration, and real-world alerting pipelines.  
📍 Bristol, UK · **Eligible for Skilled Worker Visa sponsorship** · Open to UK roles

[![LinkedIn](https://img.shields.io/badge/LinkedIn-%230077B5.svg?logo=linkedin&logoColor=white)](https://linkedin.com/in/Thiruvel-AP)
[![GitHub](https://img.shields.io/badge/GitHub-%23121011.svg?logo=github&logoColor=white)](https://github.com/Thiruvel-AP)
