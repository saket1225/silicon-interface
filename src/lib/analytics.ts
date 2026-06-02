// Thin, typed wrapper over the PostHog singleton. Centralizing event names
// here keeps them an explicit analytics contract instead of magic strings
// scattered across components. PostHog is initialized in
// instrumentation-client.ts; here we only *use* the singleton.
//
// Every call is guarded for SSR (no `window`) and is a silent no-op when
// PostHog has no token configured, so these helpers are always safe to call.
import posthog from "posthog-js";

import type { Carbon } from "./types";

// PostHog buffers calls made before init and replays them once loaded, so a
// browser check is enough — and when no token is configured, init never runs
// and the buffered calls simply never flush (no network, no error).
function ready(): boolean {
  return typeof window !== "undefined";
}

/**
 * Tie subsequent events to a carbon and refresh their person properties.
 * distinct_id is the carbon_id so a person is stable across devices/sessions.
 * Safe to call repeatedly (login, profile edits, timezone sync).
 */
export function identifyCarbon(c: Carbon | null | undefined): void {
  if (!ready() || !c?.carbon_id) return;
  posthog.identify(c.carbon_id, {
    username: c.username,
    email: c.email,
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
  if (!ready()) return;
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
