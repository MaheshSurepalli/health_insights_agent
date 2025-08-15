from fastapi import APIRouter, Depends, HTTPException, status
from auth import verify_token
from schemas.chat import ChatRequest
from clients.azure import project
from config import AGENT_ID
from azure.ai.agents.models import MessageRole, ListSortOrder
from services.threads import get_or_create_thread
from services.threads import user_threads

router = APIRouter()


@router.post("/chat")
def chat_with_agent(request: ChatRequest, user=Depends(verify_token)):
    user_id = user["sub"]
    thread_id = get_or_create_thread(user_id)

    project.agents.messages.create(
        thread_id=thread_id,
        role=MessageRole.USER,
        content=request.message
    )

    run = project.agents.runs.create_and_process(
        thread_id=thread_id,
        agent_id=AGENT_ID,
        additional_instructions=(
            "MODE: CHAT. Answer conversationally and briefly. "
            "Do NOT use the analysis section headings. "
            "Refer to the most recent analysis in this thread only if helpful. "
            "Keep responses concise (a few sentences or short bullets)."
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

    return {
        "thread_id": thread_id,
        "agent_reply": last_message
    }


@router.get("/messages")
def get_all_messages(user=Depends(verify_token)):
    user_id = user["sub"]

    # Check for an existing thread (don't create one here)
    thread_id = user_threads.get(user_id)
    result = []
    if not thread_id:
        return result

    all_msgs = project.agents.messages.list(thread_id=thread_id, order=ListSortOrder.ASCENDING)

    
    for idx, msg in enumerate(all_msgs):
        if idx == 0:
            continue
        if msg.text_messages:
            content = msg.text_messages[-1].text.value.strip()
            role = msg.role.title()
            result.append({"role": role, "text": content})

    return result
