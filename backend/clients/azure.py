from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
from config import AZURE_ENDPOINT, AGENT_ID

# Foundry 
project = AIProjectClient(
    credential=DefaultAzureCredential(),
    endpoint=AZURE_ENDPOINT
)

agent = project.agents.get_agent(AGENT_ID)
