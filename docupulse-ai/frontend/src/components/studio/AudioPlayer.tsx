'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { AudioOverview } from '@/lib/types';

interface Props {
  activeSourceIds: string[];
}

const SPEEDS = [1, 1.25, 1.5] as const;
const BAR_COUNT = 36;
const BAR_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) =>
  Math.round(8 + Math.abs(Math.sin(i * 1.7) + Math.cos(i * 0.6)) * 12),
);

const HOSTS = [
  { name: 'Alex' as const, role: 'Curious host', ring: 'ring-emerald-500', bg: 'bg-emerald-700' },
  { name: 'Sam' as const, role: 'Explainer', ring: 'ring-sky-400', bg: 'bg-sky-700' },
];

export default function AudioPlayer({ activeSourceIds }: Props) {
  const [overview, setOverview] = useState<AudioOverview | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [activeTurn, setActiveTurn] = useState(0);
  const [progress, setProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runIdRef = useRef(0); // invalidates stale speech callbacks
  const isPlayingRef = useRef(false);
  const turnRef = useRef(0);

  const speed = SPEEDS[speedIndex];
  const script = useMemo(() => overview?.script ?? [], [overview]);
  const audioSrc = overview?.audio_url ? api.resolveUrl(overview.audio_url) : null;

  // Cumulative share of the transcript at the end of each turn, to map audio time to a speaker.
  const turnBoundaries = useMemo(() => {
    const total = script.reduce((sum, turn) => sum + turn.text.length, 0) || 1;
    let running = 0;
    return script.map((turn) => {
      running += turn.text.length;
      return running / total;
    });
  }, [script]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, audioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      runIdRef.current += 1;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      audio?.pause();
    };
  }, []);

  function setPlaying(value: boolean) {
    isPlayingRef.current = value;
    setIsPlaying(value);
  }

  function halt() {
    runIdRef.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    audioRef.current?.pause();
    setPlaying(false);
  }

  function speakFrom(index: number, rate: number) {
    const synth = window.speechSynthesis;
    synth.cancel();
    runIdRef.current += 1;
    const runId = runIdRef.current;

    if (index >= script.length) {
      turnRef.current = 0;
      setActiveTurn(0);
      setProgress(0);
      setPlaying(false);
      return;
    }

    const turn = script[index];
    const utterance = new SpeechSynthesisUtterance(turn.text);
    utterance.rate = rate;
    utterance.pitch = turn.speaker === 'Alex' ? 0.85 : 1.2;

    const voices = synth.getVoices().filter((voice) => voice.lang.startsWith('en'));
    if (voices.length > 0) {
      utterance.voice = turn.speaker === 'Alex' ? voices[0] : voices[Math.min(1, voices.length - 1)];
    }

    utterance.onstart = () => {
      if (runIdRef.current !== runId) return;
      turnRef.current = index;
      setActiveTurn(index);
      setProgress(index / script.length);
    };
    utterance.onend = () => {
      if (runIdRef.current === runId && isPlayingRef.current) speakFrom(index + 1, rate);
    };
    utterance.onerror = () => {
      if (runIdRef.current === runId) setPlaying(false);
    };

    synth.speak(utterance);
  }

  async function handleGenerate() {
    if (activeSourceIds.length === 0 || isGenerating) return;
    halt();
    setError(null);
    setIsGenerating(true);
    turnRef.current = 0;
    setActiveTurn(0);
    setProgress(0);

    try {
      setOverview(await api.generateAudio(activeSourceIds, true));
    } catch (err) {
      setOverview(null);
      setError(errorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  }

  function handleTogglePlay() {
    if (!overview || script.length === 0) return;

    if (isPlaying) {
      halt();
      return;
    }

    if (audioSrc) {
      setPlaying(true);
      audioRef.current?.play().catch(() => {
        setError('The browser blocked audio playback. Press play again.');
        setPlaying(false);
      });
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setError('This browser cannot read the script aloud. Configure ElevenLabs on the backend for audio files.');
      return;
    }

    setPlaying(true);
    speakFrom(turnRef.current, speed);
  }

  function handleCycleSpeed() {
    const nextIndex = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIndex);
    if (!audioSrc && isPlayingRef.current) speakFrom(turnRef.current, SPEEDS[nextIndex]);
  }

  const currentSpeaker = script[activeTurn]?.speaker;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4" aria-label="Audio overview">
      <h3 className="text-sm font-semibold text-zinc-100">Audio overview</h3>
      <p className="mt-0.5 text-xs text-zinc-500">A two-host conversation about your active sources.</p>

      <div className="mt-4 flex justify-center gap-6">
        {HOSTS.map((host) => {
          const speaking = isPlaying && currentSpeaker === host.name;
          return (
            <div key={host.name} className="flex flex-col items-center gap-1">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white transition-shadow ${host.bg} ${
                  speaking ? `ring-2 ring-offset-2 ring-offset-zinc-900 ${host.ring}` : ''
                }`}
              >
                {host.name[0]}
              </div>
              <span className="text-xs font-medium text-zinc-200">{host.name}</span>
              <span className="text-[10px] text-zinc-500">{host.role}</span>
            </div>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${BAR_COUNT * 6} 48`}
        className="mt-4 h-12 w-full"
        role="img"
        aria-label={isPlaying ? 'Audio is playing' : 'Audio is paused'}
      >
        {BAR_HEIGHTS.map((height, i) => {
          const played = i / BAR_COUNT < progress;
          return (
            <rect
              key={i}
              x={i * 6 + 1}
              y={24 - height / 2}
              width={3}
              height={height}
              rx={1.5}
              className={`${played ? 'fill-emerald-500' : 'fill-zinc-700'} ${isPlaying ? 'wave-bar' : ''}`}
              style={{ animationDelay: `${(i % 9) * 0.08}s` }}
            />
          );
        })}
      </svg>

      {overview && (
        <div className="mt-2 min-h-[3rem]">
          <p className="truncate text-xs font-medium text-zinc-300">{overview.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
            {script[activeTurn] ? `${script[activeTurn].speaker}: ${script[activeTurn].text}` : ''}
          </p>
        </div>
      )}

      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="auto"
          onTimeUpdate={(e) => {
            const audio = e.currentTarget;
            if (!audio.duration) return;
            const fraction = audio.currentTime / audio.duration;
            setProgress(fraction);
            const index = turnBoundaries.findIndex((boundary) => fraction <= boundary);
            setActiveTurn(index === -1 ? script.length - 1 : index);
          }}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
            setActiveTurn(0);
          }}
        />
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleTogglePlay}
          disabled={!overview}
          className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={handleCycleSpeed}
          aria-label={`Playback speed ${speed}x, click to change`}
          className="w-14 rounded-lg border border-zinc-800 px-2 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600"
        >
          {speed}x
        </button>
      </div>

      <button
        onClick={handleGenerate}
        disabled={activeSourceIds.length === 0 || isGenerating}
        className="mt-2 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-emerald-600/60 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isGenerating ? 'Generating…' : overview ? 'Regenerate overview' : 'Generate audio overview'}
      </button>

      {activeSourceIds.length === 0 && (
        <p className="mt-2 text-xs text-zinc-500">Select at least one source to generate an overview.</p>
      )}
      {overview && !audioSrc && (
        <p className="mt-2 text-xs text-zinc-500">
          Playing with your browser&apos;s voices. Set ELEVENLABS_API_KEY on the backend for studio audio.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
