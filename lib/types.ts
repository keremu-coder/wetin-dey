import type { Category, Status } from "./constants";

export type Report = {
  id: string;
  created_at: string;
  category: Category;
  agency_raw: string;
  agency_canonical: string | null;
  state: string;
  lga: string | null;
  body: string;
  amount_kobo: number | null;
  evidence_url: string | null;
  summary_pidgin: string | null;
  summary_english: string | null;
  incident_date: string | null;
  status: Status;
  reviewed: boolean;
  reviewer_note: string | null;
  session_id?: string;
  formalization_confidence: number | null;
  dedupe_hash: string | null;
};

export type Comment = {
  id: string;
  report_id: string;
  created_at: string;
  body: string;
  session_id?: string;
  reviewed: boolean;
  hidden: boolean;
};

export type PublicReport = {
  id: string;
  created_at: string;
  category: string;
  agency_canonical: string | null;
  state: string;
  amount_kobo: number | null;
  summary_english: string | null;
  status: string;
};

export function stripSession<T extends { session_id?: string }>(row: T): Omit<T, "session_id"> {
  const { session_id: _s, ...rest } = row;
  return rest;
}
