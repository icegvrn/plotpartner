from schemas import Project
from llm.client import call_llm
from services.json_utils import safe_json_parse
from pydantic import ValidationError



def generate_from_text(text: str, instructions: str | None = None) -> Project:

    prompt = build_prompt(text, instructions)

    for attempt in range(3):
        raw_output = call_llm(prompt)

        raw_json = extract_first_json_block(raw_output)

        if not raw_json:
            prompt = build_correction_prompt(raw_output, "No valid JSON found")
            continue

        parsed = safe_json_parse(raw_json)

        try:
            project = Project(**parsed)
            return project
        except ValidationError as e:
            prompt = build_correction_prompt(raw_output, e)

    raise Exception("LLM failed to generate valid project after 3 attempts")

def extract_first_json_block(text: str):
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start:i+1]

    return None

def build_prompt(text: str, instructions: str | None = None) -> str:
    return f"""
You are a strict narrative graph JSON generator.

Your task:
Transform the narrative text into a valid structured narrative graph.

You must output ONLY valid JSON.
No markdown.
No explanation.
No conversational text.

CRITICAL:
If the narrative text is vague (e.g. "generate a graph"),
you must invent a coherent fictional story before structuring it.

The output MUST exactly match this structure:

{{
"blocks": [
    {{
    "id": "string",
    "title": "string",
    "description": "string"
    }}
],
"characters": [
    {{
    "id": "string",
    "name": "string"
    }}
],
"objects": [
    {{
    "id": "string",
    "name": "string"
    }}
],
"scenes": [
  {{
    "id": "string",
    "title": "string",
    "description": "string",
    "block_id": "block_id",
    "references": ["block_id"],
    "characters": ["character_id"],
    "objects": ["object_id"],
    "transitions": [
      {{
        "target": "scene_id",
        "label": "string"
      }}
    ]
  }}
]
}}

Rules:
- Output ONLY raw JSON.
- No markdown.
- No triple backticks.
- No commentary.
- All IDs must be unique.
- All transitions must reference existing scenes.
- Scenes must belong to exactly one block.

Narrative text:
{text}
"""

def build_correction_prompt(invalid_json, error):
    return f"""
The following JSON is invalid:

{invalid_json}

Validation error:
{error}

Return ONLY corrected valid JSON.
No markdown.
"""