from config_loader import configLoader

#====================
# Critical Action
def get_critical_action(situation: str) -> str:
    config = configLoader()
    for rule in config.get("rules", []):
        if rule["situation"] == situation:
            return rule["condition"]
    return ""


#====================
# Psychological Agent
def psychological_agent(
    input:             list,
    followup_context:  str  = "",
    overall_situation: str  = "low",
    force_verdict:     bool = False,
) -> str:

    critical_action = get_critical_action(overall_situation)

    if force_verdict:
        verdict_instruction = """
The follow-up question budget is now exhausted. You MUST deliver a final verdict now.
You cannot ask any more questions. Respond ONLY with VERDICT: <your assessment>.
"""
    else:
        verdict_instruction = ""

    if overall_situation == "low":
        situation_instruction = """
All responses indicate the astronaut is in good psychological health.
- Close the session warmly and positively in 2-3 sentences.
- Affirm their resilience and readiness for the mission.
- Do NOT ask any follow-up questions.
- Respond ONLY with: VERDICT: <warm positive closing>
"""
    elif overall_situation == "moderate":
        situation_instruction = f"""
The astronaut shows some areas of concern.
- You may ask follow-up questions ONE AT A TIME to understand the situation better.
- When you have enough information, deliver a verdict.
- End the conversation with pleasant words
"""
    else:  # high
        situation_instruction = f"""
The astronaut is showing signs of significant psychological distress.
- You may ask follow-up questions ONE AT A TIME to confirm severity.
- Use a calm but urgent tone — do not cause panic, but be clear about the seriousness.
- End the conversation with pleasant words
"""

    prompt = f"""
You are ARES, a Deep Space Psychological Support AI speaking directly to an astronaut.
Be warm, concise, and professional — like a trusted medical officer in real conversation.

STRICT RULES:
- Do NOT write headers, phase labels, or section titles.
- Do NOT explain your internal reasoning or analysis.
- Do NOT use bullet points or structured lists.
- Speak directly TO the astronaut in a natural conversational tone.
- Your response must start with either FOLLOWUP: or VERDICT: — nothing before it.

Session data:
{input}

{followup_context}

Situation level: {overall_situation.upper()}

{situation_instruction}

{verdict_instruction}

Respond with ONE of:
  FOLLOWUP: <one short direct question, max 20 words>
  VERDICT:  <your message to the astronaut>
"""
    return prompt


#====================
# Scoring Eval Prompt
def scoring_eval_prompt(question_prev: str, answer_prev: str, question_curr: str, answer_curr: str) -> str:
    prompt = f"""
You are evaluating whether an astronaut's answer is a genuine attempt to respond to a question.

Question asked: {question_curr}
Answer given:   {answer_curr}

Rules — respond "true" if ANY of these apply:
- The answer is yes, no, or any variation (yep, nope, yeah, nah, not really, absolutely, etc.)
- The answer contains a feeling, emotion, or personal state (good, bad, tired, fine, ok, not ok)
- The answer is a short informal phrase that relates to the topic (sleep, focus, crew, emotions)
- The answer expresses agreement or disagreement in any form
- The answer contains at least one word that is relevant to the question topic

Respond "false" ONLY if the answer is:
- Completely random characters with no meaning (e.g. "asdfgh", "xyz123")
- Entirely in a different language with no relation to the question
- Completely blank or whitespace only

Previous exchange for context (may be empty):
Q: {question_prev}
A: {answer_prev}

Strict Output: Respond with ONLY "true" or "false". Nothing else.
"""
    return prompt


#====================
# Calculate the score
def scoring_prompt(question: str, answer: str) -> str:
    prompt = f"""
You are a Senior Clinical Diagnostic AI specialized in psycholinguistics and behavioral analysis.
Your task is to analyze a Query to user and user's Response to provide a
"Psychological Intensity Score" on a scale of 1 to 20.

Query: {question}
Response: {answer}

Evaluation Criteria:
    You will evaluate the input based on the following five dimensions (Weight: 4 points each):
    1. Emotional Valence: The degree of negative/positive affect expressed.
    2. Cognitive Distortion: Presence of "all-or-nothing" thinking, catastrophizing, or overgeneralization.
    3. Functional Impact: To what extent the issue interferes with daily life or relationships.
    4. Somatic/Behavioral Markers: Mentions of physical symptoms (sleep, appetite) or high-risk behaviors.
    5. Agency vs. Helplessness: The user's perceived ability to influence their situation.

The Scoring Key (1-20):
    1–5:   Low / Sub-Clinical. Normal stressors, high agency, balanced perspective.
    6–10:  Mild / Moderate. Noticeable distress, some cognitive bias, but remains functional.
    11–15: Significant / Elevated. High emotional labor, persistent negative thought patterns, functional impairment.
    16–19: Severe / Clinical Concern. Acute distress, frequent catastrophizing, significant loss of agency.
    20:    Critical. Immediate intervention suggested; severe psychological crisis or breakdown.

Output Format — respond with ONLY this format and nothing else:
<score>/20
"""
    return prompt