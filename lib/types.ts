// lib/types.ts

export type PostType =
  | "talk_am"
  | "report_am"
  | "ask"
  | "news"
  | "help"
  | "rant"
  | "talent";

export type EvidenceType =
  | "photo"
  | "video"
  | "audio"
  | "voice_testimony"
  | "public_link"
  | "deleted";

export type ReportStatus =
  | "reported"
  | "forwarded"
  | "acknowledged"
  | "resolved"
  | "disputed";

export type Report = {
  id: string;
  created_at: string;
  category: string;
  agency_raw: string;
  agency_canonical: string | null;
  state: string;
  lga: string | null;
  body: string;
  amount_kobo: number | null;

  // Evidence
  evidence_url: string | null;
  evidence_type: EvidenceType | null;
  evidence_link: string | null;
  evidence_label: string | null;

  // AI formalization
  summary_pidgin: string | null;
  summary_english: string | null;
  incident_date: string | null;
  formalization_confidence: number | null;

  // Status & moderation
  status: ReportStatus;
  reviewed: boolean;
  reviewer_note: string | null;
  flagged_at?: string | null;
  moderation_due_at?: string | null;

  // Community
  author_handle: string | null;
  post_type: PostType;
  requires_evidence?: boolean;
  is_per_post_anonymous?: boolean;

  // Counts
  upvotes: number;
  downvotes: number;
  me_too_count: number;
  comment_count: number;

  // Dedupe
  dedupe_hash: string | null;

  // Session (server-only — stripped before sending to client)
  session_id?: string;
};

export type PublicReport = Omit<Report, "session_id" | "reviewer_note">;

export function stripSession(report: Report): Report {
  const { session_id: _omit, ...rest } = report;
  return rest as Report;
}