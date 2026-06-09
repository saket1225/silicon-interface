"use client";

import * as React from "react";

import { safeSession } from "./safe-storage";

/**
 * A simple countdown for resend buttons. `start(secs)` begins a cooldown;
 * `remaining` ticks down to 0; `active` is true while it's running.
 *
 * Pass `persistKey` to survive a page refresh (OTP screens are a common place
 * to reload): the absolute deadline is stashed in `safeSession`, so reloading
 * on the OTP screen keeps the countdown running instead of resetting it and
 * letting the user spam resend. `safeSession` (not raw sessionStorage) so a
 * private-mode storage throw degrades gracefully instead of crashing.
 */
export function useCooldown(persistKey?: string) {
  // Initialise from a persisted deadline if one is still in the future. Lazy
  // initialiser runs once on mount (client-only — safeSession no-ops on server).
  const [until, setUntil] = React.useState<number>(() => {
    if (!persistKey) return 0;
    const raw = safeSession.get(persistKey);
    const v = raw ? Number(raw) : 0;
    return Number.isFinite(v) && v > Date.now() ? v : 0;
  });
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (until <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [until]);

  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  return {
    remaining,
    active: remaining > 0,
    start: (secs: number) => {
      const t = Date.now();
      const deadline = t + secs * 1000;
      setNow(t);
      setUntil(deadline);
      if (persistKey) safeSession.set(persistKey, String(deadline));
    },
  };
}
