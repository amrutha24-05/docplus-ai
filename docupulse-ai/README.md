# DocuPulse AI

A grounded research workspace in the spirit of NotebookLM. Upload PDF, TXT or Markdown sources, chat with
inline citations, generate briefing notes, study guides and FAQs, and produce a two-host audio overview.

## Stack

- **Backend:** FastAPI, ChromaDB (persistent), Google GenAI SDK (`gemini-2.5-flash`, `text-embedding-004`), SQLite for the source registry, optional ElevenLabs for audio
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS

## Run it

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                 # then set GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000.

### Docker (backend only)

```bash
cd backend
docker build -t docupulse-backend .
docker run --env-file .env -p 8000:8000 -v "$(pwd)/data:/app/data" -v "$(pwd)/chroma_db:/app/chroma_db" docupulse-backend
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/documents/upload` | Upload PDF/TXT/MD, chunk (800 chars, 100 overlap), embed, store |
| GET | `/api/documents/sources` | List uploaded sources |
| DELETE | `/api/documents/{source_id}` | Delete a source and its vectors |
| POST | `/api/query/chat` | Grounded chat with citations: `{ query, active_source_ids }` |
| POST | `/api/artifacts/overview` | Structured briefing document |
| POST | `/api/artifacts/study-guide` | Structured study guide |
| POST | `/api/artifacts/faq` | Structured FAQ |
| POST | `/api/audio/generate` | Two-host podcast script (Alex and Sam), plus audio when ElevenLabs is configured |

## Notes

- Citations: the model cites numbered context excerpts as `[1]`, `[2]`. Each number maps to an excerpt headed `[Source: filename]`. The response returns `{ id, filename, snippet }` for every number actually cited, and the UI renders each as a clickable badge.
- Audio: without `ELEVENLABS_API_KEY` the backend returns only the script, and the browser reads it aloud with its built-in voices (alternating pitch per host). With the key set, the backend synthesizes an MP3 and the player uses that.
- If you change `EMBEDDING_MODEL`, delete `backend/chroma_db` and re-upload, because vector dimensions differ between models.
