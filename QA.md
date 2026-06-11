# Silicon Interface — Quality Assurance Report

> The interface where Carbons talk to Silicons (and each other), in one thread.
> This document is the master QA dossier ahead of selling into high‑ticket clients.
> Goal: a premium, zero‑bug experience. Below are the places things break at the
> extremes, the places where it isn't clear what's happening, and everything in
> between — each with a file:line reference, the exact edge case that triggers it,
> and a concrete fix.

**Audit date:** 2026‑06‑09
**Scope:** every page and every component under `src/` (auth, onboarding, chat core, composer/media/voice, teams/billing/invites, profile/contacts/settings/sharing, notifications, sounds, analytics, design system, dev console, UI primitives).
**Method:** full‑file reads of all ~16k lines, plus six independent deep‑dive passes. Each headline security finding was re‑verified against source after the fact.

---

## How to read this

Findings are graded:

| Grade | Meaning |
|------|---------|
| **P0 — Blocker** | Can hard‑break a paying user, lose data, leak data, or charge money incorrectly. Fix before any client touches it. |
| **Critical** | High chance a real user hits it in normal use; reads as "the product is broken/stuck." |
| **High** | Hits a meaningful slice of users (esp. international, slow networks, group rooms). |
| **Medium** | Noticeable, off‑brand, or confusing, but not blocking. |
| **Low / Polish** | Refinement; the difference between "good" and "premium." |

The body is organized by **theme deep‑dives** first (the things the brief explicitly asked about — *where things break at the extremes* and *where progress isn't clear*), then by **area** so engineers can pick up a file and fix everything in it.

---

## Executive summary

The app is genuinely well‑built: thoughtful real‑time architecture, a coherent and distinctive design system, careful comments, transparent token refresh, optimistic UI, offline‑ish caches. It is **not** at "zero‑bug premium" yet. The gaps cluster into five themes:

1. **Progress identification is the weakest area** — exactly as suspected. The silicon "is it working / stuck / done?" signal can hang forever, streaming can get stuck, and `progress_pct` exists on the wire but is never shown. This is the single most important area to harden for a product whose whole premise is watching a silicon work. See **§1**.
2. **Real‑time integrity has edge‑case holes** — frame coalescing can silently drop deltas/finals, deltas for an unknown event are lost, optimistic dedup can double‑post a message, and there's no pagination past 100 events. See **§2**.
3. **Money paths need hardening** — checkout has no idempotency (double‑charge risk), mixed‑currency totals sum incorrectly, and `null` day‑counts render as "in null days." See **§3**.
4. **Security & privacy posture is dangerous for high‑ticket clients** — session replay records full chat content **and bearer tokens**, the dev console (which can brute‑force OTPs) is reachable by any logged‑in user with no staff/prod gate, and one server‑provided SVG is injected unsanitized. See **§4**.
5. **Extreme inputs & i18n** — phone parsing breaks for pasted/international numbers, empty/whitespace/very‑long text is under‑guarded across forms, clipboard "success" can be a lie, and a number of contrast ratios fail WCAG AA. See **§5–§7**.

### Severity tally (deduplicated, headline items)

- **P0 Blockers:** 6
- **Critical:** ~14
- **High:** ~24
- **Medium:** ~40
- **Low / Polish:** ~45

---

## P0 — Fix before a client touches it

| # | Finding | File:line |
|---|---------|-----------|
| P0‑1 | **Session replay captures private chat content + `Authorization`/`X‑Silicon‑Key` tokens.** A live bearer token is liftable from any replay; full DM contents are recorded to a third party. | `src/instrumentation-client.ts:34-47` |
| P0‑2 | **Dev console open to any authenticated user, in prod, uncrawl‑gated.** `/dev` is behind `AuthGuard` only — no staff/prod check, no `middleware.ts`, no `robots.txt`. It can brute‑force OTP codes, read cost data, and mutate state. | `src/app/dev/layout.tsx:6-16`, `src/app/dev/page.tsx`, `src/components/auth-guard.tsx` |
| P0‑3 | **Unsanitized server SVG injected into the app origin.** Team structure chart is `dangerouslySetInnerHTML`'d directly (the DSL path is correctly sandboxed in an iframe — this one isn't). Stored XSS able to read the access token if the SVG content is ever attacker‑influenced. | `src/components/teams/team-panel.tsx:163` |
| P0‑4 | **Checkout has no idempotency → double‑charge risk.** Network timeout after the server commits the payment, user retries → second charge. No reuse of `payment_id`. | `src/components/teams/team-panel.tsx:433-455` |
| P0‑5 | **OTP verified but handoff fails → user permanently stranded.** Tokens persist, but the consumed challenge can't be re‑verified; user is actually logged in yet stuck on the login screen showing an error until a manual reload. | `src/app/auth/login/page.tsx:124-133` |
| P0‑6 | **`sessionStorage` write throws in private mode → infinite register→onboarding bounce.** Phone is verified server‑side but the client can never reach onboarding; loops forever. | `src/app/auth/register/page.tsx:220-229`, `src/app/onboarding/page.tsx:96-102` |

These six are the ones that lose money, leak data, or brick a real customer. Everything else degrades polish; these break trust.

---

## §1 — Progress identification clarity (the headline theme)

The product's core promise is *watching a silicon work in‑thread*. Today a user often **cannot distinguish "working" from "stuck" from "done."** This section is the priority.

### 1.1 The indicator can hang forever — Critical
`src/components/chat/room-view.tsx:339-361, 439-453, 815-818`
`activeProgress` is cleared only by (a) an explicit `done` frame, (b) a non‑mine message of a "progress‑ending" type arriving, or (c) the local send‑failure path. There is **no staleness timeout**. If a silicon crashes mid‑task, the backend restarts, or the terminal message arrives as a type not in the ending set, the animated "thinking…" line types **forever**. `updatedAt` is recorded but never read.
- **Repro:** silicon enters `executing`, process dies before `done`. User stares at a playful animation indefinitely with no way to tell it's dead.
- **Fix:** add an interval that degrades the line after ~30s of no update ("still working — no update for 45s") and offers a retry affordance after a longer threshold. Re‑use the existing `activities` sweeper pattern (`room-view.tsx:150-164`).

### 1.2 `progress_pct` is on the wire but never rendered — High
`src/lib/types.ts:435` defines `progress_pct` on the progress frame; **no component reads it.** For long tasks a determinate bar/ring is the strongest possible "it's alive and advancing" signal, and it's already being sent.
- **Fix:** render a mono progress bar / ring when `progress_pct != null`.

### 1.3 Streaming can get stuck at "streaming…" — Critical
`src/components/chat/message-bubble.tsx:322, 331` show the streaming pill whenever `!event.is_final`. The only thing that flips it is an `event.final` frame. If that frame is dropped (reconnect gap, coalescing — see §2.1), the bubble reads "streaming…" permanently though the text is complete. Non‑text types with missing `is_final` also wrongly show streaming (`L1`).
- **Fix:** treat a delta‑idle timeout (~5s with no new delta for that event id) as implicit finalization; only show the pill for streamable types (`m.text`/`m.tts`).

### 1.4 The "Silicon finished" completion summary is dead code — High
`src/components/chat/message-bubble.tsx:146-157` renders a finished‑task summary bubble, but `visibleEvents` filters out **all** `m.progress` events (`room-view.tsx:663`), so it can never render. The satisfying "done, here's what I did" moment is lost.
- **Fix:** allow `m.progress` `done` events through the visible filter (or remove the dead branch and design the moment intentionally).

### 1.5 Read receipts: "sent" vs "read" differ only by text color — High
`src/components/chat/message-bubble.tsx:582 vs 584` — `delivered` and `read` both render the same `Checks` glyph, distinguished **only** by `text-foreground` vs default. On a beige canvas this is nearly invisible. The whole point of ✓✓ is a confident "they saw it."
- **Fix:** give `read` a clear distinct treatment (brand color / filled), like every mainstream messenger does.

### 1.6 Progress mis‑attributed in group / multi‑silicon rooms — High
- Activity beacons without `member_handle` resolve to an arbitrary peer; your own typing can show as a peer's (`room-view.tsx:173-186, 469`).
- In a multi‑silicon room, progress for silicon B is suppressed when silicon A's message is the latest (`room-view.tsx:815-818`), and the progress avatar guesses "most recent silicon sender," not who's actually working (`room-view.tsx:819-830`).
- **Fix:** require `member_handle` to attribute; fall back to a generic "someone is typing…"; thread the originating handle onto `ProgressEntry`.

### 1.7 Stale progress survives a reconnect — High
On reconnect the events refetch (`room-view.tsx:329-337`) but `activeProgress` is **not** re‑validated, so a task that finished while the socket was down keeps animating until a new message arrives. There's also no per‑room "working…" hint in the sidebar, so a silicon working in a non‑open room is invisible.

### 1.8 Take‑back vanishes mid‑read with no trace — Medium
`room-view.tsx:431-438` + `662-665`: a taken‑back message is filtered out entirely and disappears while you're reading it (self‑delete shows a "message deleted" tombstone; take‑back doesn't — inconsistent and jarring).
- **Fix:** render a subtle "this message was taken back" tombstone; keep layout stable.

### 1.9 No "↓ new messages" affordance — Medium
When scrolled up, auto‑scroll silently stops; a newly arrived message gives no pill/jump button (`room-view.tsx:484-523`). Users miss new messages while reading history.

### 1.10 Grammar / polish on the activity line — Low
`room-view.tsx:1399-1412` renders "@alice & @bob **is** typing…" (singular verb with multiple actors).

### 1.11 Media‑side progress gaps (cross‑ref §6)
TTS that is still generating shows a permanently static waveform with no "generating…" state (`media-attachment.tsx:140-175`); voice‑note uploads show no progress and can't be cancelled (`composer.tsx:706-708`). Both are "is it working?" gaps in the same family.

**Priority order for this theme:** 1.1 → 1.3 → 1.5 → 1.2 → 1.7 → 1.4 → (media: §6.2, §6.3).

---

## §2 — Real‑time integrity & extreme content

### 2.1 Frame coalescing drops deltas/finals — Critical
`src/lib/ws.ts:113` sets `setLastFrame(f)` per message; both `room-view.tsx:339` and `chat/page.tsx:319` react to the single `lastFrame` **state value**. When two frames arrive in one React tick (a stream burst, a reconnect replay), only the *last* is observed — intermediate frames (a delta, a read receipt, a take‑back) are never processed. The page has a `processedRef` guard against duplicates but **nothing** recovers a coalesced‑away frame; room‑view has no guard at all.
- **Telling detail:** `useChatSocket` already accepts an `onFrame` callback (`ws.ts:11`) — but **neither consumer uses it.** Driving both handlers off a real `onFrame` queue fixes this class of bug outright.
- **Fix:** consume `onFrame` (a queue), not `lastFrame`, so no frame is coalesced away.

### 2.2 Deltas/finals for an unknown event id are silently lost — Critical
`room-view.tsx:396-421`: delta/final/transcript handlers `prev.map(...)` over existing events. If the creating `event` frame was missed (reconnect gap) or arrives after the first delta (out‑of‑order), every delta is a no‑op and the streamed text is gone. The reconnect refetch only runs on the `ready` transition and only covers the latest window.
- **Fix:** buffer deltas keyed by `event_id` and flush on the next `event` for that id, or synthesize a minimal streaming placeholder.

### 2.3 Optimistic dedup can double‑post your own message — High
`room-view.tsx:376-394` matches the echo of my own message by `JSON.stringify(content)` equality. The server enriches content (adds `media_id`, `link_preview`, normalizes whitespace, `forward_from`) → stringify mismatch → the optimistic row isn't replaced → the message appears **twice** until the next refetch. (`onAck` at `715-745` matches reliably on `_clientId`, but the WS echo frequently beats the POST ack and runs this fragile path first.)
- **Fix:** attach a `client_id` to the outgoing payload, echo it back, and match on that.

### 2.4 No rollback on failed delete / un‑react — High
`room-view.tsx:562-586` (delete) and `604-616` (un‑react) optimistically redact, then only `toast.error` on failure — the message **stays** "deleted" in the UI even though the server still has it; it reappears on the next refetch. Confusing.
- **Fix:** snapshot the prior event and restore it in the `catch`.

### 2.5 Auto‑read fires against stale cached state — High
`room-view.tsx:537-541` posts a read for the last received event id, but `events` is seeded from the localStorage snippet cache before the live fetch resolves (`279`), so unread can be cleared for messages the user hasn't actually seen yet.
- **Fix:** gate auto‑read on a `hydrated` flag set after the live fetch resolves.

### 2.6 Read‑receipt comparison assumes uniform ULID ordering — High
`room-view.tsx:422-430` uses string `<=` on event ids. Valid only for fixed‑width Crockford ULIDs; any non‑ULID/variable‑length id (forwarded, UUID fallback) mis‑marks reads.
- **Fix:** compare by array index/position, not string ordering.

### 2.7 No pagination past 100 events — High
`room-view.tsx:285, 332` fetch a single window of 100; there is **no "load older"** affordance. Rooms with long history show only the latest 100, and a reply targeting an older event renders without its quoted context (`message-bubble.tsx:261`).
- **Fix:** add `before`‑cursor pagination (the API already supports `before` at `api.ts:275`).

### 2.8 Extreme content
- **Empty/whitespace message** renders a blank padded bubble (`message-bubble.tsx:659-660`); a silicon can emit empty `m.text`. Guard or suppress.
- **Long unbroken strings** overflow: inline `code` and link anchors lack `break-all`/`overflow-wrap` (`markdown.ts:49, 60-70`); a long token in backticks overflows the bubble.
- **No fenced code‑block support** at all (`markdown.ts` is inline‑only) — a silicon's multi‑line code dump loses monospace/scroll. Notable capability gap for a dev‑facing product.
- **Link safety:** only `https?://` is linkified (good — `javascript:`/`data:` are not), but the URL regex swallows trailing punctuation into the href and doesn't guard against Unicode bidi‑override / homograph hosts that visually spoof the link (`markdown.ts:10,15`). Strip trailing `).,;:!?`; consider punycode warnings.
- **Stuck pending** message shows a clock forever if the send POST never resolves/rejects (no timeout) (`message-bubble.tsx:579-580`).
- **Multi‑file drop** silently keeps only the first file (`room-view.tsx:789-794`).

### 2.9 Memory leak: `processedRef` grows unbounded — Medium
`chat/page.tsx:186, 324-325` adds every event id forever, never pruned.
- **Fix:** LRU cap, or clear on refetch.

---

## §3 — Billing correctness (money deep‑dive)

### 3.1 No checkout idempotency → double charge — P0 (see P0‑4)
`team-panel.tsx:433-455`. A committed‑server / lost‑response retry creates a second payment intent. **Fix:** reuse `pending.payment_id` / pass a stable idempotency token; keep the button disabled until navigation actually begins.

### 3.2 Mixed‑currency totals are summed as one number — High
`team-panel.tsx:467-471`: `unpaidCycles.reduce((s,c)=>s+c.total_cents,0)` adds cents **across currencies** and formats with a single currency. A USD plan with a EUR add‑on cycle yields a silently wrong total.
- **Fix:** group by currency; never sum mixed currencies into one figure.

### 3.3 `open` (unbilled) cycles bundled into payable set — High
Same lines: filtering `status !== "paid"` sweeps in `open` and `charged` cycles, so a user may be asked to pre‑pay an unbilled cycle, or checkout 400s on an `open` id (especially when `data.pending` is absent).
- **Fix:** only `charged`/`failed` are payable in the fallback; prefer `data.pending` exclusively.

### 3.4 `null` day‑counts render as "in null days" — High
`payment-banner.tsx:92, 117, 125`. `daysToPause` can legitimately be `null` (server `grace` state with no pause fields), but it's interpolated into copy and `as number`‑cast. Banner reads "**pause in null days**."
- **Fix:** guard each branch; remove the `as number` casts; fall back to "soon" / hide the count.

### 3.5 `dev_mode` checkout path unhandled — High
`api.teamCheckout` returns `dev_mode?` (`api.ts:254`) but `payOutstanding` only branches on `checkout_url` (`team-panel.tsx:442-448`). In demo/staging the user gets "Checkout unavailable." — a confusing error in front of a prospective client.
- **Fix:** if `r.dev_mode`, show "payment simulated" and refresh the ledger.

### 3.6 `CronsSection` shows the *viewer's* crons, not the team's — High
`team-panel.tsx:631` fetches `crons({ for: "me" })` inside the team panel, mislabeled as the team's crons (`crons · N`). A head viewing Team A sees their own personal crons regardless of team.
- **Fix:** scope the query to the team.

### 3.7 Two date formatters, inconsistent output — Medium
`monthLabel` (`team-panel.tsx:411`) lacks the NaN guard `longDueDate` has (`562`); cycle `due_date` is shown raw ISO (`582`) while the banner shows a nice "1 July, 2026"; `days_left` is shown verbatim from a possibly‑stale snapshot (`554`) while the banner recomputes — two countdowns can disagree on screen simultaneously.
- **Fix:** route all money/date display through one set of helpers; recompute `days_left` from `due_date`.

### 3.8 Plan/addon editing UI is missing entirely — Medium (functional gap)
`setTeamPlan`/`addTeamAddon` exist (`api.ts:240-247`) but no UI calls them. If heads are expected to edit the plan/addons, that capability — and all its cents↔decimal/locale parsing — is unbuilt and untested.

### 3.9 Currency formatting fallbacks — Low
`fmtCents` catch fallback hardcodes `$` regardless of currency (`team-panel.tsx:404-408`); `payment-banner.tsx` uses a different formatter (`Number.toLocaleString`) than the panel's `Intl.NumberFormat` — two money formatters for the same surface. Huge totals have no width clamp (`team-panel.tsx:480`).

### 3.10 Status states under‑differentiated — Low
`CycleCard` maps only `paid→success`, `failed→destructive`; `open` and `charged` look identical (`secondary`). The Pay button label doesn't change for a `paused` team vs a `warning` team.

---

## §4 — Security & privacy

### 4.1 Session replay records chat content **and tokens** — P0 (see P0‑1)
`src/instrumentation-client.ts:34-47`. `maskAllInputs:false`, `maskTextSelector:undefined`, `recordHeaders:true`, `recordBody:true`, `enable_recording_console_log:true`. The in‑repo comment says this is "intentional per product decision" — but the consequence is that **every replay contains private DM content and a liftable live bearer/silicon token**, plus OTP codes (rendered in a custom input the `password` mask doesn't cover). For high‑ticket clients this is a contractual/GDPR exposure, not a polish item.
- **Minimum fix:** strip `Authorization`, `X‑Silicon‑Key`, cookies from recorded headers; set `maskAllInputs:true`; mask chat surfaces (`ph-no-capture` / `maskTextSelector`); gate recording behind consent and document it in the DPA.

### 4.2 Analytics `identify` ships raw PII — High
`src/lib/analytics.ts:26-34` sends `email`, `username`, `name`, `tagline`, `timezone` as PostHog person properties, persisted (`person_profiles:"always"`). No opt‑out exists anywhere (`resetAnalytics` only runs on logout).
- **Fix:** drop/hash email & phone; add an opt‑out in settings (`posthog.opt_out_capturing()`); gate init behind consent.

### 4.3 Dev console reachable by any authed user, in prod — P0 (see P0‑2)
`src/app/dev/layout.tsx` + `auth-guard.tsx`. No `is_staff`, no `NODE_ENV`, no `middleware.ts`, no `robots.txt`/`noindex`. `/dev` exposes a `dev/last-otp` card that brute‑forces 6‑digit codes from a stored hash (`dev/page.tsx:238`), cost summaries (`520-534`), and arbitrary mutations.
- **Fix:** add `middleware.ts` that 404s `/dev/*` unless non‑prod **and** staff; ensure the backend independently gates `/api/v1/dev/*` and `/api/v1/cost/*`; add `noindex`.

### 4.4 Unsanitized server SVG injection — P0 (see P0‑3)
`team-panel.tsx:163`. The DSL structure path correctly sandboxes in an iframe (`253`, with `</script` escaping at `191`); the SVG path injects directly into the app origin. **Fix:** DOMPurify (SVG profile) or render in the same sandboxed iframe. (The avatar `dangerouslySetInnerHTML` at `id-avatar.tsx:44` is **safe** — the SVG is deterministically generated and the seed text never reaches rendered markup, only a numeric hash.)

### 4.5 Settings draft persists whitelist emails in localStorage plaintext — Medium
`team-panel.tsx:951-1016`. Unsaved settings (allowed emails like `ceo@acme.com`) sit in localStorage until save; on a shared machine they persist. Use sessionStorage / clear on unmount.

### 4.6 Hardcoded internal identities shipped to clients — Low
`team-panel.tsx:362-375` hardcodes `"lords"` / `"lords@unlikefraction.com"` to hide an internal member; this also makes member counts disagree with billing seat math.

---

## §5 — Auth & onboarding

(Headline P0s: P0‑5 stranded‑after‑OTP, P0‑6 private‑mode bounce.)

### Critical / High
- **Channel resend can silently spawn a new challenge.** If the server returns `status:"sent"` without echoing `channel`, `chosenChannel` is `""` and resend restarts login with a brand‑new `challenge_id`, abandoning the code the user is typing. `login/page.tsx:97, 115`.
- **Dead `carbonid`/`finalize` path in register** is unreachable but a latent double‑`registerUsername` trap; `suggestCarbonId` is imported unused. `register/page.tsx:242-251, 351-382, 14`.
- **`await generateAndStoreAvatar` blocks entry** in register (contradicts its own "never block" comment); onboarding correctly uses `void`. `register/page.tsx:248` vs `onboarding/page.tsx:214`.
- **Expired flow on refresh mid‑onboarding has no recovery** — email/phone are verified but the client can't restart. `onboarding/page.tsx:179`.

### Phone handling (international clients) — Medium, but hits a real fraction
- **Pasted full number → double country code.** Pasting `+1 415 555 1212` with country US yields `+114155551212`. `login/page.tsx:66`, `register/page.tsx:92`.
- **National trunk `0` never stripped** — UK `07911 123456` → invalid `+44 07911123456`.
- **`+1` mis‑attributed to Barbados**, not US, due to first‑match on shared dial code. `country-codes.ts:24, 206-213`.

### Other
- **Double‑submit on OTP** — `onComplete` + button + Enter can fire `verify` concurrently with the same code (`otp-input.tsx:49`, `login/page.tsx:270-273`).
- **Resend cooldown/lockout not persisted** — refresh on the OTP screen resets it (`use-resend.ts`, `use-cooldown.ts`).
- **`migrateLegacyKeys()` and `sessionStorage` are unguarded** against storage that throws on access (private mode) — can throw at import time (`auth.ts:31`).
- **Network errors show developer‑y text** (`TypeError: Failed to fetch`) to a premium user (`api.ts:116-120`); detect and humanize.
- **Enter in the onboarding name/bio input finalizes the whole flow** — the global Enter handler only exempts `TEXTAREA`, not the `<input>` fields (`onboarding/page.tsx:234-249, 346, 360`).

---

## §6 — Composer, media & voice

### Critical / High
- **6.1 `media.status` (`infected`/`failed`/`pending`) is never checked.** An AV‑flagged or failed‑transcode object fetches fine with a null `download_url`; an image renders `src={null}`, audio has no source, the placeholder spins forever. `media-attachment.tsx:99-139` (status enum at `types.ts:332`). **Fix:** branch on status — flag `infected`, fail `failed`, keep loading for `pending`.
- **6.2 TTS "still generating" spins forever.** Pending TTS media (`status:"pending"`, null URL) renders an inert waveform that never refreshes. `media-attachment.tsx:140-175`. **Fix:** poll/subscribe until ready; show "generating audio…".
- **6.3 Voice upload has no progress and no abort** (the file path has both via `xhrUpload`; voice uses bare `fetch`). A long voice note on slow uplink shows only a spinner, can't be cancelled. `composer.tsx:706-708`.
- **6.4 Failed voice upload leaks the blob URL and loses the recording.** `revokeObjectURL` only on success; the only handle to the audio was that URL, so a transient failure destroys an unrecoverable recording. `composer.tsx:726-730`. **Fix:** revoke in `finally`; retain the blob for retry.
- **6.5 Recording destroyed / mic left hot on unmount.** Mount‑cleanup only sets a flag; it never calls `cleanup()`, so a room switch mid‑record can leak the MediaStream and leave the OS mic indicator on; the peer's "recording…" beacon is never cleared. `voice-recorder.tsx:66-82, 140-146`; composer beacon `938`.
- **6.6 No size/mime/zero‑byte validation before presign.** A 5 GB file is attempted (OOM/hang); a zero‑byte file uploads; HEIC is treated as a renderable image and shows broken. `composer.tsx:333-352`.
- **6.7 Attaching a 2nd file aborts the 1st silently;** multi‑file drag‑drop keeps only one, the rest vanish with no message. `composer.tsx:317-322, 333-395`.
- **6.8 IME (CJK) + Enter sends a half‑composed message.** The Enter handler doesn't check `isComposing`/keyCode 229. `composer.tsx:910-913` (and emoji branch `875`).

### Medium
- Metadata extraction can hang the upload forever (no timeout) → send stays disabled though bytes uploaded (`media-meta.ts:15-55`, `composer.tsx:367`); `computePeaks` decodes the entire file into memory → OOM on long audio (`media-meta.ts:72-74`).
- Multiple voice notes play simultaneously — no single‑active‑player coordination (`silicon-audio.tsx:103-117`).
- Audio scrubber is mouse‑only despite `role="slider"` — no keyboard/`tabIndex`/drag (`silicon-audio.tsx:169-215`); seek before duration known is a silent no‑op (`119-125`).
- No `onPaste` handler — pasting a screenshot does nothing (`composer.tsx`).
- Link‑preview / remote‑browser anchors render unvalidated URL schemes (`link-preview-card.tsx:18`, `remote-browser-card.tsx:101`).
- Delayed‑text queue can double‑send / orphan its optimistic bubble on fast unmount (`composer.tsx:578-590`).

### Low / Polish
- Upload byte label is computed from a rounded percent, not real `loaded` (`composer.tsx:175`); no char cap on drafts (oversized draft silently fails to persist, `407`); recorder waveform flatlines on silence (looks frozen) (`voice-recorder.tsx:262`); emoji `:` trigger fires inside URLs/times like `12:30` (`composer.tsx:838`); `RemoteBrowserCard` ticks every second forever and always says "expires soon" (`remote-browser-card.tsx:24-27, 93`); `formatBytes` duplicated in two files.

---

## §7 — Profile, contacts, settings, sharing & dialogs

### Critical / High
- **7.1 Clipboard copy assumes `navigator.clipboard` and shows false success.** In an insecure context (LAN demo over HTTP) it throws synchronously *or* the promise rejects while "link copied" already showed. Affects every copy button. `share-dialog.tsx:61-68`, `profile-drawer.tsx:153-156`. **Fix:** `try/await/catch` with an `execCommand`/select fallback.
- **7.2 Contacts can never be deleted from the UI.** `api.deleteContact` exists but has zero call sites; a saved contact is permanent. **Fix:** add a destructive "remove contact" action.
- **7.3 Profile name allows empty/whitespace and has no length cap** (tagline caps at 160; name doesn't). A `"   "` name renders blank everywhere; a 5000‑char name breaks the share card and drawer. `profile-editor.tsx:63-75, 151`.
- **7.4 No unsaved‑changes warning.** Editing name/tagline then clicking the always‑present header logo loses changes silently. `profile-editor.tsx` (no `beforeunload`).
- **7.5 Photo upload: no size/type guard** (profile + contact dialogs) — huge/wrong files attempted; `file.type===""` mislabeled as png. `profile-editor.tsx:77-107`, `save-contact-dialog.tsx:52-77`.
- **7.6 `IdAvatar` has no `onError` fallback to the glyph.** Expired presigned S3 URLs (inevitable) show the browser's broken‑image icon instead of the deterministic mark it already computed. `id-avatar.tsx:25-37`.
- **7.7 Forward dialog reports success even on total failure.** Per‑room `.catch` swallows errors, `Promise.all` resolves, and "forwarded to N chats" always fires — user sees N error toasts *and* a success toast, dialog closes. `forward-dialog.tsx:85-97`. **Fix:** `allSettled`, report real counts.

### Medium
- Share card: long **name/ID** still overflow the exported PNG — the recent fix truncated the *link* but not name/carbonId (`share-dialog.tsx:291-308`); no `document.fonts.ready` await before canvas draw → off‑brand fallback font; `/logo.png` via CDN would taint the canvas and break export (`share-dialog.tsx:109-115, 246, 320-328`).
- `c/[carbonId]` lookup failure bounces to `/chat` with no toast/explanation (a stale QR → silent dead end) (`c/[carbonId]/page.tsx:15-33`).
- `profile-editor` mount refetch can clobber in‑progress typing on slow networks (`41-59`); `setName(c.name)` with a null server value → controlled→uncontrolled warning (`48-49`).
- `TimezoneSelect` recomputes & re‑sorts ~400 zones **every second** even while closed (`timezone-select.tsx:32-36`, `use-clock.ts`).
- `new-direct-dialog` treats a whitespace handle as valid (`84-93`).

### Accessibility (cross‑area)
- **TimezoneSelect** and **CountryCodeSelect** listboxes have no `role="listbox"/option"`, no `aria-activedescendant`, no arrow‑key nav — SR/keyboard users must Tab through ~400 / many rows (`timezone-select.tsx:87-145`, `country-code-select.tsx:85-119`).
- OTP input has no `aria-live` error region (wrong code is only a toast) (`otp-input.tsx`); availability marks convey state by icon/color only with no `aria-label` (`register`).
- Onboarding typewriter is a non‑live `<div>` with a `div onClick` skip (no role/keyboard) (`onboarding/page.tsx:264-273`).
- Forward/timezone selected rows convey selection by background only — add `aria-pressed`/`aria-selected`.
- Emoji picker has no roles/live region (`composer.tsx:916`).

---

## §8 — Notifications, sounds, design system & infra

### Notifications
- Browser‑notification click does a **hard `window.location.href`** that cold‑reloads the SPA and drops the socket, instead of a soft route (`notifications.ts:131-135`). A visible‑but‑unfocused tab (second monitor) gets **both** the OS notification and the in‑app toast (`notifications.ts:124`, `chat/page.tsx:356`).
- Store caps at 80, quietly shrinks to 30 under quota pressure with no "showing latest" affordance; unread count can never exceed the kept window even if 200 are truly unread (`notifications.ts:4, 56, 64, 73-78`).
- Cross‑tab `onStorage` reloads on *any* owner's key, not just the current owner's (`notification-center.tsx:43-45`).

### Sounds
- **First beep is dropped** if the AudioContext is still `suspended` (no prior gesture) — `resume()` is fire‑and‑forget and the oscillator is scheduled before it resolves (`sounds.ts:40-59`). No first‑gesture primer.
- No throttle: a burst of 10 incoming messages plays 10 overlapping tones (`chat/page.tsx:328`).
- Audio is coupled to **`prefers-reduced-motion`** — a user who disabled motion for vestibular reasons loses all sound cues (`sounds.ts:36`). Use the separate sound preference key.

### Design system / animation
- **`prefers-reduced-motion` only covers the silicon‑activity indicator.** `page-fade-in`, `stagger-in`, and `notice-fade-in` all run translate/opacity motion unconditionally (`globals.css:215-247` vs `332-338`). WCAG 2.3.3.
- **Root `template.tsx` remounts the whole subtree on every navigation,** re‑firing the 0.32s enter animation (and a `translateY(6px)` CLS nudge) on each room switch (`template.tsx:5-7`, `globals.css:230-232`). Combined with the above, it's motion the user can't escape.
- **Contrast failures (WCAG AA):** `--muted-foreground:#666` on beige ≈ **3.7:1** (used pervasively, incl. 10–11px labels); `--success:#5a9a6b` ≈ **2.9:1** and `--destructive:#b85c5c` ≈ **3.0:1** as text. Darken for text use. (`globals.css:81, 89-92, 347`.)
- Double focus indicator: global `:focus-visible` outline **plus** Button's own ring (`globals.css:138-141`, `button.tsx:13`). Active tab is nearly invisible (active bg vs muted bg ≈ 1.05:1, shadows nulled) (`tabs.tsx:17,32`). Dead `shadow-*`/`rounded-*` classes that the theme nulls litter the primitives (misleading for maintainers). Radix `Avatar` primitive is `rounded-full` (off‑brand) and appears unused.

### Utils / infra
- `relativeTime` returns "Invalid Date" for malformed input and "just now" for clock‑skewed future timestamps; never live‑updates in the open notification list (`utils.ts:8-16`).
- `useNow` interval isn't aligned to the second boundary → up to ~1s display lag and jumps under background throttling (`use-clock.ts:8-12`).
- Dev `EndpointCard` hardcodes `200` on success (even for 204/201) and off‑palette `bg-green-100`/`bg-red-100` (`endpoint-card.tsx:37-45, 73-74`); WS log uses array index as React key on a prepended list (`ws-log.tsx:56`).

---

## Prioritized remediation roadmap

**Sprint 0 — before any client (P0s):**
1. Lock down session replay (mask tokens + chat) and gate `/dev` (staff + non‑prod + noindex). — §4.1, §4.3
2. Sanitize the team‑structure SVG. — §4.4
3. Checkout idempotency. — §3.1
4. Stranded‑after‑OTP + private‑mode register bounce. — P0‑5, P0‑6

**Sprint 1 — "is it working?" (the headline theme):**
5. Progress staleness timeout + recovery affordance. — §1.1
6. Implicit finalization for stuck streams; streamable‑only pill. — §1.3
7. Render `progress_pct`. — §1.2
8. Distinct read‑receipt treatment. — §1.5
9. TTS "generating…" + voice upload progress/abort/retain. — §6.2–§6.4
10. Drive real‑time off `onFrame` (kills frame coalescing) + buffer orphan deltas. — §2.1, §2.2

**Sprint 2 — integrity & money:**
11. `client_id` echo dedup; delete/un‑react rollback; auto‑read gating; pagination. — §2.3–§2.7
12. Mixed‑currency + `open`‑cycle + `null` day‑count + `dev_mode` + team‑cron scope. — §3.2–§3.6

**Sprint 3 — extremes, i18n, a11y polish:**
13. Phone parsing (paste/trunk/NANP), media validation (size/mime/status), IME Enter, clipboard fallback, contact delete, name validation, unsaved‑changes guard. — §5, §6.6, §7
14. Reduced‑motion coverage, template remount, contrast, listbox a11y, sound primer/decouple. — §8

---

## Appendix — extreme‑case test matrix (use as a manual QA checklist)

- **Identity inputs:** empty / `"   "` / 5000‑char / emoji / RTL / homograph in name, username, tagline, contact note, team name.
- **Phone:** paste `+1 415…`, paste `00441234…`, UK `07911…`, a shared `+1` country, leading zeros.
- **OTP:** paste with spaces/dashes, expire mid‑entry, double‑submit, refresh on screen.
- **Network:** kill wifi mid‑login, mid‑upload, mid‑checkout, mid‑send; backend restart while a stream is in flight; backgrounded tab for 10 min then return.
- **Storage:** private/incognito, storage disabled, quota exhausted.
- **Real‑time:** silicon that never sends `done`; dropped `event.final`; burst of 20 messages; take‑back of a message you're reading; reply to an event >100 back; reconnect mid‑stream.
- **Media:** 5 GB file, 0‑byte file, HEIC, animated GIF, very tall image, 30‑min audio, mic permission denied/revoked, multi‑file drop, paste screenshot, two voice notes at once.
- **Money:** mixed‑currency cycles, negative/credit cycle, huge amount, `dev_mode`, double‑click pay, `grace` with no pause date.
- **Invites:** expired, exhausted, disabled, already‑a‑member, wrong code, alphanumeric `?code=`, whitelist subdomain/case.
- **A11y:** keyboard‑only across every dialog/listbox, screen reader on OTP errors & progress, `prefers-reduced-motion` on, 200% zoom, color‑contrast scan.
