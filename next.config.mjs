/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**"
      }
    ]
  },
  experimental: {
    serverComponentsExternalPackages: ["sharp"],
    // Cache the RSC payload of previously-visited pages for 30 seconds.
    // Tapping back and forth between tabs is instant within that window.
    // Below 30s, pages always re-render. Above 30s, stale data becomes
    // visible. 30 is the sweet spot for a social app.
    staleTimes: {
      dynamic: 30,
      static: 180
    },
    // Small bundle win: tree-shake lucide/react-icons if ever added.
    optimizePackageImports: ["date-fns"]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" }
        ]
      },
      {
        // Long-cache everything in /_next/static (chunks are content-hashed)
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        // Cache avatars and icons for a year
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