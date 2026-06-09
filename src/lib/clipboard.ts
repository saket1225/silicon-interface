// Clipboard copy that never lies about success.
//
// QA §7.1: every copy button went straight through `navigator.clipboard
// .writeText(...)` and then unconditionally toasted "copied". That API is only
// available in a secure context (https / localhost). On a LAN demo served over
// plain HTTP — exactly the setup a prospect might be handed — `navigator
// .clipboard` is `undefined` (throws synchronously) or the returned promise
// rejects, while the success toast has already fired. The user is told the
// link is on their clipboard when it isn't.
//
// `copyText` tries the modern async API first, then falls back to a hidden
// textarea + `document.execCommand("copy")` (which works in insecure contexts
// and older engines), and only resolves `true` when a copy actually happened.
// Callers must branch on the result and show an error on `false`.

export async function copyText(text: string): Promise<boolean> {
  // Preferred path: the async Clipboard API. Guard the whole thing in
  // try/catch because merely *reading* `navigator.clipboard` is fine, but the
  // write rejects (or, in some embedded webviews, throws) when the context is
  // insecure or permission is denied.
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the execCommand fallback */
  }

  // Fallback: stage the text in an off-screen textarea, select it, and ask the
  // document to copy. This is the only thing that works in an insecure context.
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  // Keep it out of view and out of layout flow, but still selectable. Avoid
  // `display:none` / `hidden` — a non-rendered element can't be selected.
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-9999px";
  ta.style.left = "-9999px";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  try {
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    // execCommand is deprecated but remains the only synchronous copy that
    // works without a secure context; returns false when the copy is refused.
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}
