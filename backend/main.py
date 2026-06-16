from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .config import APP_NAME, VERSION
from .meta_builder import build_meta_builder_status, continue_meta_builder
from .meta_development import build_meta_development_status
from .studio_control_plane import boot_studio_mission, build_studio_control_plane

app = FastAPI(title=f"{APP_NAME} API", version=VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/status")
def status():
    return {"status": "running", "version": VERSION}


@app.get("/api/meta-development/status")
def meta_development_status():
    return build_meta_development_status()


@app.get("/api/meta-builder/status")
def meta_builder_status():
    return build_meta_builder_status()


class MetaBuilderContinueRequest(BaseModel):
    objective: str = "Continue until TPS is production ready."
    maxActions: int = 3


@app.post("/api/meta-builder/continue")
def meta_builder_continue(payload: MetaBuilderContinueRequest):
    return continue_meta_builder(payload.objective, payload.maxActions)


@app.get("/api/studio/control-plane")
def studio_control_plane():
    return build_studio_control_plane()


class StudioMissionRequest(BaseModel):
    prompt: str


@app.post("/api/studio/control-plane/boot")
def studio_control_plane_boot(payload: StudioMissionRequest):
    return boot_studio_mission(payload.prompt)


# ---------------------------------------------------------------------------
# Pipeline execution status
# ---------------------------------------------------------------------------

@app.get("/api/pipeline/{mission_id}/status")
def pipeline_status(mission_id: str):
    """Poll real-time pipeline execution status for a running mission."""
    from .pipeline_executor import get_executor  # noqa: PLC0415
    result = get_executor().get_mission_status(mission_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found.")
    return result


@app.get("/api/pipeline/missions")
def pipeline_missions():
    """List recent missions."""
    from .pipeline_executor import get_executor  # noqa: PLC0415
    return {"missions": get_executor().list_missions()}


# ---------------------------------------------------------------------------
# LUMI AI chat interface
# ---------------------------------------------------------------------------

class LumiChatRequest(BaseModel):
    message: str
    missionId: str | None = None
    history: list[dict] | None = None


@app.post("/api/lumi/chat")
def lumi_chat(payload: LumiChatRequest):
    """
    Chat with LUMI. Stores conversation in MissionStore and returns AI response.
    Cascades through free models first (Gemini → DeepSeek → Llama → …).
    """
    from datetime import datetime, timezone  # noqa: PLC0415
    from .ai_router import get_router  # noqa: PLC0415
    from .mission_store import MissionStore  # noqa: PLC0415

    router = get_router()
    store = MissionStore()
    now = datetime.now(timezone.utc).isoformat()

    # Persist user message
    store.add_chat(
        role="user",
        content=payload.message,
        now=now,
        mission_id=payload.missionId,
    )

    # Retrieve recent history from DB if not provided
    history = payload.history
    if history is None and payload.missionId:
        db_history = store.get_chat_history(payload.missionId, limit=20)
        history = [{"role": h["role"], "content": h["content"]} for h in db_history[:-1]]

    result = router.lumi_chat(payload.message, history=history)

    content = result.content if result.ok else f"LUMI is unavailable: {result.error}"
    model_used = result.model if result.ok else "none"

    # Persist LUMI response
    store.add_chat(
        role="assistant",
        content=content,
        now=datetime.now(timezone.utc).isoformat(),
        mission_id=payload.missionId,
        model_used=model_used,
    )

    return {
        "role": "assistant",
        "content": content,
        "model": model_used,
        "ok": result.ok,
    }


@app.get("/api/lumi/chat/history")
def lumi_chat_history(mission_id: str | None = None, limit: int = 40):
    """Retrieve LUMI chat history."""
    from .mission_store import MissionStore  # noqa: PLC0415
    store = MissionStore()
    return {"history": store.get_chat_history(mission_id, limit=limit)}


# ---------------------------------------------------------------------------
# Fine-tuning
# ---------------------------------------------------------------------------

@app.get("/api/lumi/finetune/status")
def lumi_finetune_status():
    """Return fine-tuning dataset status."""
    from .lumi_finetune import get_finetune_status  # noqa: PLC0415
    return get_finetune_status()


@app.post("/api/lumi/finetune/assemble")
def lumi_finetune_assemble():
    """Assemble the LUMI fine-tuning dataset from repo content + pipeline fragments."""
    from .lumi_finetune import assemble_dataset  # noqa: PLC0415
    from .mission_store import MissionStore  # noqa: PLC0415
    return assemble_dataset(MissionStore())


# ---------------------------------------------------------------------------
# AI model cascade info
# ---------------------------------------------------------------------------

@app.get("/api/lumi/models")
def lumi_models():
    """Return the configured AI model cascade."""
    from .ai_router import get_router  # noqa: PLC0415
    return {"cascade": get_router().cascade_info()}
