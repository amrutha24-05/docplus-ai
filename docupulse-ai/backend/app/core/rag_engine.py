"""Text extraction, chunking, ingestion, retrieval-augmented chat and structured artifacts."""

import io
import os
import re
import uuid

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from app.config import get_settings
from app.core.errors import DocumentError
from app.core.llm import generate_structured, generate_text
from app.db.database import insert_source
from app.db.vector_store import add_chunks, delete_chunks, get_source_chunks, query_chunks
from app.schemas.models import (
    Briefing,
    ChatResponse,
    Citation,
    FaqSet,
    SourceDocument,
    StudyGuide,
)

GROUNDED_SYSTEM_PROMPT = """You are DocuPulse AI, a research assistant strictly grounded in the user's documents.

Rules:
- Answer ONLY using the numbered context excerpts provided. Never use outside knowledge.
- If the excerpts do not contain the answer, say so plainly instead of guessing.
- Cite every factual claim with the number of the excerpt it came from, in square brackets, like [1] or [2][3]. Each excerpt header shows its [Source: filename].
- Never invent a citation number that is not in the context.
- Write in clear markdown. Be concise and well organized."""

ARTIFACT_SYSTEM_PROMPT = (
    "You are DocuPulse AI. Use ONLY the source material provided. Do not add outside facts. "
    "Write clearly and concisely for a reader who has not seen the sources."
)

SNIPPET_LENGTH = 300


# --------------------------------------------------------------------------- #
# Extraction & chunking
# --------------------------------------------------------------------------- #
def extract_text(filename: str, data: bytes) -> str:
    extension = os.path.splitext(filename)[1].lower()

    if extension == ".pdf":
        try:
            reader = PdfReader(io.BytesIO(data))
            pages = [page.extract_text() or "" for page in reader.pages]
        except PyPdfError as exc:
            raise DocumentError(f"Could not read '{filename}' as a PDF: {exc}") from exc
        except Exception as exc:
            raise DocumentError(f"Could not read '{filename}' as a PDF.") from exc
        text = "\n\n".join(pages)
    elif extension in {".txt", ".md"}:
        text = data.decode("utf-8", errors="replace")
    else:
        raise DocumentError("Unsupported file type. Upload a PDF, TXT or MD file.")

    if not text.strip():
        raise DocumentError(
            f"No text could be extracted from '{filename}'. Scanned PDFs need OCR before upload."
        )
    return text


def chunk_text(text: str, size: int = 800, overlap: int = 100) -> list[str]:
    """Split text into ~`size`-character chunks with `overlap` characters shared between neighbours.

    Chunk ends snap to a paragraph, sentence or word boundary when one exists in the last 40% of the window.
    """
    if overlap >= size:
        raise ValueError("overlap must be smaller than size")

    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        return []

    chunks: list[str] = []
    length = len(text)
    start = 0

    while start < length:
        end = min(start + size, length)

        if end < length:
            window = text[start:end]
            for separator in ("\n\n", ". ", "\n", " "):
                index = window.rfind(separator)
                if index >= size * 0.6:
                    end = start + index + len(separator)
                    break

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= length:
            break
        start = max(end - overlap, start + 1)

    return chunks


# --------------------------------------------------------------------------- #
# Ingestion
# --------------------------------------------------------------------------- #
def ingest_document(filename: str, data: bytes) -> SourceDocument:
    settings = get_settings()
    text = extract_text(filename, data)
    chunks = chunk_text(text, settings.chunk_size, settings.chunk_overlap)
    if not chunks:
        raise DocumentError(f"'{filename}' did not contain any usable text.")

    source_id = uuid.uuid4().hex
    try:
        add_chunks(source_id, filename, chunks)
        return insert_source(source_id, filename, len(chunks), len(text))
    except Exception:
        delete_chunks(source_id)  # never leave orphaned vectors behind
        raise


# --------------------------------------------------------------------------- #
# Grounded chat
# --------------------------------------------------------------------------- #
def _normalize_citations(answer: str) -> str:
    """Turn '[1, 2]' into '[1][2]' so the UI can render one badge per number."""

    def expand(match: re.Match[str]) -> str:
        return "".join(f"[{number.strip()}]" for number in match.group(1).split(","))

    return re.sub(r"\[(\d+(?:\s*,\s*\d+)+)\]", expand, answer)


def _snippet(text: str) -> str:
    return text if len(text) <= SNIPPET_LENGTH else text[:SNIPPET_LENGTH].rstrip() + "…"


def answer_query(query: str, source_ids: list[str]) -> ChatResponse:
    settings = get_settings()
    chunks = query_chunks(query, source_ids, settings.top_k)

    if not chunks:
        return ChatResponse(
            answer="I couldn't find any content in the selected sources to answer that.",
            citations=[],
        )

    context = "\n\n".join(
        f"[{number}] [Source: {chunk.filename}]\n{chunk.text}" for number, chunk in enumerate(chunks, start=1)
    )
    prompt = f"CONTEXT EXCERPTS:\n{context}\n\nQUESTION: {query}"
    answer = _normalize_citations(generate_text(prompt, GROUNDED_SYSTEM_PROMPT))

    cited_numbers = sorted(
        {int(n) for n in re.findall(r"\[(\d+)\]", answer) if 1 <= int(n) <= len(chunks)}
    )
    citations = [
        Citation(
            id=number,
            filename=chunks[number - 1].filename,
            snippet=_snippet(chunks[number - 1].text),
            source_id=chunks[number - 1].source_id,
        )
        for number in cited_numbers
    ]
    return ChatResponse(answer=answer, citations=citations)


# --------------------------------------------------------------------------- #
# Whole-source context + structured artifacts
# --------------------------------------------------------------------------- #
def gather_context(source_ids: list[str], max_chars: int = 48_000) -> str:
    """Concatenate chunks of the selected sources, sampling evenly when they exceed `max_chars`."""
    chunks = get_source_chunks(source_ids)
    if not chunks:
        raise DocumentError("The selected sources contain no readable text.")

    total = sum(len(chunk.text) for chunk in chunks)
    if total > max_chars:
        step = -(-total // max_chars)  # ceiling division
        chunks = chunks[::step]

    parts: list[str] = []
    current_source: str | None = None
    for chunk in chunks:
        if chunk.source_id != current_source:
            parts.append(f"\n=== {chunk.filename} ===")
            current_source = chunk.source_id
        parts.append(chunk.text)
    return "\n".join(parts).strip()


def generate_briefing(source_ids: list[str]) -> Briefing:
    context = gather_context(source_ids)
    prompt = (
        "Write a briefing document for the sources below: a short title, an executive summary "
        "(3-5 sentences), 5-8 key points, 3-5 major themes with a one-sentence description each, "
        f"and 3-5 open questions the sources leave unanswered.\n\nSOURCES:\n{context}"
    )
    return generate_structured(prompt, ARTIFACT_SYSTEM_PROMPT, Briefing)


def generate_study_guide(source_ids: list[str]) -> StudyGuide:
    context = gather_context(source_ids)
    prompt = (
        "Write a study guide for the sources below: a short title, a one-paragraph overview, "
        "6-10 key concepts with clear definitions, and 6-8 review questions each with a concise answer."
        f"\n\nSOURCES:\n{context}"
    )
    return generate_structured(prompt, ARTIFACT_SYSTEM_PROMPT, StudyGuide)


def generate_faq(source_ids: list[str]) -> FaqSet:
    context = gather_context(source_ids)
    prompt = (
        "Write an FAQ for the sources below: 8-10 questions a newcomer would plausibly ask, "
        f"each with a direct, accurate answer drawn only from the sources.\n\nSOURCES:\n{context}"
    )
    return generate_structured(prompt, ARTIFACT_SYSTEM_PROMPT, FaqSet)
