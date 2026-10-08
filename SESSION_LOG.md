# Session log

Newest at top. One line per session. Add before starting a new session.

## Format
`YYYY-MM-DD — what we built — what's next`

## Log
- 2026-10-08 (cont. 2) — Final round items 1, 2, 3, 7, 8, and partial 9 + 10. Dismiss now restores auto-hidden content (unhideTarget + last-actioned check). Civic reports (report_am) never auto-hide; only trusted reporters (verified email OR session age ≥ 24h) count toward threshold; every report_am flag is priority=high. Block filtering extended to report page + replies. Banned users can no longer flag. InstallPrompt + PushRegistrar return early in native shell (lib/native.ts). STORE_DISCLOSURES.md (Apple nutrition label, Google Data Safety, UGC moderation notes, demo account). Privacy + delete-account disclose DM retention. RouteWarmup skips prefetch on saveData / 2G. .gitattributes for LF. Deleted last junk file. Migration 009 (content_flags.priority). — ChatRoom split into MessageList/Composer/Recorder (item 9-rest). scripts/check-schema.ts + vitest coverage (item 10-rest). Capacitor (items 4–6) — needs Firebase project + Mac.
- 2026-10-08 (cont.) — Follow-up task items 1–10, 16, 17a, 18, 19a–19c, 20. Blocking now hides content everywhere. Block button on chat messages + comments. Hidden broadcasts no longer serve. Terms + ban guards on every write route via lib/guards.ts. Anti-brigading on auto-hide (trusted reporters only, never report_am). Exact-match handle lookups via handle_lower. Reliable Auth deletion via sessions.auth_user_id. Full data cleanup on delete. Email verification flow shipped. Single LiveStateProvider. Lazy-load heavy components. Self-host all 8 fonts. Pinch-zoom enabled. Service worker caches static + app shell. Removed 'unsafe-eval' from CSP. README/SPEC/DECISIONS rewritten. Migrations 007 + 008.
- 2026-10-08 — Closed all 7 original reviewer items. Then closed all 10 P0 items from the app-store review. Also /guidelines page, favicon fixes, package rename.
- 2026-10-05 — Speed fixes, presence online/away/offline, BBM chat with ping sound, member list, realtime.
- 2026-10-04 — Communities Phase 1 (create, join, chat, feed). Fixed sign-in. Added settings sub-pages.
- 2026-10-03 — Two-tab split, evidence tiers, dispute flow, dark mode.
- 2026-10-02 — Voice comments, post voting, block users, age gate.

## What each session did (keep only last 10)
(Add your own notes here as you go)