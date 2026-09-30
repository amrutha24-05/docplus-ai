'use client';

import { useEffect, useRef, useState } from 'react';
import type { Citation } from '@/lib/types';

interface Props {
  index: number;
  citation?: Citation;
}

export default function CitationBadge({ index, citation }: Props) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [pinned]);

  // The model cited a number we have no excerpt for: show it as plain text, not a false link.
  if (!citation) {
    return <span className="text-zinc-500">[{index}]</span>;
  }

  return (
    <span
      ref={containerRef}
      className="relative inline-block align-baseline"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Source ${index}: ${citation.filename}`}
        onClick={() => {
          setPinned((value) => !value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (!pinned) setOpen(false);
        }}
        className={`mx-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded px-1 text-[10px] font-semibold leading-none transition-colors ${
          open
            ? 'bg-emerald-500 text-zinc-950'
            : 'bg-emerald-900/60 text-emerald-300 hover:bg-emerald-700'
        }`}
      >
        {index}
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-2 block w-72 max-w-[80vw] rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-left text-xs shadow-xl"
        >
          <span className="block truncate font-semibold text-emerald-400">{citation.filename}</span>
          <span className="mt-1 block whitespace-normal leading-relaxed text-zinc-300">
            {citation.snippet}
          </span>
        </span>
      )}
    </span>
  );
}
