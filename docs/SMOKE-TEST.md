# Pre-deploy smoke test (10 minutes)

Run this on a Vercel **preview** deployment BEFORE promoting to production.
Use a fresh browser profile (or private window) so you start with no session
row. That is exactly the situation of every new user and every store reviewer,
and it is the case the session regression broke.

## Order of deploy
1. Apply any new SQL migrations in Supabase FIRST (025–029 at the time of
   writing). Code that reads `session_epoch` / `last_ip_hash` now tolerates a
   missing column, but revocation and IP bans stay off until the migration runs.
2. Deploy the code to a preview. Run this list. Then promote.

## Checklist (tick every line)
- [ ] Open the site in a fresh private window. `GET /api/whoami` returns 200 with a handle (not 401).
- [ ] Accept the terms. Post a text report with a public link as evidence.
- [ ] Post a report with a photo. Open the stored image URL: no GPS in the EXIF.
- [ ] Record a voice testimony on **Android Chrome** and on an **iPhone**. Both succeed and play back.
- [ ] Post a voice note in a Space from an iPhone and from Android.
- [ ] Send a DM. Send a DM containing a threat: the recipient does NOT see it and gets NO push.
- [ ] Sign out, then sign back in with the recovery code.
- [ ] Copy the session cookie, sign out, replay the old cookie: it must be rejected (revocation).
- [ ] Hide a reviewed report from the admin page: it disappears from `/api/public/reports.json`, `/r/<id>` (public), and the Telegram channel.
- [ ] Delete a test account with "delete my content": its Space voice notes' URLs stop working.

## Known not-covered here (needs a Mac / device)
- iOS: run `npx cap sync ios` on a Mac and confirm the generated
  `ios/App/CapApp-SPM/Package.swift` lists background-geolocation,
  local-notifications and status-bar. Then test Radar in the background and a
  push notification on a real iPhone.
