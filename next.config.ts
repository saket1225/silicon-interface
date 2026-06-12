import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Desktop (Electron) builds run the bundled Next server inside the app, so
  // they need `output: "standalone"`. Web builds are untouched — only the
  // desktop build script (see desktop/) sets NEXT_OUTPUT.
  ...(process.env.NEXT_OUTPUT === "standalone"
    ? {
        output: "standalone" as const,
        // The desktop app serves itself from localhost, and sharp's win/linux
        // binaries aren't traced when building on a Mac — skip optimization.
        images: { unoptimized: true },
      }
    : {}),
  // Reverse-proxy PostHog ingestion through our own origin (/ingest) so the
  // SDK isn't blocked by ad/tracker blockers and first-party cookies apply.
  // Targets are US Cloud. The SDK is pointed at `/ingest` in
  // instrumentation-client.ts.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // PostHog's API expects trailing-slash requests to pass through untouched.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
