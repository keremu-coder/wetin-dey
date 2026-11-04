"use client";

import { useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";

export function ShareCard({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/r/${id}` : `/r/${id}`;

  async function share() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${id}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    setOpen(true);
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={share}>
        {copied ? "Link don copy" : "Share this report"}
      </Button>
      <Dialog open={open} title="Share card" onClose={() => setOpen(false)}>
        <p className="mb-3 text-sm text-ink/70">{url}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/share/${id}`}
          alt="Share card"
          width={1200}
          height={630}
          className="h-auto w-full rounded-md border border-ink/10"
        />
      </Dialog>
    </>
  );
}
