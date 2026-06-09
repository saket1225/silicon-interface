"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { authStore } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = React.useState(false);
  React.useEffect(() => {
    if (authStore.getAccess() || authStore.getSiliconKey()) {
      setOk(true);
      // P0-5: backfill the carbon profile when we hold a session token but have
      // no cached profile — e.g. login navigated here before its own me()
      // resolved. Without this the app would run with a null carbon.
      if (authStore.getAccess() && !authStore.getCarbon()) {
        api
          .me()
          .then((me) => authStore.setCarbon(me))
          .catch(() => undefined);
      }
    } else {
      router.replace("/auth/login");
    }
  }, [router]);
  if (!ok) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">authenticating…</div>
      </main>
    );
  }
  return <>{children}</>;
}
