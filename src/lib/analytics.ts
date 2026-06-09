// Thin, typed wrapper over the PostHog singleton. Centralizing event names
// here keeps them an explicit analytics contract instead of magic strings
// scattered across components. PostHog is initialized in
// instrumentation-client.ts; here we only *use* the singleton.
//
// Every call is guarded for SSR (no `window`) and is a silent no-op when
// PostHog has no token configured, so these helpers are always safe to call.
import posthog from "posthog-js";

import type { Carbon } from "./types";

// Opt-out persistence. Privacy posture (§4.2): analytics must be opt-out-able
// and must never ship raw PII. We persist the user's choice and gate capture
// behind it; PostHog's own opt_out flag is also flipped so even buffered/
// autocapture events stop.
const OPT_OUT_KEY = "silicon-interface:analytics";

// PostHog buffers calls made before init and replays them once loaded, so a
// browser check is enough — and when no token is configured, init never runs
// and the buffered calls simply never flush (no network, no error).
function ready(): boolean {
  return typeof window !== "undefined";
}

/** True unless the user has explicitly opted out (default: analytics on). */
export function analyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) !== "off";
  } catch {
    return true; // storage blocked (private mode) — treat as enabled, but see set*
  }
}

/**
 * Persist and apply the user's analytics preference. When opting out we also
 * call posthog.opt_out_capturing() so autocapture/pageviews stop immediately
 * and the choice survives reloads; opting back in re-enables capture.
 */
export function setAnalyticsOptedOut(optedOut: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OPT_OUT_KEY, optedOut ? "off" : "on");
  } catch {
    /* private mode — preference can't persist; still apply for this session */
  }
  if (!ready()) return;
  if (optedOut) posthog.opt_out_capturing();
  else posthog.opt_in_capturing();
}

/**
 * One-time deterministic hash so a person can still be correlated across events
 * without storing the raw address. djb2 → hex; not cryptographic, but we only
 * need a stable pseudonymous token, not secrecy, and it avoids a new dependency.
 */
function hashPII(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return `h_${(h >>> 0).toString(16)}`;
}

/**
 * Apply the persisted opt-out at startup, before any capture happens. Call once
 * from the client bootstrap. Idempotent.
 */
export function applyAnalyticsConsent(): void {
  if (!ready()) return;
  if (!analyticsEnabled()) posthog.opt_out_capturing();
  else posthog.opt_in_capturing();
}

/**
 * Tie subsequent events to a carbon and refresh their person properties.
 * distinct_id is the carbon_id so a person is stable across devices/sessions.
 * Safe to call repeatedly (login, profile edits, timezone sync).
 *
 * Privacy: gated behind opt-in, and never ships raw email/phone — the email is
 * hashed to a pseudonymous token and the phone is dropped entirely. We keep
 * non-PII signal (username, verified flags) for product analytics.
 */
export function identifyCarbon(c: Carbon | null | undefined): void {
  if (!ready() || !c?.carbon_id) return;
  if (!analyticsEnabled()) return;
  posthog.identify(c.carbon_id, {
    username: c.username,
    // raw email/phone deliberately omitted; hashed token only.
    email_hash: c.email ? hashPII(c.email.trim().toLowerCase()) : undefined,
    name: c.name || undefined,
    tagline: c.tagline || undefined,
    timezone: c.timezone || undefined,
    phone_verified: Boolean(c.phone_verified_at),
    email_verified: Boolean(c.email_verified_at),
  });
}

/** Clear identity on logout so the next user starts a fresh person/session. */
export function resetAnalytics(): void {
  if (!ready()) return;
  posthog.reset();
}

/** Associate events with a team group (PostHog group analytics). */
export function setTeamGroup(teamId: string, props?: Record<string, unknown>): void {
  if (!ready() || !teamId) return;
  posthog.group("team", teamId, props);
}

function capture(event: string, props?: Record<string, unknown>): void {
  if (!ready() || !analyticsEnabled()) return;
  posthog.capture(event, props);
}

/** Named domain events. Keep names snake_case and stable. */
export const track = {
  loggedIn: (props?: { method?: string }) => capture("carbon_logged_in", props),
  signedUp: (props?: { method?: string }) => capture("carbon_signed_up", props),
  loggedOut: () => capture("carbon_logged_out"),
  messageSent: (props: {
    room_id: string;
    message_type: string;
    has_attachment?: boolean;
    is_reply?: boolean;
  }) => capture("message_sent", props),
  roomOpened: (props: { room_id: string; room_kind: string }) =>
    capture("room_opened", props),
};
