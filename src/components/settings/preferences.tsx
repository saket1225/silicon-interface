"use client";

import * as React from "react";

import { analyticsEnabled, setAnalyticsOptedOut } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// Privacy & sound preferences. Both persist to localStorage; the analytics
// toggle additionally flips PostHog's opt_out flag (see lib/analytics) so
// capture stops immediately. Sounds read the same `silicon-interface:sounds`
// key that lib/sounds consults, decoupled from prefers-reduced-motion.
const SOUNDS_KEY = "silicon-interface:sounds";

function readSounds(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SOUNDS_KEY) !== "off";
  } catch {
    return true;
  }
}

function writeSounds(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUNDS_KEY, on ? "on" : "off");
  } catch {
    /* private mode — preference can't persist */
  }
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          // Sharp corners, no shadow — a flat track + ink knob, on-brand.
          "relative inline-flex h-6 w-11 shrink-0 items-center border transition-colors",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "block h-4 w-4 bg-background transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

export function PreferencesSection() {
  // Hydration-safe: localStorage isn't readable on the server, so we read after
  // mount. Defaults match the "on" baseline both helpers fall back to.
  const [analytics, setAnalytics] = React.useState(true);
  const [sounds, setSounds] = React.useState(true);

  React.useEffect(() => {
    // Read persisted prefs once after mount (localStorage is client-only).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time hydration of client-only storage
    setAnalytics(analyticsEnabled());
    setSounds(readSounds());
  }, []);

  return (
    <section className="border-t pt-5">
      <h2 className="text-sm font-semibold">Preferences</h2>
      <div className="mt-1 divide-y">
        <Toggle
          label="Product analytics"
          description="Anonymous usage events to improve the product. No email or phone is sent; email is hashed."
          checked={analytics}
          onChange={(next) => {
            setAnalytics(next);
            setAnalyticsOptedOut(!next);
          }}
        />
        <Toggle
          label="Sound cues"
          description="Short tones for sent and received messages."
          checked={sounds}
          onChange={(next) => {
            setSounds(next);
            writeSounds(next);
          }}
        />
      </div>
    </section>
  );
}
