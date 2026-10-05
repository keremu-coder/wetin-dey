import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  // Fetch civic footprint counts
  const db = createServiceClient();

  const { count: reportsCount } = await db
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("session_id", profile.id);

  const { count: followCount } = await db
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_session_id", profile.id);

  const { count: blockedCount } = await db
    .from("blocked_users")
    .select("id", { count: "exact", head: true })
    .eq("blocker_session_id", profile.id);

  const reports = reportsCount ?? 0;
  const following = followCount ?? 0;
  const blocked = blockedCount ?? 0;

  // Anonymity score — based on what identity info we hold
  let anonymityScore = 100;
  if (profile.email) anonymityScore -= 15;
  if (profile.phone) anonymityScore -= 15;
  if (profile.auth_provider && profile.auth_provider !== "none") anonymityScore -= 10;
  anonymityScore = Math.max(anonymityScore, 0);

  const iconClass = "text-warm-deep";

  const sections = [
    {
      label: "Your Account",
      rows: [
        {
          href: "/settings/account",
          icon: "👤",
          label: "Your profile",
          hint: profile.email ? profile.email : "No email attached"
        },
        {
          href: "/settings/security",
          icon: "🔒",
          label: "Password & sign in",
          hint: "Change password, sign out of devices"
        },
        {
          href: "/settings/notifications",
          icon: "🔔",
          label: "Wetin we tell you about",
          hint: "Mentions, replies, weekly digest"
        }
      ]
    },
    {
      label: "How you dey hide",
      rows: [
        {
          href: "/settings/privacy",
          icon: "🛡️",
          label: "Your privacy",
          hint: "Wetin people fit see about you"
        },
        {
          href: "/settings/blocked",
          icon: "🚫",
          label: "People you block",
          hint: blocked > 0 ? `${blocked} blocked` : "Nobody blocked"
        }
      ]
    },
    {
      label: "Your civic footprint",
      rows: [
        {
          href: "/me",
          icon: "📰",
          label: "Reports you don post",
          hint: reports > 0 ? `${reports} report${reports === 1 ? "" : "s"}` : "You never post report"
        },
        {
          href: "/settings/agencies",
          icon: "🏛️",
          label: "Agencies you don report",
          hint: "Agencies you've called out"
        },
        {
          href: "/settings/following",
          icon: "👥",
          label: "People you follow",
          hint: following > 0 ? `${following} following` : "You no follow anybody"
        }
      ]
    },
    {
      label: "Wetin we keep about you",
      rows: [
        {
          href: "/settings/data",
          icon: "📊",
          label: "Your data",
          hint: "Download am or make we delete am"
        },
        {
          href: "/settings/delete",
          icon: "⚠️",
          label: "Delete account",
          hint: "Permanent. No go fit undo.",
          danger: true
        }
      ]
    },
    {
      label: "Talk to us",
      rows: [
        {
          href: "/support",
          icon: "💬",
          label: "Help & support",
          hint: "Report problem, appeal moderation"
        }
      ]
    }
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">
          Your setup
        </h1>
      </div>

      {/* Profile card */}
      <Link
        href={`/u/${encodeURIComponent(profile.handle)}`}
        className="mb-6 block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-[1.4rem] font-semibold text-white">
            {profile.handle.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[1.05rem] font-semibold text-ink">
              @{profile.handle}
            </p>
            <p className="text-[0.8125rem] text-muted">
              {profile.handle_kind === "named" ? "Named account" : "Anonymous"}
            </p>
          </div>
          <span className="text-muted">›</span>
        </div>
      </Link>

      {/* Anonymity meter */}
      <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[0.8125rem] font-semibold text-ink">
              How you dey hide
            </p>
            <p className="mt-0.5 text-[0.75rem] text-muted">
              Based on wetin we hold about you
            </p>
          </div>
          <div className="text-right">
            <p className="font-serif text-[1.75rem] font-semibold leading-none text-accent">
              {anonymityScore}%
            </p>
            <p className="mt-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
              Anonymous
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/5">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${anonymityScore}%` }}
          />
        </div>
        {anonymityScore < 100 ? (
          <p className="mt-2 text-[0.7rem] leading-relaxed text-faint">
            You no dey 100% because we hold one email for your account. Reports
            you post go always publish anonymous.
          </p>
        ) : (
          <p className="mt-2 text-[0.7rem] leading-relaxed text-faint">
            We no hold nothing wey fit link you to your reports.
          </p>
        )}
      </div>

      {/* Appearance */}
      <div className="mb-6">
        <p className="mb-2 px-1 font-mono text-[0.7rem] uppercase tracking-wider text-faint">
          Appearance
        </p>
        <div className="rounded-2xl border border-border bg-surface p-3">
          <ThemeToggle />
        </div>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.label} className="mb-6">
          <p className="mb-2 px-1 font-mono text-[0.7rem] uppercase tracking-wider text-faint">
            {section.label}
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {section.rows.map((row, i) => {
              const danger = "danger" in row && row.danger;
              return (
                <Link
                  key={row.href}
                  href={row.href}
                  className={`flex items-center gap-3 px-4 py-4 transition-colors hover:bg-ink/5 ${
                    i !== 0 ? "border-t border-border" : ""
                  }`}
                >
                  <span className={`text-[1.25rem] ${iconClass}`}>
                    {row.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[0.9375rem] font-medium ${
                        danger ? "text-danger" : "text-ink"
                      }`}
                    >
                      {row.label}
                    </p>
                    {row.hint ? (
                      <p className="text-[0.75rem] text-muted">{row.hint}</p>
                    ) : null}
                  </div>
                  <span className="text-faint">›</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[0.75rem] text-faint">
        <Link href="/terms" className="hover:text-accent">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-accent">
          Privacy
        </Link>
        <Link href="/guidelines" className="hover:text-accent">
          Guidelines
        </Link>
        <span className="font-mono">Wetin Dey · v1.0</span>
      </div>
    </main>
  );
}