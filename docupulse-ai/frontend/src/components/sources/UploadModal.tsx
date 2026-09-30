'use client';

import { useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { SourceDocument } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (doc: SourceDocument) => void;
}

type ItemStatus = 'pending' | 'uploading' | 'done' | 'error';

interface UploadItem {
  name: string;
  status: ItemStatus;
  error?: string;
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.md'];
const MAX_MB = 20;

function validate(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return 'Unsupported type. Use PDF, TXT or MD.';
  }
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_MB * 1024 * 1024) return `Larger than ${MAX_MB} MB.`;
  return null;
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: 'Waiting',
  uploading: 'Processing…',
  done: 'Added',
  error: 'Failed',
};

export default function UploadModal({ isOpen, onClose, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isWorking, setIsWorking] = useState(false);

  if (!isOpen) return null;

  const patch = (index: number, changes: Partial<UploadItem>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  const close = () => {
    if (isWorking) return;
    setItems([]);
    onClose();
  };

  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0 || isWorking) return;

    const offset = items.length;
    setIsWorking(true);
    setItems((prev) => [...prev, ...files.map((file) => ({ name: file.name, status: 'pending' as ItemStatus }))]);

    for (let i = 0; i < files.length; i += 1) {
      const index = offset + i;
      const file = files[i];

      const problem = validate(file);
      if (problem) {
        patch(index, { status: 'error', error: problem });
        continue;
      }

      patch(index, { status: 'uploading' });
      try {
        const doc = await api.uploadDocument(file);
        onUploaded(doc);
        patch(index, { status: 'done' });
      } catch (error) {
        patch(index, { status: 'error', error: errorMessage(error) });
      }
    }

    setIsWorking(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Add source"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-100">Add source</h3>
          <button
            onClick={close}
            disabled={isWorking}
            aria-label="Close"
            className="text-zinc-500 hover:text-zinc-200 disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void processFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? 'border-emerald-500 bg-emerald-950/20' : 'border-zinc-700 hover:border-zinc-500'
          }`}
        >
          <p className="text-sm text-zinc-200">Drop files here or click to browse</p>
          <p className="mt-1 text-xs text-zinc-500">PDF, TXT or MD, up to {MAX_MB} MB each</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void processFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {items.length > 0 && (
          <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto">
            {items.map((item, index) => (
              <li
                key={`${item.name}-${index}`}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-zinc-200">{item.name}</span>
                  <span
                    className={`shrink-0 text-xs ${
                      item.status === 'done'
                        ? 'text-emerald-400'
                        : item.status === 'error'
                          ? 'text-red-400'
                          : 'text-zinc-500'
                    }`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                {item.error && <p className="mt-1 text-xs text-red-400">{item.error}</p>}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={close}
            disabled={isWorking}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {isWorking ? 'Processing…' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
