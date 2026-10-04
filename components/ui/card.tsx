export function Card({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`rounded-lg border border-ink/10 bg-white p-4 ${className}`}>{children}</div>;
}
