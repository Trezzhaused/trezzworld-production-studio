from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .config import APP_NAME, VERSION
from .meta_builder import build_meta_builder_status, continue_meta_builder
from .meta_development import build_meta_development_status

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
