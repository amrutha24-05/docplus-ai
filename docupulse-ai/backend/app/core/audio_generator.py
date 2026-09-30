"""Podcast script generation (Alex and Sam) and optional ElevenLabs synthesis."""

import uuid
from io import BytesIO
from pathlib import Path

import httpx

from app.config import get_settings
from app.core.errors import AudioError
from app.core.llm import generate_structured
from app.core.rag_engine import gather_context
from app.schemas.models import AudioOverviewResponse, PodcastScript, PodcastTurn

SCRIPT_SYSTEM_PROMPT = """You write scripts for a two-host audio overview podcast.

Hosts:
- Alex: the curious host. Asks sharp questions, reacts, and keeps the conversation moving.
- Sam: the knowledgeable host. Explains clearly, with concrete details and short examples.

Rules:
- Base every statement ONLY on the provided sources. Do not add outside facts.
- 14-20 turns total, alternating naturally. Each turn is 1-3 spoken sentences.
- Spoken language only: no stage directions, no markdown, no speaker names inside the text.
- Open with a hook, cover the most important facts, and end with a brief recap."""


def generate_script(source_ids: list[str]) -> PodcastScript:
    context = gather_context(source_ids, max_chars=30_000)
    prompt = f"Write the podcast script from these sources.\n\nSOURCES:\n{context}"
    return generate_structured(prompt, SCRIPT_SYSTEM_PROMPT, PodcastScript, temperature=0.7)


def _synthesize_turn(client: httpx.Client, text: str, voice_id: str) -> bytes:
    settings = get_settings()
    try:
        response = client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={"xi-api-key": settings.elevenlabs_api_key, "Accept": "audio/mpeg"},
            params={"output_format": "mp3_44100_128"},
            json={"text": text, "model_id": settings.elevenlabs_model},
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise AudioError(f"ElevenLabs rejected the request (HTTP {exc.response.status_code}).") from exc
    except httpx.HTTPError as exc:
        raise AudioError(f"Could not reach ElevenLabs: {exc}") from exc
    return response.content


def synthesize_audio(script: PodcastScript, audio_id: str) -> str | None:
    """Render the script to one MP3 and return its URL path, or None when ElevenLabs is not configured."""
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        return None

    voices = {"Alex": settings.elevenlabs_voice_alex, "Sam": settings.elevenlabs_voice_sam}
    buffer = BytesIO()

    with httpx.Client(timeout=90.0) as client:
        for turn in script.turns:
            buffer.write(_synthesize_turn(client, turn.text, voices[turn.speaker]))

    output_dir = Path(settings.audio_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / f"{audio_id}.mp3").write_bytes(buffer.getvalue())
    return f"/static/audio/{audio_id}.mp3"


def create_audio_overview(source_ids: list[str], synthesize: bool = True) -> AudioOverviewResponse:
    script = generate_script(source_ids)
    audio_id = uuid.uuid4().hex
    audio_url = synthesize_audio(script, audio_id) if synthesize else None

    return AudioOverviewResponse(
        id=audio_id,
        title=script.title,
        script=[PodcastTurn(speaker=turn.speaker, text=turn.text) for turn in script.turns],
        audio_url=audio_url,
    )
