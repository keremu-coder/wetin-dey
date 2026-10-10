# Session log

Newest at top. One line per session. Add before starting a new session.

## Format
YYYY-MM-DD - what we built - what's next

## Log
- 2026-10-10 (cont.) - In-app notifications bell, end to end (13 commits). Shipped: migration 012 (notifications table - recipient_id cascade, actor_id set-null, two indexes, RLS enabled); lib/notifications.ts create helper (self-check + bidirectional block check + 140-char preview slice + swallowed errors); GET /api/notifications (50 rows, cursor via ?before=, actor handle resolution); GET /api/notifications/unread (count for badge); POST /api/notifications/read ({all:true} or {id}); createNotification wired into chat replies (kind:"reply", deduped against mention pass), chat mentions (kind:"mention", matched on generated handle_lower column), and report comments (kind:"comment", top-level only - replies-to-comments skip to avoid thread spam); check-schema guards sessions.handle_lower; LiveStateProvider polls /api/notifications/unread every 30s + on visibilitychange/focus, exposes useLiveNotificationsUnread + useLiveRefreshNotifications; /notifications page (server) + NotificationsList.tsx (client - mark-all-read on mount, then refreshNotifications() so badge clears immediately; tap-to-navigate via target_type); Nav bell between Search and Post with accent/green badge (distinct from red DM badge). Known v1 gap: tapping a reply/mention notification lands on /inbox, not the actual space - deep-link needs a community_messages to communities join to get the slug. Commits: 89f9fd2, 13ad055, 1268fba, 3a1e5cc, 293d4a0, df864dc, 1014e6d, 76f0d9d, 876ebcf, 7872d4e, d07c695, caf2699, ade404a.
- 2026-10-10 - Polish + reply feature. (22 fixes and additions across CSP, splash, chat layout, gestures, forms, explore page, and end-to-end reply-to-message with swipe gesture.) See prior entry detail below.
- 2026-10-08 (cont. 4) - Capacitor native shell scaffolded. Installed @capacitor/core + 6 plugins (app, splash-screen, push-notifications, haptics, share, network) + dev deps (iOS, Android, CLI). Created capacitor.config.ts. Generated ios/ + android/ projects. Wrote all permission strings (AndroidManifest.xml + Info.plist). Added npm scripts cap:sync, cap:ios, cap:android. Also: ownership audit of all 65 API routes; fixed 4 real bugs (reaction emoji mojibake, push/subscribe DELETE ownership, legacy reports/[id]/flag guards, communities members private-space leak).
- 2026-10-08 (cont. 3) - Ownership audit of all 65 API routes.
- 2026-10-08 (cont. 2) - Final round items 1, 2, 3, 7, 8, partial 9 + 10.
- 2026-10-08 (cont.) - Follow-up task items 1-10, 16, 17a, 18, 19a-19c, 20.
- 2026-10-08 - Closed all 7 original reviewer items. Then closed all 10 P0 items.
- 2026-10-05 - Speed fixes, presence, BBM chat.
- 2026-10-04 - Communities Phase 1.
- 2026-10-03 - Two-tab split, evidence tiers.

## What each session did (keep only last 10)
(Add your own notes here as you go)