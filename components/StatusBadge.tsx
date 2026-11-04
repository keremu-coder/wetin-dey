// Status badge for reports.
//
// Uses theme tokens (bg-signal-soft / text-signal-ink, etc.) instead of
// hardcoded hexes so it renders correctly in both light and dark themes.
// The previous version used hardcoded light-mode hex colors that were
// invisible-on-dark — a light pink chip on a black card.
//
// "resolved" is the emotional peak of the product (see the positioning
// doc — "wetin we talk here no dey disappear"). It is the only status
// with a checkmark prefix, and the only one that hides the leading dot
// (the checkmark IS the indicator).

type Meta = { label: string; bg: string; text: string; dot: string };

const STATUS_META: Record<string, Meta> = {
  reported: {
    label: "Reported",
    bg: "bg-ink/10",
    text: "text-muted",
    dot: "bg-faint"
  },
  forwarded: {
    label: "Forwarded",
    bg: "bg-warn-tint",
    text: "text-warn-ink",
    dot: "bg-warn"
  },
  acknowledged: {
    label: "Acknowledged",
    bg: "bg-gold-soft",
    text: "text-ink",
    dot: "bg-gold"
  },
  resolved: {
    // \u2713 = checkmark. A BMP character, survives any encoding safely.
    label: "\u2713 Resolved",
    bg: "bg-signal-soft",
    text: "text-signal-ink",
    dot: "bg-signal"
  },
  disputed: {
    label: "Disputed",
    bg: "bg-danger-soft",
    text: "text-danger",
    dot: "bg-danger"
  }
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.reported;
  const isResolved = status === "resolved";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${meta.bg} ${meta.text}`}
    >
      {isResolved ? null : (
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      )}
      {meta.label}
    </span>
  );
}
