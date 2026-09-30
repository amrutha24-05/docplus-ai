"""Source management: upload, list, delete."""

import os

from fastapi import APIRouter, File, UploadFile

from app.config import get_settings
from app.core.errors import DocumentError
from app.core.rag_engine import ingest_document
from app.db.database import delete_source_row, list_sources
from app.db.vector_store import delete_chunks
from app.schemas.models import DeleteResponse, SourceDocument

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md"}


@router.post("/upload", response_model=SourceDocument, status_code=201)
def upload_document(file: UploadFile = File(...)) -> SourceDocument:
    filename = os.path.basename(file.filename or "")
    extension = os.path.splitext(filename)[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise DocumentError("Unsupported file type. Upload a PDF, TXT or MD file.")

    limit_mb = get_settings().max_upload_mb
    data = file.file.read(limit_mb * 1024 * 1024 + 1)
    if len(data) > limit_mb * 1024 * 1024:
        raise DocumentError(f"File exceeds the {limit_mb} MB upload limit.")
    if not data:
        raise DocumentError("The uploaded file is empty.")

    return ingest_document(filename, data)


@router.get("/sources", response_model=list[SourceDocument])
def get_sources() -> list[SourceDocument]:
    return list_sources()


@router.delete("/{source_id}", response_model=DeleteResponse)
def delete_document(source_id: str) -> DeleteResponse:
    delete_source_row(source_id)  # raises NotFoundError (404) when missing
    delete_chunks(source_id)
    return DeleteResponse(deleted=source_id)
