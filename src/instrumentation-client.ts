// Client-side PostHog initialization. In Next.js 15.3+ this file is the
// canonical place to boot client instrumentation — it runs once, early, before
// React hydrates. Do NOT also initialize PostHog via a <PostHogProvider
// apiKey=...> (that would double-init); components read the singleton with
// `import posthog from "posthog-js"`.
//
// Config posture: capture *everything*. Session replay records the full UI
// (including private chat content), all inputs, canvas, console logs and
// network timing. This is intentional per product decision — dial back the
// `session_recording` masking options below if the data policy changes.
import posthog from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (token) {
  posthog.init(token, {
    // First-party reverse proxy (see next.config.ts rewrites).
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    // Required modern defaults bundle (history-change pageviews, etc.).
    defaults: "2026-01-30",

    // ---- product analytics: capture as much as possible ----
    autocapture: true, // clicks, input changes, form submits, $autocapture
    capture_pageview: "history_change", // SPA route changes (App Router)
    capture_pageleave: true,
    rageclick: true,
    person_profiles: "always", // profile anonymous + identified users
    capture_performance: { network_timing: true, web_vitals: true },

    // ---- error tracking ----
    capture_exceptions: true, // unhandled errors + rejections + console.error

    // ---- session replay: maximal detail, no masking ----
    disable_session_recording: false,
    enable_recording_console_log: true,
    session_recording: {
      maskAllInputs: false, // record what users type
      maskTextSelector: undefined, // record all rendered text
      maskInputOptions: { password: true }, // never record password fields
      recordCrossOriginIframes: true,
      collectFonts: true,
      captureCanvas: { recordCanvas: true }, // record <canvas> elements
      // Capture network request/response headers + bodies in the replay.
      recordHeaders: true,
      recordBody: true,
    },

    debug: process.env.NODE_ENV === "development",
  });
}
