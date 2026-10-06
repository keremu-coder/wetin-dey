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

/**
 * Escape HTML entities for Telegram's HTML parse mode.
 * Only 3 characters need escaping: & < >
 */
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

/**
 * Post a single report to the configured Telegram channel.
 * Returns true on success, false otherwise.
 */
export async function postReportToTelegram(
  p: MirrorPayload
): Promise<boolean> {
  const t = token();
  const c = chatId();
  if (!t || !c) return false;

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
  lines.push(
    `🔗 <a href="${escapeHtml(p.publicUrl)}">Read on Wetin Dey</a>`
  );

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
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram] network error", err);
    return false;
  }
}