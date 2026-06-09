// template.tsx (root) — wraps every page render. Next gives templates a unique
// key per segment, so this subtree remounts on each navigation (that's the
// template contract; a layout wouldn't). To avoid a jarring, unavoidable motion
// on every room switch, the .page-enter animation in globals.css is now
// opacity-only (no translateY CLS nudge) and is fully disabled under
// prefers-reduced-motion. The fade is cheap and never shifts layout, so the
// per-navigation remount no longer reads as motion the user can't escape.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
