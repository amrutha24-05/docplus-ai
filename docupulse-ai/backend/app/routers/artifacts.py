"""Structured study artifacts: briefing, study guide, FAQ."""

from fastapi import APIRouter

from app.core.rag_engine import generate_briefing, generate_faq, generate_study_guide
from app.db.database import require_sources
from app.schemas.models import ArtifactRequest, Briefing, FaqSet, StudyGuide

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


@router.post("/overview", response_model=Briefing)
def overview(request: ArtifactRequest) -> Briefing:
    return generate_briefing(require_sources(request.active_source_ids))


@router.post("/study-guide", response_model=StudyGuide)
def study_guide(request: ArtifactRequest) -> StudyGuide:
    return generate_study_guide(require_sources(request.active_source_ids))


@router.post("/faq", response_model=FaqSet)
def faq(request: ArtifactRequest) -> FaqSet:
    return generate_faq(require_sources(request.active_source_ids))
