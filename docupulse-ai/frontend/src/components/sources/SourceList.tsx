'use client';

import type { Source } from '@/lib/types';

interface Props {
  sources: Source[];
  loading: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SourceList({ sources, loading, onToggle, onDelete }: Props) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-8 text-sm text-zinc-500">
        Loading sources…
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
        <p className="text-sm text-zinc-500">
          No sources yet. Add a PDF, TXT or Markdown file to start a grounded conversation.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex-1 space-y-2 overflow-y-auto py-4">
      {sources.map((source) => (
        <li key={source.id}>
          <div
            className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
              source.active
                ? 'border-emerald-600/50 bg-emerald-950/20'
                : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
            }`}
          >
            <input
              type="checkbox"
              checked={source.active}
              onChange={() => onToggle(source.id)}
              aria-label={`Use ${source.filename} as context`}
              className="mt-1 accent-emerald-500"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100" title={source.filename}>
                {source.filename}
              </p>
              <p className="text-xs text-zinc-500">
                {source.chunk_count} chunks · {new Date(source.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => onDelete(source.id)}
              aria-label={`Delete ${source.filename}`}
              className="text-xs text-zinc-500 transition-colors hover:text-red-400"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
