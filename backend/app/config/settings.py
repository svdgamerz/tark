"""Application settings — loaded from backend/.env (CLAUDE.md §6, §12).

Fail-fast: if a required provider key is missing, the app refuses to start and
names exactly what's missing and where to get it. We never mock providers
(CLAUDE.md §1).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config/settings.py  ->  parents[2] == backend/
BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Model providers (required — no mocks) ---
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    nvidia_nim_api_key: str = Field(default="", alias="NVIDIA_NIM_API_KEY")
    # Optional extra providers (for the model switcher / extra fallbacks).
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    mistral_api_key: str = Field(default="", alias="MISTRAL_API_KEY")
    cerebras_api_key: str = Field(default="", alias="CEREBRAS_API_KEY")
    sambanova_api_key: str = Field(default="", alias="SAMBANOVA_API_KEY")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    tavily_api_key: str = Field(default="", alias="TAVILY_API_KEY")
    tavily_api_key_backup: str = Field(default="", alias="TAVILY_API_KEY_BACKUP")

    # Dedicated Prompt Engineering Layer (Isolated Key)
    prompt_engineer_api_key: str = Field(default="", alias="PROMPT_ENGINEER_API_KEY")
    prompt_engineer_model: str = Field(default="openai/gpt-oss-120b", alias="PROMPT_ENGINEER_MODEL")

    @property
    def gemini_api_keys(self) -> list[str]:
        if not self.gemini_api_key:
            return []
        return [k.strip() for k in self.gemini_api_key.replace("\n", ",").split(",") if k.strip()]

    def get_gemini_key(self) -> str:
        """Return a Gemini key from the configured pool with random selection."""
        keys = self.gemini_api_keys
        if not keys:
            return ""
        import random
        return random.choice(keys)

    @property
    def tavily_api_keys(self) -> list[str]:
        return [k.strip() for k in [self.tavily_api_key, self.tavily_api_key_backup] if k.strip()]

    # --- Supabase (optional in Phase 0; sessions degrade to no-op if absent) ---
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_service_key: str = Field(default="", alias="SUPABASE_SERVICE_KEY")

    # --- Auth: Email (Brevo HTTP API or direct Gmail SMTP) + JWT session signing ---
    brevo_api_key: str = Field(default="", alias="BREVO_API_KEY")
    email_from: str = Field(default="", alias="EMAIL_FROM")
    email_from_name: str = Field(default="Tark", alias="EMAIL_FROM_NAME")
    smtp_host: str = Field(default="smtp.gmail.com", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    token_secret: str = Field(default="dev-insecure-change-me", alias="TARK_TOKEN_SECRET")

    # Comma-separated emails that are admins (matched case-insensitively).
    admin_emails: str = Field(default="", alias="ADMIN_EMAILS")

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    # --- Server ---
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173", alias="CORS_ORIGINS"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


# Required keys and where the user gets them (used in the fail-fast message).
REQUIRED_PROVIDER_KEYS: dict[str, str] = {
    "GEMINI_API_KEY": "https://aistudio.google.com/apikey",
    "NVIDIA_NIM_API_KEY": "https://build.nvidia.com",
}


def validate_settings(settings: Settings) -> None:
    """Raise a clear error naming any missing required provider key."""
    missing: list[tuple[str, str]] = []
    if not settings.gemini_api_key:
        missing.append(("GEMINI_API_KEY", REQUIRED_PROVIDER_KEYS["GEMINI_API_KEY"]))
    if not settings.nvidia_nim_api_key:
        missing.append(
            ("NVIDIA_NIM_API_KEY", REQUIRED_PROVIDER_KEYS["NVIDIA_NIM_API_KEY"])
        )
    if missing:
        lines = "\n".join(f"  - {key}   (get it at {url})" for key, url in missing)
        raise RuntimeError(
            "Tark cannot start — missing required key(s) in backend/.env:\n"
            f"{lines}\n\n"
            f"Copy backend/.env.example to backend/.env and fill these in.\n"
            "We do not mock providers (CLAUDE.md §1)."
        )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    validate_settings(settings)
    return settings
