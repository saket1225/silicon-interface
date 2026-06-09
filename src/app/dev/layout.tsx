"use client";

import { AppHeader } from "@/components/app-header";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth";

// QA P0-2 (client side): the dev console must only render for core-team staff.
// `src/proxy.ts` already 404s /dev in production; this is the per-user gate that
// also applies in non-prod/staging. We fail closed — while the carbon profile
// is still loading (or never resolves) we never reveal the console.
function StaffOnly({ children }: { children: React.ReactNode }) {
  const { carbon } = useAuth();
  if (!carbon) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">authenticating…</div>
      </main>
    );
  }
  if (!carbon.is_staff) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">404 — not found</div>
      </main>
    );
  }
  return <>{children}</>;
}

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <StaffOnly>
        <div className="flex min-h-screen flex-col">
          <AppHeader active="dev" />
          <main className="flex-1 bg-background">
            <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
          </main>
        </div>
      </StaffOnly>
    </AuthGuard>
  );
}
