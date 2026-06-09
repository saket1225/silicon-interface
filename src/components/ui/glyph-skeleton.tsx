"use client";

import { IdAvatar } from "@/components/profile/id-avatar";

// Delights §9a — loading tiles render a faint MarkSystem glyph + bars instead of
// a generic shimmer, so even the skeleton is on-brand.
export function GlyphSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul aria-hidden className="animate-pulse motion-reduce:animate-none">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-3 pl-6 pr-4">
          <IdAvatar
            seed={`skeleton-${i}`}
            size={36}
            family={i % 2 ? "silicon" : "carbon"}
            className="opacity-20"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/3 bg-foreground/10" />
            <div className="h-2 w-1/2 bg-foreground/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}
