from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import APP_NAME, VERSION
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
