"""Thin wrapper around the Google GenAI SDK with consistent error handling."""

from functools import lru_cache
from typing import TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import get_settings
from app.core.errors import ConfigError, LLMError

T = TypeVar("T", bound=BaseModel)


@lru_cache
def get_client() -> genai.Client:
    api_key = get_settings().gemini_api_key
    if not api_key:
        raise ConfigError("GEMINI_API_KEY is not set. Add it to backend/.env and restart the server.")
    return genai.Client(api_key=api_key)


def generate_text(prompt: str, system: str, temperature: float = 0.2) -> str:
    """Plain-text generation."""
    try:
        response = get_client().models.generate_content(
            model=get_settings().chat_model,
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=system, temperature=temperature),
        )
    except ConfigError:
        raise
    except Exception as exc:  # SDK raises several error types
        raise LLMError(f"Gemini request failed: {exc}") from exc

    text = (response.text or "").strip()
    if not text:
        raise LLMError("Gemini returned an empty response. It may have been blocked by safety filters.")
    return text


def generate_structured(prompt: str, system: str, schema: type[T], temperature: float = 0.3) -> T:
    """Generation constrained to a Pydantic schema via JSON output mode."""
    try:
        response = get_client().models.generate_content(
            model=get_settings().chat_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=temperature,
                response_mime_type="application/json",
                response_schema=schema,
            ),
        )
    except ConfigError:
        raise
    except Exception as exc:
        raise LLMError(f"Gemini request failed: {exc}") from exc

    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, schema):
        return parsed

    try:
        return schema.model_validate_json(response.text or "")
    except Exception as exc:
        raise LLMError("Gemini returned malformed structured output. Please try again.") from exc
