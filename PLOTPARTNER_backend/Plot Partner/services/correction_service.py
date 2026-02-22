from pydantic import ValidationError
from llm.client import call_llm
from services.json_utils import safe_json_parse

def attempt_correction(invalid_json: str, error: ValidationError) -> dict:
    """
    Relance le LLM en lui expliquant ce qui est invalide.
    """

    correction_prompt = f"""
The following JSON is invalid.

Validation errors:
{error}

Invalid JSON:
{invalid_json}

Return ONLY corrected valid JSON.
Do not add explanations.
"""

    corrected_output = call_llm(correction_prompt)

    return safe_json_parse(corrected_output)
