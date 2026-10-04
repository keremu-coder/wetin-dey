"use client";

import { useState } from "react";
import type { Report } from "@/lib/types";
import { Button } from "./ui/button";
import { Tabs } from "./ui/tabs";
import { StatusBadge } from "./StatusBadge";
import { ReviewedFlag } from "./ReviewedFlag";

type FlagRow = { id: string; report_id: string; reason: string; created_at: string; resolved: boolean };
type DisputeRow = {
  id: string;
  report_id: string;
  claimant_name: string;
  claimant_contact: string;
  explanation: string;
  created_at: string;
  resolved: boolean;
};
type ActionRow = { id: string; report_id: string | null; action: string; moderator_note: string | null; created_at: string };

export function ModerationQueue({
  unreviewed,
  flagged,
  disputes,
  actions
}: {
  unreviewed: Report[];
  flagged: { flag: FlagRow; report: Report | null }[];
  disputes: { dispute: DisputeRow; report: Report | null }[];
  actions: ActionRow[];
}) {
  const [tab, setTab] = useState("unreviewed");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function act(payload: Record<string, string>) {
    setBusy(payload.report_id || payload.comment_id || "x");
    await fetch("/api/admin/moderate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, note })
    });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "unreviewed", label: "Not reviewed" },
          { id: "flagged", label: "Flagged" },
          { id: "disputes", label: "Disputes" },
          { id: "actions", label: "Recently actioned" }
        ]}
      />
      <label className="block text-sm">
        Moderator note
        <input
          className="mt-1 w-full rounded-md border border-ink/20 px-3 py-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {tab === "unreviewed" &&
        unreviewed.map((r) => (
          <Row key={r.id} report={r} busy={busy} onAct={act} />
        ))}
      {tab === "flagged" &&
        flagged.map(({ flag, report }) => (
          <div key={flag.id} className="rounded-lg border border-ink/10 bg-white p-4">
            <p className="text-sm text-ink/70">Flag: {flag.reason}</p>
            {report ? <Row report={report} busy={busy} onAct={act} /> : <p>Report {flag.report_id}</p>}
          </div>
        ))}
      {tab === "disputes" &&
        disputes.map(({ dispute, report }) => (
          <div key={dispute.id} className="rounded-lg border border-ink/10 bg-white p-4">
            <p className="text-sm">
              {dispute.claimant_name} · {dispute.claimant_contact}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{dispute.explanation}</p>
            {report ? <Row report={report} busy={busy} onAct={act} /> : null}
          </div>
        ))}
      {tab === "actions" &&
        actions.map((a) => (
          <div key={a.id} className="rounded-lg border border-ink/10 bg-white p-3 text-sm">
            {a.created_at} · {a.action} · {a.report_id} · {a.moderator_note}
          </div>
        ))}
    </div>
  );
}

function Row({
  report,
  busy,
  onAct
}: {
  report: Report;
  busy: string | null;
  onAct: (p: Record<string, string>) => void;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4">
      <div className="flex justify-between gap-2">
        <a href={`/r/${report.id}`} className="font-serif text-lg">
          {report.agency_canonical || report.agency_raw}
        </a>
        <ReviewedFlag reviewed={report.reviewed} />
      </div>
      <p className="mt-2 line-clamp-4 text-sm">{report.body}</p>
      <div className="mt-2">
        <StatusBadge status={report.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={busy === report.id} onClick={() => onAct({ report_id: report.id, action: "approve" })}>
          Approve
        </Button>
        <Button
          variant="outline"
          disabled={busy === report.id}
          onClick={() => onAct({ report_id: report.id, action: "disputed" })}
        >
          Mark disputed
        </Button>
        <Button
          variant="ghost"
          disabled={busy === report.id}
          onClick={() => onAct({ report_id: report.id, action: "hide" })}
        >
          Hide from feed
        </Button>
      </div>
    </div>
  );
}
