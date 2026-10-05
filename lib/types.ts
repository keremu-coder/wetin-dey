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

  evidence_url: string | null;
  evidence_type: EvidenceType | null;
  evidence_link: string | null;
  evidence_label: string | null;

  summary_pidgin: string | null;
  summary_english: string | null;
  incident_date: string | null;
  formalization_confidence: number | null;

  status: ReportStatus;
  reviewed: boolean;
  reviewer_note: string | null;
  flagged_at?: string | null;
  moderation_due_at?: string | null;

  author_handle: string | null;
  post_type: PostType;
  requires_evidence?: boolean;
  is_per_post_anonymous?: boolean;

  upvotes: number;
  downvotes: number;
  me_too_count: number;
  comment_count: number;

  dedupe_hash: string | null;

  session_id?: string;
};

export type Comment = {
  id: string;
  report_id: string;
  created_at: string;
  body: string;
  audio_url: string | null;
  transcript: string | null;
  session_id: string;
  reviewed: boolean;
  hidden: boolean;
  upvotes: number;
  downvotes: number;
  author_handle?: string | null;
  score?: number;
};

export type PublicReport = Omit<Report, "session_id" | "reviewer_note">;

/**
 * Strip the session_id from any object that has one.
 * Works for Report, Comment, and anything else that carries a session.
 */
export function stripSession<T extends { session_id?: string }>(item: T): Omit<T, "session_id"> {
  const { session_id: _omit, ...rest } = item;
  return rest;
}