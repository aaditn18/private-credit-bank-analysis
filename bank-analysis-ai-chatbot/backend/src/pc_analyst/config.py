"""Runtime configuration, sourced from environment / .env.

All other modules import ``settings`` from here. Keeping this thin and
dependency-free lets scripts, tests, and the MCP server share state.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PACKAGE_ROOT = Path(__file__).resolve().parent          # .../backend/src/pc_analyst
BACKEND_ROOT = PACKAGE_ROOT.parents[1]                  # .../backend
REPO_ROOT = BACKEND_ROOT.parent                          # workspace root


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[str(REPO_ROOT / ".env")],
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Storage ---------------------------------------------------------------
    storage_backend: str = Field(default="postgres")  # 'postgres' | 'sqlite'
    database_url: str = Field(default="postgresql://pc:pc@localhost:5432/pc_analyst")
    sqlite_path: Path = Field(default=BACKEND_ROOT / "pc_analyst.db")

    def model_post_init(self, __context) -> None:  # type: ignore[override]
        # Anchor any relative sqlite_path to REPO_ROOT so the DB resolves to
        # the same file regardless of cwd. Previously, launching uvicorn from
        # a different directory silently created an empty DB and every
        # request failed with "no such table: …".
        if not self.sqlite_path.is_absolute():
            object.__setattr__(self, "sqlite_path", (REPO_ROOT / self.sqlite_path).resolve())

    # Embeddings / reranker -------------------------------------------------
    embedding_model: str = Field(default="local")
    embedding_dim: int = Field(default=384)
    reranker_model: str = Field(default="BAAI/bge-reranker-base")

    # LLM -------------------------------------------------------------------
    llm_provider: str = Field(default="none")  # 'none' | 'anthropic' | 'gemini'
    anthropic_api_key: str | None = Field(default=None)
    anthropic_model: str = Field(default="claude-sonnet-4-5")
    gemini_api_key: str | None = Field(default=None)
    gemini_model: str = Field(default="gemini-2.5-flash")

    # External feeds --------------------------------------------------------
    ffiec_username: str | None = Field(default=None)
    ffiec_token: str | None = Field(default=None)
    sec_user_agent: str = Field(default="private-credit-analyst example@example.com")
    alphavantage_api_key: str | None = Field(default=None)

    # HTTP ------------------------------------------------------------------
    backend_port: int = Field(default=8000)
    backend_url: str = Field(default="http://localhost:8000")

    @property
    def repo_root(self) -> Path:
        return REPO_ROOT

    @property
    def package_root(self) -> Path:
        return PACKAGE_ROOT


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
