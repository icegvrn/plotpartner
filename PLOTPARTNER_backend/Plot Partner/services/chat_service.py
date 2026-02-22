from llm.client import call_llm, client
from services.generation_service import generate_from_text
from services.json_utils import safe_json_parse
from schemas import Project
from pydantic import ValidationError
import json
from services import build_correction_prompt
from services.system_prompts import PLOT_PARTNER_CORE


def modify_project_with_llm(project, message, selected_node_id, selected_node_type):

    prompt = build_modify_prompt(
        project,
        message,
        selected_node_id,
        selected_node_type
    )

    for attempt in range(3):

        raw_output = call_llm(prompt)

        print("\n===== RAW MODIFY OUTPUT =====")
        print(raw_output)
        print("===== END RAW OUTPUT =====\n")

        parsed = safe_json_parse(raw_output)

        try:
            validated_project = Project(**parsed)
            return validated_project.model_dump()

        except ValidationError as e:
            prompt = build_correction_prompt(raw_output, e)

    raise Exception("LLM failed to return valid modified project after 3 attempts")

def build_chat_prompt(project, message, selected_node_id, selected_node_type):

    project_json = json.dumps(project, indent=2)

    return f"""
{PLOT_PARTNER_CORE}

Current project:
{project_json}

Selected node:
ID: {selected_node_id}
Type: {selected_node_type}

User request:
{message}

Remember:
- First respond in natural French with Markdown.
- Then output the <decision> block.
- Never output raw JSON outside <decision>.
"""

def handle_no_project(message):

    prompt = f"""
    {PLOT_PARTNER_CORE}
You are a narrative assistant.

There is currently NO narrative graph loaded.

You must decide:

- If the user explicitly asks to generate a graph or confirms generation,
  return:
{{
  "type": "generation"
}}

- If the user provides a story idea that could become a graph,
  but does not explicitly request generation,
  return:
{{
  "type": "suggest_generation",
  "assistant_message": {{ask if they want to generate a graph}}
}}

- Otherwise return:
{{
  "type": "analysis",
  "assistant_message": {{normal conversational answer}}
}}

Return ONLY valid JSON.
No markdown.

User message:
{message}
"""

    raw_output = call_llm(prompt)

    print("\n===== RAW NO PROJECT OUTPUT =====")
    print(raw_output)
    print("===== END RAW OUTPUT =====\n")

    parsed = safe_json_parse(raw_output)

    # 🔥 CAS GENERATION
    if parsed["type"] == "generation":
        new_project = generate_from_text(message)

        return {
            "type": "generation",
            "project": new_project.model_dump(),
            "assistant_message": f"Successfully generated a new narrative graph based on your idea: {message}"
        }

    return parsed

def build_modify_prompt(project, message, selected_node_id, selected_node_type):

    project_json = json.dumps(project, indent=2)

    return f"""
    {PLOT_PARTNER_CORE}
You are a narrative graph editor.

You must modify the given project according to the user request.

Return ONLY the full updated project JSON.
Do not wrap it.
Do not add explanations.
Do not add markdown.

Rules:
- Preserve all existing IDs unless explicitly instructed.
- Do not change positions unless necessary.
- Only modify what is requested.
- Keep structure valid.

Current project:
{project_json}

Selected node:
ID: {selected_node_id}
Type: {selected_node_type}

User request:
{message}
"""
def chat_decision(project, message, selected_node_id, selected_node_type):

    prompt = build_chat_prompt(
        project,
        message,
        selected_node_id,
        selected_node_type
    )

    raw_output = call_llm(prompt)
    parsed = safe_json_parse(raw_output)

    return parsed

def chat_decision_stream(project, message, selected_node_id, selected_node_type):

    prompt = build_chat_prompt(
        project,
        message,
        selected_node_id,
        selected_node_type
    )

    with client.responses.stream(
        model="gpt-4.1-mini",
        input=prompt,
        temperature=0.2
    ) as stream:

        full_text = ""

        for event in stream:
            if event.type == "response.output_text.delta":
                delta = event.delta
                full_text += delta
                yield delta   # 👈 on stream le token

        yield {"__final_text__": full_text}    