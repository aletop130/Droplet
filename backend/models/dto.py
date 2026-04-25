from typing import Literal

from pydantic import BaseModel, Field


class PageContext(BaseModel):
    route: str | None = None
    entity_type: str | None = None
    entity_id: int | None = None
    selected_window: str | None = "30d"


class ChatAttachment(BaseModel):
    id: str
    name: str
    mime_type: str = "application/octet-stream"
    size_bytes: int = 0
    kind: Literal["image", "audio", "document"] = "document"
    data_url: str | None = None


class ChatRequest(BaseModel):
    message: str
    page_context: PageContext = Field(default_factory=PageContext)
    session_id: str
    agent_mode: Literal["operations", "investments"] = "operations"
    attachments: list[ChatAttachment] = Field(default_factory=list)


class IncidentPatch(BaseModel):
    status: Literal["open", "in_progress", "resolved", "dismissed"] | None = None
    assigned_to: str | None = None


class ControlRejectRequest(BaseModel):
    reason: str | None = None
    operator_id: str = "operator"


class ControlApproveRequest(BaseModel):
    operator_id: str = "operator"

