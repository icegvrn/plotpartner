from fastapi import FastAPI,HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from llm.client import client
import re
import json
from schemas import Project, ChatRequest, ModifyRequest
from pydantic import BaseModel, ValidationError
from services import generate_from_text
from services.chat_service import modify_project_with_llm, chat_decision, chat_decision_stream
from typing import Optional
from services import safe_json_parse

class GenerateRequest(BaseModel):
    text: str
    instructions: str | None = None

app = FastAPI()

# Autorise React à parler au backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/project")
def get_project():
    with open("project.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    project = Project(**data)  # validation ici
    return project    

@app.post("/generate")
def generate_project(request: GenerateRequest):
    try:
        project = generate_from_text(request.text)
        return project
    except Exception as e:
        print("🔥 BACKEND ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
def chat_endpoint(request: ChatRequest):
    decision = chat_decision(
        request.project,
        request.message,
        request.selected_node_id,
        request.selected_node_type
    )

    return decision
    
@app.post("/modify")
def modify_endpoint(request: ModifyRequest):
    updated_project = modify_project_with_llm(
        request.project,
        request.message,
        request.selected_node_id,
        request.selected_node_type
    )

    return updated_project



@app.post("/chat-stream")
async def chat_stream(request: Request):

    body = await request.json()

    project = body.get("project")
    message = body.get("message")
    selected_node_id = body.get("selected_node_id")
    selected_node_type = body.get("selected_node_type")

    # 🔥 Extracteur JSON robuste
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

    async def generator():

        text_buffer = ""
        decision_buffer = ""
        inside_decision = False
        decision_completed = False

        yield json.dumps({"status": "thinking"}) + "\n"

        for chunk in chat_decision_stream(
            project,
            message,
            selected_node_id,
            selected_node_type
        ):

            if isinstance(chunk, dict):
                chunk = chunk.get("__final_text__", "")

            text_buffer += chunk

            while True:

                if decision_completed:
                    break

                if not inside_decision:
                    decision_start = text_buffer.find("<decision>")

                    if decision_start == -1:
                        # 🔒 marge de sécurité pour ne jamais streamer une balise partielle
                        safe_length = len(text_buffer) - len("<decision>")
                        if safe_length > 0:
                            safe_text = text_buffer[:safe_length]
                            yield json.dumps({"delta": safe_text}) + "\n"
                            text_buffer = text_buffer[safe_length:]
                        break

                    else:
                        # Stream uniquement ce qui est AVANT <decision>
                        before = text_buffer[:decision_start]
                        if before:
                            yield json.dumps({"delta": before}) + "\n"

                        text_buffer = text_buffer[decision_start + len("<decision>"):]
                        inside_decision = True

                else:
                    decision_end = text_buffer.find("</decision>")

                    if decision_end == -1:
                        decision_buffer += text_buffer
                        text_buffer = ""
                        break
                    else:
                        decision_buffer += text_buffer[:decision_end]
                        text_buffer = text_buffer[decision_end + len("</decision>"):]
                        inside_decision = False
                        decision_completed = True
                        break

        # 🔥 Extraction JSON propre
        raw_json = extract_first_json_block(decision_buffer)

        # 🔥 fallback si pas de <decision>
        if not raw_json:
            raw_json = extract_first_json_block(text_buffer)

        if not raw_json:
            raise ValueError("No valid JSON found in decision block or raw output")

        decision = safe_json_parse(raw_json)

        final_project = None

        if decision["type"] == "generation":
            yield json.dumps({"status": "generating"}) + "\n"
            final_project = generate_from_text(message)

        elif decision["type"] == "modification":
            yield json.dumps({"status": "modifying"}) + "\n"
            final_project = modify_project_with_llm(
                project,
                message,
                selected_node_id,
                selected_node_type
            )

        yield json.dumps({
            "status": "done",
            "assistant_message": decision.get("assistant_message"),
            "project": final_project.model_dump() if final_project else None
        }) + "\n"

        yield "[DONE]"

    return StreamingResponse(generator(), media_type="text/plain")
