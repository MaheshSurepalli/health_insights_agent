from azure_client import project

# In-memory storage; replace with DB
user_threads = {}

def get_or_create_thread(user_id: str) -> str:
    """
    Gets the thread for a given user or creates one if it doesn't exist.
    """
    if user_id not in user_threads:
        thread = project.agents.threads.create()
        user_threads[user_id] = thread.id
    return user_threads[user_id]
