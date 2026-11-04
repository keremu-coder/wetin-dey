import { getBlockedIds } from "@/lib/blocks";
import type { createServiceClient } from "@/lib/supabase/server";

export type NotificationKind = "reply" | "mention" | "comment";
export type NotificationTargetType = "community_message" | "report";

export type CreateNotificationArgs = {
  recipientId: string;
  actorId: string;
  kind: NotificationKind;
  targetType: NotificationTargetType;
  targetId: string;
  preview: string | null;
};

/**
 * Create one notification row, with two safety filters applied:
 *
 *   1. Never notify yourself. The recipient and the actor must differ.
 *      This catches self-replies, self-mentions, and commenting on your
 *      own report.
 *
 *   2. Never notify someone who has blocked the actor. Uses the same
 *      bidirectional block check the feed and comments use. A block
 *      hides their content AND stops their notifications.
 *
 * Best-effort: any DB error is swallowed and logged. Notification
 * delivery must never break the primary write (message send, comment
 * post). Same principle as push notifications elsewhere in the app.
 */
export async function createNotification(
  db: ReturnType<typeof createServiceClient>,
  args: CreateNotificationArgs
): Promise<void> {
  const { recipientId, actorId, kind, targetType, targetId, preview } = args;

  if (!recipientId || !actorId) return;
  if (recipientId === actorId) return;

  try {
    const blocked = await getBlockedIds(recipientId);
    if (blocked.has(actorId)) return;

    await db.from("notifications").insert({
      recipient_id: recipientId,
      actor_id: actorId,
      kind,
      target_type: targetType,
      target_id: targetId,
      preview: preview ? preview.slice(0, 140) : null
    });
  } catch (e) {
    console.error("[notification] insert failed:", e);
  }
}