"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ReportActions({ reportId }: { reportId: string }) {
  const [flagOpen, setFlagOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [explanation, setExplanation] = useState("");
  const [msg, setMsg] = useState("");

  async function sendFlag() {
    const res = await fetch(`/api/reports/${reportId}/flag`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason })
    });
    setMsg(res.ok ? "Flag don land for moderator." : "Flag no send.");
    setFlagOpen(false);
  }

  async function sendDispute() {
    const res = await fetch(`/api/reports/${reportId}/dispute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        claimant_name: name,
        claimant_contact: contact,
        explanation
      })
    });
    setMsg(res.ok ? "Dispute don land. Report URL still dey." : "Dispute no send.");
    setDisputeOpen(false);
  }

  return (
    <div className="mt-12 border-t border-ink/10 pt-6 text-sm">
      {msg ? <p className="mb-3">{msg}</p> : null}
      <div className="flex gap-4">
        <button type="button" className="underline" onClick={() => setFlagOpen(true)}>
          Flag
        </button>
        <button type="button" className="underline" onClick={() => setDisputeOpen(true)}>
          Dispute
        </button>
      </div>
      <Dialog open={flagOpen} title="Flag this report" onClose={() => setFlagOpen(false)}>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} placeholder="Why?" />
        <Button className="mt-3" onClick={sendFlag}>
          Send flag
        </Button>
      </Dialog>
      <Dialog open={disputeOpen} title="Dispute this report" onClose={() => setDisputeOpen(false)}>
        <p className="mb-3 text-sm">Dispute no go delete the report. E go label am disputed.</p>
        <Input className="mb-2" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input className="mb-2" placeholder="Contact" value={contact} onChange={(e) => setContact(e.target.value)} />
        <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} minLength={20} />
        <Button className="mt-3" onClick={sendDispute}>
          File dispute
        </Button>
      </Dialog>
    </div>
  );
}
