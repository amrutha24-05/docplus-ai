export interface SourceDocument {
  id: string;
  filename: string;
  chunk_count: number;
  char_count: number;
  created_at: string;
}

/** A source plus its UI-only "included in context" flag. */
export interface Source extends SourceDocument {
  active: boolean;
}

export interface Citation {
  id: number;
  filename: string;
  snippet: string;
  source_id: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  isError?: boolean;
}

export interface Theme {
  name: string;
  description: string;
}

export interface Briefing {
  title: string;
  executive_summary: string;
  key_points: string[];
  themes: Theme[];
  open_questions: string[];
}

export interface Concept {
  term: string;
  definition: string;
}

export interface ReviewQuestion {
  question: string;
  answer: string;
}

export interface StudyGuide {
  title: string;
  overview: string;
  key_concepts: Concept[];
  review_questions: ReviewQuestion[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSet {
  items: FaqItem[];
}

export type ArtifactKind = 'briefing' | 'study-guide' | 'faq';

export interface PodcastTurn {
  speaker: 'Alex' | 'Sam';
  text: string;
}

export interface AudioOverview {
  id: string;
  title: string;
  script: PodcastTurn[];
  audio_url: string | null;
}
