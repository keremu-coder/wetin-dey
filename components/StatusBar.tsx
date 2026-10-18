"use client";
import { useState } from "react";
import { StatusViewer } from "./StatusViewer";

type StatusData = {
  id: string;
  handle: string;
  status_line: string | null;
  status_photo_url: string;
  status_photo_updated_at: string;
};

export function StatusBar({ statuses, myHandle }: { statuses: StatusData[], myHandle: string }) {
  const [active, setActive] = useState<StatusData | null>(null);

  if (statuses.length === 0) return null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-5 pb-4 pt-2 hide-scrollbar">
        {/* My Status (placeholder) */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="relative h-16 w-16 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-surface">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-faint">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>
          <span className="text-[0.7rem] font-medium text-ink">My Status</span>
        </div>

        {/* Friends' Statuses */}
        {statuses.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s)}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <div className="h-16 w-16 rounded-full p-[2px] bg-brand">
              <div className="h-full w-full rounded-full border-[3px] border-paper overflow-hidden bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.status_photo_url} alt={s.handle} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
              </div>
            </div>
            <span className="text-[0.7rem] font-medium text-ink truncate w-16 text-center">
              @{s.handle}
            </span>
          </button>
        ))}
      </div>

      <StatusViewer 
        status={active ? { 
          handle: active.handle, 
          photo_url: active.status_photo_url, 
          status_line: active.status_line,
          created_at: active.status_photo_updated_at
        } : null} 
        onClose={() => setActive(null)} 
      />
    </>
  );
}
