/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/reports/**": ["./node_modules/ffmpeg-static/**"]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**"
      }
    ]
  },
  serverExternalPackages: ["sharp", "ffmpeg-static"],
  experimental: {
    staleTimes: {
      dynamic: 300,
      static: 600
    }
  },
  async headers() {
    // No 'unsafe-eval' — Next 14 production builds don't need it.
    // 'unsafe-inline' is still required because Next injects a small
    // inline hydration script. Replacing that with nonces is a
    // separate project (needs a middleware rewrite).
    // CSP is set by middleware.ts (needs a per-request nonce).

    const permissions = [
      "camera=(self)",
      "microphone=(self)",
      "geolocation=(self)",
      "payment=()",
      "usb=()",
      "interest-cohort=()"
    ].join(", ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload"
          },
          { key: "Permissions-Policy", value: permissions },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-DNS-Prefetch-Control", value: "on" }
        ]
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        source: "/icon-192.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        source: "/icon-512.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      }
    ];
  }
};

export default nextConfig;