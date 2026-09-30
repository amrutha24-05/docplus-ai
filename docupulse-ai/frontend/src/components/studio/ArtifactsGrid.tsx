'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { ArtifactKind, Briefing, FaqSet, StudyGuide } from '@/lib/types';

interface Props {
  activeSourceIds: string[];
}

interface Results {
  briefing?: Briefing;
  'study-guide'?: StudyGuide;
  faq?: FaqSet;
}

const TABS: { kind: ArtifactKind; label: string; action: string }[] = [
  { kind: 'briefing', label: 'Briefing', action: 'Generate briefing' },
  { kind: 'study-guide', label: 'Study guide', action: 'Generate study guide' },
  { kind: 'faq', label: 'FAQ', action: 'Generate FAQ' },
];

function BriefingView({ data }: { data: Briefing }) {
  return (
    <div className="space-y-4 text-sm">
      <h4 className="font-semibold text-zinc-100">{data.title}</h4>
      <p className="leading-relaxed text-zinc-300">{data.executive_summary}</p>

      <div>
        <h5 className="mb-1 text-xs font-semibold text-emerald-400">Key points</h5>
        <ul className="list-disc space-y-1 pl-4 text-zinc-300">
          {data.key_points.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      </div>

      <div>
        <h5 className="mb-1 text-xs font-semibold text-emerald-400">Themes</h5>
        <dl className="space-y-2">
          {data.themes.map((theme, i) => (
            <div key={i}>
              <dt className="font-medium text-zinc-200">{theme.name}</dt>
              <dd className="text-zinc-400">{theme.description}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h5 className="mb-1 text-xs font-semibold text-emerald-400">Open questions</h5>
        <ul className="list-disc space-y-1 pl-4 text-zinc-300">
          {data.open_questions.map((question, i) => (
            <li key={i}>{question}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StudyGuideView({ data }: { data: StudyGuide }) {
  return (
    <div className="space-y-4 text-sm">
      <h4 className="font-semibold text-zinc-100">{data.title}</h4>
      <p className="leading-relaxed text-zinc-300">{data.overview}</p>

      <div>
        <h5 className="mb-1 text-xs font-semibold text-emerald-400">Key concepts</h5>
        <dl className="space-y-2">
          {data.key_concepts.map((concept, i) => (
            <div key={i}>
              <dt className="font-medium text-zinc-200">{concept.term}</dt>
              <dd className="text-zinc-400">{concept.definition}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h5 className="mb-1 text-xs font-semibold text-emerald-400">Review questions</h5>
        <div className="space-y-2">
          {data.review_questions.map((item, i) => (
            <details key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
              <summary className="cursor-pointer text-zinc-200">{item.question}</summary>
              <p className="mt-2 text-zinc-400">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

function FaqView({ data }: { data: FaqSet }) {
  return (
    <div className="space-y-2 text-sm">
      {data.items.map((item, i) => (
        <details key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
          <summary className="cursor-pointer text-zinc-200">{item.question}</summary>
          <p className="mt-2 text-zinc-400">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export default function ArtifactsGrid({ activeSourceIds }: Props) {
  const [activeTab, setActiveTab] = useState<ArtifactKind>('briefing');
  const [results, setResults] = useState<Results>({});
  const [loadingKind, setLoadingKind] = useState<ArtifactKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sourceKey = [...activeSourceIds].sort().join(',');

  // Generated content describes one set of sources; discard it when the selection changes.
  useEffect(() => {
    setResults({});
    setError(null);
  }, [sourceKey]);

  const tab = TABS.find((t) => t.kind === activeTab) ?? TABS[0];
  const isLoading = loadingKind === activeTab;

  async function handleGenerate() {
    if (activeSourceIds.length === 0 || loadingKind) return;
    const kind = activeTab;
    setError(null);
    setLoadingKind(kind);

    try {
      if (kind === 'briefing') {
        const data = await api.generateBriefing(activeSourceIds);
        setResults((prev) => ({ ...prev, briefing: data }));
      } else if (kind === 'study-guide') {
        const data = await api.generateStudyGuide(activeSourceIds);
        setResults((prev) => ({ ...prev, 'study-guide': data }));
      } else {
        const data = await api.generateFaq(activeSourceIds);
        setResults((prev) => ({ ...prev, faq: data }));
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingKind(null);
    }
  }

  const hasResult = Boolean(results[activeTab]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4" aria-label="Studio artifacts">
      <div className="mb-4 flex border-b border-zinc-800" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.kind}
            role="tab"
            aria-selected={activeTab === t.kind}
            onClick={() => {
              setActiveTab(t.kind);
              setError(null);
            }}
            className={`flex-1 border-b-2 py-2 text-center text-xs font-semibold transition-colors ${
              activeTab === t.kind
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeSourceIds.length === 0 ? (
        <p className="text-xs text-zinc-500">Select at least one source to generate study material.</p>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={loadingKind !== null}
          className="mb-4 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-emerald-600/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? 'Generating…' : hasResult ? `Regenerate ${tab.label.toLowerCase()}` : tab.action}
        </button>
      )}

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {activeTab === 'briefing' && results.briefing && <BriefingView data={results.briefing} />}
      {activeTab === 'study-guide' && results['study-guide'] && <StudyGuideView data={results['study-guide']} />}
      {activeTab === 'faq' && results.faq && <FaqView data={results.faq} />}
    </section>
  );
}
