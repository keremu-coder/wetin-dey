import Link from "next/link";

export const metadata = {
  title: "Support — Wetin Dey"
};

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <p className="text-[0.7rem] text-faint">
          Support
        </p>
        <h1 className="mt-2 font-serif text-[2rem] font-semibold leading-tight text-ink">
          Talk to us
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          We dey respond within 24 hours.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <p className="text-[0.8125rem] font-semibold text-brand">
            Email
          </p>
          <a
            href="mailto:support@wetindey.app"
            className="mt-1 block text-[1rem] font-medium text-ink hover:text-brand"
          >
            support@wetindey.app
          </a>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <p className="text-[0.8125rem] font-semibold text-danger">
            Report harm or abuse
          </p>
          <a
            href="mailto:report@wetindey.app"
            className="mt-1 block text-[1rem] font-medium text-ink hover:text-danger"
          >
            report@wetindey.app
          </a>
          <p className="mt-2 text-[0.8125rem] text-muted">
            We act within 24 hours.
          </p>
        </div>
      </div>
            <div className="mt-6 rounded-2xl border border-brand/20 bg-brand-tint/20 p-5">
          <h2 className="font-serif text-[1.15rem] font-semibold text-ink mb-2">
            Child Safety Standards
          </h2>
          <p className="text-[0.9375rem] text-ink/80 mb-3">
            We have a zero-tolerance policy for child sexual abuse material (CSAM) and the exploitation of minors. Read our full safety standards and reporting process.
          </p>
          <Link
            href="/safety"
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-[0.875rem] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Read Child Safety Standards
          </Link>
        </div>
    </main>
  );
}