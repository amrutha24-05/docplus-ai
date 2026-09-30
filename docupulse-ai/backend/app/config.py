"""Environment-driven configuration."""

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    chat_model: str
    embedding_model: str
    chroma_db_path: str
    sqlite_path: str
    audio_dir: str
    port: int
    cors_origins: list[str]
    elevenlabs_api_key: str
    elevenlabs_voice_alex: str
    elevenlabs_voice_sam: str
    elevenlabs_model: str
    chunk_size: int = 800
    chunk_overlap: int = 100
    top_k: int = 8
    max_upload_mb: int = 20


@lru_cache
def get_settings() -> Settings:
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        chat_model=os.getenv("CHAT_MODEL", "gemini-2.5-flash"),
        embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-004"),
        chroma_db_path=os.getenv("CHROMA_DB_PATH", "./chroma_db"),
        sqlite_path=os.getenv("SQLITE_PATH", "./data/docupulse.db"),
        audio_dir=os.getenv("AUDIO_DIR", "./audio_cache"),
        port=int(os.getenv("PORT", "8000")),
        cors_origins=_split_csv(os.getenv("CORS_ORIGINS", "http://localhost:3000")),
        elevenlabs_api_key=os.getenv("ELEVENLABS_API_KEY", "").strip(),
        elevenlabs_voice_alex=os.getenv("ELEVENLABS_VOICE_ALEX", "pNInz6obpgDQGcFmaJgB"),
        elevenlabs_voice_sam=os.getenv("ELEVENLABS_VOICE_SAM", "21m00Tcm4TlvDq8ikWAM"),
        elevenlabs_model=os.getenv("ELEVENLABS_MODEL", "eleven_turbo_v2_5"),
    )
