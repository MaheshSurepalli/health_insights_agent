from typing import Dict
from clients.azure import project

# In-memory storage; intentionally unchanged (behavior-compatible)
user_threads: Dict[str, str] = {}

class ThreadRepository:
    """
    Minimal indirection layer. Keeps current in-memory behavior,
    but lets us swap the backing store later without touching call sites.
    """
    def __init__(self, store: Dict[str, str]):
        self._store = store

    def get_or_create(self, user_id: str) -> str:
        if user_id not in self._store:
            thread = project.agents.threads.create()
            self._store[user_id] = thread.id
        return self._store[user_id]

# Single module-level instance (keeps semantics identical)
_repo = ThreadRepository(user_threads)

def get_or_create_thread(user_id: str) -> str:
    """
    Public API used by the rest of the app. Do not change callers.
    """
    return _repo.get_or_create(user_id)
