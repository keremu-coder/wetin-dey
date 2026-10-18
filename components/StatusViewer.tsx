"use client";
import { useEffect } from "react";

export function StatusViewer({ 
  status, 
  onClose 
}: { 
  status: { handle: string; photo_url: string; status_line: string | null; created_at: string } | null;
  onClose: () => void;
}) {
  if (!status) return null;

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand flex items-center justify-center font-bold text-white">
            {status.handle.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-[0.9375rem]">@{status.handle}</p>
            <p className="text-[0.7rem] text-white/70">Just now</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-white/70 hover:text-white">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Image */}
      <div className="flex flex-1 items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={status.photo_url} alt="Status" className="max-h-full max-w-full object-contain rounded-lg" />
      </div>

      {/* Caption */}
      {status.status_line && (
        <div className="p-6 text-center bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-white text-[1rem] font-medium">{status.status_line}</p>
        </div>
      )}
    </div>
  );
}
