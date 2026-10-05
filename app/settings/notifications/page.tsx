import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  const items = [
    {
      icon: "💬",
      label: "Replies and mentions",
      hint: "When someone replies to you or mentions @yourhandle"
    },
    {
      icon: "✋",
      label: "Reactions on your posts",
      hint: "When someone taps Me too or votes on your post"
    },
    {
      icon: "✅",
      label: "Status changes",
      hint: "When a report you engaged with moves to Acknowledged or Resolved"
    },
    {
      icon: "📊",
      label: "Weekly digest",
      hint: "Top patterns in your state, once a week"
    },
    {
      icon: "🔔",
      label: "New followers",
      hint: "When someone follows your handle"
    }
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
        >
          ←
        </Link>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">
          Notifications
        </h1>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {items.map((item, i) => (
          <div
            key={item.label}
            className={`flex items-start gap-3 px-4 py-4 ${
              i !== 0 ? "border-t border-border" : ""
            }`}
          >
            <span className="mt-0.5 text-[1.15rem] text-warm-deep">
              {item.icon}
            </span>
            <div className="flex-1">
              <p className="text-[0.9375rem] font-medium text-ink">
                {item.label}
              </p>
              <p className="mt-0.5 text-[0.75rem] text-muted">{item.hint}</p>
            </div>
            <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider text-faint">
              Soon
            </span>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[0.75rem] leading-relaxed text-faint">
        Notification settings will be configurable when we launch email and push
        notifications. For now, we only send critical account emails (password
        resets).
      </p>
    </main>
  );
}