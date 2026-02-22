import json

def safe_json_parse(raw_text: str) -> dict:
    """
    Nettoie la sortie LLM et retourne un dict JSON.
    Lève une ValueError si parsing impossible.
    """

    if not raw_text:
        raise ValueError("Empty LLM response")

    text = raw_text.strip()

    # Supprime les fences markdown éventuelles
    if text.startswith("```"):
        text = text.split("```")[1].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON from LLM: {e}")
