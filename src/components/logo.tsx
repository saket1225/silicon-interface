"use client";

import * as React from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

interface LogoProps {
  /** Edge length of the square mark, in px. */
  size?: number;
  /** Render the "Silicon Interface" wordmark beside the mark. */
  withWordmark?: boolean;
  className?: string;
}

/**
 * The Silicon Interface logo. Centralizes the brand mark so it can be swapped
 * in one place everywhere it's used (landing, navbar, auth). The asset lives at
 * `public/logo.png` — replace that file to rebrand.
 *
 * §7g — hovering the logo reveals session uptime in mono, a tiny terminal beat
 * for the curious. The clock only ticks while hovered, so it costs nothing at
 * rest.
 */
export function Logo({ size = 28, withWordmark = false, className }: LogoProps) {
  // Session start — set once on mount (client-only). A ref so it never resets
  // on re-render and never participates in render output until hover.
  const mountedAt = React.useRef<number | null>(null);
  const [hovering, setHovering] = React.useState(false);
  const [uptime, setUptime] = React.useState("");

  React.useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  React.useEffect(() => {
    if (!hovering) return; // not hovered — don't run a timer
    const tick = () => {
      if (mountedAt.current !== null) setUptime(formatUptime(Date.now() - mountedAt.current));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [hovering]);

  const show = () => setHovering(true);
  const hide = () => setHovering(false);

  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <Image
        src="/logo.png"
        alt=""
        aria-hidden
        width={size}
        height={size}
        className="shrink-0 select-none"
        draggable={false}
        priority
      />
      {withWordmark && (
        <span className="font-mono text-sm font-semibold tracking-tight">Silicon Interface</span>
      )}
      {hovering && uptime && (
        <span
          className="font-mono text-[11px] tabular-nums text-muted-foreground"
          aria-hidden
        >
          uptime {uptime}
        </span>
      )}
      <span className="sr-only">Silicon Interface</span>
    </span>
  );
}

/** Format a millisecond span as a compact mono uptime: `h:mm:ss` or `m:ss`. */
function formatUptime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
