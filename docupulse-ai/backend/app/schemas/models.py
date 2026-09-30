"""Pydantic request and response schemas.

Schemas sent to Gemini as `response_schema` (Briefing, StudyGuide, FaqSet, PodcastScript and their
nested models) deliberately have no default values, because Gemini's schema dialect does not support them.
"""

from typing import Literal

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
# Documents
# --------------------------------------------------------------------------- #
class SourceDocument(BaseModel):
    id: str
    filename: str
    chunk_count: int
    char_count: int
    created_at: str


class DeleteResponse(BaseModel):
    deleted: str


# --------------------------------------------------------------------------- #
# Chat
# --------------------------------------------------------------------------- #
class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    active_source_ids: list[str] = Field(min_length=1)


class Citation(BaseModel):
    id: int
    filename: str
    snippet: str
    source_id: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]


# --------------------------------------------------------------------------- #
# Artifacts
# --------------------------------------------------------------------------- #
class ArtifactRequest(BaseModel):
    active_source_ids: list[str] = Field(min_length=1)


class Theme(BaseModel):
    name: str
    description: str


class Briefing(BaseModel):
    title: str
    executive_summary: str
    key_points: list[str]
    themes: list[Theme]
    open_questions: list[str]


class Concept(BaseModel):
    term: str
    definition: str


class ReviewQuestion(BaseModel):
    question: str
    answer: str


class StudyGuide(BaseModel):
    title: str
    overview: str
    key_concepts: list[Concept]
    review_questions: list[ReviewQuestion]


class FaqItem(BaseModel):
    question: str
    answer: str


class FaqSet(BaseModel):
    items: list[FaqItem]


# --------------------------------------------------------------------------- #
# Audio
# --------------------------------------------------------------------------- #
class PodcastTurn(BaseModel):
    speaker: Literal["Alex", "Sam"]
    text: str


class PodcastScript(BaseModel):
    title: str
    turns: list[PodcastTurn]


class AudioRequest(BaseModel):
    active_source_ids: list[str] = Field(min_length=1)
    synthesize: bool = True


class AudioOverviewResponse(BaseModel):
    id: str
    title: str
    script: list[PodcastTurn]
    audio_url: str | None
