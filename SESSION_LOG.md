# Session log

Newest at top. One line per session. Add before starting a new session.

## Format
`YYYY-MM-DD — what we built — what's next`

## Log
- 2026-10-08 (cont. 4) — Capacitor native shell scaffolded. Installed @capacitor/core + 6 plugins (app, splash-screen, push-notifications, haptics, share, network) + dev deps (iOS, Android, CLI). Created capacitor.config.ts (appId com.wetindey.app, server.url to production, Android https scheme, SplashScreen config). Generated ios/ + android/ projects (76 files, 350KB). Wrote all permission strings: AndroidManifest.xml has RECORD_AUDIO, CAMERA, READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, POST_NOTIFICATIONS, ACCESS_COARSE_LOCATION. Info.plist has NSMicrophoneUsageDescription, NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSLocationWhenInUseUsageDescription. Added npm scripts cap:sync, cap:ios, cap:android. Also earlier: ownership audit of all 65 API routes. Fixed 4 real bugs (react emoji ALLOWED list had mojibake so reactions 400-ed; push/subscribe DELETE had no ownership filter; legacy reports/[id]/flag had no ban guard/rate limit/self-flag check; communities/[slug]/members leaked private-space member lists). Hardened settings/dm-policy + settings/hide-presence with assertCanWrite. — Native push wiring (needs Firebase project + FCM_SERVICE_ACCOUNT_JSON env var). Native share/haptics/splash/offline component wiring. Build + run Android (needs JDK 17 + Android Studio on this machine). Build + run iOS (needs a Mac with Xcode). Item 9-rest (ChatRoom split). Item 10-rest (check-schema + vitest). Runtime test of reactions on live site.
- 2026-10-08 (cont. 3) — Ownership audit of all 65 API routes.
- 2026-10-08 (cont. 2) — Final round items 1, 2, 3, 7, 8, partial 9 + 10.
- 2026-10-08 (cont.) — Follow-up task items 1–10, 16, 17a, 18, 19a–19c, 20.
- 2026-10-08 — Closed all 7 original reviewer items. Then closed all 10 P0 items.
- 2026-10-05 — Speed fixes, presence, BBM chat.
- 2026-10-04 — Communities Phase 1.
- 2026-10-03 — Two-tab split, evidence tiers.
- 2026-10-02 — Voice comments, voting, block users.

## What each session did (keep only last 10)
(Add your own notes here as you go)