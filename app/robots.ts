import type { MetadataRoute } from "next";

const BASE_URL = "https://9jawatindey.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Moderation + admin surface — never index.
          "/admin",
          "/admin/*",
          // Private account surface.
          "/settings",
          "/settings/*",
          "/inbox",
          "/inbox/*",
          "/notifications",
          // Auth flow.
          "/signin",
          "/join",
          "/forgot-password",
          "/reset-password",
          // API routes — no value to crawlers, and avoid any accidental
          // data exposure via JSON endpoints.
          "/api/",
          // Fullscreen chat — content is transient and often private.
          "/c/*/chat"
        ]
      }
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL
  };
}