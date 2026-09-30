'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CitationBadge from './CitationBadge';
import PromptBar from './PromptBar';
import type { ChatMessage } from '@/lib/types';

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  hasActiveSources: boolean;
  filter: string;
  onSend: (query: string) => void | Promise<void>;
}

/** Turn "[3]" markers into links the markdown renderer swaps for citation badges. */
function linkCitations(text: string): string {
  return text.replace(/\[(\d+)\]/g, '[$1](#cite-$1)');
}

function AssistantContent({ message }: { message: ChatMessage }) {
  const components = useMemo<Components>(
    () => ({
      a: ({ href, children }) => {
        const match = href?.match(/^#cite-(\d+)$/);
        if (match) {
          const id = Number(match[1]);
          return <CitationBadge index={id} citation={message.citations.find((c) => c.id === id)} />;
        }
        return (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        );
      },
    }),
    [message.citations],
  );

  return (
    <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-li:my-0.5">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {linkCitations(message.content)}
      </ReactMarkdown>
    </div>
  );
}

export default function ChatFeed({ messages, loading, hasActiveSources, filter, onSend }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const visibleMessages = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return messages;
    return messages.filter((m) => m.content.toLowerCase().includes(term));
  }, [messages, filter]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const canSend = hasActiveSources && !loading;

  const submit = (text: string) => {
    const query = text.trim();
    if (!query || !canSend) return;
    setInput('');
    void onSend(query);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <p className="max-w-sm text-sm text-zinc-500">
              {hasActiveSources
                ? 'Ask a question about your selected sources. Answers cite the passages they come from.'
                : 'Add a source and tick it on the left, then ask a question about it.'}
            </p>
          </div>
        )}

        {messages.length > 0 && visibleMessages.length === 0 && (
          <p className="text-center text-sm text-zinc-500">No messages match “{filter}”.</p>
        )}

        {visibleMessages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'bg-emerald-600 text-white'
                  : message.isError
                    ? 'border border-red-900/60 bg-red-950/30 text-red-300'
                    : 'border border-zinc-800 bg-zinc-900 text-zinc-200'
              }`}
            >
              {message.role === 'user' || message.isError ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <AssistantContent message={message} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-500">
              Searching your sources…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="space-y-3 border-t border-zinc-800 p-4">
        <PromptBar disabled={!canSend} onSelect={submit} />
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            disabled={!hasActiveSources}
            placeholder={hasActiveSources ? 'Ask about your sources' : 'Select a source to start'}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => submit(input)}
            disabled={!canSend || !input.trim()}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
