# Delights — detailed implementation plan

One commit per feature. Status legend: ☐ todo · ☑ done · ⤬ already shipped in QA work · ⊘ skipped (why).

Brand invariants for every item: warm beige (`#ede8e0`) canvas, near-black ink,
JetBrains Mono accents, **0 radius**, **flat (no shadows)**, hairline borders,
terminal/ASCII soul, lowercase, `>`-prefixed system lines, no exclamation marks.

---

## §0 — ASCII avatars (flagship)

### 0a. "Silicon Treatment" — ASCII-ify uploaded profile pictures ☐
**Scope (per user):** ONLY uploaded **profile pictures** for **carbons and silicons**.
NOT chat images, NOT team logos. Use the Python lib **ascii-magic**
(https://pypi.org/project/ascii-magic/). **Maintain the colors.**
- **Backend (glass):**
  - Add `ascii-magic` + `Pillow` to deps.
  - `apps/media/asciify.py`: `asciify_to_svg(image_bytes, columns=56) -> bytes`.
    Uses `ascii_magic.AsciiArt.from_pillow_image(img).to_ascii(monochrome=False)`,
    parses the 24-bit ANSI color codes into a (char,color) grid, emits a crisp
    **colored SVG** (beige bg, monospace `<tspan fill>` per cell). SVG so it
    stays sharp at every avatar size (28–132px) and renders in an `<img>`.
  - Store as a derived asset: new `profile_ascii_key` CharField on `Carbon` and
    `Silicon` (+ migration); serializers expose `profile_ascii_url`.
  - Hook: when `profile_photo_key` is set (carbon `PATCH /me`, silicon photo
    update), fetch the image bytes, asciify, store the SVG asset, set
    `profile_ascii_key`. Guard so it no-ops gracefully when bytes are
    unavailable (dev mode / no S3).
  - **Test:** unit-test `asciify_to_svg` on a synthetic Pillow image → valid
    colored SVG with expected dims (no S3 needed).
- **Frontend:** `IdAvatar` gains `asciiSrc?`; prefers `profile_ascii_url` over the
  raw photo when present. Thread `profile_ascii_url` through the peer/contact/
  carbon projections that feed avatars.

### 0b. Glyph ASCII mode ☐
Render the generated MarkSystem mark itself as ASCII. `glyphAscii(text, opts)`
sibling to `glyphSvg` in `glyph.ts`: map `0→" " 1→"█" 2/3/4/5→◤◥◢◣`, wrap in a
`<pre class="font-mono leading-none">`. `IdAvatar` gains `variant?: "mark"|"ascii"`.

### Avatar follow-ons
- **0c. Identity reveal on first render** ☐ — new avatars "compile" ring-by-ring
  (domain is radius-sorted), each ring fading 40ms after the last. Respect
  reduced-motion. Used on signup + first appearance.
- **0d. Re-roll your mark** ☐ — `fillBias`/`parity`/`centerType` vary the mark;
  a seed-salt re-roll button in the profile editor + `/seed` composer command.
- **0e. Glyph breathing on hover** ☐ — hover animates a few cells with the
  existing `silicon-core-step` keyframe.
- **0f. Team split-mark handshake** ☐ — on team-panel open, slide the two halves
  together.
- **0g. Copy mark as text** ☐ — right-click an avatar → ASCII grid to clipboard.
- **0h. Long-press easter egg** ☐ — long-press any avatar → raw 7×7 grid as
  ASCII in a mono tooltip.

## §1 — Progress / "it's working"
- **Typewriter progress lines** ⤬ (QA §1) · **Determinate compile bar** ⤬ (QA §1.2)
  · **Read-receipt distinct** ⤬ (QA §1.5).
- **1a. ASCII spinner** ☐ — shared `<Spinner>` braille cycle `⠋⠙⠹⠸⠼⠴⠦⠧`; replace
  `CircleNotch` usages.
- **1b. Completion flourish** ☐ — wire the (dead) "Silicon finished" summary
  bubble so a finished task lands with an inline summary + single sparkle.
- **1c. Read-receipt "fill"** ☐ — animate tick hollow→solid on receipt.
- **1d. Sidebar "working…" shimmer** ☐ — faint pulse on rooms with a mid-task
  silicon even when not open.

## §2 — Empty states (terminal prompts)
- **2a. Quiet-inbox prompt** ☐ — `> inbox is quiet.` + blinking caret.
- **2b. First-contact welcome** ☐ — new DM shows carbon+silicon split marks
  facing each other with `say hi →`.
- **2c. Search miss** ☐ — `no events match "<q>"` as a grep line.
- **2d. WS log heartbeat** ☐ — `waiting for frames…` + pulsing `▮`.
- **2e. Boot sequence** ☐ — auth/loading prints `silicon-interface · linking
  carbons + silicons…` line-by-line.

## §3 — Sound & haptics
- Sound theme in settings + decouple from reduced-motion ⤬ (QA §8).
- **3a. Carbon vs silicon tones** ☐ — silicons reply with a square/triangle
  timbre vs carbons' sine (`playReceivedSilicon`).
- **3b. Two-stage send** ☐ — send chirp + a confirm tick on server ack.
- **3c. Mobile haptics** ☐ — `navigator.vibrate(8)` on send / record-start,
  gated by the sound preference.

## §4 — Micro-animations & hover
- **4a. Unread badge bump** ☐ — one-step scale pop when count rises.
- **4b. Hover-scrub timestamps** ☐ — hovering "2m" crossfades to absolute time.
- **4c. Copy flash** ☐ — brief invert flash on a bubble when copied.
- **4d. Tab as carriage return** ☐ — `TabsContent` slides in from left.
- **4e. Dialog "expand from a line"** ☐ — dialogs grow from a 1px hairline.
- **4f. Available-ID success pop** ☐ — green check pops + field border flashes
  on Carbon-ID available.

## §5 — Copy, voice & tone
- **5a. Tone guide** ☐ — `TONE.md` doc codifying the voice.
- **5b. `stderr:` errors** ☐ — error toasts as mono `stderr: <message>`.
- **5c. Carbon/silicon-aware microcopy** ☐ — "silicon is thinking…" vs "alice is
  typing…".
- **5d. Humanized overflows** ☐ — warm copy for network-error & expired-code
  states (anchor: the "take a breather ☕" lockout line).

## §6 — Onboarding moments
- **6a. "Generating your mark"** ☐ — show the ring-by-ring compile (0c) with
  `> deriving your mark from carbon_id…` then a snap into place.
- **6b. First message ever** ☐ — `> first contact established` system note.
- **6c. Permission priming** ☐ — one-line mono explainer before the OS
  notification prompt.
- **6d. "We brought your email over"** ☐ — tiny confirmation that login carried
  the email so it feels intentional.

## §7 — Terminal power features & easter eggs
- **7a. `/` command palette** ☐ — `/shrug /me /seed /dnd /clear /theme` in the
  composer (parser + per-command).
- **7b. `Cmd+K` jump menu** ☐ — fuzzy jump to rooms / people / dev, mono-styled.
- **7c. `j`/`k` room nav, Enter to open** ☐ — vim list nav.
- **7d. `Shift+?` keymap cheatsheet** ☐ — mono shortcut table.
- **7e. `sudo make me a sandwich`** ☐ — mono `permission denied` toast.
- **7f. Console banner** ☐ — ASCII banner + `carbon · <handle>` on load.
- **7g. Logo `uptime`** ☐ — hovering the logo shows session uptime in mono.
- **7h. Glyph "matrix rain" on 404** ☐ — falling MarkSystem cells on the
  not-found / fatal screen.

## §8 — Sharing & identity
- **8a. ASCII mark on the share card** ☐ — render the recipient's ASCII mark in
  monospace beside the QR on `buildShareCard`.
- **8b. Invite QR codes** ☐ — QR for team/silicon join links in the invite dialog.
- **8c. Seat-usage meter** ☐ — invite cards show `uses/max_uses` as a mono bar.
- **8d. Copy-code-only button** ☐ — separate from copy-link.
- **8e. "Paid up" beat** ☐ — `> balance cleared` on returning from checkout to a
  zero balance.

## §9 — Loading skeletons
- **9a. Glyph-grid skeletons** ☐ — loading tiles render a faint random
  MarkSystem grid that resolves into the real avatar/content.
- **9b. Sidebar cache "warm" indicator** ☐ — 1px top progress hairline during a
  background refresh.

---

### Execution order
1. §0a flagship (backend+frontend) → 0b glyph ascii → avatar follow-ons.
2. Cheap pervasive wins: §2 empty states, §5 copy/tone, §1a spinner, §4 micro-anims.
3. §3 sound, §6 onboarding, §8 sharing, §9 skeletons.
4. §7 power features (Cmd+K, palette) + easter eggs last (largest).
