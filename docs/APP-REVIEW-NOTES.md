# Wetin Dey — App Store Connect review notes

Paste the section between BEGIN PASTE and END PASTE into **App Review
Information → Notes**. Reviewer credentials go in the **Sign-in required**
fields *above* the notes, not inside the notes text.

Reviewer password lives in `.env.test` locally (gitignored). Do not
commit it here.

---

BEGIN PASTE

Wetin Dey is a Nigerian civic-accountability and community platform.

**Two surfaces:**
- Talk Am: anonymous civic reports about public agencies (power, roads,
  water, police, health). Evidence required (photo / video / voice / public
  link). AI formalizes each report into Pidgin + English summaries. Human
  moderators review every report before publication.
- Community: free-form social feed + Spaces (group chat with voice notes
  and voice broadcasts).

**Native features in this build (Capacitor shell):**
Haptics on every interaction, native share sheet, native status-bar
theming (light/dark follows app theme), native splash, offline-aware
banner, edge-swipe-to-go-back gesture, swipe-to-reply on chat messages.
Native push is Android-only via FCM. iOS native push is not shipped in
this build (see "Known limitations" below).

**Guideline 1.2 — UGC moderation**
- Report action on every post, comment, chat message, DM, profile, and
  broadcast. 10 reason categories: threats, doxxing, sexual, minors, spam,
  harassment, hate, misinformation, scam, other.
- Block action everywhere. Bidirectional — if A blocks B, neither sees the
  other's content.
- Pre-moderation quarantine for avatars and status photos: a newly
  uploaded photo is visible only to its owner for the first 15 minutes.
  After 15 minutes the row auto-approves on next read. A moderator can
  reject any photo, which permanently 404s it. This is the pre-approval
  workflow the guideline requires.
- Automated text filter on chat messages, comments, report bodies, and
  voice transcripts (via Whisper). Threats, hate, and profanity hold the
  content for moderator review.
- Image reports (Talk Am evidence) and video reports are held for manual
  moderator review — no classifier, every image/video evidence report
  waits for a human. This is deliberate.
- 24-hour removal SLA stated in Terms of Use (`/terms`) and Community
  Guidelines (`/guidelines`). Moderation queue at `/admin/pending`.

**Guideline 5.1.1(v) — Account deletion**
Full deletion flow at Settings → Delete Account. Requires typing "DELETE"
to confirm. Handler: `app/api/account/delete/route.ts`.
- Deleted immediately: Supabase Auth credential, email/phone on the
  session row, handle, avatar file, status photo file, push
  subscriptions, follows, blocks, votes, reactions, check-ins, Radar
  contacts, broadcasts, community chat messages, DM threads and DM media.
- Retained in the public archive, detached from the account: reports and
  comments (session id tombstoned, `author_handle` nulled). This matches
  the disclosure in `/privacy` ("we replace your session id and handle
  with a placeholder") and `/delete-account`.
- Rationale: Wetin Dey is a civic archive. If reports could be deleted
  by pressuring the author to delete their account, the platform could be
  censored by any government agency. Same model as Wikipedia, Internet
  Archive, SeeClickFix.

**Guideline 4.4 — Background location (Radar)**
Radar is a personal-safety feature. A user in physical danger sends a
"Need help" or "Police stop" signal to a mutual-consent Circle (both
parties must add each other). While active, location updates every ~30s
and auto-terminates on "I'm safe" or at the 4h mark. Enforced at the
update endpoint and by a 15-minute sweep. No location is stored for
inactive users. Comparable to Life360 / Emergency SOS.

**Guideline 4.2 — Minimum functionality**
The build uses Capacitor + WebView loading the production URL. Native
adds: haptics, share sheet, splash, status bar, network monitor,
getUserMedia audio capture for voice notes and evidence, edge-swipe-back,
swipe-to-reply, native Android push (FCM).

External evidence links open in the in-app WebView. Users who want a
native browser experience can long-press → Open in Safari. Local asset
bundling is on the roadmap (removes the remote-load dependency entirely).

**Third-party services:**
- Supabase (database, storage, auth) — EU region
- Vercel (hosting, edge) — global
- Groq (AI text formalization + Whisper audio transcription) — US. Report
  body and voice files only; no session identifiers.
- Resend (transactional email) — US
- Telegram (public mirror of moderator-reviewed reports only) — no DMs,
  no user files
- Firebase Cloud Messaging (Android push) — no iOS push in this build

**Testing flow:**
1. Launch → 17+ age gate → accept → homepage.
2. Tap "See wetin dey happen" → /talk civic feed. Tap any report for AI
   summary, evidence, and comments.
3. Report UGC: open a Space, long-press a message from another user →
   Report / Block. Own messages show Reply only.
4. Delete account: Settings → Delete Account → type DELETE.
5. Radar: needs two devices. Add each other as Circle contacts, send a
   Need help signal, verify live location, tap I'm safe.

Contact: support@wetindey.app

END PASTE

---

## Known limitations (do NOT claim these in the notes)

- iOS native push (APNs) is not shipped. Entitlements reference
  `aps-environment` — that is being removed before submission.
- Local asset bundling is on the roadmap. The current build loads the
  production URL.
- Live video rooms, government ID verification for institutions, native
  DMs beyond the current WebView implementation — all roadmap.

Keep this file in sync with the build. If a feature ships, update the
PASTE section the same day.