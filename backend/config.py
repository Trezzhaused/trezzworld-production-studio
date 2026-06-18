from pathlib import Path
from dotenv import load_dotenv

# Load .env from the repo root, so `os.getenv()` works everywhere in the backend.
# Works whether uvicorn is started from the repo root or from inside backend/.
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=False)

APP_NAME = "TrezzWorld Production Studio"
VERSION = "0.1.0-alpha"
API_HOST = "127.0.0.1"
API_PORT = 8000

