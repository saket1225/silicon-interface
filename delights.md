# Silicon Interface — Delights

> Small, on‑brand touches that make the interface feel *alive*, *crafted*, and
> unmistakably **siliconfriendly**. None of these are required for correctness —
> they're the difference between "very good software" and "software people
> screenshot and show their friends."

**The aesthetic we're amplifying:** warm beige canvas, near‑black ink, JetBrains
Mono accents, sharp corners (0 radius), flat (no shadows), hairline borders, a
terminal / ASCII soul. Every delight below should feel like it was *compiled*,
not designed — precise, monospace, deterministic, a little playful.

Each idea lists **what it does**, **where it slots in**, a rough **approach**, and
**effort** (S = hours, M = a day or two, L = a few days). Items marked ⭐ are the
highest delight‑per‑effort.

---

## 0. The flagship: ASCII profile pictures ⭐⭐

*This is the founder's idea, and it's a great one — it makes every avatar in the
product feel native to the silicon world, and it's a strong brand signature.*

### The whole avatar system already routes through one place

Every avatar — sidebar, header, drawer, profile, share card, forward dialog,
contact dialog — renders through **`IdAvatar`** (`src/components/profile/id-avatar.tsx`),
which falls back to the deterministic **MarkSystem** glyph (`src/lib/glyph.ts`)
when there's no photo. That single chokepoint means *one* renderer change
propagates everywhere.

And `glyph.ts` is already perfect raw material: `buildGrid()` produces an `n×n`
matrix of cell‑types `0–5` (solid, two triangle variants, sparse, alt‑checker,
gap), seeded deterministically (FNV → mulberry32) and symmetrized per family
(carbon = orthogonal, silicon = diagonal, team = full‑8 + split light/dark).

### Two complementary features here

**(a) "Silicon Treatment" for uploaded photos** — *the founder's exact idea.*
Any uploaded pfp is dithered/quantized into an ASCII‑block portrait in the brand's
beige + ink, so **every** photo carries the terminal look.
- **Where:** an `asciify()` step at upload time (`profile-editor.tsx` / `save-contact-dialog.tsx` upload handlers), plus a render branch in `IdAvatar`.
- **Approach:** draw the image to an offscreen `<canvas>`, downsample to ~32×32, map per‑cell luminance to a ramp (` .:-=+*#%@` or block elements `░▒▓█`), render as monospace text (or pre‑rasterize to a small SVG for crispness). Store the char‑grid alongside the photo so it's computed once. Offer an intensity slider (light grayscale ↔ hard 1‑bit threshold).
- **Effort:** L. Highest‑visibility delight in the product.

**(b) Glyph ASCII mode** — render the *generated* MarkSystem mark itself as ASCII.
Since the grid is already cells `0–5`, this is a near drop‑in beside `cellMarkup()`:
map `0→" "`, `1→"█"`, and the four triangles `2/3/4/5 → ◤ ◥ ◢ ◣` (or `/ \`),
wrap in a `<pre>` with `font-mono`, `line-height:1`.
- **Where:** add a `glyphAscii(text, opts)` sibling to `glyphSvg` in `glyph.ts`; `IdAvatar` gains `variant?: "mark" | "ascii"`.
- **Why it's nice:** the ASCII mark and the SVG mark share the exact same grid, so a user's two representations are visually consistent — same identity, different render target.
- **Effort:** M.

### Avatar follow‑ons

- **⭐ Identity reveal on first render** — new avatars "compile" ring‑by‑ring (the domain is already radius‑sorted in `glyph.ts:73`), each ring fading in 40ms after the last. Use on signup and first appearance. *Effort: M.*
- **Re‑roll your mark** — `fillBias`/`parity`/`centerType` already vary the mark; let a user re‑roll with a seed‑salt until they like it. A `/seed` composer command or a button in the profile editor. *Effort: M.*
- **Glyph breathing on hover** — on avatar hover, animate a few cells with the existing `silicon-core-step` scale keyframe (`globals.css:322`). *Effort: S.*
- **Team split‑mark handshake** — teams render split light/dark (`glyph.ts:216`); on team‑panel open, slide the two halves together. *Effort: S.*
- **"Copy mark as text"** — right‑click an avatar → the ASCII grid lands on the clipboard. Perfect for pasting your silicon identity into a terminal/README. *Effort: M.*
- **Long‑press easter egg** — long‑press any avatar to peek the raw 7×7 grid as ASCII in a tiny mono tooltip. *Effort: M.*

---

## 1. Progress & "it's working" moments

*(These double as fixes for the QA report's biggest theme — making delight and
clarity the same feature.)*

- **⭐ Typewriter progress lines** — render `m.progress` states as terminal output: `> reading file…`, `> executing…`, `> searching the web…`, each typed out with the caret already defined in `globals.css:293`. Turns a vague spinner into a narrated, legible "here's what I'm doing." *Where:* progress renderer in `room-view.tsx`. *Effort: S.*
- **⭐ Determinate "compile bar"** — when `progress_pct` is present (it's already on the wire, `types.ts:435`, and currently unused), show a fixed‑width mono bar `[####------] 42%`. Determinate progress is the single strongest "alive and advancing" signal. *Effort: S.*
- **ASCII spinner** — replace `CircleNotch` with a braille cycle `⠋⠙⠹⠸⠼⠴⠦⠧` or a block sweep, as a shared `<Spinner>`. *Effort: S.*
- **Completion flourish** — wire up the (currently dead) "Silicon finished" summary bubble (`message-bubble.tsx:146-157`) so a finished task lands with a satisfying inline summary + a single sparkle, then settles. *Effort: M.*
- **Read‑receipt "fill"** — when a receipt arrives, animate the tick from hollow → solid with a one‑cell glyph wipe. Makes "they saw it" feel earned. *Effort: S.*
- **Sidebar "working…" shimmer** — a faint pulse on rooms where a silicon is mid‑task even when not open, so you can feel work happening across threads. *Effort: M.*

---

## 2. Empty states (terminal prompts, not blank space)

- **⭐ Quiet‑inbox prompt** — "No notifications yet" becomes `> inbox is quiet.` with a blinking caret. (`notification-center.tsx:135`.) *Effort: S.*
- **First‑contact welcome** — a brand‑new DM shows the carbon + silicon split marks facing each other with `say hi →` between them. (`chat/page.tsx` welcome pane.) *Effort: M.*
- **Search miss** — `no events match "<q>"` rendered as a grep line. *Effort: S.*
- **WS log heartbeat** — "waiting for frames…" gets a faint pulsing `▮` cursor (`ws-log.tsx:52`). *Effort: S.*
- **Boot sequence** — the auth/loading screen prints `silicon-interface · linking carbons + silicons…` line‑by‑line before content lands (`auth-guard.tsx` loading branch). *Effort: S.*

---

## 3. Sound & haptics

- **⭐ Carbon vs silicon tones** — silicons reply with a subtly more synthetic timbre (square/triangle wave) vs carbons' sine, so you *hear who's talking* without looking. (`sounds.ts` → `playReceivedSilicon`.) *Effort: S.*
- **Two‑stage send** — current send is one chirp; add a tiny confirm tick when the server acks (`room-view.tsx` ack handler). The "sent → delivered" feel in sound. *Effort: M.*
- **Mobile haptics** — `navigator.vibrate(8)` on send / record‑start, gated by the sound preference. *Effort: S.*
- **Sound theme in settings** — surface the existing `silicon-interface:sounds` key with a "test" button that plays both tones, and **decouple it from `prefers-reduced-motion`** (today a motion preference silences audio — see QA §8). *Effort: S.*

---

## 4. Micro‑animations & hover

- **Unread badge bump** — a one‑step scale pop when the count rises (`notification-center.tsx:79`). *Effort: S.*
- **Hover‑scrub timestamps** — hovering a relative time ("2m") crossfades to the absolute time inline. *Effort: M.*
- **Copy flash** — a brief invert flash on a message bubble when you copy it (the selection theming already exists at `globals.css:132`). *Effort: S.*
- **Tab as carriage return** — `TabsContent` slides in from the left like a fresh terminal line instead of a fade (`tabs.tsx`). *Effort: S.*
- **Dialog "expand from a line"** — dialogs grow from a 1px horizontal hairline to full height — very on‑brand for a flat/sharp system (`dialog.tsx`). *Effort: M.*
- **Available‑ID success pop** — when a Carbon ID becomes available during signup, the green check pops and the field border flashes success (`register`/`onboarding`). *Effort: S.*

---

## 5. Copy, voice & tone

- **⭐ Tone guide** — codify what's already emerging: lowercase, mono accents, no exclamation marks, system lines prefixed with `>`. One short doc keeps every new string on‑brand. *Effort: S (doc), ongoing.*
- **`stderr:` errors** — surface API/error toasts as mono `stderr: <message>` instead of generic red. (`endpoint-card.tsx:82`, global toasts.) *Effort: S.*
- **Carbon/silicon‑aware microcopy** — "silicon is thinking…" vs "alice is typing…", reusing the activity line. *Effort: S.*
- **Humanized overflows** — keep the breather copy in the same warm voice everywhere (the "take a breather ☕" lockout line in `resend-row.tsx:18` is a great anchor); extend it to network‑error and expired‑code states (which currently show raw errors). *Effort: S.*

---

## 6. Onboarding moments

- **⭐ "Generating your mark"** — `generateAndStoreAvatar` runs silently today (`avatar.ts:16`). Show the ring‑by‑ring compile (delight §0) with `> deriving your mark from carbon_id…` then a satisfying snap into place. A memorable first 5 seconds. *Effort: M.*
- **First message ever** — instead of confetti, drop a single mono system note: `> first contact established`. *Effort: S.*
- **Permission priming** — before the cold OS notification prompt (`notification-center.tsx:199`), show a one‑line mono explainer so the browser dialog isn't a surprise. (Also lifts grant rates.) *Effort: S.*
- **"We brought your email over"** — the login pivot already carries email/phone so you never re‑type (`login/page.tsx:84-89`); surface a tiny confirmation so the magic feels intentional, not spooky. *Effort: S.*

---

## 7. Terminal‑flavored power features & easter eggs

- **⭐ `/` command palette in the composer** — `/shrug`, `/me`, `/seed` (re‑roll mark), `/dnd` (mute 1h), `/clear`, `/theme`. The terminal vibe made literal. *Effort: L (S per command after the parser).* 
- **⭐ `Cmd+K` jump menu** — fuzzy jump to rooms / people / dev, mono‑styled. The single most loved power feature in any chat app. *Effort: L.*
- **`j`/`k` room navigation, `Enter` to open** — vim‑style list nav (the Esc handler already exists at `chat/page.tsx:425`). *Effort: L.*
- **`Shift+?` keymap cheatsheet** — a mono table of shortcuts. *Effort: M.*
- **`sudo make me a sandwich`** in the composer → a mono `permission denied` toast. *Effort: S.*
- **Console banner** — `console.log` a brand ASCII banner + `carbon · <handle>` on load, for the devtools‑opening crowd. *Effort: S.*
- **Logo `uptime`** — hovering the logo shows session uptime in mono (pair with the `useNow` boundary‑align fix). *Effort: S.*
- **Glyph "matrix rain"** on the 404 / fatal‑error screen — falling MarkSystem cells. Turns a dead end into a screenshot. *Effort: M.*

---

## 8. Sharing & identity (lean into the brand)

- **⭐ ASCII mark on the share card** — `buildShareCard` (`share-dialog.tsx`) already draws a QR + handle; render the recipient's ASCII mark in monospace beside it for a signature "terminal‑poster" look. *Effort: M.*
- **Invite QR codes** — generate a QR for team/silicon join links in the invite dialog (today it's copy‑link only). Great for in‑person onboarding. *Effort: S.*
- **Seat‑usage meter** — invite cards show `uses / max_uses` as a mono progress bar instead of a bare "seats left" number (`team-panel.tsx:818`). *Effort: S.*
- **Copy‑code‑only button** — separate from copy‑link, since the OTP‑style code is what people read aloud. *Effort: S.*
- **"Paid up" beat** — when the outstanding balance hits zero after returning from checkout, a brief mono `> balance cleared` confirmation instead of a silent ledger. *Effort: S.*

---

## 9. Loading skeletons with personality

- **Glyph‑grid skeletons** — instead of generic shimmer, loading tiles render a faint *random* MarkSystem grid that resolves into the real avatar/content. The skeleton itself is on‑brand. *Where:* room‑list / profile skeletons. *Effort: M.*
- **Sidebar cache "warm" indicator** — the app already serves cached rooms instantly then refetches; a 1px top progress hairline during the background refresh tells power users the list is reconciling. *Effort: S.*

---

## Suggested first batch

If you want a tight, high‑impact starter set that ships in ~a week and reads as
"this product is different":

1. **ASCII pfp Silicon Treatment** (§0a) — the flagship. ⭐⭐
2. **Typewriter progress + compile bar** (§1) — delight *and* the QA win. ⭐
3. **Carbon vs silicon sound tones** (§3) — tiny, memorable. ⭐
4. **`Cmd+K` jump menu** (§7) — the power‑user hook. ⭐
5. **Terminal empty states + `stderr:` errors** (§2, §5) — cheap, pervasive, on‑brand. ⭐
6. **"Generating your mark" onboarding moment** (§6) — owns the first impression. ⭐

Every one of these reinforces the same idea: *you're not in a chat app, you're at
a friendly terminal where carbons and silicons meet.* That's the feeling worth
selling.
