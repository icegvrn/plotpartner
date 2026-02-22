from pydantic import BaseModel, Field
from typing import List, Dict
from typing import Optional, Dict, Any

# =====================
# BASIC MODELS
# =====================
class ChatRequest(BaseModel):
    project: Optional[Dict[str, Any]] = None
    message: str
    selected_node_id: Optional[str] = None
    selected_node_type: Optional[str] = None

class ModifyRequest(BaseModel):
    project: Dict[str, Any]
    message: str
    selected_node_id: Optional[str] = None
    selected_node_type: Optional[str] = None

class Position(BaseModel):
    x: int
    y: int


class Block(BaseModel):
    id: str
    title: str
    description: str
    position: Position
    width: int
    height: int


class Character(BaseModel):
    id: str
    name: str


class ObjectModel(BaseModel):
    id: str
    name: str


class Transition(BaseModel):
    target: str
    label: str


class Scene(BaseModel):
    id: str
    title: str
    description: str
    characters: List[str] = Field(default_factory=list)
    objects: List[str] = Field(default_factory=list)
    block_id: str
    transitions: List[Transition] = Field(default_factory=list)


class Project(BaseModel):
    blocks: List[Block]
    characters: List[Character] = Field(default_factory=list)
    objects: List[ObjectModel] = Field(default_factory=list)
    scenes: List[Scene]
