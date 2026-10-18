import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = STATIC_DIR / "data"
CACHE_DIR = BASE_DIR / ".cache"
CACHE_DIR.mkdir(exist_ok=True)

# Server configuration
PORT = int(os.environ.get("CONTRADICTOME_PORT", 5050))
HOST = os.environ.get("CONTRADICTOME_HOST", "127.0.0.1")
DEBUG = os.environ.get("DEBUG", "true").lower() in ("true", "1", "yes")

# API Keys & LLM settings
XAI_API_KEY = os.environ.get("XAI_API_KEY") or os.environ.get("GROK_API_KEY", "")
XAI_BASE_URL = os.environ.get("XAI_BASE_URL", "https://api.x.ai/v1")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

DEFAULT_MODEL = os.environ.get("DEFAULT_MODEL", "grok-2-latest")

# OpenAlex Academic API base
OPENALEX_API_BASE = "https://api.openalex.org"
USER_AGENT = "Contradictome/1.0 (mailto:researcher@contradictome.org)"
