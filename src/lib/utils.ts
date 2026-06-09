import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function relativeTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  // Guard malformed input: `new Date("nonsense").getTime()` is NaN, which used
  // to fall through to `d.toLocaleDateString()` → "Invalid Date".
  const ms = d.getTime();
  if (Number.isNaN(ms)) return "";
  // Guard clock skew: a timestamp slightly in the future (server/client clock
  // drift) produced a negative diff that still satisfied `diff < 60` and read
  // "just now" — acceptable — but a larger future drift fell through to a date.
  // Clamp non-positive diffs to "just now" so the future never renders oddly.
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString();
}

export function shortId(id: string, head = 6, tail = 4): string {
  if (!id || id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}
