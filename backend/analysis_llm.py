# analysis_llm.py
import json, re
from typing import Any, Dict
from azure.ai.agents.models import MessageRole, ListSortOrder
from azure_client import project
from config import AGENT_ID
from threads import get_or_create_thread

_JSON_FENCE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)

SCHEMA_JSON = """
Return JSON ONLY (no prose, no markdown). Schema:
{
  "summary": "2–4 sentences on key findings",
  "metrics": [
    {"name":"Hemoglobin","value":6.5,"unit":"g/dL","reference_range":"14.0-18.0","status":"low"}
  ],
  "flags": [
    {"metric":"Hemoglobin","status":"critical-low","reason":"below lab critical mark"}
  ],
  "recommendations": [
    "Increase iron-rich foods and discuss iron studies with a clinician.",
    "Prioritize sleep, hydration, and 150–300 min/wk moderate activity."
  ],
  "disclaimer": "Information only; not medical advice."
}
Rules:
- status ∈ {"low","normal","high","critical-low","critical-high","unknown"}
- Include reference_range only when present in the text.
- Do NOT invent values. Omit metrics that aren’t clearly present.
- Use cautious, non-diagnostic language.
"""

def _build_prompt(extracted: Dict[str, Any]) -> str:
    text = (extracted or {}).get("content") or ""
    if len(text) > 120_000:
        text = text[:120_000] + "\n...[truncated]..."
    return (
        "MODE: ANALYZE_JSON\n"
        "You are a Health Insights assistant. Analyze this lab report text and return JSON ONLY per the schema.\n"
        + SCHEMA_JSON +
        "\n\n--- LAB REPORT TEXT BEGIN ---\n" + text + "\n--- LAB REPORT TEXT END ---"
    )

def _parse_json_output(s: str) -> Dict[str, Any]:
    m = _JSON_FENCE.search(s)
    if m:
        s = m.group(1)
    else:
        i = s.find("{")
        if i != -1:
            s = s[i:]
    return json.loads(s)

def analyze_with_agent(user_id: str, extracted: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sends the DI text to your Azure Agent on the user's thread and returns structured JSON.
    """
    thread_id = get_or_create_thread(user_id)
    prompt = _build_prompt(extracted)

    # add user message
    project.agents.messages.create(
        thread_id=thread_id,
        role=MessageRole.USER,
        content=prompt,
    )

    # run to completion (same pattern as your chat API)
    run = project.agents.runs.create_and_process(  # :contentReference[oaicite:1]{index=1}
        thread_id=thread_id,
        agent_id=AGENT_ID,
    )
    if getattr(run, "status", "") == "failed":
        return {
            "summary": "LLM analysis failed to run.",
            "metrics": [],
            "flags": [],
            "recommendations": [],
            "disclaimer": "Information only; not medical advice."
        }

    # read latest agent message (descending list)
    msgs = project.agents.messages.list(thread_id=thread_id, order=ListSortOrder.DESCENDING)
    for msg in msgs:
        if msg.role == MessageRole.AGENT and msg.text_messages:  # match your chat code’s role usage :contentReference[oaicite:2]{index=2}
            raw = msg.text_messages[-1].text.value.strip()
            try:
                return _parse_json_output(raw)
            except Exception:
                # Fallback: wrap raw text
                return {
                    "summary": raw[:600],
                    "metrics": [],
                    "flags": [],
                    "recommendations": [],
                    "disclaimer": "Information only; not medical advice."
                }

    # No assistant message found
    return {
        "summary": "No LLM output available.",
        "metrics": [],
        "flags": [],
        "recommendations": [],
        "disclaimer": "Information only; not medical advice."
    }
