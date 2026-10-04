import { ReportForm } from "@/components/ReportForm";

export default function SubmitPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <p className="font-mono text-[0.7rem] uppercase tracking-widest text-faint">
          Talk Am
        </p>
        <h1 className="mt-2 font-serif text-[2rem] font-semibold leading-tight text-ink">
          Wetin happen?
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          Talk am. Nobody go know na you. We no dey collect name, phone, or email.
          Every post gets a permanent link.
        </p>
      </div>
      <ReportForm />
    </main>
  );
}