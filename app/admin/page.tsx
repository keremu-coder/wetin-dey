import { notFound } from "next/navigation";
import { ModerationQueue } from "@/components/ModerationQueue";
import { getSessionId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { stripSession, type Report } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const sessionId = await getSessionId();
  const db = createServiceClient();
  if (!sessionId) notFound();
  const { data: admin } = await db.from("admins").select("session_id").eq("session_id", sessionId).maybeSingle();
  if (!admin) notFound();

  const { data: unreviewed } = await db
    .from("reports")
    .select("*")
    .eq("reviewed", false)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: flags } = await db
    .from("flags")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: disputes } = await db
    .from("disputes")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: actions } = await db
    .from("moderation_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const flagged = [];
  for (const flag of flags ?? []) {
    const { data: report } = await db.from("reports").select("*").eq("id", flag.report_id).maybeSingle();
    flagged.push({
      flag,
      report: report ? (stripSession(report as Report) as Report) : null
    });
  }

  const disputeRows = [];
  for (const dispute of disputes ?? []) {
    const { data: report } = await db.from("reports").select("*").eq("id", dispute.report_id).maybeSingle();
    disputeRows.push({
      dispute,
      report: report ? (stripSession(report as Report) as Report) : null
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-3xl">Moderation</h1>
      <p className="mt-2 text-sm text-ink/70">Reports no dey delete. Hide na un-review. Dispute na label.</p>
      <div className="mt-6">
        <ModerationQueue
          unreviewed={((unreviewed ?? []) as Report[]).map((r) => stripSession(r) as Report)}
          flagged={flagged}
          disputes={disputeRows}
          actions={actions ?? []}
        />
      </div>
    </main>
  );
}
