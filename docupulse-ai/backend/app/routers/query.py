"""Grounded chat endpoint."""

from fastapi import APIRouter

from app.core.rag_engine import answer_query
from app.db.database import require_sources
from app.schemas.models import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/query", tags=["query"])


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    source_ids = require_sources(request.active_source_ids)
    return answer_query(request.query.strip(), source_ids)
