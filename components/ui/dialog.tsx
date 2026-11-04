"use client";

import { useEffect } from "react";

export function Dialog({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-lg bg-paper p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-serif text-xl">{title}</h2>
          <button type="button" onClick={onClose} className="px-3">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
