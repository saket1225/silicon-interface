"use client";

import * as React from "react";
import { Pause, Play } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

interface Props {
  /** Presigned/permanent URL. May be null while still loading. */
  url: string | null;
  /** Pre-computed peaks (0..1). When absent, the bars fall back to a flat
   *  line; once playback decodes, they stay flat (we trust server peaks for
   *  consistency between sender + receiver). */
  peaks?: number[] | null;
  /** Duration in ms — server-known, so the timer renders before audio loads. */
  durationMs?: number | null;
  className?: string;
}

/**
 * Silicon-style audio bubble — same waveform language as the recorder.
 *
 *   ┌────────────────────────────────────────────┐
 *   │ ▶  ▁▂▄▆▇▆▄▂▁▂▄▆▇▆▄▂▁▂▄▆▇▆▄▂  00:42 / 01:24 │
 *   └────────────────────────────────────────────┘
 *
 * We render server-computed peaks immediately (so the bars exist before
 * audio decodes), then progress recolors them in step with playback.
 */
export function SiliconAudio({ url, peaks, durationMs, className }: Props) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [currentMs, setCurrentMs] = React.useState(0);
  const [internalDurMs, setInternalDurMs] = React.useState<number | null>(null);

  const bars = React.useMemo(() => {
    if (peaks && peaks.length > 0) return peaks;
    // Synth a gentle wave so a missing peaks projection (older messages,
    // metadata fetch failed, etc.) still looks intentional rather than
    // empty. Static deterministic pattern.
    return Array.from({ length: 48 }, (_, i) =>
      0.25 + 0.5 * Math.abs(Math.sin(i * 0.6 + Math.cos(i * 0.13))),
    );
  }, [peaks]);

  const dur = durationMs ?? internalDurMs ?? 0;
  const progress = dur > 0 ? Math.min(1, currentMs / dur) : 0;

  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentMs(Math.round(a.currentTime * 1000));
    const onMeta = () => {
      if (!durationMs && a.duration && Number.isFinite(a.duration)) {
        setInternalDurMs(Math.round(a.duration * 1000));
      }
    };
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [durationMs]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      try {
        await a.play();
        setPlaying(true);
      } catch {
        /* user gesture or codec issue — silently no-op */
      }
    }
  };

  const seekTo = (frac: number) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    const t = Math.max(0, Math.min(dur, dur * frac));
    a.currentTime = t / 1000;
    setCurrentMs(t);
  };

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 border bg-card px-3 py-2 text-foreground",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "pause" : "play"}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center border bg-foreground text-background transition-opacity hover:opacity-90"
      >
        {playing ? <Pause /> : <Play />}
      </button>
      <Waveform bars={bars} progress={progress} onSeek={seekTo} />
      <span className="shrink-0 label-mono text-[10px] text-muted-foreground">
        {formatTime(currentMs)}/{formatTime(dur)}
      </span>
      {url && (
        // The actual playback element. preload=metadata so duration arrives
        // without paying the full bytes cost up front.
        // eslint-disable-next-line jsx-a11y/media-has-caption -- voice notes don't have captions
        <audio ref={audioRef} src={url} preload="metadata" />
      )}
    </div>
  );
}

function Waveform({
  bars,
  progress,
  onSeek,
}: {
  bars: number[];
  progress: number;
  onSeek: (frac: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek(Math.max(0, Math.min(1, x / rect.width)));
  };
  return (
    <div
      ref={ref}
      onClick={handleClick}
      role="slider"
      aria-label="audio scrubber"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={progress}
      className="flex h-9 flex-1 cursor-pointer items-center gap-[2px]"
    >
      {bars.map((v, i) => {
        const reached = i / bars.length < progress;
        return (
          <span
            key={i}
            className={cn(
              "inline-block w-[3px] transition-colors",
              reached ? "bg-foreground" : "bg-foreground/35",
            )}
            style={{ height: `${Math.max(8, Math.round(v * 100))}%` }}
          />
        );
      })}
    </div>
  );
}

function formatTime(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
