"use client";

import * as React from "react";
import { Bell, X } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/lib/api";
import type { Announcement } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { printConsoleBanner } from "@/lib/console-banner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ANNOUNCEMENT_EVENT = "silicon-interface:announcement";

function seenKey(ownerId: string) {
  return `silicon-interface:announcements-seen:${encodeURIComponent(ownerId)}`;
}

function loadSeen(ownerId: string): number {
  try {
    return Number(window.localStorage.getItem(seenKey(ownerId)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** The bell — team announcements: product news, new updates. */
export function NotificationCenter({ ownerId }: { ownerId: string }) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Announcement[]>([]);
  const [seen, setSeen] = React.useState(0);

  const unread = items.filter((a) => a.id > seen).length;

  // §4a — one-step scale pop when the unread count *rises*.
  const prevUnread = React.useRef(unread);
  const [bump, setBump] = React.useState(0);
  React.useEffect(() => {
    if (unread > prevUnread.current) setBump((b) => b + 1);
    prevUnread.current = unread;
  }, [unread]);

  const reload = React.useCallback(() => {
    api
      .announcements()
      .then(setItems)
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    setSeen(loadSeen(ownerId));
    reload();
    printConsoleBanner();
  }, [ownerId, reload]);

  // A live announcement frame landed on the socket — fold it in.
  React.useEffect(() => {
    const onAnnouncement = (event: Event) => {
      const a = (event as CustomEvent<Announcement>).detail;
      if (!a?.id) return;
      setItems((prev) => (prev.some((x) => x.id === a.id) ? prev : [a, ...prev]));
    };
    window.addEventListener(ANNOUNCEMENT_EVENT, onAnnouncement);
    return () => window.removeEventListener(ANNOUNCEMENT_EVENT, onAnnouncement);
  }, []);

  // Opening the inbox is seeing it.
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && items.length > 0) {
      const top = items[0].id;
      try {
        window.localStorage.setItem(seenKey(ownerId), String(top));
      } catch {
        /* private mode — fine */
      }
      setSeen(top);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative grid h-9 w-9 place-items-center border text-foreground transition-colors hover:bg-accent"
          aria-label={unread > 0 ? `${unread} unread notifications` : "notifications"}
          title="notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span
              key={bump}
              className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center bg-foreground px-1 font-mono text-[10px] font-semibold leading-none text-background motion-reduce:animate-none"
              style={bump > 0 ? { animation: "unread-bump 0.28s ease-out" } : undefined}
            >
              {unread > 99 ? "99+" : unread}
              <style>{"@keyframes unread-bump{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}"}</style>
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-1.5rem))]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Notifications</div>
            <div className="label-mono mt-0.5">{unread} unread</div>
          </div>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setOpen(false)}
            aria-label="close notifications"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground">
              <span>&gt; inbox is quiet.</span>
              {/* blinking caret — steps(1) hard blink, stilled under reduced-motion */}
              <span
                aria-hidden
                className="ml-0.5 inline-block h-[1em] w-[0.55ch] translate-y-[0.12em] border-r border-current motion-reduce:animate-none"
                style={{ animation: "qi-caret 0.9s steps(1, end) infinite" }}
              />
              <style>{"@keyframes qi-caret{0%,49%{opacity:1}50%,100%{opacity:0}}"}</style>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item) => {
                const isUnread = item.id > seen;
                const inner = (
                  <span className="block min-w-0">
                    <span className="flex min-w-0 items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "label-mono shrink-0 border px-1.5 py-0.5",
                            isUnread && "bg-foreground text-background",
                          )}
                        >
                          {item.kind}
                        </span>
                        <span className="min-w-0 truncate text-sm font-semibold">
                          {item.title}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {relativeTime(item.created_at)}
                      </span>
                    </span>
                    {item.body ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {item.body}
                      </span>
                    ) : null}
                  </span>
                );
                return (
                  <li key={item.id}>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "block px-4 py-3 transition-colors hover:bg-accent",
                          isUnread && "bg-secondary/70",
                        )}
                      >
                        {inner}
                      </a>
                    ) : (
                      <div className={cn("px-4 py-3", isUnread && "bg-secondary/70")}>
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
