export function ReviewedFlag({ reviewed }: { reviewed: boolean }) {
  if (reviewed) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-[0.7rem] font-medium text-brand">
        <svg
          viewBox="0 0 12 12"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M2 6.5L5 9.5L10 3" />
        </svg>
        Reviewed
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-[0.7rem] font-medium text-faint">
      <span className="h-1 w-1 rounded-full bg-faint" aria-hidden />
      Not reviewed
    </span>
  );
}