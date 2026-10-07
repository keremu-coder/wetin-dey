// lib/formalize.ts
// Groq-powered report formalization.

import { AGENCIES } from "./agencies";

export type FormalizeInput = {
  category: string;
  agency_raw: string;
  state: string;
  body: string;
  amount_kobo?: number | null;
};

export type FormalizeOutput = {
  summary_pidgin: string;
  summary_english: string;
  agency_canonical: string;
  incident_date: string | null;
  normalized_amount_kobo: number | null;
  confidence: number;
  /** Legal/reputational risk score 0.0–1.0. High = serious accusation at a
   * named private individual with weak evidence. */
  defamation_risk: number;
  /** Short reasons, e.g. ["names individual", "accuses of bribery"]. */
  defamation_reasons: string[];
};

const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function buildPrompt(input: FormalizeInput): string {
  const agencyList = AGENCIES.join(", ");
  return `You formalize anonymous corruption reports from Nigerian citizens into structured, citable records.

INPUT:
category: ${input.category}
agency_raw: ${input.agency_raw}
state: ${input.state}
body: ${input.body}
amount_kobo: ${input.amount_kobo ?? "not stated"}

TASK: Return a single JSON object with exactly these fields:
{
  "summary_pidgin": "2-3 sentences in Nigerian Pidgin. Write natively in Pidgin, do NOT translate from English. Direct, factual, no editorializing.",
  "summary_english": "Same content in plain English.",
  "agency_canonical": "Normalized agency name from this list: [${agencyList}]. If no match, return the raw agency name.",
  "incident_date": "ISO date (YYYY-MM-DD) or null if not stated",
  "normalized_amount_kobo": "Integer in kobo (N1 = 100 kobo), or null if not stated",
  "confidence": 0.0-1.0,
  "defamation_risk": 0.0-1.0,
  "defamation_reasons": ["short string reasons"]
}

RULES FOR defamation_risk:
- Score HIGH (0.6-1.0) if the report levels a serious personal accusation (theft, bribery, extortion, assault, sexual misconduct, fraud, cultism) at a NAMED PRIVATE INDIVIDUAL with weak or no evidence attached.
- Score LOW (0.0-0.3) if the report criticizes a public agency (NEPA, police, customs) or a named public official ACTING IN THEIR OFFICIAL CAPACITY — even harshly. Criticizing public officials for doing their job is legitimate civic reporting, not defamation.
- Score MEDIUM (0.3-0.6) if there is ambiguity.
- Score on LEGAL EXPOSURE (would this survive a Nigerian defamation suit), NOT on how well-formed the report is. Confidence and defamation_risk are orthogonal.

Return ONLY valid JSON. No markdown. No preamble. No code fences.`;
}

export async function formalizeReport(
  input: FormalizeInput
): Promise<FormalizeOutput> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a formalization engine. Return only valid JSON. No markdown, no code fences, no explanation."
        },
        { role: "user", content: buildPrompt(input) }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no text");

  const parsed = JSON.parse(text) as Partial<FormalizeOutput>;

  return {
    summary_pidgin: parsed.summary_pidgin ?? "",
    summary_english: parsed.summary_english ?? "",
    agency_canonical: parsed.agency_canonical ?? input.agency_raw,
    incident_date: parsed.incident_date ?? null,
    normalized_amount_kobo:
      typeof parsed.normalized_amount_kobo === "number"
        ? parsed.normalized_amount_kobo
        : null,
    confidence:
      typeof parsed.confidence === "number" ? parsed.confidence : 0,
    defamation_risk:
      typeof parsed.defamation_risk === "number"
        ? parsed.defamation_risk
        : 0,
    defamation_reasons: Array.isArray(parsed.defamation_reasons)
      ? parsed.defamation_reasons.filter(
          (r): r is string => typeof r === "string"
        )
      : []
  };
}