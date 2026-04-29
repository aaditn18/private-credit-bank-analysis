"""
Load BUFN403/.env into the process environment (e.g. GEMINI_API_KEY).

Import this module early from any script under BUFN403, or rely on the same
pattern in entrypoints that cannot import from the repo root easily.
"""
from __future__ import annotations

from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent


def load_bufn403_env(*, override: bool = False) -> None:
    """Load ``<repo>/.env`` if python-dotenv is installed and the file exists."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    env_path = _REPO_ROOT / ".env"
    if env_path.is_file():
        load_dotenv(env_path, override=override)


# Convenience: loading on import when this file is executed as a module
load_bufn403_env()
