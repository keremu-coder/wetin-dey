import Link from "next/link";

export const metadata = {
  title: "Child Safety Standards — Wetin Dey"
};

export default function SafetyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-28">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-ink/5" aria-label="Back">
          ←
        </Link>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">Child Safety Standards</h1>
      </div>

      <article className="space-y-6 text-[0.9375rem] leading-relaxed text-ink/90">
        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">Zero Tolerance for CSAM</h2>
          <p>
            Wetin Dey has a zero-tolerance policy for Child Sexual Abuse Material (CSAM) and the sexual exploitation of minors. Any account found sharing, soliciting, or promoting such material will be permanently banned, and the content will be removed immediately.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">Reporting & Escalation</h2>
          <p>
            Users can report any content or profile that violates these standards using the "Report" button available on every post, message, and profile. 
            Reports flagged for "Minors" or "Sexual Content" are automatically escalated to the highest priority in our moderation queue.
          </p>
          <p className="mt-2">
            Where legally required, we report apparent CSAM to the relevant authorities, including the National Center for Missing & Exploited Children (NCMEC) and local Nigerian law enforcement (NAPTIP).
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">Prevention & Enforcement</h2>
          <p>
            We employ automated filters and human moderators to detect and block grooming behavior, exploitation, and inappropriate contact. Accounts engaging in these behaviors are permanently banned, and associated IP addresses may be blocked.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-serif text-[1.15rem] font-semibold text-ink">Designated Point of Contact</h2>
          <p>
            For urgent child-safety inquiries or to report a violation directly to our team, contact our designated child-safety point of contact at: <strong>safety@wetindey.app</strong>.
          </p>
        </section>
      </article>
    </main>
  );
}
