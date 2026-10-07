"use client";

export function FilterWarning({
  reason,
  onClose
}: {
  reason: string;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/60 fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-[90] rounded-t-3xl border-t border-danger/40 bg-surface px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] fade-in">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />

        <div className="flex items-start gap-3">
          <span className="text-[1.75rem]">🚫</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-[1.15rem] font-semibold text-ink">
              Can&apos;t send that
            </h2>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
              {reason}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-paper p-3">
          <p className="text-[0.75rem] leading-relaxed text-muted">
            This protects both of you. Once a conversation leaves Wetin Dey,
            we can&apos;t help if something goes wrong. Scammers push off-platform
            for exactly that reason.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-accent py-3 text-[0.875rem] font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          Got it
        </button>
      </div>
    </>
  );
}