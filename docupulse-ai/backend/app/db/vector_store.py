"""Embedding generation and Chroma vector queries."""

from dataclasses import dataclass

from google.genai import types

from app.config import get_settings
from app.core.errors import ConfigError, LLMError
from app.core.llm import get_client
from app.db.database import get_collection

EMBED_BATCH_SIZE = 100


@dataclass(frozen=True)
class RetrievedChunk:
    text: str
    source_id: str
    filename: str
    chunk_id: int
    score: float = 0.0


def embed_texts(texts: list[str], task_type: str) -> list[list[float]]:
    """Embed texts with Gemini. `task_type` is RETRIEVAL_DOCUMENT or RETRIEVAL_QUERY."""
    if not texts:
        return []

    vectors: list[list[float]] = []
    model = get_settings().embedding_model

    for offset in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[offset : offset + EMBED_BATCH_SIZE]
        try:
            response = get_client().models.embed_content(
                model=model,
                contents=batch,
                config=types.EmbedContentConfig(task_type=task_type),
            )
        except ConfigError:
            raise
        except Exception as exc:
            raise LLMError(f"Embedding request failed: {exc}") from exc

        embeddings = response.embeddings or []
        if len(embeddings) != len(batch):
            raise LLMError("Embedding service returned an unexpected number of vectors.")
        vectors.extend(list(item.values) for item in embeddings)

    return vectors


def _source_filter(source_ids: list[str]) -> dict:
    return {"source_id": {"$in": source_ids}}


def add_chunks(source_id: str, filename: str, chunks: list[str]) -> None:
    embeddings = embed_texts(chunks, "RETRIEVAL_DOCUMENT")
    get_collection().add(
        ids=[f"{source_id}:{index}" for index in range(len(chunks))],
        documents=chunks,
        embeddings=embeddings,
        metadatas=[
            {"source_id": source_id, "filename": filename, "chunk_id": index}
            for index in range(len(chunks))
        ],
    )


def query_chunks(query: str, source_ids: list[str], top_k: int) -> list[RetrievedChunk]:
    collection = get_collection()
    where = _source_filter(source_ids)

    available = len(collection.get(where=where, include=[])["ids"])
    if available == 0:
        return []

    query_embedding = embed_texts([query], "RETRIEVAL_QUERY")[0]
    result = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, available),
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    documents = result["documents"][0]
    metadatas = result["metadatas"][0]
    distances = result["distances"][0]

    return [
        RetrievedChunk(
            text=document,
            source_id=str(metadata["source_id"]),
            filename=str(metadata["filename"]),
            chunk_id=int(metadata["chunk_id"]),
            score=1.0 - float(distance),
        )
        for document, metadata, distance in zip(documents, metadatas, distances)
    ]


def get_source_chunks(source_ids: list[str]) -> list[RetrievedChunk]:
    """All chunks for the given sources, ordered by source (as requested) then chunk position."""
    result = get_collection().get(where=_source_filter(source_ids), include=["documents", "metadatas"])
    order = {source_id: position for position, source_id in enumerate(source_ids)}

    chunks = [
        RetrievedChunk(
            text=document,
            source_id=str(metadata["source_id"]),
            filename=str(metadata["filename"]),
            chunk_id=int(metadata["chunk_id"]),
        )
        for document, metadata in zip(result["documents"], result["metadatas"])
    ]
    chunks.sort(key=lambda chunk: (order.get(chunk.source_id, len(order)), chunk.chunk_id))
    return chunks


def delete_chunks(source_id: str) -> None:
    get_collection().delete(where={"source_id": source_id})
