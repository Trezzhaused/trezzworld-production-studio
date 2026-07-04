from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Header, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from .config import APP_NAME, VERSION
from .meta_builder import build_meta_builder_status, continue_meta_builder
from .meta_development import build_meta_development_status
from .platform_vision import (
    build_platform_vision_status,
    get_brand_catalog,
    get_public_api_surface,
    schedule_liveops_event,
)
from .studio_control_plane import boot_studio_mission, build_studio_control_plane

app = FastAPI(title=f"{APP_NAME} API", version=VERSION)

app.add_middleware(
    CORSMiddleware,
 allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/status")
def status():
    return {"status": "running", "version": VERSION}


@app.get("/api/platform/vision")
def platform_vision_status():
    return build_platform_vision_status()


@app.get("/api/platform/brands")
def platform_brands():
    return get_brand_catalog()


@app.get("/api/platform/public")
def platform_public_surface():
    return get_public_api_surface()


class PlatformLiveOpsScheduleRequest(BaseModel):
    brandId: str
    event: dict[str, Any] | None = None


@app.post("/api/platform/liveops/schedule")
def platform_liveops_schedule(payload: PlatformLiveOpsScheduleRequest):
    return schedule_liveops_event(payload.brandId, payload.event)


@app.get("/api/debug/ffmpeg")
def debug_ffmpeg():
    """Diagnose FFmpeg availability on this server."""
    import shutil, subprocess
    from pathlib import Path
    which = shutil.which("ffmpeg")
    nix_paths = list(Path("/nix/store").glob("*/bin/ffmpeg")) if Path("/nix/store").exists() else []
    result = {"which": which, "nix_paths": [str(p) for p in nix_paths[:5]]}
    if which:
        try:
            r = subprocess.run([which, "-version"], capture_output=True, timeout=5)
            result["version_check"] = r.returncode == 0
            result["version_output"] = r.stdout.decode()[:200]
        except Exception as e:
            result["error"] = str(e)
    return result

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

@app.get("/api/auth/session")
def auth_session(authorization: str | None = Header(default=None)):
    """Validate the caller's TrezzHaus account session (SSO with trezzhaus.com) and report owner status."""
    from .trezzhaus_auth import read_bearer_token, get_session, is_owner  # noqa: PLC0415

    token = read_bearer_token(authorization)
    account = get_session(token) if token else None
    return {
        "loggedIn": account is not None,
        "isOwner": is_owner(account),
        "account": {"id": account.get("id"), "username": account.get("username"), "role": account.get("role")} if account else None,
    }


class LumiChatRequest(BaseModel):
    message: str
    missionId: str | None = None
    history: list[dict] | None = None
    useOllama: bool = False
    ollamaModel: str | None = None
    domain: str | None = None


@app.post("/api/lumi/chat")
def lumi_chat(payload: LumiChatRequest, authorization: str | None = Header(default=None)):
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

    # If the user is asking for visual output, actually generate a real image
    # instead of letting the chat model hallucinate having "attached" one —
    # plain chat completions have no file I/O of their own.
    image_id: str | None = None
    image_url_override: str | None = None
    image_note = ""
    from .lumi_image_export import wants_visual_output, has_image_credentials, generate_lumi_image  # noqa: PLC0415
    from .lumi_creative_tools import wants_vector_output, generate_vector_svg, save_output  # noqa: PLC0415
    if wants_vector_output(payload.message):
        png, _svg, vector_error = generate_vector_svg(payload.message)
        if png is not None:
            image_url_override = f"/api/lumi/tools/export/{save_output(png, 'png')}.png"
        else:
            image_note = f"\n\n[Vector generation attempted but failed: {vector_error[:200]}]"
    elif wants_visual_output(payload.message):
        if has_image_credentials():
            image_id, image_fail_reason = generate_lumi_image(payload.message)
            if image_id is None:
                image_note = f"\n\n[Image generation attempted but failed: {image_fail_reason[:200]}]"
        else:
            image_note = "\n\n[No image-generation API key configured — add one in Settings to enable real image output.]"

    # Owner mode: verified via SSO against the trezzhaus.com account system
    # (trezzhaus_auth.py). Never grants LUMI any new execution ability — it
    # only changes what she's allowed to say: for the verified owner, she may
    # propose concrete infrastructure/capability changes (e.g. a Dockerfile
    # diff) as a plan for a human to review and ship, instead of refusing or
    # pretending she can do it herself.
    owner_note = ""
    from .trezzhaus_auth import read_bearer_token, get_session, is_owner  # noqa: PLC0415
    owner_mode = is_owner(get_session(read_bearer_token(authorization)))
    if owner_mode:
        owner_note = (
            "\n\n[SYSTEM: The speaker is verified, via TrezzHaus account SSO, as the "
            "owner of this app. If they ask you to add a new capability or tool, you "
            "may propose a concrete, specific plan (e.g. exact Dockerfile lines, exact "
            "code) for a human engineer to review and apply — you cannot execute, "
            "install, or deploy anything yourself, so always frame it as a plan to "
            "hand off, never as something you've already done.]"
        )

    result = router.lumi_chat(
        payload.message + image_note + owner_note,
        history=history,
        use_ollama=payload.useOllama,
        ollama_model=payload.ollamaModel,
        domain=payload.domain,
        owner_mode=owner_mode,
    )

    content = result.content if result.ok else result.content or f"LUMI is unavailable: {result.error}"
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
        "imageUrl": image_url_override or (f"/api/lumi/export/{image_id}" if image_id else None),
    }


@app.get("/api/lumi/export/{image_id}")
def lumi_export_image(image_id: str):
    """Download an image LUMI generated during a chat conversation."""
    from .lumi_image_export import get_image_path  # noqa: PLC0415
    path = get_image_path(image_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Image not found or expired.")
    return FileResponse(path=str(path), media_type="image/png", filename=f"lumi-{image_id}.png")


# ---------------------------------------------------------------------------
# LUMI Creative Tools — Inkscape (vector), GIMP (raster filters), FreeCAD (CAD)
# ---------------------------------------------------------------------------

@app.get("/api/lumi/tools/status")
def lumi_tools_status():
    """Which creative tools actually work in this environment right now."""
    from .lumi_creative_tools import check_tools  # noqa: PLC0415
    return check_tools()


class LumiVectorRequest(BaseModel):
    prompt: str
    width: int = 512
    height: int = 512


@app.post("/api/lumi/tools/vector")
def lumi_tools_vector(payload: LumiVectorRequest):
    """LUMI authors SVG markup for the prompt; Inkscape validates/renders it (self-healing on parse errors)."""
    from .lumi_creative_tools import generate_vector_svg, save_output  # noqa: PLC0415

    png, svg_text, error = generate_vector_svg(payload.prompt, payload.width, payload.height)
    if png is None:
        raise HTTPException(status_code=502, detail=error or "Vector generation failed.")
    job_id = save_output(png, "png")
    return {"imageUrl": f"/api/lumi/tools/export/{job_id}.png", "svg": svg_text}


class LumiImageFilterRequest(BaseModel):
    imageId: str
    operation: str
    width: int | None = None
    height: int | None = None
    amount: int | None = None


@app.post("/api/lumi/tools/image-filter")
def lumi_tools_image_filter(payload: LumiImageFilterRequest):
    """Apply a whitelisted GIMP filter to a previously-generated LUMI image."""
    from .lumi_image_export import get_image_path  # noqa: PLC0415
    from .lumi_creative_tools import apply_image_filter, save_output, CreativeToolError  # noqa: PLC0415

    src_path = get_image_path(payload.imageId)
    if src_path is None:
        raise HTTPException(status_code=404, detail="Source image not found or expired.")
    params = {k: v for k, v in {"width": payload.width, "height": payload.height, "amount": payload.amount}.items() if v is not None}
    try:
        result = apply_image_filter(src_path.read_bytes(), payload.operation, **params)
    except CreativeToolError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    job_id = save_output(result, "png")
    return {"imageUrl": f"/api/lumi/tools/export/{job_id}.png"}


class LumiCadRequest(BaseModel):
    shape: str
    length: float | None = None
    width: float | None = None
    height: float | None = None
    radius: float | None = None
    radius1: float | None = None
    radius2: float | None = None


@app.post("/api/lumi/tools/cad")
def lumi_tools_cad(payload: LumiCadRequest):
    """Generate a parametric primitive (box/cylinder/sphere/cone) as an STL file via FreeCAD."""
    from .lumi_creative_tools import generate_cad_primitive, save_output, CreativeToolError  # noqa: PLC0415

    dims = {k: v for k, v in payload.model_dump().items() if k != "shape" and v is not None}
    try:
        result = generate_cad_primitive(payload.shape, **dims)
    except CreativeToolError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    job_id = save_output(result, "stl")
    return {"modelUrl": f"/api/lumi/tools/export/{job_id}.stl"}


@app.get("/api/lumi/tools/export/{filename}")
def lumi_tools_export(filename: str):
    """Download a creative-tool output (PNG or STL) by its generated job id."""
    from .lumi_creative_tools import get_output_path  # noqa: PLC0415

    job_id, _, ext = filename.rpartition(".")
    if not job_id or ext not in ("png", "stl"):
        raise HTTPException(status_code=400, detail="Invalid export filename.")
    path = get_output_path(job_id, ext)
    if path is None:
        raise HTTPException(status_code=404, detail="Export not found or expired.")
    media_type = "image/png" if ext == "png" else "model/stl"
    return FileResponse(path=str(path), media_type=media_type, filename=f"lumi-{filename}")


@app.get("/api/lumi/chat/history")
def lumi_chat_history(mission_id: str | None = None, limit: int = 40):
    """Retrieve LUMI chat history."""
    from .mission_store import MissionStore  # noqa: PLC0415
    store = MissionStore()
    return {"history": store.get_chat_history(mission_id, limit=limit)}


# ---------------------------------------------------------------------------
# User-provided AI provider key management
# Users can connect their own OpenRouter/OpenAI/Anthropic/Google accounts
# so LUMI never goes fully offline when free-tier limits are hit.
# ---------------------------------------------------------------------------

class UserKeyRequest(BaseModel):
    provider: str
    api_key: str
    label: str = ""


@app.post("/api/lumi/user-key")
def lumi_add_user_key(payload: UserKeyRequest):
    """
    Register a user-provided AI provider API key.
    Supported providers: openrouter, openai, anthropic, google.
    The key is stored locally in the missions SQLite database.
    """
    from .user_key_store import get_user_key_store, PROVIDER_CATALOGUE  # noqa: PLC0415
    if payload.provider not in PROVIDER_CATALOGUE:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported provider '{payload.provider}'. Supported: {list(PROVIDER_CATALOGUE)}",
        )
    if not payload.api_key.strip():
        raise HTTPException(status_code=400, detail="api_key must not be empty.")
    store = get_user_key_store()
    store.save_key(payload.provider, payload.api_key, label=payload.label)
    info = PROVIDER_CATALOGUE[payload.provider]
    return {
        "ok": True,
        "provider": payload.provider,
        "name": info["name"],
        "message": f"{info['name']} key saved. LUMI will use it when the main cascade is exhausted.",
    }


@app.get("/api/lumi/user-keys")
def lumi_list_user_keys():
    """
    List configured user-provided provider keys (keys are masked for security).
    Also returns the full provider catalogue with instructions for unconfigured providers.
    """
    from .user_key_store import get_user_key_store, PROVIDER_CATALOGUE  # noqa: PLC0415
    store = get_user_key_store()
    configured = {p["provider"]: p for p in store.list_providers()}
    providers = []
    for pid, info in sorted(PROVIDER_CATALOGUE.items(), key=lambda x: x[1]["priority"]):
        entry = {
            "provider": pid,
            "name": info["name"],
            "description": info["description"],
            "cost": info["cost"],
            "get_key_url": info["get_key_url"],
            "recommended": info.get("recommended", False),
            "configured": pid in configured,
        }
        if pid in configured:
            entry["key_preview"] = configured[pid]["key_preview"]
            entry["added_at"] = configured[pid]["added_at"]
        providers.append(entry)
    return {"providers": providers, "configured_count": len(configured)}


@app.delete("/api/lumi/user-key/{provider}")
def lumi_delete_user_key(provider: str):
    """Remove a user-provided API key for the specified provider."""
    from .user_key_store import get_user_key_store  # noqa: PLC0415
    store = get_user_key_store()
    removed = store.delete_key(provider)
    if not removed:
        raise HTTPException(status_code=404, detail=f"No key found for provider '{provider}'.")
    return {"ok": True, "provider": provider, "message": f"{provider} key removed."}


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
    narrate: bool = True
    narratorVoice: str = "en-US-female"
    includeMusic: bool = True


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
        narrate=payload.narrate,
        narrator_voice=payload.narratorVoice,
        include_music=payload.includeMusic,
    )
    return job.to_dict()


@app.get("/api/video/voices")
def video_voices():
    """List available narration voices (male/female, English accents + foreign languages)."""
    from .narration_engine import get_narrator_voices  # noqa: PLC0415
    return {"voices": get_narrator_voices()}


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
# REWORK-iT — lightweight, server-driven edits on an already-rendered video
# ---------------------------------------------------------------------------

class VideoRerenderRequest(BaseModel):
    storyboard: dict | None = None
    narrate: bool | None = None
    narratorVoice: str | None = None
    includeMusic: bool | None = None


@app.post("/api/video/{job_id}/rerender")
def video_rerender(job_id: str, payload: VideoRerenderRequest):
    """
    Re-render a video from an edited storyboard (reordered scenes, edited narration/visual
    text, swapped voice or music) without paying for a new AI storyboard call. Omit
    `storyboard` to just change narration/music settings and re-render the same scenes.
    """
    from .video_creator import create_rerender_job  # noqa: PLC0415
    job = create_rerender_job(
        source_job_id=job_id,
        storyboard_override=payload.storyboard,
        narrate=payload.narrate,
        narrator_voice=payload.narratorVoice,
        include_music=payload.includeMusic,
    )
    if job is None:
        raise HTTPException(status_code=404, detail=f"Video job '{job_id}' not found.")
    return job.to_dict()


class VideoLumiEditRequest(BaseModel):
    instruction: str


@app.post("/api/video/{job_id}/lumi-edit")
def video_lumi_edit(job_id: str, payload: VideoLumiEditRequest):
    """
    Apply a natural-language edit instruction to a video's storyboard via LUMI (e.g.
    "make scene 3 happen at night" or "swap the order of the first two scenes"), then
    re-render. This is REWORK-iT's AI-assisted edit mode, as opposed to manually
    reordering/editing scenes and calling /rerender directly.
    """
    from .video_creator import get_video_job, lumi_edit_storyboard, create_rerender_job  # noqa: PLC0415

    source = get_video_job(job_id)
    if source is None:
        raise HTTPException(status_code=404, detail=f"Video job '{job_id}' not found.")
    if not payload.instruction.strip():
        raise HTTPException(status_code=400, detail="instruction must not be empty.")

    edited = lumi_edit_storyboard(source.storyboard, payload.instruction)
    if edited is None:
        raise HTTPException(status_code=502, detail="LUMI could not apply that edit — try rephrasing, or use manual edit instead.")

    job = create_rerender_job(source_job_id=job_id, storyboard_override=edited)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Video job '{job_id}' not found.")
    return job.to_dict()


class VideoTrimRequest(BaseModel):
    startSeconds: float
    endSeconds: float


@app.post("/api/video/{job_id}/trim")
def video_trim(job_id: str, payload: VideoTrimRequest):
    """Trim a completed video to [startSeconds, endSeconds] via a fast stream-copy cut."""
    from .video_creator import create_trim_job  # noqa: PLC0415
    if payload.endSeconds <= payload.startSeconds:
        raise HTTPException(status_code=400, detail="endSeconds must be greater than startSeconds.")
    job = create_trim_job(job_id, payload.startSeconds, payload.endSeconds)
    if job is None:
        raise HTTPException(status_code=404, detail="Source video not ready, not found, or FFmpeg unavailable.")
    return job.to_dict()


class VideoExportRequest(BaseModel):
    resolution: str = "1080p"


@app.post("/api/video/{job_id}/export")
def video_export(job_id: str, payload: VideoExportRequest):
    """Re-encode a completed video to a different resolution (e.g. upscale 720p -> 4k)."""
    from .video_creator import create_export_job  # noqa: PLC0415
    job = create_export_job(job_id, payload.resolution)
    if job is None:
        raise HTTPException(status_code=404, detail="Source video not ready, not found, or FFmpeg unavailable.")
    return job.to_dict()


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
    """Start a music creation job and return the job metadata."""
    from .music_creator import create_music_job  # noqa: PLC0415
    job = create_music_job(
        concept=payload.concept,
        genre=payload.genre,
        bpm=payload.bpm,
        mood=payload.mood,
        duration_seconds=payload.durationSeconds,
    )
    return job.to_dict()


@app.get("/api/music/{job_id}/status")
def music_status(job_id: str):
    """Poll the status of a music creation job."""
    from .music_creator import get_music_job  # noqa: PLC0415
    job = get_music_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Music job '{job_id}' not found.")
    return job.to_dict()


@app.get("/api/music/{job_id}/download")
def music_download(job_id: str):
    """Download the finished WAV for a completed music job."""
    from .music_creator import get_music_output_path  # noqa: PLC0415
    path = get_music_output_path(job_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Music not ready or job not found.")
    filename = path.name
    return FileResponse(path=str(path), media_type="audio/wav", filename=filename)


@app.get("/api/music/jobs")
def music_jobs():
    """List all music creation jobs."""
    from .music_creator import list_music_jobs  # noqa: PLC0415
    return {"jobs": list_music_jobs()}


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
# Roblox Game Suite — LUMI-driven game creation with Luau scripts + ZIP export
# ---------------------------------------------------------------------------

@app.get("/api/roblox/lookup-universe")
def roblox_lookup_universe(placeId: str):
    """
    Best-effort convenience lookup: derive a universe ID from a place ID (or a
    pasted Roblox game URL) via a legacy public endpoint. Not official Open
    Cloud — there's no sanctioned API to fully auto-discover a signed-in
    user's experiences (it would require Roblox's website session cookie,
    which this app will never request or store). Returns null on failure;
    the frontend falls back to asking for the universe ID manually.
    """
    from .roblox_publisher import extract_place_id, lookup_universe_id  # noqa: PLC0415
    clean_place_id = extract_place_id(placeId)
    universe_id = lookup_universe_id(clean_place_id)
    return {"placeId": clean_place_id, "universeId": universe_id}


class RobloxCreateRequest(BaseModel):
    concept: str
    genre: str = "Adventure"
    maxPlayers: int = 20
    monetization: str = "freemium"
    universeId: str | None = None
    placeId: str | None = None


class RobloxStudioSyncRequest(BaseModel):
    prompt: str | None = None
    files: list[dict[str, Any]] | None = None


@app.get("/api/roblox/game/{job_id}/studio-sync")
def roblox_game_studio_sync(job_id: str):
    """Return the latest synced studio payload for a Roblox game job."""
    from .roblox_creator import get_roblox_job  # noqa: PLC0415
    from .roblox_studio_bridge import get_studio_bridge  # noqa: PLC0415

    job = get_roblox_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Roblox job '{job_id}' not found.")

    bridge = get_studio_bridge()
    return {
        "jobId": job_id,
        "status": job.status,
        "hasSession": bridge.has_session(job_id),
        **bridge.get_status(job_id),
    }


@app.post("/api/roblox/game/{job_id}/studio-sync")
async def roblox_game_studio_sync_update(job_id: str, payload: RobloxStudioSyncRequest):
    """Store a fresh studio sync payload and broadcast it to any connected Studio clients."""
    from .roblox_creator import get_roblox_job  # noqa: PLC0415
    from .roblox_studio_bridge import get_studio_bridge  # noqa: PLC0415

    job = get_roblox_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Roblox job '{job_id}' not found.")

    bridge = get_studio_bridge()
    snapshot = bridge.record_snapshot(job_id, prompt=payload.prompt or job.concept, files=payload.files or [])
    await bridge.publish(job_id, {"type": "SYNC", "source": "http"})
    return {"ok": True, "snapshot": snapshot}


@app.post("/api/roblox/game/{job_id}/studio-push")
async def roblox_game_studio_push(job_id: str, payload: RobloxStudioSyncRequest):
    """Push the latest script payload to connected Studio clients."""
    from .roblox_creator import get_roblox_job  # noqa: PLC0415
    from .roblox_studio_bridge import get_studio_bridge  # noqa: PLC0415

    job = get_roblox_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Roblox job '{job_id}' not found.")

    bridge = get_studio_bridge()
    snapshot = bridge.record_snapshot(job_id, prompt=payload.prompt or job.concept, files=payload.files or [])
    await bridge.publish(job_id, {"type": "INJECT", "files": snapshot["files"]})
    return {"ok": True, "snapshot": snapshot}


@app.websocket("/ws/roblox/studio")
async def roblox_studio_socket(websocket: WebSocket):
    """WebSocket bridge for Studio clients to receive generated Roblox payloads."""
    from .roblox_studio_bridge import get_studio_bridge  # noqa: PLC0415

    await websocket.accept()
    bridge = get_studio_bridge()
    job_id = "default"

    try:
        message = await websocket.receive_json()
        if message.get("type") != "HELLO":
            await websocket.send_json({"type": "ERROR", "message": "Expected HELLO."})
            return

        job_id = str(message.get("jobId") or "default")
        bridge.register_session(job_id, websocket)
        await websocket.send_json({"type": "WELCOME", "jobId": job_id})

        while True:
            payload = await websocket.receive_json()
            message_type = payload.get("type")
            if message_type == "LOG":
                print(f"[RobloxStudio] [{payload.get('level', 'info')}] {payload.get('body', '')}")
            elif message_type == "DISCONNECT":
                break
    except Exception:
        pass
    finally:
        bridge.unregister_session(job_id, websocket)


@app.post("/api/roblox/game/create")
def roblox_game_create(payload: RobloxCreateRequest):
    """
    Start an AI-driven Roblox game creation job.
    LUMI generates a full game design document + Luau scripts + Rojo project ZIP.
    universeId/placeId identify an EXISTING Roblox experience to publish into later —
    Roblox has no API to create a brand-new experience from scratch, so the user must
    create an empty Experience via Roblox Studio or the Creator Dashboard first.
    Poll /api/roblox/game/{job_id}/status for progress.
    """
    from .roblox_creator import create_roblox_job  # noqa: PLC0415
    job = create_roblox_job(
        concept=payload.concept,
        genre=payload.genre,
        max_players=payload.maxPlayers,
        monetization=payload.monetization,
        universe_id=payload.universeId,
        place_id=payload.placeId,
    )
    return job.to_dict()


@app.get("/api/roblox/game/{job_id}/status")
def roblox_game_status(job_id: str):
    """Poll the status of a Roblox game creation job."""
    from .roblox_creator import get_roblox_job  # noqa: PLC0415
    job = get_roblox_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Roblox job '{job_id}' not found.")
    return job.to_dict()


@app.get("/api/roblox/game/{job_id}/download")
def roblox_game_download(job_id: str):
    """Download the Rojo-compatible ZIP package for a completed Roblox game job."""
    from .roblox_creator import get_roblox_output_path  # noqa: PLC0415
    path = get_roblox_output_path(job_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Game package not ready or job not found.")
    return FileResponse(path=str(path), media_type="application/zip", filename=path.name)


@app.get("/api/roblox/game/{job_id}/scripts")
def roblox_game_scripts(job_id: str):
    """Return the generated Luau scripts for a completed Roblox game job."""
    from .roblox_creator import get_roblox_job  # noqa: PLC0415
    job = get_roblox_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Roblox job '{job_id}' not found.")
    if job.status not in ("packaging", "done"):
        raise HTTPException(status_code=409, detail=f"Scripts not ready yet. Status: {job.status}")
    return {"jobId": job_id, "scripts": job.scripts}


@app.get("/api/roblox/game/{job_id}/design")
def roblox_game_design(job_id: str):
    """Return the full game design document for a Roblox game job."""
    from .roblox_creator import get_roblox_job  # noqa: PLC0415
    job = get_roblox_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Roblox job '{job_id}' not found.")
    return {"jobId": job_id, "designDoc": job.design_doc}


@app.get("/api/roblox/games")
def roblox_games_list():
    """List all Roblox game creation jobs."""
    from .roblox_creator import list_roblox_jobs  # noqa: PLC0415
    return {"jobs": list_roblox_jobs()}


def _resolve_roblox_auth(
    explicit_api_key: str | None,
    universe_id_override: str | None,
    place_id_override: str | None,
    job_universe_id: str | None,
    job_place_id: str | None,
    prefer_oauth: bool = True,
) -> tuple[dict, str, str]:
    """Resolve (auth_kwargs, universe_id, place_id) for an Open Cloud call — prefers a
    signed-in Roblox OAuth session over a static admin API key when both are available.

    Set prefer_oauth=False for place publishing: Roblox Open Cloud does not accept OAuth
    tokens for publishing places (staff-confirmed, devforum.com/t/3615911), only API keys."""
    import os  # noqa: PLC0415
    from .roblox_oauth import get_valid_access_token  # noqa: PLC0415
    from .roblox_publisher import RobloxPublishError  # noqa: PLC0415

    universe_id = universe_id_override or job_universe_id or os.environ.get("ROBLOX_UNIVERSE_ID")
    place_id = place_id_override or job_place_id or os.environ.get("ROBLOX_PLACE_ID")
    if not universe_id or not place_id:
        raise RobloxPublishError(
            "No universeId/placeId — set them when creating the game, or provide them now."
        )

    bearer_token = get_valid_access_token() if prefer_oauth else None
    api_key = explicit_api_key or os.environ.get("ROBLOX_API_KEY")
    if not bearer_token and not api_key:
        raise RobloxPublishError(
            "No Roblox credentials — configure ROBLOX_API_KEY."
            if not prefer_oauth
            else "No Roblox credentials — sign in with Roblox, or configure ROBLOX_API_KEY."
        )
    auth_kwargs = {"bearer_token": bearer_token} if bearer_token else {"api_key": api_key}
    return auth_kwargs, str(universe_id), str(place_id)


class RobloxPublishRequest(BaseModel):
    apiKey: str | None = None
    universeId: str | None = None
    placeId: str | None = None


@app.post("/api/roblox/game/{job_id}/publish")
def roblox_game_publish(job_id: str, payload: RobloxPublishRequest):
    """
    Publish a completed Roblox game job's generated scripts to a live Roblox
    experience via the Roblox Open Cloud API.

    Always uses ROBLOX_API_KEY (or the explicit apiKey in the request) — Roblox
    Open Cloud does not accept OAuth tokens for publishing places, only API
    keys, regardless of whether a Roblox OAuth session is signed in. Uses the
    universeId/placeId stored on the job (set at creation time) unless
    overridden in the request body.
    """
    from .roblox_creator import get_roblox_job  # noqa: PLC0415
    from .roblox_publisher import RobloxPublishError, build_place_xml, publish_place  # noqa: PLC0415

    job = get_roblox_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Roblox job '{job_id}' not found.")
    if job.status != "done" or not job.scripts:
        raise HTTPException(status_code=409, detail=f"Game scripts not ready yet. Status: {job.status}")

    try:
        auth_kwargs, universe_id, place_id = _resolve_roblox_auth(
            payload.apiKey, payload.universeId, payload.placeId, job.universe_id, job.place_id,
            prefer_oauth=False,
        )
    except RobloxPublishError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    title = job.design_doc.get("title", job.concept[:60])
    place_xml = build_place_xml(title, job.scripts)

    try:
        result = publish_place(place_xml, universe_id, place_id, **auth_kwargs)
    except RobloxPublishError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "jobId": job_id,
        "universeId": universe_id,
        "placeId": place_id,
        "versionNumber": result.get("versionNumber"),
        "published": True,
    }


# ---------------------------------------------------------------------------
# Roblox OAuth2 — "Sign in with Roblox"
# ---------------------------------------------------------------------------

@app.get("/api/roblox/oauth/login")
def roblox_oauth_login():
    """Redirect to Roblox's authorization page to sign in with a Roblox account."""
    from fastapi.responses import RedirectResponse  # noqa: PLC0415
    from .roblox_oauth import RobloxOAuthError, build_authorize_url  # noqa: PLC0415
    try:
        url = build_authorize_url()
    except RobloxOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RedirectResponse(url)


@app.get("/api/roblox/oauth/callback")
def roblox_oauth_callback(code: str = "", state: str = "", error: str = ""):
    """Roblox redirects here after the user approves/denies the sign-in request."""
    from fastapi.responses import RedirectResponse  # noqa: PLC0415
    from .roblox_oauth import RobloxOAuthError, handle_callback  # noqa: PLC0415

    if error:
        return RedirectResponse(f"/?tab=roblox&robloxAuth=error&reason={error}")
    try:
        handle_callback(code, state)
    except RobloxOAuthError as exc:
        return RedirectResponse(f"/?tab=roblox&robloxAuth=error&reason={exc}")
    return RedirectResponse("/?tab=roblox&robloxAuth=success")


@app.get("/api/roblox/oauth/status")
def roblox_oauth_status():
    """Whether a Roblox account is currently connected via OAuth, and basic identity."""
    from .roblox_oauth import get_status  # noqa: PLC0415
    return get_status()


@app.post("/api/roblox/oauth/logout")
def roblox_oauth_logout():
    """Disconnect the signed-in Roblox account."""
    from .roblox_oauth import clear_tokens  # noqa: PLC0415
    clear_tokens()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Roblox Monetization — Game Passes & Developer Products (beta Open Cloud APIs)
# ---------------------------------------------------------------------------

class RobloxMonetizationRequest(BaseModel):
    name: str
    price: int
    description: str = ""
    apiKey: str | None = None
    universeId: str | None = None
    placeId: str | None = None


class RobloxAutoMonetizationRequest(BaseModel):
    cohort: str = "control"
    apiKey: str | None = None
    universeId: str | None = None
    placeId: str | None = None


class RobloxAnalyticsEventRequest(BaseModel):
    userId: int | None = None
    event: str
    payload: dict[str, Any] | None = None
    ts: int | None = None


@app.post("/api/roblox/game/{job_id}/monetization/game-pass")
def roblox_create_game_pass(job_id: str, payload: RobloxMonetizationRequest):
    """Create a Game Pass at a given Robux price point for this game's universe."""
    from .roblox_creator import get_roblox_job  # noqa: PLC0415
    from .roblox_publisher import RobloxPublishError, create_game_pass  # noqa: PLC0415

    job = get_roblox_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Roblox job '{job_id}' not found.")
    try:
        auth_kwargs, universe_id, _ = _resolve_roblox_auth(
            payload.apiKey, payload.universeId, payload.placeId, job.universe_id, job.place_id
        )
        result = create_game_pass(universe_id, payload.name, payload.price, payload.description, **auth_kwargs)
    except RobloxPublishError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return result


@app.post("/api/roblox/game/{job_id}/monetization/developer-product")
def roblox_create_developer_product(job_id: str, payload: RobloxMonetizationRequest):
    """Create a Developer Product at a given Robux price point for this game's universe."""
    from .roblox_creator import get_roblox_job  # noqa: PLC0415
    from .roblox_publisher import RobloxPublishError, create_developer_product  # noqa: PLC0415

    job = get_roblox_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Roblox job '{job_id}' not found.")
    try:
        auth_kwargs, universe_id, _ = _resolve_roblox_auth(
            payload.apiKey, payload.universeId, payload.placeId, job.universe_id, job.place_id
        )
        result = create_developer_product(universe_id, payload.name, payload.price, payload.description, **auth_kwargs)
    except RobloxPublishError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return result


@app.get("/api/roblox/game/{job_id}/monetization")
def roblox_list_monetization(job_id: str):
    """List existing Game Passes and Developer Products for this game's universe."""
    from .roblox_creator import get_roblox_job  # noqa: PLC0415
    from .roblox_publisher import RobloxPublishError, list_game_passes, list_developer_products  # noqa: PLC0415

    job = get_roblox_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Roblox job '{job_id}' not found.")
    try:
        auth_kwargs, universe_id, _ = _resolve_roblox_auth(None, None, None, job.universe_id, job.place_id)
        passes = list_game_passes(universe_id, **auth_kwargs)
        products = list_developer_products(universe_id, **auth_kwargs)
    except RobloxPublishError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"gamePasses": passes, "developerProducts": products}


@app.get("/api/roblox/game/{job_id}/monetization/plan")
def roblox_monetization_plan(job_id: str, cohort: str = "control"):
    """Return a genre-aware monetization plan for this Roblox job."""
    from .roblox_creator import get_roblox_job  # noqa: PLC0415
    from .roblox_monetization import build_monetization_plan  # noqa: PLC0415

    job = get_roblox_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Roblox job '{job_id}' not found.")
    return build_monetization_plan(job, cohort=cohort)


@app.post("/api/roblox/game/{job_id}/monetization/auto")
def roblox_auto_monetization(job_id: str, payload: RobloxAutoMonetizationRequest):
    """Create a monetization bundle (developer products and game passes) for a Roblox job."""
    from .roblox_creator import get_roblox_job  # noqa: PLC0415
    from .roblox_monetization import create_monetization_assets  # noqa: PLC0415

    job = get_roblox_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Roblox job '{job_id}' not found.")
    return create_monetization_assets(
        job,
        api_key=payload.apiKey,
        universe_id=payload.universeId,
        place_id=payload.placeId,
        cohort=payload.cohort,
    )


@app.post("/api/roblox/analytics")
def roblox_analytics(payload: RobloxAnalyticsEventRequest):
    """Receive analytics events shipped from generated Roblox games."""
    return {"ok": True, "event": payload.event}


@app.post("/api/debug/video-test")
def debug_video_test():
    """Run a minimal FFmpeg encode test on Railway."""
    import subprocess, tempfile, shutil
    from pathlib import Path

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return {"error": "ffmpeg not found"}

    # Create a test frame using pure Python (no Pillow needed)
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        # Write a minimal valid PNG (1x1 red pixel) as test frame
        import struct, zlib
        def make_png(w, h, r, g, b):
            def chunk(name, data):
                c = zlib.crc32(name + data) & 0xffffffff
                return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)
            raw = b'\x00' + bytes([r, g, b]) * w
            idat = zlib.compress(raw * h)
            return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))

        # Write 10 identical frames
        for i in range(10):
            (tmp / f"frame_{i:06d}.png").write_bytes(make_png(320, 240, 255, 0, 0))

        out = tmp / "test.mp4"
        cmd = [ffmpeg, "-y", "-framerate", "10", "-i", str(tmp / "frame_%06d.png"),
               "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)]
        result = subprocess.run(cmd, capture_output=True, timeout=30)

        return {
            "ffmpeg": ffmpeg,
            "returncode": result.returncode,
            "stdout": result.stdout.decode()[-500:],
            "stderr": result.stderr.decode()[-500:],
            "output_size": out.stat().st_size if out.exists() else 0
        }


@app.post("/api/debug/image-test")
def debug_image_test():
    """
    Directly test whichever image-generation API key is configured (Hugging Face, fal.ai,
    or OpenAI) by generating one real scene image. Use this to see the EXACT failure reason
    (bad key, model unavailable, rate limited, etc.) without running a full video job.
    """
    import os
    import tempfile
    from pathlib import Path
    from .video_generator_patch import generate_scene_image_ai, _get_hf_token, _get_fal_key
    from .user_key_store import get_user_key_store

    openai_key = os.environ.get("OPENAI_API_KEY") or get_user_key_store().get_key("openai")
    configured = {
        "huggingface": _get_hf_token() is not None,
        "fal": _get_fal_key() is not None,
        "openai": openai_key is not None,
    }
    if not any(configured.values()):
        return {"ok": False, "configured": configured, "reason": "No image generation API key configured at all."}

    test_scene = {
        "title": "Debug Test Scene",
        "visual_description": "a red apple sitting on a wooden table, soft window light",
        "camera_motion": "static shot",
        "color_grade": "warm golden",
    }
    with tempfile.TemporaryDirectory() as tmpdir:
        target = Path(tmpdir) / "test.png"
        ok, reason = generate_scene_image_ai(test_scene, "Debug Test", "cinematic", (1024, 1024), target)
        image_size = target.stat().st_size if ok and target.exists() else 0

    return {
        "ok": ok,
        "configured": configured,
        "reason": reason,
        "imageBytes": image_size,
    }


@app.get("/api/debug/roblox-test")
def debug_roblox_test(universeId: str | None = None):
    """
    Read-only connectivity check for the Roblox Open Cloud API key — lists
    Game Passes for a universe (never publishes or creates anything). Use
    this to confirm ROBLOX_API_KEY actually authenticates before trying a
    real publish/monetization action.

    Pass ?universeId=... to test a specific universe, or set
    ROBLOX_UNIVERSE_ID as an environment variable to test the default one.
    """
    import os
    from .roblox_oauth import get_valid_access_token
    from .roblox_publisher import RobloxPublishError, list_game_passes

    api_key = os.environ.get("ROBLOX_API_KEY")
    bearer_token = get_valid_access_token()
    resolved_universe_id = universeId or os.environ.get("ROBLOX_UNIVERSE_ID")

    configured = {"apiKey": api_key is not None, "oauthSignedIn": bearer_token is not None}
    if not api_key and not bearer_token:
        return {"ok": False, "configured": configured, "reason": "No Roblox credentials configured (ROBLOX_API_KEY not set, not signed in via OAuth)."}
    if not resolved_universe_id:
        return {"ok": False, "configured": configured, "reason": "No universeId provided and ROBLOX_UNIVERSE_ID is not set."}

    auth_kwargs = {"bearer_token": bearer_token} if bearer_token else {"api_key": api_key}
    try:
        result = list_game_passes(resolved_universe_id, **auth_kwargs)
    except RobloxPublishError as exc:
        return {"ok": False, "configured": configured, "universeId": resolved_universe_id, "reason": str(exc)}

    return {
        "ok": True,
        "configured": configured,
        "universeId": resolved_universe_id,
        "gamePassCount": len(result.get("gamePasses", [])) if isinstance(result, dict) else None,
    }


# ---------------------------------------------------------------------------
# Privacy Policy & Terms of Service — required for Roblox OAuth app review
# ---------------------------------------------------------------------------

from fastapi.responses import HTMLResponse  # noqa: E402

_LEGAL_PAGE_STYLE = """
<style>
  body { background:#020817; color:#e2e8f0; font-family:'Inter','Segoe UI',system-ui,sans-serif;
         max-width:760px; margin:0 auto; padding:40px 24px 80px; line-height:1.6; }
  h1 { font-size:28px; } h2 { font-size:20px; margin-top:36px; color:#38bdf8; }
  a { color:#38bdf8; } small { color:#64748b; }
</style>
"""


@app.get("/privacy", response_class=HTMLResponse)
def privacy_policy():
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Privacy Policy — TrezzHaus Studio</title>{_LEGAL_PAGE_STYLE}</head><body>
<h1>Privacy Policy</h1>
<p><small>Last updated 2026-06-21. This is a baseline policy for the TrezzHaus Studio app
(studio.trezzhaus.com) and its connection to Roblox. It has not been reviewed by an attorney —
review before relying on it for a product handling student/child data at scale.</small></p>

<h2>What we collect</h2>
<p>When you connect your Roblox account via "Sign in with Roblox," we receive only what the
following OAuth scopes provide: your Roblox user ID, username, and display name (openid,
profile), and the ability to act on experiences, Game Passes, and Developer Products you
already own (universe-place, game-pass, developer-product scopes). We do not receive your
Roblox password — sign-in happens entirely on Roblox's own servers.</p>

<h2>How we use it</h2>
<p>This data is used solely to let you publish places and manage monetization for your own
Roblox experiences through this app. We do not sell, rent, or share this data with third
parties, except Roblox itself (as the platform the data originates from).</p>

<h2>Data storage</h2>
<p>OAuth tokens are stored in a private database on our hosting provider (Railway) and are
used only to make authenticated calls to Roblox's Open Cloud API on your behalf. You can
disconnect your account at any time, which deletes the stored tokens.</p>

<h2>Children's privacy</h2>
<p>This app is intended for use by educators and developers, not directly by children. If
this product is extended to be used by K-12 students, additional COPPA-compliant safeguards
(parental consent, data minimization, no behavioral advertising) will be required before
collecting any data from users under 13 — consult legal counsel before that expansion.</p>

<h2>Contact</h2>
<p>Questions about this policy: <a href="mailto:dreambigusa@gmail.com">dreambigusa@gmail.com</a></p>
</body></html>"""


@app.get("/terms", response_class=HTMLResponse)
def terms_of_service():
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Terms of Service — TrezzHaus Studio</title>{_LEGAL_PAGE_STYLE}</head><body>
<h1>Terms of Service</h1>
<p><small>Last updated 2026-06-21. Baseline terms for the TrezzHaus Studio app
(studio.trezzhaus.com). Not reviewed by an attorney — review before relying on it at scale.</small></p>

<h2>Use of this app</h2>
<p>This app is provided to help create and publish content to Roblox, including places,
Game Passes, and Developer Products, using your own Roblox account credentials via OAuth.
You are responsible for complying with Roblox's own Terms of Use and Community Standards
for any content you publish through this app.</p>

<h2>No warranty</h2>
<p>This app is provided "as is," without warranty of any kind. We are not responsible for
any loss of data, lost Roblox account access, or other damages arising from use of this
app, to the maximum extent permitted by law.</p>

<h2>Account connection</h2>
<p>Connecting your Roblox account is optional and can be revoked at any time from within
the app. We act on your Roblox experiences only within the scopes you explicitly grant
during the Roblox OAuth consent flow.</p>

<h2>Changes</h2>
<p>These terms may be updated as the app evolves. Continued use after changes constitutes
acceptance of the updated terms.</p>

<h2>Contact</h2>
<p>Questions about these terms: <a href="mailto:dreambigusa@gmail.com">dreambigusa@gmail.com</a></p>
</body></html>"""


# ---------------------------------------------------------------------------
# Static file serving — serve the built React UI at /
# Must be registered AFTER all API routes so /api/* is not intercepted.
# ---------------------------------------------------------------------------

_RENDERER_DIR = Path(__file__).parent.parent / "dist" / "renderer"
if _RENDERER_DIR.is_dir():
    from fastapi.staticfiles import StaticFiles  # noqa: PLC0415
    app.mount("/", StaticFiles(directory=str(_RENDERER_DIR), html=True), name="ui")