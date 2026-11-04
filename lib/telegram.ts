import "server-only";

const TELEGRAM_API = "https://api.telegram.org";

function token(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

function chatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID ?? null;
}

export function telegramConfigured(): boolean {
  return !!(token() && chatId());
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type MirrorPayload = {
  id: string;
  title: string;
  agency: string;
  state: string;
  summary: string;
  amount_kobo: number | null;
  publicUrl: string;
};

export type MirrorResult =
  | { ok: true; messageId: number }
  | { ok: false; reason: string };

export async function postReportToTelegram(
  p: MirrorPayload
): Promise<MirrorResult> {
  const t = token();
  const c = chatId();
  if (!t || !c) return { ok: false, reason: "not-configured" };

  const lines: string[] = [];
  lines.push(`<b>${escapeHtml(p.title)}</b>`);
  lines.push("");
  lines.push(`📍 ${escapeHtml(p.agency)} · ${escapeHtml(p.state)}`);

  if (p.amount_kobo != null && p.amount_kobo > 0) {
    const naira = (p.amount_kobo / 100).toLocaleString("en-NG", {
      maximumFractionDigits: 0
    });
    lines.push(`💰 ₦${naira}`);
  }

  if (p.summary) {
    const trimmed = p.summary.trim().slice(0, 500);
    lines.push("");
    lines.push(escapeHtml(trimmed));
  }

  lines.push("");
  lines.push(`🔗 <a href="${escapeHtml(p.publicUrl)}">Read on Wetin Dey</a>`);

  const text = lines.join("\n");

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${t}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: c,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[telegram] send failed", res.status, body.slice(0, 200));
      return { ok: false, reason: `http-${res.status}` };
    }
    const json = (await res.json()) as {
      ok?: boolean;
      result?: { message_id?: number };
    };
    const messageId = json?.result?.message_id;
    if (typeof messageId !== "number") {
      return { ok: false, reason: "no-message-id" };
    }
    return { ok: true, messageId };
  } catch (err) {
    console.error("[telegram] network error", err);
    return { ok: false, reason: "network" };
  }
}

/**
 * Delete a previously-posted message from the mirror channel.
 * Returns true if Telegram confirms deletion (or the message was
 * already gone), false on any failure. Safe to call on ids that may
 * not exist — Telegram returns "message to delete not found" and we
 * treat that as success since the goal state is achieved.
 */
export async function deleteReportFromTelegram(
  messageId: number
): Promise<boolean> {
  const t = token();
  const c = chatId();
  if (!t || !c) return false;

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${t}/deleteMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: c, message_id: messageId })
    });
    if (res.ok) return true;
    const body = await res.text().catch(() => "");
    // "message to delete not found" is fine — already gone.
    if (body.includes("message to delete not found")) return true;
    console.error("[telegram] delete failed", res.status, body.slice(0, 200));
    return false;
  } catch (err) {
    console.error("[telegram] delete network error", err);
    return false;
  }
}