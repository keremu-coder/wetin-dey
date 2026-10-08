# Session log

Newest at top. One line per session. Add before starting a new session.

## Format
`YYYY-MM-DD — what we built — what's next`

## Log
- 2026-10-08 (cont.) — Follow-up task items 1–10, 16, 17a, 18, 19a–19c, 20. Blocking now hides content everywhere (feed, chat, comments, broadcasts, profiles, search, DMs). Block button on chat messages + comments. Hidden broadcasts no longer serve. Terms + ban guards on every write route via lib/guards.ts. Anti-brigading on auto-hide (trusted reporters only, never report_am). Exact-match handle lookups via handle_lower generated column. Reliable Auth deletion via sessions.auth_user_id; full data cleanup on delete; reports + comments tombstoned; DMs left in place (FK). Email verification flow shipped (Supabase Auth SMTP via Resend, verify banner in Settings → Account). Single LiveStateProvider replaces triple-polling in Nav/BottomNav/PresencePing. Lazy-load ReportForm, Onboarding, FlagSheet, InviteSheet, BroadcastRecorder, VoiceNotePlayer. Self-host all 8 fonts via next/font. Pinch-zoom enabled. Service worker caches static + app shell with offline fallback page. Removed 'unsafe-eval' from CSP; added report-only header for future nonce migration. README/SPEC/DECISIONS rewritten. Migrations 007 (reliability) + 008 (email_verified). — Runtime test of email verification. Capacitor shell (items 11–15). Vitest tests (item 21). ChatRoom internal split (17b).
- 2026-10-08 — Closed all 7 original reviewer items (voice note ext fix, legal docs, strict TS, security headers, RLS helper, /radar verified live, force-dynamic on cron). Then closed all 10 P0 items from the app-store review. Also /guidelines page, favicon fixes, package rename.
- 2026-10-05 — Speed fixes, presence online/away/offline, BBM chat with ping sound, member list, realtime. — Test on phone, seed more reports.
- 2026-10-04 — Communities Phase 1 (create, join, chat, feed). Fixed sign-in. Added settings sub-pages. — Realtime + speed.
- 2026-10-03 — Two-tab split, evidence tiers, dispute flow, dark mode. — Communities.
- 2026-10-02 — Voice comments, post voting, block users, age gate. — Two-tab split.

## What each session did (keep only last 10)
(Add your own notes here as you go)