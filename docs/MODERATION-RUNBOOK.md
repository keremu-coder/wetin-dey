# Wetin Dey moderation runbook

Operational guide for whoever reviews the queue. Answers the safety lead's
"single point of failure" concern and gives Apple / legal something concrete
to point at when they ask how moderation works.

## Response times (commitments)

| Class | Example | First response | Action |
|-------|---------|----------------|--------|
| Imminent threat | "I go shoot X", a bomb threat | 1 hour | Hide + preserve + notify authority |
| CSAM / minors | Any image, video, or audio depicting a minor in a sexual or harmful context | 1 hour | Hide + preserve + mandatory report |
| Doxxing | Home address, phone, bank details posted about a private person | 4 hours | Hide + notify affected party via support@ |
| Sexual content | Explicit content outside a clearly-labelled context | 12 hours | Hide, unless it's civic evidence |
| Threats (non-imminent) | "Somebody should deal with this guy" | 12 hours | Hide if not the reporter's own experience |
| Hate speech | Tribal, religious, or group attacks | 12 hours | Hide |
| Harassment | Targeted abuse of a specific person | 24 hours | Hide + warn the actor |
| Defamation (contested) | Named official claims the report is false | 24 hours | Apply Disputed state; do not delete |
| Misinformation | Knowingly false claims | 24 hours | Apply Disputed label; keep visible if public-record sourced |
| Spam / scam | Ads, repeated posts, fraud offers | 72 hours | Hide |
| Everything else | Borderline content, weak evidence | 7 days | Log and decide |

**24-hour rule (Apple 1.2 / Google Play UGC):** any item marked
"hide" in the table above must be actioned within 24 hours of first
report OR first flag threshold trigger, whichever comes first. If we
miss the window, the report stays live and the platform is exposed.

## Sources of moderation work

1. **User reports** — the flag sheet, backed by `content_flags` table and
   the `POST /api/flag` route. Reason categories: spam, harassment, hate,
   threats, doxxing, sexual, minors, false info, scam, other.

2. **Auto-hide triggers** — `AUTO_HIDE_FLAG_THRESHOLD = 3` weighted
   trust score. Weighted by account quality:
   - verified email → 2.0
   - account ≥ 30 days → 1.0
   - account 24h to 30d → 0.5
   - under 24h → 0.0
   See `app/api/flag/route.ts` for the exact scoring. Auto-hide always
   creates a pending review row; it never permanently removes content
   without a human decision.

3. **Defamation hold** — `lib/defamation.ts` heuristically scores report
   text against named officials. Above the threshold, the report is
   held (not published) pending review.

4. **Evidence-hold** — reports without any photo / video / voice note /
   link are held (added 2026-10-11, matches SPEC "evidence required").

5. **AI-assisted hold** — text reports scored ≥ 0.6 on the combined risk
   index are held. Images are held by default (no vision model available
   yet). Videos are held by default. Voice notes are transcribed via
   Whisper and run through the text filter; flagged voice is held.

6. **Moderator mail** — support@wetindey.app with subject "Takedown" or
   "NDPA". These are legal requests and follow a different path — see
   `docs/LEGAL.md`.

## Where to review

Two entry points, both admin-gated:

- **`/admin`** — the general moderation dashboard. Every pending flag.
- **`/admin/pending`** — items explicitly held (defamation, no-evidence,
  AI risk, video, image). These are not yet public.

Actions available on each item:
- **Dismiss** — flag was not actionable, un-hide the content
- **Remove** — hide the content, keep the row, no ban
- **Ban user** — remove + permanently ban the session

`POST /api/admin/moderate-flag` handles all three. Every action is
logged with the moderator's session_id, the target, the action, and
the reason in `moderation_actions`.

## Categories that need special handling

### Imminent threat
- Do NOT just hide. Preserve the raw evidence (screenshot the report
  page including the URL before hiding).
- Notify the appropriate Nigerian authority. EFCC for financial crime,
  NPF for violence, NAPTIP for trafficking and CSAM.
- Document the notification in the ticket: date, time, agency, contact
  name, reference number if given.
- Report the actor to Supabase support if account data is needed for
  the authority — Supabase will only act on a proper legal request.

### CSAM / minors
- Hide immediately, do not delete the row (legal hold).
- Do not download, screenshot, or duplicate the content.
- File with NAPTIP or the Nigerian Police Cybercrime Unit. Nigeria's
  mandatory reporting framework is under the Cybercrimes Act 2015 (as
  amended 2024).
- Notify the project owner (kpekpes / keremu) immediately via a
  separate channel — do not put CSAM details in email.

### Defamation
- Wetin Dey is a host, not a publisher. Under Nigerian law the safest
  posture is: remove from public view within 24h of notice, retain the
  record, allow the reporter to reply.
- The right-of-reply flow is built (`report_replies` table). Use it.
- If a lawyer writes in citing a specific report, escalate to the
  project owner before acting. Do not respond to legal correspondence
  on your own.

### Civic reports vs. Community content
- Civic reports (Talk Am / `report_am` category) are **never
  auto-hidden**. They require manual moderator review even if the flag
  threshold is reached. This is intentional — the whole point of the
  civic surface is that public-interest accountability survives
  pressure.
- Community content (comments, chat, posts, DMs) is subject to the
  auto-hide path.

## Single point of failure (the honest answer)

Right now there is **one person** reviewing this queue. That is a real
risk. Two mitigations:

1. **Automated holds are aggressive.** Defamation, no-evidence, AI
   risk, video, image — all held by default. If the human reviewer is
   unavailable for 24 hours, nothing the platform holds publishes
   itself. The failure mode is not "bad content goes live"; it's "good
   content sits in review longer than it should." That is the right
   failure mode for a civic platform.

2. **Escalation path** — if the reviewer will be unavailable for more
   than 24 hours, the project owner takes over. If both are unavailable,
   the auto-holds extend indefinitely. Community members can still
   publish content that doesn't trip any hold.

The next step is a second moderator. Until then, document every decision
so the record shows the platform is actively moderating, not passively
hosting.

## Records and audit

Every moderation action writes to `moderation_actions` with:
- moderator session_id
- target type and id
- action taken
- free-text reason
- timestamp

This table is the evidence that the platform moderates. If Apple, Google,
or a Nigerian authority asks "what did you do and when", query it.

Retention: permanent. Never delete rows from `moderation_actions` or
`content_flags`. They are the legal defense.

## What "Disputed" means

The disputed state is enforced in the report page. A report with status `disputed` shows a prominent banner at the top of the page and a link to the published right-of-reply response below. The body stays visible by design — Wetin Dey is a host, not a publisher, and the response is the corrective, not removal.

Do not hide disputed content unless it also violates the 24-hour removal categories in the SLA table above. If a dispute contains an imminent threat, CSAM, or doxxing, apply the normal removal action; "disputed" does not shield it.

## When to contact a lawyer

- Any takedown request citing Nigerian law
- Any NDPA data subject request
- Any report naming a specific official where the reporter has not
  shown clear evidence
- Any coordinated flagging campaign against a specific report
- Any request from a government agency

The legal contact is defined in `docs/LEGAL.md`. Do not improvise
responses to legal correspondence.

## Escalation summary

| Situation | Action |
|-----------|--------|
| Imminent threat or CSAM | Hide + preserve + notify authority + notify owner |
| Lawyer writes in | Forward to owner, no direct response |
| 20+ flags on one item | Investigate for coordinated abuse before acting |
| Moderator unavailable >24h | Owner takes queue |
| Both unavailable | Auto-holds continue; nothing publishes unmoderated |
| Uncertain category | Hold. Always hold. |