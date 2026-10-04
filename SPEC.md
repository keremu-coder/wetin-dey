# Naija Archive — Build Spec (Phase 1 MVP)

A civic-tech platform for anonymous corruption reporting in Nigeria. Reports are published with permanent, timestamped URLs. AI formalizes each report into a structured, quotable record. A moderator reviews and labels. No identity is ever stored.

## NON-NEGOTIABLE RULES

1. NEVER log IP addresses for anonymous activity. Disable Vercel Analytics. Do not install analytics packages.
2. ALWAYS strip EXIF metadata from uploads — client-side (exifr) AND server-side (sharp).
3. Reports are NEVER deleted. They are labeled "disputed". URLs are immutable.
4. Anonymous users have NO phone, NO email requirement, NO identity. Session = signed cookie with random nanoid.
5. Every report gets a permanent URL at /r/[nanoid].
6. All UI copy and AI summaries are PIDGIN-FIRST, English second.
7. Supabase RLS enabled on every table. Service role key never reaches the client.
8. All AI calls happen in server-side route handlers only.
9. No third-party analytics, no fingerprinting, no tracking pixels.
10. Assume users are under physical threat. Design for that.

## STACK

- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Storage, anonymous auth)
- Anthropic Claude API (claude-sonnet-4-5) for formalization
- exifr + sharp for images
- nanoid for IDs
- Recharts for Explore dashboard
- satori + @vercel/og for share cards
- Vercel deploy
- Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

## PHASE 1 SCOPE ONLY

Ships in this build:
- Home feed with near-you default sorting
- Submit report form with EXIF stripping
- Report detail page with AI summary, me-too, comments
- Explore dashboard
- My reports page
- Moderation dashboard (admin only)
- Share card generator
- Legal pages (disclaimer, privacy, takedown)
- Public JSON feed

Does NOT ship in this build:
- Push notifications
- Pattern alerts
- Weekly digest
- AI forwarding to agencies
- Verified agency badges
- Any form of identity collection

## DATABASE SCHEMA

reports: id (nanoid PK), created_at, category, agency_raw, agency_canonical, state, lga, body, amount_kobo (BIGINT nullable), evidence_url, summary_pidgin, summary_english, incident_date, status (reported|forwarded|acknowledged|resolved|disputed), reviewed (bool default false), reviewer_note, session_id, formalization_confidence, dedupe_hash

comments: id, report_id FK, created_at, body, session_id, reviewed (bool), hidden (bool)

me_toos: id, report_id FK, created_at, session_id, UNIQUE(report_id, session_id)

flags: id, report_id FK, created_at, reason, session_id, resolved

disputes: id, report_id FK, created_at, claimant_name, claimant_contact, explanation, resolved

formalization_log: id, report_id FK, created_at, prompt_tokens, completion_tokens, model, success, error

moderation_actions: id, report_id, action, moderator_note, created_at

admins: session_id, created_at

### RLS POLICIES

- reports: SELECT if reviewed=true OR session_id = current_setting('app.session_id'); INSERT allowed; UPDATE/DELETE service-role only.
- comments: SELECT where hidden=false; INSERT allowed; DELETE service-role only.
- me_toos: SELECT open; INSERT if session_id matches own.
- flags/disputes: INSERT open; SELECT/UPDATE service-role only.
- formalization_log, moderation_actions, admins: service-role only.

Add a Postgres function to reject INSERT if same session_id inserted >10 reports in last hour.

## SCREENS

### / (home feed)
- Server component. Fetch latest 30 reviewed reports (fallback to not-reviewed if <5 reviewed exist).
- Pidgin header: "Wetin dey happen for Naija"
- Filter tabs: All | Near you (uses rough geolocation, no precise coordinates stored)
- ReportCard list, infinite scroll (simple pagination, not algorithmic ranking)
- Big CTA button at bottom: "Report Wetin Happen"

### /submit
- Fields: category (electricity|police|customs|local_govt|judiciary|hospital|school|other), agency (free text), state (36 states + FCT dropdown), LGA (optional), body (50–5000 chars), amount (optional, ₦), evidence upload (optional), anonymous confirmation checkbox
- On submit: strip EXIF client-side → POST /api/reports → POST /api/formalize with returned id
- After submit: redirect to /r/[id]
- Persistent banner: "We send your report to every known public channel for this agency. We never promise a government response."

### /r/[id]
- Fetches by nanoid
- AI summary in PIDGIN (large) then English (smaller) inside a bordered box at top
- Original body below, evidence image if present
- Status timeline horizontal: reported → forwarded → acknowledged → resolved
- MeTooButton with count
- Comments (latest 50)
- Share button (copies /r/[id] and opens share card preview)
- Flag button (small, bottom)
- Dispute button (small, bottom, opens modal)
- ReviewedFlag pill top-right of header

### /explore
- Top stats row: total reports, total ₦ demanded, reports this month, % resolved
- Bar chart: top 10 agencies by report volume
- Bar chart: top 10 agencies by total ₦ demanded
- Line chart: reports per week over last 12 weeks
- Filter by state / category / date range
- Every stat and bar links to filtered report list

### /me
- Reads anonymous session cookie
- Lists reports where session_id matches
- Lists comments where session_id matches
- No profile, no name, no avatar

### /admin
- Gate: check session is in admins table
- Tabs: Not reviewed | Flagged | Disputes | Recently actioned
- Each row: report summary + action buttons (approve, mark disputed, hide)
- Every action logged to moderation_actions

### /disclaimer, /privacy, /takedown
- Static, no JS
- Copy from /docs/LEGAL.md (I will replace with real copy later)
- Every report page footer links to all three

## AI FORMALIZATION

Server-side only. Called AFTER report is created and published. Never blocks publication.

System prompt:

You formalize anonymous corruption reports from Nigerian citizens into structured, citable records.

INPUT: { category, agency_raw, state, body, amount }

Return ONLY this JSON:
{
  "summary_pidgin": "2-3 sentences in Nigerian Pidgin. Native Pidgin, NOT translated from English. Direct, factual, no editorializing.",
  "summary_english": "Same content in plain English.",
  "agency_canonical": "One of: [NEPA, NERC, Ikeja Electric, Eko Electricity, Abuja Electricity, Enugu Electricity, Port Harcourt Electricity, Benin Electricity, Kaduna Electricity, Kano Electricity, Jos Electricity, Yola Electricity, Nigerian Police Force, Nigeria Customs Service, FIRS, EFCC, ICPC, NIMC, NNPC, CBN, other]. If no match, return raw name.",
  "incident_date": "ISO date or null",
  "normalized_amount_kobo": "Integer, ₦1 = 100 kobo. Null if not stated.",
  "confidence": 0.0-1.0
}

No preamble. Return JSON only.

On response: update report row, log to formalization_log, set reviewed=false if confidence < 0.7. On timeout (10s) or error: leave summaries null, keep reviewed=false.

## EXIF STRIPPING

Client-side (ReportForm.tsx before upload):
- Use exifr to detect metadata
- Re-encode through canvas to produce a clean blob

Server-side (/api/reports/route.ts on receive):
- Use sharp: sharp(buffer).rotate().toBuffer() — verify output has no EXIF block

Add /lib/exif.test.ts that fails if GPS coordinates survive either pass.

## RATE LIMITING

- /api/reports: 10/hour per session
- /api/reports/[id]/comments: 20/hour per session
- Enforce in-memory AND via Postgres RLS function

## SHARE CARD (/api/share/[id])
- 1200x630 PNG via @vercel/og
- Shows: report ID (mono, small), agency canonical (large), state + category (small), pidgin summary (truncated 220 chars), footer "naija-archive.vercel.app/r/[id]" + "Not independently verified"

## PUBLIC JSON FEED (/api/public/reports.json)
- GET only, reviewed reports
- Shape: { id, created_at, category, agency_canonical, state, amount_kobo, summary_english, status }
- Rate limit 60/min per IP (this endpoint MAY log IPs — it is public read-only, not anonymous submission)
- CORS: Access-Control-Allow-Origin: *
- Cache 60s

## UI TONE

- Colors: earthy green #1f7a4d accent, off-white #f7f5f0 bg, dark text #1c1a15
- Serif headings (Fraunces fallback Georgia), system sans body
- Pidgin-first headings: "Wetin dey happen for Naija" not "Latest Reports"
- Status badges: 🔴 Reported, 🟠 Forwarded, 🟡 Acknowledged, ✅ Resolved, ⚠️ Disputed
- Reviewed flag: green pill "✓ Reviewed" or grey pill "· Not reviewed"
- Large mobile-first tap targets
- No avatars, no follower counts, no like hearts. Not a social app.

## CANONICAL AGENCY LIST (/lib/agencies.ts)

export const AGENCIES = ["NEPA","NERC","Ikeja Electric","Eko Electricity Distribution","Abuja Electricity Distribution","Enugu Electricity Distribution","Port Harcourt Electricity Distribution","Benin Electricity Distribution","Kaduna Electricity Distribution","Kano Electricity Distribution","Jos Electricity Distribution","Yola Electricity Distribution","Nigerian Police Force","Nigeria Customs Service","Federal Inland Revenue Service","EFCC","ICPC","NIMC","NNPC Limited","Central Bank of Nigeria","Nigerian Ports Authority","Federal Road Safety Corps","other"]

## FILE STRUCTURE

/app
  /layout.tsx, /page.tsx, /submit/page.tsx, /r/[id]/page.tsx, /explore/page.tsx, /me/page.tsx, /admin/page.tsx
  /disclaimer/page.tsx, /privacy/page.tsx, /takedown/page.tsx
  /api/reports/route.ts, /api/reports/[id]/route.ts
  /api/reports/[id]/me-too/route.ts, /api/reports/[id]/comments/route.ts
  /api/reports/[id]/flag/route.ts, /api/reports/[id]/dispute/route.ts
  /api/formalize/route.ts, /api/share/[id]/route.ts
  /api/admin/moderate/route.ts, /api/public/reports.json/route.ts
/components
  ReportCard.tsx, StatusBadge.tsx, ReviewedFlag.tsx, MeTooButton.tsx, CommentThread.tsx
  ReportForm.tsx, ModerationQueue.tsx, ExploreChart.tsx, ShareCard.tsx, Nav.tsx
/lib
  supabase/client.ts, supabase/server.ts, session.ts, exif.ts, formalize.ts, agencies.ts, rateLimit.ts, constants.ts
/migrations/001_initial.sql
/docs/SPEC.md (this file), /docs/AGENCIES.md, /docs/LEGAL.md
/public/manifest.json, icon-192.png, icon-512.png
README.md, .env.example