const STATUS_META: Record<
  string,
  { label: string; dot: string; bg: string; text: string }
> = {
  reported: {
    label: "Reported",
    dot: "bg-[#C0392B]",
    bg: "bg-[#FBEAE8]",
    text: "text-[#8A2A1E]"
  },
  forwarded: {
    label: "Forwarded",
    dot: "bg-[#D97706]",
    bg: "bg-[#FDF3E7]",
    text: "text-[#8A4A00]"
  },
  acknowledged: {
    label: "Acknowledged",
    dot: "bg-[#C7A008]",
    bg: "bg-[#FBF3D9]",
    text: "text-[#6B5500]"
  },
  resolved: {
    label: "Resolved",
    dot: "bg-[#1F7A4D]",
    bg: "bg-[#E8F3EC]",
    text: "text-[#15522F]"
  },
  disputed: {
    label: "Disputed",
    dot: "bg-[#6B6459]",
    bg: "bg-[#EFEBE2]",
    text: "text-[#4A453A]"
  }
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.reported;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${meta.bg} ${meta.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}