import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
