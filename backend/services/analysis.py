# services/analysis.py
from __future__ import annotations

import time
from typing import Any, Dict, Optional

from azure.ai.agents.models import MessageRole, ListSortOrder
from fastapi import HTTPException, status
from clients.azure import project
from config import AGENT_ID
from services.threads import get_or_create_thread

_MAX_DOC_CHARS = 120_000  # generous but bounded


def _coalesce_report_text(extracted: Dict[str, Any]) -> str:
    """
    Pull a single text blob from Document Intelligence output.
    Prefer `content`; otherwise fall back to a compact summary of keys.
    """
    text = (extracted or {}).get("content")
    if not text:
        parts = []
        for k in ("pages", "tables", "keyValuePairs"):
            if k in (extracted or {}):
                try:
                    parts.append(f"{k}:{len(extracted[k])}")
                except Exception:
                    parts.append(k)
        text = " ".join(parts) or "No textual content extracted."
    return text[:_MAX_DOC_CHARS]


def _build_user_message(report_text: str) -> str:
    """
    Minimal per-request prompt. We rely on the agent's system instructions
    for role, safety, tone, and exact section headings. This avoids duplication.
    """
    return (
        "Analyze the laboratory report below per the system instructions. "
        "Respond in **Markdown** only, using the exact section headings specified in the system prompt. "
        "Do not return JSON or XML.\n\n"
        "=== REPORT TEXT START ===\n"
        f"{report_text}\n"
        "=== REPORT TEXT END ==="
    )



def analyze_with_agent(user_id: str, extracted: Dict[str, Any]) -> str:
    """
    Sends the extracted report text to the Azure Agent and returns the assistant’s
    Markdown response **as-is** (no parsing or transformation).
    """
    # 1) Reuse/create a thread for this user
    thread_id = get_or_create_thread(user_id)

    # 2) Build and send the user message
    report_text = _coalesce_report_text(extracted)
    user_message = _build_user_message(report_text)
    project.agents.messages.create(
        thread_id=thread_id,
        role=MessageRole.USER,
        content=user_message,
    )

    # 3) Run the agent on this thread
    run = project.agents.runs.create_and_process(
        thread_id=thread_id,
        agent_id=AGENT_ID,
        additional_instructions=(
            "For THIS response, use these EXACT section headings and nothing else: "
            "Summary; Potential Concerns; Key Readings (as reported); "
            "Recommendations (non-diagnostic); Follow-Up & Monitoring; "
            "Limitations; Disclaimer. Quote units and the report’s own ranges; "
            "use cautious, non-diagnostic language."
        ),
    )

    if run.status == "failed":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=run.last_error
        )

    last_message = project.agents.messages.get_last_message_text_by_role(
        thread_id=thread_id,
        role=MessageRole.AGENT
    ).get("text", {}).get("value", "")
    
    return last_message
