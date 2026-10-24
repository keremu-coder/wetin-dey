# App Store Review Notes

Version: 1.0
Last updated: 2026-10-17
Submitter contact: support@wetindey.app

This document is the internal reference for the App Store Connect
"Notes for Review" field. The condensed version at the bottom is what
actually gets pasted into App Store Connect (4000 character limit).

---

## Reviewer credentials

Provide the reviewer account in the App Store Connect "Sign-in
required" fields, NOT here and NOT in any tracked file.

- Username / email: (fill in)
- Password: (fill in — reviewer-scoped account, no real user data)
- No 2FA / MFA on the reviewer account
- Test report already seeded under this account

---

## What the app is

Wetin Dey is a Nigerian community platform with two distinct tabs:

**Talk Am** — anonymous civic reporting. Nigerian citizens file reports
about public agencies (power, water, roads, police, health, corruption).
Every report requires evidence (photo, video, audio, voice testimony, or
public link). AI formalizes each report into Pidgin and English
summaries. A human moderator reviews before publication.

**Community** — free-form social feed plus Discord-style Spaces with
live chat, voice notes, and voice broadcasts.

Identity model: anonymous by default. No phone number or email is
required to use the app. A signed session cookie is the only identifier.

---

## Guideline 1.2 — UGC moderation

Report is available on every UGC surface. Block is available on
messages, comments, posts, reports, DMs, and profiles. Space-level
content (the space itself) has Report only; blocking applies to
messages within a space. Voice notes inside chat messages and comments
are blockable via their message menu. Broadcast items are reportable
only — the broadcast banner has no Block action.

- Chat messages (message menu — long-press or tap the menu button)
- Comments on reports
- Posts and reports
- DM conversations
- Space (community) messages
- Voice notes
- Broadcasts
- User profiles

Report flow: tap Report -> modal presents 10 categories (threats,
doxxing, sexual, minors, spam, harassment, hate, misinformation, scam,
other) -> submission stored in content_flags and surfaced to moderators.

Block flow: tap Block -> the blocked user's content is hidden
immediately for the blocking user -> server-side getBlockedIds filter
applies on next load. Blocked-users list at Settings -> Blocked Users.

Automated moderation:
- Server-side keyword and pattern filters run before any chat message,
  comment, or voice note is stored (threats, hate, doxxing, sexual
  content). The filter runs on voice uploads via Whisper transcription
  and text classification.
- Weighted trust scoring: content flagged by verified-email and
  30-day-old accounts crosses the 3.0 auto-hide threshold faster than
  by fresh accounts. The rule is a weighted sum, not a flat count.
- Moderation queue at /admin/pending (moderator-only, protected).
- 24-hour removal SLA stated in Terms of Use (/terms) and Community
  Guidelines (/guidelines).

Published policies:
- Terms of Use (/terms) — acceptable use, removal policy, dispute flow
- Community Guidelines (/guidelines) — prohibited content
- Support contact (/support) — monitored email + moderation email

Age gate: 17+ modal on first launch, blocking, must acknowledge.
---

## Guideline 5.1.1(v) — Account deletion

Full deletion flow: Settings -> Delete Account. Requires typing the
literal string "DELETE" to confirm. Server-side handler:
app/api/account/delete/route.ts.

### Deleted immediately and permanently

- Supabase Auth credential (email + password)
- Email / phone recovery data on the session row
- Handle (replaced with deleted_<id>, not nulled)
- Avatar image file (from the user-avatars storage bucket)
- All push subscriptions (browser + native tokens)
- Follows, blocks, votes, reactions
- Check-ins and Radar safety contacts
- Broadcasts
- Session row is scrubbed to a tombstone (session_id replaced with
  "deleted", email nulled, auth_user_id nulled, handle replaced)

### Retained — and disclosed

Public reports and comments remain visible at their permanent URLs,
detached from the user's identity.

**Why retained:** Wetin Dey is a civic accountability archive. Reports
are published at permanent, timestamped URLs so that historical
corruption and public-safety claims cannot be erased by later pressure
from the subject of the report. If a report were deleted because its
author quit, any government agency or private actor could effectively
censor the platform by pressuring the original author to delete their
account.

**Where this is disclosed to the user:**
- In-app privacy policy /privacy, sections "Retention" and "Deleting
  your account". Explicit text: "Your reports and comments stay visible
  in the archive but are detached from your identity — we replace your
  session id and handle with a placeholder."
- In-app Terms of Use /terms, section "Report retention". Explicit
  text: "Reports are not deleted. They are published at a permanent,
  timestamped URL and remain publicly accessible at that URL forever
  — unless they violate the content rules above."
- In the App Store listing's App Privacy section (the data-types
  disclosure lists "User Content" as linked to account creation but
  retained post-deletion with reason "public archive").
- This document, provided to the reviewer.

This retention model is the same one used by Wikipedia, the Internet
Archive, Citizen, and SeeClickFix: the record outlives the account.

### Deletion behavior in this build

The Delete Account form has no optional content-deletion checkbox. The
current flow deletes DM threads/messages and the user's community
messages; public reports and comments are detached from the account and
retained in the archive, as disclosed in `/privacy` and `/terms`.
---

## Guideline 4.4 — Background location (Radar)

Radar is a personal-safety feature. A user in physical danger sends a
"Need help" or "Police stop" signal to a small, mutual-consent Circle.
Both parties must have added each other; the app will not deliver a
signal to someone the sender has not added who has not added back.

While the signal is active, the app sends location updates every ~30
seconds so the Circle can see where the sender is.

The signal auto-terminates:
- When the sender taps "I'm safe"
- After 4 hours of continuous sharing. The cutoff is enforced at two
  points: app/api/radar/update-location/route.ts refuses any update
  whose target signal has expires_at in the past (hard cutoff, no
  grace window), and a scheduled sweep job
  (app/api/radar/sweep/route.ts, run every 15 minutes by a GitHub
  Actions workflow) flips location_sharing to false and nulls the
  stored coordinates so recipients no longer see a live signal.

Location updates are only accepted by the server while the sender has
an active signal. No location is stored for inactive users, and no
location is used for analytics or shared with the app's operators.

Purpose strings in Info.plist:
- NSLocationWhenInUseUsageDescription — "Wetin Dey uses your location
  when you send a Need help or Police stop signal on Radar, so the
  trusted contacts you chose can find you. Other signals do not include
  your location."
- NSLocationAlwaysAndWhenInUseUsageDescription — "While a Need help or
  Police stop signal is active (up to 4 hours), Wetin Dey keeps sharing
  your live location with the contacts you chose, even when the app is
  in the background. You can stop sharing at any time."

Comparable apps: Life360, Apple's Emergency SOS Live Video, Noonlight.

---

## Guideline 4.2 — Minimum functionality

This is the current build's honest position. The reviewer should read
this before deciding whether 4.2 is triggered.

**Current build:** Capacitor loads the production web app in the
WebView (capacitor.config.ts sets server.url to the Vercel deploy).
The app is functional and complete, but the WebView wrapping is
acknowledged.

**Native integrations already present in this build:**
- @capacitor/haptics — tap feedback on interaction (voting, button taps)
- @capacitor/share — native share sheet for report URLs and cards
- @capacitor/splash-screen — native launch screen
- @capacitor/status-bar — theme-aware status bar
- @capacitor/push-notifications — permission flow + token capture (FCM
  wiring lands in next build)
- @capacitor/network — offline/online detection
- Audio capture via getUserMedia + MediaRecorder running inside the
  WebView (same JS path as desktop; not a separate native plugin)

**Native integrations explicitly scheduled for the very next build
(within 2 weeks of this submission):**
- Firebase Cloud Messaging + APNs for native push
- Biometric app lock (Face ID / Touch ID / fingerprint)

**Follow-up build (within 6-8 weeks):**
- Local asset bundling: the .ipa/.apk will ship the built web assets
  locally instead of loading the remote URL. This removes the
  server.url remote load entirely.

We are requesting review of the current build with this roadmap in hand.
If 4.2 requires more native surface before approval, we will accelerate
the local-bundling timeline.
---

## Third-party services disclosed

For App Privacy label accuracy, the following services are integrated:

- **Supabase** (database, file storage, realtime) — EU region
- **Vercel** (hosting, edge network) — global edge
- **Groq** (AI formalization of report body, audio transcription of
  voice testimony attached to reports and voice comments) — US. Report
  body and the relevant audio file transmitted; no session identifiers,
  no account data.
- **Resend** (verification emails, password resets) — US
- **Telegram** (public mirror of moderator-reviewed civic reports only
  — no DMs, no user files, no evidence attachments) — moderator-triggered,
  not author-triggered
- **Firebase Cloud Messaging** (native push) — not yet wired in this
  build; browser Web Push is active

Full disclosure in /privacy and docs/STORE_DISCLOSURES.md.

---

## Testing flow for the reviewer

1. Launch the app. Age gate appears — tap "I am 17 or older" and confirm.
2. The homepage shows the identity hero (new visitor) or the chat inbox
   (existing member).
3. Tap "See wetin dey happen" to reach the civic feed at /talk.
4. Tap any report card -> detail page shows:
   - Report title, state, category
   - AI-generated summary with visible "AI-generated" label
   - "Read clean English version" collapsible (English translation)
   - Evidence block (photo / video / audio / public link)
   - Comment thread
   - Share button (opens native share sheet)
   - Report / Block actions in the overflow menu

5. To test UGC moderation end-to-end:
   - Tap /communities -> join "Naija Market" or "Gamers Lounge"
   - Long-press any message from ANOTHER user in the Space chat
   - The menu shows Reply, Report, Block (own messages only show Reply)
   - Tap Report -> pick a reason -> confirm
   - Tap Block -> that user's messages hide immediately, a banner confirms
   - Settings -> Blocked Users shows the blocked handle

6. To test account deletion:
   - Settings -> Delete Account
   - Type "DELETE", type "DELETE"; reports/comments remain detached from the account
   - Confirm -> login credential gone, avatar gone, all reports remain
     visible but detached (privacy policy explains why)

7. To test Radar (background location):
   - Two devices or two browser profiles needed
   - Device A: open the Radar page (/radar) -> add Device B as a Circle contact
   - Device B: open the Radar page (/radar) -> add Device A back
   - Device A: tap "Need help" -> grant location permission
   - Device B: receive signal with Device A's live location
   - Device A: tap "I'm safe" -> location sharing stops immediately

---

## Known limitations in this build

- Native push (FCM/APNs) not yet wired. Browser Web Push works on iOS
  Safari 16.4+ and Android Chrome.
- Video evidence is held for manual moderator review (no video content
  classifier in the current stack).
- iOS native push token capture is wired but the FCM relay is not
  active.

---

## Support email

support@wetindey.app

---

## Paste-into-App-Store-Connect version (for the Notes field)

Open this file and copy the text between the "BEGIN PASTE" and
"END PASTE" markers below. That is the 4000-character-safe version
for the App Store Connect Notes field.

BEGIN PASTE

Wetin Dey is a Nigerian civic-accountability + community platform.

Two tabs:
- Talk Am: anonymous civic reports about public agencies. Evidence required. AI formalizes into Pidgin+English. Human moderator reviews before publish.
- Community: free-form feed + Spaces with live chat, voice notes, broadcasts.

UGC MODERATION (1.2):
Report is on every UGC surface (10 reason categories, 24h SLA, moderation queue at /admin/pending). Block is on messages, comments, posts, reports, DMs, and profiles; spaces have Report only; blocking applies to messages within spaces. Voice notes in chat/comments are blockable via the message menu. Broadcast items are reportable only. Blocks hide content immediately and persist server-side. Age gate 17+.

ACCOUNT DELETION (5.1.1v):
Settings > Delete Account. Type DELETE to confirm. Server-side deletion of auth credential, email, avatar, push tokens, follows, blocks, votes, check-ins, Radar contacts, broadcasts. Handle is replaced with deleted_<id>; session row is tombstoned.

RETAINED (fully disclosed in /privacy and /terms in-app): public reports + comments remain at permanent URLs, detached from identity (session_id tombstoned, handle nulled). This is required for civic archive integrity: otherwise any government agency could censor a report by pressuring its author to quit. Same model as Wikipedia, Internet Archive, SeeClickFix.

BACKGROUND LOCATION (4.4):
Radar is personal-safety. Location is collected ONLY during an active "Need help"/"Police stop" signal, sent every 30s to a mutual-consent Circle. Stops on "I'm safe" tap or at the 4h mark. The 4h cutoff is enforced at the location-update endpoint (expired signals refuse new coordinates, no grace window) plus a 15-minute scheduled sweep that clears stored coordinates. No location is stored for inactive users. Comparable to Life360 / Emergency SOS.

MINIMUM FUNCTIONALITY (4.2):
Current build uses Capacitor + WebView loading production URL. Native integrations already present: haptics, share sheet, splash, status bar, push permission flow + token capture, network monitor, getUserMedia/MediaRecorder audio capture for voice notes/evidence (running in the WebView).
Next build (within 2 weeks): Firebase FCM + APNs native push, biometric app lock.
Follow-up build (6-8 weeks): local asset bundling (removes remote load).

THIRD PARTIES:
Supabase (EU), Vercel, Groq (AI text + audio transcription - US), Resend, Telegram (public mirror of moderator-reviewed reports only), FCM (next build).

REVIEWER CREDENTIALS: provided in App Store Connect sign-in fields.

TESTING:
- Age gate on first launch
- /talk shows civic feed, tap any report for AI summary + evidence + comments
- /communities > join "Naija Market" > long-press a message from another user > Report/Block (own messages show Reply only)
- Settings > Delete Account > type DELETE
- /radar > add mutual contact (they must add you back) > send Need help > verify live location

Contact: support@wetindey.app

END PASTE