import type {
  AudioOverview,
  Briefing,
  ChatResponse,
  FaqSet,
  SourceDocument,
  StudyGuide,
} from './types';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    throw new ApiError(
      `Cannot reach the DocuPulse API at ${BASE_URL}. Is the backend running?`,
      0,
    );
  }

  if (!response.ok) {
    let detail = response.statusText || `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.detail === 'string') detail = body.detail;
      else if (Array.isArray(body?.detail)) {
        detail = body.detail.map((item: { msg?: string }) => item.msg ?? 'Invalid request').join('; ');
      }
    } catch {
      // Body was not JSON; keep the status text.
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const api = {
  listSources: () => request<SourceDocument[]>('/api/documents/sources'),

  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<SourceDocument>('/api/documents/upload', { method: 'POST', body: form });
  },

  deleteSource: (id: string) =>
    request<{ deleted: string }>(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  chat: (query: string, activeSourceIds: string[]) =>
    postJson<ChatResponse>('/api/query/chat', { query, active_source_ids: activeSourceIds }),

  generateBriefing: (activeSourceIds: string[]) =>
    postJson<Briefing>('/api/artifacts/overview', { active_source_ids: activeSourceIds }),

  generateStudyGuide: (activeSourceIds: string[]) =>
    postJson<StudyGuide>('/api/artifacts/study-guide', { active_source_ids: activeSourceIds }),

  generateFaq: (activeSourceIds: string[]) =>
    postJson<FaqSet>('/api/artifacts/faq', { active_source_ids: activeSourceIds }),

  generateAudio: (activeSourceIds: string[], synthesize = true) =>
    postJson<AudioOverview>('/api/audio/generate', {
      active_source_ids: activeSourceIds,
      synthesize,
    }),

  resolveUrl: (path: string) => (path.startsWith('http') ? path : `${BASE_URL}${path}`),
};
