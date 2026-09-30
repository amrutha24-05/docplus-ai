"""Two-host audio overview."""

from fastapi import APIRouter

from app.core.audio_generator import create_audio_overview
from app.db.database import require_sources
from app.schemas.models import AudioOverviewResponse, AudioRequest

router = APIRouter(prefix="/api/audio", tags=["audio"])


@router.post("/generate", response_model=AudioOverviewResponse)
def generate_audio(request: AudioRequest) -> AudioOverviewResponse:
    source_ids = require_sources(request.active_source_ids)
    return create_audio_overview(source_ids, synthesize=request.synthesize)
