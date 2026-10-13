import { ReportForm } from "@/components/ReportFormLazy";

export const dynamic = "force-dynamic";

export default async function SubmitPage(props: {
  searchParams: Promise<{ tab?: string; c?: string }>;
}) {
  const searchParams = await props.searchParams;
  const tab = searchParams.tab === "community" ? "community" : "talk";
  const communitySlug = searchParams.c ?? null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 pb-24">
      <div className="mb-8">
        <p className="text-[0.7rem] text-faint">
          {communitySlug
            ? `Space: /c/${communitySlug}`
            : tab === "talk"
              ? "Talk Am"
              : "Community"}
        </p>
        <h1 className="mt-2 font-serif text-[2rem] font-semibold leading-tight text-ink">
          {tab === "talk" ? "Wetin happen?" : "Post something"}
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          {tab === "talk"
            ? "Talk am. Nobody go know na you. Evidence required — reports without evidence no go publish."
            : "Share a win, a talent, a story. Free form."}
        </p>
      </div>
      <ReportForm tab={tab} communitySlug={communitySlug} />
    </main>
  );
}