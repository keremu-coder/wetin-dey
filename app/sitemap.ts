import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";

const BASE_URL = "https://wetindey.app";
const REPORT_LIMIT = 5000;

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * Public sitemap. Includes static marketing/legal pages plus every
 * report that has passed moderation:
 *
 *   reviewed = true  → the SELECT policy allows anonymous reads
 *   held = false     → not held for moderator review
 *
 * Private surfaces (admin, settings, inbox, notifications, api) are
 * excluded via robots.ts, not here — sitemaps should list what SHOULD
 * be indexed, robots.txt should block what should NOT.
 *
 * On any DB error we fall back to static entries only. A failed sitemap
 * build must not 500 the whole site.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1.0
    },
    {
      url: `${BASE_URL}/talk`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9
    },
    {
      url: `${BASE_URL}/community`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9
    },
    {
      url: `${BASE_URL}/communities`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7
    },
    {
      url: `${BASE_URL}/guidelines`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3
    }
  ];

  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("reports")
      .select("id, created_at")
      .eq("reviewed", true)
      .eq("held", false)
      .order("created_at", { ascending: false })
      .limit(REPORT_LIMIT);

    if (error || !data) return staticEntries;

    const reportEntries: MetadataRoute.Sitemap = data.map((r) => ({
      url: `${BASE_URL}/r/${r.id}`,
      lastModified: r.created_at ? new Date(r.created_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.6
    }));

    return [...staticEntries, ...reportEntries];
  } catch {
    return staticEntries;
  }
}