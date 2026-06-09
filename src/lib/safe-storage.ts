// Storage that never throws.
//
// QA P0-6: in private/incognito mode (notably Safari) `sessionStorage.setItem`
// can throw, or storage can be disabled entirely. The register → onboarding
// handoff stashes the flow id in sessionStorage; if the write throws, the
// phone is verified server-side but onboarding can't read the flow id and
// bounces straight back to register — forever.
//
// This wrapper falls back to an in-module Map. Because client-side navigations
// in the SPA don't reload the page, that Map persists across the
// register → onboarding transition, so the handoff survives even when
// sessionStorage is unavailable.

const memory = new Map<string, string>();

function store(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const safeSession = {
  get(key: string): string | null {
    try {
      const v = store()?.getItem(key);
      if (v != null) return v;
    } catch {
      /* fall through to memory */
    }
    return memory.has(key) ? (memory.get(key) as string) : null;
  },
  set(key: string, value: string): void {
    memory.set(key, value);
    try {
      store()?.setItem(key, value);
    } catch {
      /* memory holds it for the rest of the session */
    }
  },
  remove(key: string): void {
    memory.delete(key);
    try {
      store()?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
