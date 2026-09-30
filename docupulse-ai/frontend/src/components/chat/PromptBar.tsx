'use client';

interface Props {
  disabled: boolean;
  onSelect: (prompt: string) => void;
}

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: 'Summarize', prompt: 'Summarize the key points of the selected sources.' },
  { label: 'Timeline', prompt: 'Create a timeline of the key events or steps described in the sources.' },
  { label: 'Key terms', prompt: 'List the key terms and definitions found in the sources.' },
  { label: 'Open questions', prompt: 'What questions do these sources leave unanswered?' },
  { label: 'Explain simply', prompt: 'Explain the main idea of these sources in simple terms.' },
];

export default function PromptBar({ disabled, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick actions">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(action.prompt)}
          className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-emerald-600/60 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
