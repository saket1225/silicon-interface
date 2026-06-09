"use client";

import * as React from "react";

/** A `Date` that re-renders every `intervalMs` (for live clocks). */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    // Align the tick to the next interval boundary before starting the steady
    // interval. A naive setInterval(…, 1000) fires at an arbitrary phase, so a
    // displayed clock could lag the real second by up to ~1s and visibly jump.
    // We first wait out the remainder of the current interval, then tick on the
    // boundary and run a clean interval from there.
    const align = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), intervalMs);
    }, intervalMs - (Date.now() % intervalMs));
    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, [intervalMs]);
  return now;
}
