"use client";

export function Tabs({
  tabs,
  value,
  onChange
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`rounded-full px-4 py-2 text-sm ${
            value === t.id ? "bg-accent text-white" : "bg-white text-ink border border-ink/15"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
