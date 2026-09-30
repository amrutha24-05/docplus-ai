"""SQLite source registry + ChromaDB persistent collection."""

import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

import chromadb
from chromadb.api.models.Collection import Collection
from chromadb.config import Settings as ChromaSettings

from app.config import get_settings
from app.core.errors import DocumentError, NotFoundError
from app.schemas.models import SourceDocument

COLLECTION_NAME = "docupulse_chunks"

_collection: Collection | None = None
_collection_lock = threading.Lock()


# --------------------------------------------------------------------------- #
# ChromaDB
# --------------------------------------------------------------------------- #
def get_collection() -> Collection:
    global _collection
    with _collection_lock:
        if _collection is None:
            path = Path(get_settings().chroma_db_path)
            path.mkdir(parents=True, exist_ok=True)
            client = chromadb.PersistentClient(
                path=str(path),
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            _collection = client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
        return _collection


# --------------------------------------------------------------------------- #
# SQLite
# --------------------------------------------------------------------------- #
@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(get_settings().sqlite_path)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db() -> None:
    Path(get_settings().sqlite_path).parent.mkdir(parents=True, exist_ok=True)
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS sources (
                id          TEXT PRIMARY KEY,
                filename    TEXT NOT NULL,
                chunk_count INTEGER NOT NULL,
                char_count  INTEGER NOT NULL,
                created_at  TEXT NOT NULL
            )
            """
        )
    get_collection()  # fail fast if Chroma cannot open its directory


def _row_to_source(row: sqlite3.Row) -> SourceDocument:
    return SourceDocument(
        id=row["id"],
        filename=row["filename"],
        chunk_count=row["chunk_count"],
        char_count=row["char_count"],
        created_at=row["created_at"],
    )


def insert_source(source_id: str, filename: str, chunk_count: int, char_count: int) -> SourceDocument:
    created_at = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute(
            "INSERT INTO sources (id, filename, chunk_count, char_count, created_at) VALUES (?, ?, ?, ?, ?)",
            (source_id, filename, chunk_count, char_count, created_at),
        )
    return SourceDocument(
        id=source_id,
        filename=filename,
        chunk_count=chunk_count,
        char_count=char_count,
        created_at=created_at,
    )


def list_sources() -> list[SourceDocument]:
    with get_db() as db:
        rows = db.execute("SELECT * FROM sources ORDER BY created_at ASC").fetchall()
    return [_row_to_source(row) for row in rows]


def delete_source_row(source_id: str) -> None:
    with get_db() as db:
        cursor = db.execute("DELETE FROM sources WHERE id = ?", (source_id,))
        if cursor.rowcount == 0:
            raise NotFoundError("Source not found.")


def require_sources(source_ids: list[str]) -> list[str]:
    """Return the requested ids that exist, preserving order. Raise if none do."""
    unique_ids = list(dict.fromkeys(source_ids))
    if not unique_ids:
        raise DocumentError("Select at least one source.")

    placeholders = ",".join("?" * len(unique_ids))
    with get_db() as db:
        rows = db.execute(f"SELECT id FROM sources WHERE id IN ({placeholders})", unique_ids).fetchall()

    existing = {row["id"] for row in rows}
    valid = [source_id for source_id in unique_ids if source_id in existing]
    if not valid:
        raise DocumentError("None of the selected sources exist. Re-upload or refresh the page.")
    return valid
