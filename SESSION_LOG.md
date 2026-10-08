# Session log

Newest at top. One line per session. Add before starting a new session.

## Format
`YYYY-MM-DD — what we built — what's next`

## Log
- 2026-10-08 (cont. 3) — Ownership audit of all 65 API routes. Verified 5 routes already correct (posts/[id] DELETE, communities/[slug] DELETE, dm/threads/[id] GET, dm/threads/[id]/read POST, settings/recovery-code). Fixed 4 real bugs: (a) messages/[id]/react — ALLOWED emoji list had mojibake so every reaction was 400-ing; (b) push/subscribe DELETE had no session filter — anyone with a leaked endpoint could silence another user's push; (c) reports/[id]/flag legacy route had no ban guard, rate limit, self-flag check, or try/catch; (d) communities/[slug]/members leaked private-space member lists to non-members and didn't filter blocked users. Hardened settings/dm-policy and settings/hide-presence with assertCanWrite for consistency. All routes now either verify ownership by session_id from the signed cookie, or use DM session_a/session_b pattern, or community owner_session_id. No route trusts body-supplied session IDs. — Runtime test of reactions on live site. Item 9-rest (ChatRoom split). Item 10-rest (check-schema + vitest). Capacitor (items 4–6).
- 2026-10-08 (cont. 2) — Final round items 1, 2, 3, 7, 8, and partial 9 + 10. Dismiss restores auto-hidden content. Civic reports never auto-hide. Block filtering extended. InstallPrompt/PushRegistrar return early in native shell. STORE_DISCLOSURES.md added. RouteWarmup skips prefetch on saveData/2G. .gitattributes for LF. Migration 009.
- 2026-10-08 (cont.) — Follow-up task items 1–10, 16, 17a, 18, 19a–19c, 20.
- 2026-10-08 — Closed all 7 original reviewer items. Then closed all 10 P0 items.
- 2026-10-05 — Speed fixes, presence, BBM chat.
- 2026-10-04 — Communities Phase 1.
- 2026-10-03 — Two-tab split, evidence tiers.
- 2026-10-02 — Voice comments, voting, block users.

## What each session did (keep only last 10)
(Add your own notes here as you go)