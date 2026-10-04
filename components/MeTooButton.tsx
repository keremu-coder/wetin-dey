"use client";

import { useState } from "react";

export function MeTooButton({
  reportId,
  initialCount,
  initialMine
}: {
  reportId: string;
  initialCount: number;
  initialMine: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [mine, setMine] = useState(initialMine);
  const [busy, setBusy] = useState(false);

  async function tap() {
    if (mine || busy) return;
    setBusy(true);
    const res = await fetch(`/api/reports/${reportId}/me-too`, { method: "POST" });
    const json = (await res.json()) as { count?: number };
    if (res.ok) {
      setCount(json.count ?? count + 1);
      setMine(true);
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={tap}
      disabled={mine || busy}
      className="rounded-md border border-ink/20 bg-white px-4 py-3 text-base"
    >
      {mine ? "You don add voice" : "Me too, e happen for me"} · {count}
    </button>
  );
}
