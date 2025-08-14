# services/analysis.py
from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

from azure.ai.agents.models import MessageRole, ListSortOrder
from clients.azure import project
from config import AGENT_ID
from services.threads import get_or_create_thread

# Extracts a JSON object inside ```json ... ``` or ``` ... ```
_JSON_FENCE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)
_MAX_DOC_CHARS = 120_000  # keep generous but bounded like before

# NOTE: keep this schema text identical to what you already use.
# If you store your prompt elsewhere, import it here.
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
- Include reference_range only when found in the document.
- Be concise and avoid medical diagnosis language.
"""

def _build_prompt(extracted: Dict[str, Any]) -> str:
    """
    Build the exact user message sent to the Agent.
    """
    content = extracted.get("content") or ""
    # Hard cap the size to keep the run predictable
    if len(content) > _MAX_DOC_CHARS:
        content = content[:_MAX_DOC_CHARS]

    # Preserve the existing control marker + schema instructions
    parts = [
        "MODE: ANALYZE_JSON",
        "You are a Health Insights assistant. Analyze this lab report text and return JSON ONLY per the schema.",
        SCHEMA_JSON.strip(),
        "",
        "Report text:",
        content.strip(),
    ]
    return "\n".join(parts).strip()


def _try_parse_json(text: str) -> Optional[Dict[str, Any]]:
    """
    Attempt multiple strategies to parse JSON from model output.
    """
    if not text:
        return None

    # 1) Look for fenced code blocks
    m = _JSON_FENCE.search(text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    # 2) Raw JSON (no fences)
    text = text.strip()
    if text.startswith("{") and text.endswith("}"):
        try:
            return json.loads(text)
        except Exception:
            pass

    return None


def _fallback_payload(raw: str | None) -> Dict[str, Any]:
    raw = (raw or "").strip()
    snippet = raw[:600] if raw else "No LLM output available."
    return {
        "summary": snippet,
        "metrics": [],
        "flags": [],
        "recommendations": [],
        "disclaimer": "Information only; not medical advice.",
    }


def analyze_with_agent(user_id: str, extracted: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sends the extracted DI text to the Agent and returns a structured JSON dict.
    Signature and return shape remain identical to the previous implementation.
    """
    # 1) Ensure a per-user thread
    thread_id = get_or_create_thread(user_id)

    # 2) Post the user message (prompt)
    user_msg = _build_prompt(extracted)
    project.agents.messages.create(
        thread_id=thread_id,
        role=MessageRole.USER,
        content=user_msg,
    )

    # 3) Run the agent
    run = project.agents.runs.create_and_process(thread_id=thread_id, agent_id=AGENT_ID)
    if getattr(run, "status", None) == "failed":
        # Surface the agent's last error upstream (same behavior as before)
        err = getattr(run, "last_error", "Agent run failed")
        raise RuntimeError(err)

    # 4) Read the last assistant message text
    #    (Use list() to be robust to SDK surface; ASC then take last or DESC and take first)
    msgs = project.agents.messages.list(thread_id=thread_id, order=ListSortOrder.DESCENDING)
    last_text: Optional[str] = None
    for m in msgs:
        if m.role == MessageRole.AGENT and m.text_messages:
            last_text = m.text_messages[-1].text.value.strip()
            break

    # 5) Parse JSON or fallback
    parsed = _try_parse_json(last_text or "")
    return parsed if parsed is not None else _fallback_payload(last_text)
