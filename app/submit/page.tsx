import { ReportForm } from "@/components/ReportForm";

export const dynamic = "force-dynamic";

export default function SubmitPage({
  searchParams
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab === "community" ? "community" : "talk";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <p className="font-mono text-[0.7rem] uppercase tracking-widest text-faint">
          {tab === "talk" ? "Talk Am" : "Community"}
        </p>
        <h1 className="mt-2 font-serif text-[2rem] font-semibold leading-tight text-ink">
          {tab === "talk" ? "Wetin happen?" : "Post something"}
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          {tab === "talk"
            ? "Talk am. Nobody go know na you. Evidence required — reports without evidence no go publish."
            : "Share a win, a talent, a story. Free form. No evidence required."}
        </p>
      </div>
      <ReportForm tab={tab} />
    </main>
  );
}