import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signin");

  const rows = [
    { href: "/settings/account", label: "Account", icon: "👤", hint: "Email, password, handle" },
    { href: "/settings/security", label: "Security", icon: "🔒", hint: "Login, devices, 2FA" },
    { href: "/settings/notifications", label: "Notifications", icon: "🔔", hint: "Push, email, mentions" },
    { href: "/settings/privacy", label: "Privacy & safety", icon: "🛡️", hint: "Blocked, muted, visibility" },
    { href: "/settings/blocked", label: "Blocked users", icon: "🚫", hint: "Manage who can reach you" },
    { href: "/settings/data", label: "Your data", icon: "📊", hint: "Download or delete your data" },
    { href: "/support", label: "Help & support", icon: "💬", hint: "Contact us, appeals" },
    { href: "/settings/delete", label: "Delete account", icon: "⚠️", hint: "Permanent, cannot be undone", danger: true }
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
          Settings
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
              {profile.email ? ` · ${profile.email}` : ""}
            </p>
          </div>
          <span className="text-muted">›</span>
        </div>
      </Link>

      {/* Appearance */}
      <div className="mb-6">
        <p className="mb-2 px-1 font-mono text-[0.7rem] uppercase tracking-wider text-faint">
          Appearance
        </p>
        <div className="rounded-2xl border border-border bg-surface p-3">
          <ThemeToggle />
        </div>
      </div>

      {/* Menu rows */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {rows.map((row, i) => (
          <Link
            key={row.href}
            href={row.href}
            className={`flex items-center gap-3 px-4 py-4 transition-colors hover:bg-ink/5 ${
              i !== 0 ? "border-t border-border" : ""
            }`}
          >
            <span className="text-[1.25rem]">{row.icon}</span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-[0.9375rem] font-medium ${
                  row.danger ? "text-danger" : "text-ink"
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
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[0.75rem] text-faint">
        <Link href="/terms" className="hover:text-accent">Terms</Link>
        <Link href="/privacy" className="hover:text-accent">Privacy</Link>
        <Link href="/guidelines" className="hover:text-accent">Guidelines</Link>
        <span className="font-mono">Wetin Dey · v1.0</span>
      </div>
    </main>
  );
}