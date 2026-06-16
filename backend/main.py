from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from .config import APP_NAME, VERSION
from .meta_builder import build_meta_builder_status, continue_meta_builder
from .meta_development import build_meta_development_status
from .studio_control_plane import boot_studio_mission, build_studio_control_plane

app = FastAPI(title=f"{APP_NAME} API", version=VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "https://app.trezzhaus.com",
    ],
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
    useOllama: bool = False
    ollamaModel: str | None = None
    domain: str | None = None


@app.post("/api/lumi/chat")
def lumi_chat(payload: LumiChatRequest):
    """
    Chat with LUMI. Stores conversation in MissionStore and returns AI response.
    Supports OpenRouter cascade AND local Ollama (SuperGemma 26B / Gemma 27B).
    Set useOllama=true to route through local Ollama.
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

    result = router.lumi_chat(
        payload.message,
        history=history,
        use_ollama=payload.useOllama,
        ollama_model=payload.ollamaModel,
        domain=payload.domain,
    )

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
    """Return the configured AI model cascade (OpenRouter + Ollama)."""
    from .ai_router import get_router  # noqa: PLC0415
    from .ollama_provider import get_ollama  # noqa: PLC0415
    ollama = get_ollama()
    return {
        "cascade": get_router().cascade_info(),
        "ollama": {
            "available": ollama.is_available(),
            "host": ollama.host,
            "catalogue": ollama.catalogue(),
        },
    }


# ---------------------------------------------------------------------------
# Ollama local model management
# ---------------------------------------------------------------------------

@app.get("/api/ollama/status")
def ollama_status():
    """Return Ollama availability and locally-pulled models."""
    from .ollama_provider import get_ollama  # noqa: PLC0415
    ollama = get_ollama()
    available = ollama.is_available()
    return {
        "available": available,
        "host": ollama.host,
        "localModels": ollama.list_local_models() if available else [],
        "catalogue": ollama.catalogue(),
        "superGemmaReady": any(
            m["available"] for m in ollama.catalogue()
            if "gemma3:27b" in m["id"] or "gemma2:27b" in m["id"]
        ) if available else False,
        "installHint": (
            "Start Ollama: `ollama serve`  "
            "Pull SuperGemma 26B: `ollama pull gemma3:27b`"
        ),
    }


# ---------------------------------------------------------------------------
# Prompt enhancer — domain-aware LUMI prompt improvement
# ---------------------------------------------------------------------------

class PromptEnhanceRequest(BaseModel):
    prompt: str
    domain: str | None = None


@app.post("/api/lumi/enhance-prompt")
def enhance_prompt_endpoint(payload: PromptEnhanceRequest):
    """Enhance a raw user prompt using LUMI's domain-aware prompt engineering."""
    from .lumi_prompt_enhancer import enhance_prompt, detect_domain, get_domain_catalogue  # noqa: PLC0415
    domain = payload.domain or detect_domain(payload.prompt)
    messages = enhance_prompt(payload.prompt, domain=domain)
    return {
        "domain": domain,
        "detectedDomain": domain,
        "enhancedMessages": messages,
        "systemPromptPreview": messages[0]["content"][:300] + "…" if len(messages[0]["content"]) > 300 else messages[0]["content"],
    }


@app.get("/api/lumi/prompt-domains")
def prompt_domains():
    """Return the list of creative domains supported by the prompt enhancer."""
    from .lumi_prompt_enhancer import get_domain_catalogue  # noqa: PLC0415
    return {"domains": get_domain_catalogue()}


# ---------------------------------------------------------------------------
# Video Creator — AI-driven end-to-end video production with MP4 export
# ---------------------------------------------------------------------------

class VideoCreateRequest(BaseModel):
    concept: str
    durationSeconds: int = 60
    style: str = "cinematic"
    resolution: str = "1080p"
    fps: int = 24


@app.post("/api/video/create")
def video_create(payload: VideoCreateRequest):
    """
    Start an AI-driven video creation job.
    Returns a jobId to poll for status and download the MP4.
    Duration capped at 600 seconds (10 minutes).
    """
    from .video_creator import create_video_job  # noqa: PLC0415
    job = create_video_job(
        concept=payload.concept,
        duration_seconds=payload.durationSeconds,
        style=payload.style,
        resolution_label=payload.resolution,
        fps=payload.fps,
    )
    return job.to_dict()


@app.get("/api/video/{job_id}/status")
def video_status(job_id: str):
    """Poll the status of a video creation job."""
    from .video_creator import get_video_job  # noqa: PLC0415
    job = get_video_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Video job '{job_id}' not found.")
    return job.to_dict()


@app.get("/api/video/{job_id}/download")
def video_download(job_id: str):
    """Download the finished MP4 for a completed video job."""
    from .video_creator import get_video_output_path  # noqa: PLC0415
    path = get_video_output_path(job_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Video not ready or job not found.")
    filename = path.name
    media_type = "video/mp4" if filename.endswith(".mp4") else "text/plain"
    return FileResponse(path=str(path), media_type=media_type, filename=filename)


@app.get("/api/video/jobs")
def video_jobs():
    """List all video creation jobs."""
    from .video_creator import list_video_jobs  # noqa: PLC0415
    return {"jobs": list_video_jobs()}


# ---------------------------------------------------------------------------
# Music Generator — AI composition briefs
# ---------------------------------------------------------------------------

class MusicGenerateRequest(BaseModel):
    concept: str
    genre: str = "cinematic"
    durationSeconds: int = 60
    bpm: int = 120
    mood: str = "epic"


@app.post("/api/music/generate")
def music_generate(payload: MusicGenerateRequest):
    """Generate a detailed music composition brief using LUMI."""
    from .ai_router import get_router  # noqa: PLC0415
    router = get_router()
    prompt = (
        f"Compose a detailed music production brief for: {payload.concept}\n"
        f"Genre: {payload.genre}, BPM: {payload.bpm}, Mood: {payload.mood}, "
        f"Duration: {payload.durationSeconds}s\n\n"
        "Provide:\n"
        "1. Track title\n"
        "2. Full arrangement (intro/verse/chorus/bridge/outro with timestamps)\n"
        "3. Instrument list with specific articulations\n"
        "4. Sound design notes\n"
        "5. Mixing/mastering targets (LUFS, dynamics)\n"
        "6. Lyrics or vocal notes if applicable\n"
        "7. Reference tracks\n"
        "Format as a professional studio session document."
    )
    result = router.lumi_chat(prompt, domain="music")
    return {
        "concept": payload.concept,
        "genre": payload.genre,
        "bpm": payload.bpm,
        "mood": payload.mood,
        "durationSeconds": payload.durationSeconds,
        "composition": result.content if result.ok else f"LUMI unavailable: {result.error}",
        "model": result.model,
        "ok": result.ok,
    }


# ---------------------------------------------------------------------------
# Image Generator — AI prompt engineering for image synthesis
# ---------------------------------------------------------------------------

class ImageGenerateRequest(BaseModel):
    concept: str
    style: str = "photorealistic"
    aspectRatio: str = "16:9"
    count: int = 4


@app.post("/api/image/generate")
def image_generate(payload: ImageGenerateRequest):
    """Generate detailed image prompts for Stable Diffusion / Midjourney / DALL-E."""
    from .ai_router import get_router  # noqa: PLC0415
    router = get_router()
    prompt = (
        f"Generate {payload.count} detailed image prompts for: {payload.concept}\n"
        f"Style: {payload.style}, Aspect ratio: {payload.aspectRatio}\n\n"
        "For each image provide a JSON object with:\n"
        "- title: short descriptive title\n"
        "- prompt: 150-200 word Stable Diffusion / Midjourney prompt (lighting, camera, style tokens)\n"
        "- negative_prompt: what to exclude\n"
        "- model_suggestion: e.g. 'SDXL + Cinematic LoRA', 'Midjourney v6', 'DALL-E 3'\n"
        "- color_palette: 3-5 hex codes\n\n"
        "Respond ONLY with a valid JSON array."
    )
    result = router.lumi_chat(prompt, domain="creative")
    return {
        "concept": payload.concept,
        "style": payload.style,
        "aspectRatio": payload.aspectRatio,
        "count": payload.count,
        "output": result.content if result.ok else f"LUMI unavailable: {result.error}",
        "model": result.model,
        "ok": result.ok,
    }


# ---------------------------------------------------------------------------
# Static file serving — serve the built React UI at /
# Must be registered AFTER all API routes so /api/* is not intercepted.
# ---------------------------------------------------------------------------

_RENDERER_DIR = Path(__file__).parent.parent / "dist" / "renderer"
if _RENDERER_DIR.is_dir():
    from fastapi.staticfiles import StaticFiles  # noqa: PLC0415
    app.mount("/", StaticFiles(directory=str(_RENDERER_DIR), html=True), name="ui")
