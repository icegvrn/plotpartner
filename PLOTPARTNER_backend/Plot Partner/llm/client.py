from openai import OpenAI
from config import settings

if not settings.OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY not found in environment")

client = OpenAI(api_key=settings.OPENAI_API_KEY)

def call_llm(prompt: str) -> str:
    response = client.responses.create(
        model="gpt-4.1-mini",
        input=prompt,
        temperature=0.2
    )
    return response.output_text


