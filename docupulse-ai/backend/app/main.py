"""FastAPI entry point: app factory, CORS, routers, static audio, error handling."""

from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.core.errors import DocuPulseError
from app.db.database import init_db
from app.routers import artifacts, audio, documents, query

settings = get_settings()

# The static mount needs its directory to exist at import time.
Path(settings.audio_dir).mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="DocuPulse AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DocuPulseError)
async def handle_docupulse_error(_: Request, exc: DocuPulseError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


app.include_router(documents.router)
app.include_router(query.router)
app.include_router(artifacts.router)
app.include_router(audio.router)
app.mount("/static/audio", StaticFiles(directory=settings.audio_dir), name="audio")


@app.get("/health", tags=["meta"])
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "gemini_configured": bool(settings.gemini_api_key),
        "elevenlabs_configured": bool(settings.elevenlabs_api_key),
    }


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)
