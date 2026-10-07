"use client";

import { useState } from "react";
import { ReportReplyForm } from "./ReportReplyForm";

export function ReplyTrigger({ reportId }: { reportId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-3 text-[0.875rem] font-medium text-ink transition-colors hover:bg-ink/5"
      >
        <span className="text-[1.05rem]">⚖️</span>
        I&apos;m named in this report — submit a reply
      </button>
      {open ? (
        <ReportReplyForm
          reportId={reportId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}