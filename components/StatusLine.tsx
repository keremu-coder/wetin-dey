export function StatusLine({
  status,
  className = ""
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) return null;
  return (
    <p
      className={`text-[0.8125rem] italic leading-snug text-muted ${className}`}
    >
      {status}
    </p>
  );
}