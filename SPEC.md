
Ctrl+A → Delete → paste:

```markdown
# Wetin Dey — Build Spec (Phase 1 MVP)

A civic-tech platform for anonymous corruption reporting in Nigeria.
Reports are published with permanent, timestamped URLs. AI formalizes
each report into a structured, quotable record. A moderator reviews and
labels. No identity is ever stored.

> **Note (2026-10-08):** this spec is the original Phase 1 build. The
> app has since grown a Community tab, Spaces (Discord-style communities
> with live chat), DMs, and voice broadcasts. See `README.md` for the
> current shape. The "Reports are never deleted" rule below is
> superseded by the 24-hour removal policy in `docs/LEGAL.md` for
> content that violates our rules.

## NON-NEGOTIABLE RULES

1. NEVER log IP addresses for anonymous activity. Disable Vercel Analytics.
   Do not install analytics packages.
2. ALWAYS strip EXIF metadata from uploads — client-side (exifr) AND
   server-side (sharp).
3. Reports are never deleted, except for content that violates the rules
   (threats, doxxing, hate, sexual content, minors, illegal content, and
   confirmed defamation). Violating content is removed from public view
   within 24 hours; the row is preserved for legal and audit purposes.
   Non-violating reports are never deleted; they are labeled "disputed" if
   contested. URLs are immutable.
4. Anonymous users have NO phone, NO email requirement, NO identity.
   Session = signed cookie with random nanoid.
5. Every report gets a permanent URL at `/r/[nanoid]`.
6. All UI copy and AI summaries are PIDGIN-FIRST, English second.
7. Supabase RLS enabled on every table. Service role key never reaches
   the client.
8. All AI calls happen in server-side route handlers only.
9. No third-party analytics, no fingerprinting, no tracking pixels.
10. Assume users are under physical threat. Design for that.

## STACK

- Next.js 14.2 App Router + TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Storage, Realtime, anonymous auth)
- Groq API (`openai/gpt-oss-120b`) for formalization
- exifr + sharp for images
- nanoid for IDs
- Recharts for Explore dashboard
- satori + @vercel/og for share cards
- Vercel deploy

## PHASE 1 SCOPE (original, now extended)

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

Later additions (not in original spec):
- Community tab with free-form posts
- Spaces (Discord-style communities) with live chat
- Direct messages with contact-info filter
- Voice broadcasts, check-ins, daily answers
- Radar (coarse location signals)
- Communities become public/private with members and roles

Does NOT ship:
- Push notifications for reports (browser push for DMs/chat exists)
- Pattern alerts
- Weekly digest
- AI forwarding to agencies
- Verified agency badges
- Any form of identity collection

## DATABASE

See `migrations/` for the schema. Migrations are additive; the
authoritative source is the migration files, not this spec.

## AI FORMALIZATION

Server-side only. Called AFTER report is created and published. Never
blocks publication.

System prompt asks for JSON with: `summary_pidgin`, `summary_english`,
`agency_canonical`, `incident_date`, `normalized_amount_kobo`,
`confidence`. On timeout (10s) or error, summaries stay null and the
report is held for review.

## EXIF STRIPPING

Client-side (`ReportForm.tsx`): exifr detects metadata, canvas re-encodes
a clean blob.

Server-side (`/api/reports/route.ts`): sharp `rotate().toBuffer()`; output
has no EXIF block.

`lib/exif.test.ts` fails if GPS survives either pass.

## UI TONE

- Colors: earthy green accent, off-white bg, dark text
- Serif headings (Space Grotesk), system sans body
- Pidgin-first headings: "Wetin dey happen for Naija"
- Status badges with emoji: 🔴 Reported, 🟠 Forwarded, 🟡 Acknowledged,
  ✅ Resolved, ⚠️ Disputed
- Large mobile-first tap targets
- No avatars in the original spec — since added
- No follower counts in the original spec — since added