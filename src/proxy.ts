// Server-side gate for the developer console (`/dev/*`).
//
// QA P0-2: `/dev` was reachable by ANY authenticated user, in production, with
// no `noindex`. It can read cost data, brute-force OTP codes, and mutate state.
// This proxy is the network-boundary defence:
//
//   1. In production builds `/dev/*` returns 404 unless `ENABLE_DEV_CONSOLE=1`
//      is explicitly set (so staging/demo can opt in). The console simply does
//      not exist for real customers.
//   2. `/dev/*` is always tagged `noindex, nofollow` so it can never be crawled.
//
// NOTE — defence in depth: the proxy runs server-side and cannot see the
// localStorage auth token, so it cannot do a per-user `is_staff` check. That
// check must live (a) client-side once the API exposes `is_staff` on the
// Carbon, and (b) — authoritatively — on the backend, which must independently
// gate `/api/v1/dev/*` and `/api/v1/cost/*`. This proxy is necessary but not
// sufficient on its own.
import { NextResponse } from "next/server";

const DEV_CONSOLE_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_CONSOLE === "1";

// The matcher below scopes this to `/dev/*`, so we don't need to inspect the
// request path.
export function proxy() {
  if (!DEV_CONSOLE_ENABLED) {
    // Pretend the route doesn't exist for everyone who isn't explicitly opted in.
    return new NextResponse(null, {
      status: 404,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: "/dev/:path*",
};
