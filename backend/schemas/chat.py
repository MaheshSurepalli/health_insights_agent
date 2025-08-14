# schemas/chat.py
from typing import List
from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    thread_id: str
    agent_reply: str

class MessageItem(BaseModel):
    role: str
    text: str

class MessagesResponse(BaseModel):
    messages: List[MessageItem]
