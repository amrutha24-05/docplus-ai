'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SourceList from '@/components/sources/SourceList';
import UploadModal from '@/components/sources/UploadModal';
import ChatFeed from '@/components/chat/ChatFeed';
import AudioPlayer from '@/components/studio/AudioPlayer';
import ArtifactsGrid from '@/components/studio/ArtifactsGrid';
import { api, errorMessage } from '@/lib/api';
import type { ChatMessage, Source, SourceDocument } from '@/lib/types';

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function StudioPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const [notebookTitle, setNotebookTitle] = useState('Untitled notebook');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .listSources()
      .then((docs) => {
        if (!cancelled) setSources(docs.map((doc) => ({ ...doc, active: true })));
      })
      .catch((error) => {
        if (!cancelled) setSourcesError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setSourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSources = useMemo(() => sources.filter((s) => s.active), [sources]);
  const activeIds = useMemo(() => activeSources.map((s) => s.id), [activeSources]);
  const activeChunks = useMemo(
    () => activeSources.reduce((total, s) => total + s.chunk_count, 0),
    [activeSources],
  );

  const toggleSourceActive = useCallback((id: string) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  }, []);

  const handleDocumentUploaded = useCallback((doc: SourceDocument) => {
    setSourcesError(null);
    setSources((prev) => [...prev, { ...doc, active: true }]);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await api.deleteSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      setSourcesError(errorMessage(error));
    }
  }, []);

  const handleSend = useCallback(
    async (query: string) => {
      if (activeIds.length === 0 || isChatLoading) return;

      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: 'user', content: query, citations: [] },
      ]);
      setIsChatLoading(true);

      try {
        const response = await api.chat(query, activeIds);
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'assistant', content: response.answer, citations: response.citations },
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'assistant', content: errorMessage(error), citations: [], isError: true },
        ]);
      } finally {
        setIsChatLoading(false);
      }
    },
    [activeIds, isChatLoading],
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-zinc-950 text-zinc-100 lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* 1. LEFT: sources (25%) */}
      <aside className="flex w-full flex-col border-b border-zinc-800 bg-zinc-900/50 p-4 lg:w-1/4 lg:min-w-[280px] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
            <h2 className="text-lg font-semibold text-zinc-100">Sources</h2>
          </div>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
          >
            + Add Source
          </button>
        </div>

        {sourcesError && (
          <p className="mt-3 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {sourcesError}
          </p>
        )}

        <SourceList
          sources={sources}
          loading={sourcesLoading}
          onToggle={toggleSourceActive}
          onDelete={handleDelete}
        />

        <div className="mt-auto rounded-lg border border-zinc-800 bg-zinc-900/90 p-3 text-xs text-zinc-400">
          <div className="flex justify-between">
            <span>Active context</span>
            <strong className="text-emerald-400">
              {activeSources.length} / {sources.length} documents
            </strong>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Active chunks</span>
            <strong className="text-emerald-400">{activeChunks}</strong>
          </div>
        </div>
      </aside>

      {/* 2. CENTER: grounded workspace (50%) */}
      <main className="flex min-h-[70vh] w-full flex-col bg-zinc-950 lg:h-full lg:min-h-0 lg:w-1/2 lg:border-r lg:border-zinc-800">
        <header className="border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <input
                value={notebookTitle}
                onChange={(e) => setNotebookTitle(e.target.value)}
                aria-label="Notebook title"
                className="w-full bg-transparent text-xl font-bold tracking-tight text-white focus:outline-none"
              />
              <p className="text-xs text-zinc-400">DocuPulse AI · Grounded research workspace</p>
            </div>
            <button
              onClick={() => {
                setIsSearchOpen((open) => !open);
                setSearchTerm('');
              }}
              aria-pressed={isSearchOpen}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                isSearchOpen
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Search chat
            </button>
          </div>
          {isSearchOpen && (
            <input
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter messages"
              className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none"
            />
          )}
        </header>

        <ChatFeed
          messages={messages}
          loading={isChatLoading}
          hasActiveSources={activeSources.length > 0}
          filter={searchTerm}
          onSend={handleSend}
        />
      </main>

      {/* 3. RIGHT: studio (25%) */}
      <aside className="flex w-full flex-col gap-4 overflow-y-auto bg-zinc-900/40 p-4 lg:w-1/4 lg:min-w-[280px]">
        <AudioPlayer activeSourceIds={activeIds} />
        <ArtifactsGrid activeSourceIds={activeIds} />
      </aside>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploaded={handleDocumentUploaded}
      />
    </div>
  );
}
