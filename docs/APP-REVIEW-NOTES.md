# Wetin Dey — App Store Connect review notes

Paste the "Draft text" section below into **App Store Connect → App Review
Information → Notes**. The reviewer credentials go in the **Sign-in
required** fields *above* the notes, not inside the notes text.

The reviewer password is NOT in this file. It is stored in `.env.test`
locally (gitignored) and must be entered directly in App Store Connect
at submission time.

---

## Draft text (paste into App Store Connect)

Wetin Dey is a Nigerian community platform with two surfaces:

1. **Talk Am** — anonymous civic reporting about public services and
   agencies (power, roads, water, police conduct). Every report requires
   evidence (photo, video, voice note, or public URL). Reports get a
   permanent URL and are moderated for defamation.
2. **Spaces** — group chat for families, churches, estates, and friends.
   Voice-first, Nigerian Pidgin default.

**Native features in the iOS build (Capacitor shell):**

- Haptics on every action (tactile tap feedback)
- Native share sheet
- Native status bar theming (light/dark follows the app theme)
- Native splash screen, no white flash
- Offline-aware banner via @capacitor/network
- Edge-swipe-to-go-back gesture
- Swipe-right-to-reply on chat messages

Native push notifications are enabled on Android via Firebase Cloud
Messaging. iOS push (APNs) is on the roadmap but not shipped. Web push
works in browsers.

**Account deletion:** in-app at Settings → Account → Delete account,
and on the web at /delete-account. Deletes the auth user first; refuses
to scrub the profile if that fails.

**Reporting user-generated content:** every post, comment, chat message,
DM, profile, report, and broadcast has a report action. Report reasons:
spam, harassment, hate speech, threats, doxxing, sexual content, minors,
false info, and scam.

**Blocking:** bidirectional. If A blocks B, neither sees the other's
content or notifications.

**Moderation (only the following is enforced in this build):**

- Text (report bodies, comments, DMs, chat messages): filtered on
  submit for threats, hate speech, and profanity via pattern matching.
  Flagged content is held for moderator review.
- Voice testimony and voice comments on reports: transcribed via Groq
  Whisper and passed through the same text filter. Flagged content is
  held. (Voice notes in Spaces chat are not yet transcribed.)
- Images attached to reports: held for moderator review before
  publishing. There is no vision classifier — every photo report waits
  for a human decision by design.
- Video attached to reports: held for moderator review before
  publishing. Same reasoning.
- Reports without any attached evidence: held for moderator review.

Held content is not published. Violating content is removed from public
view within 24 hours per our Community Guidelines. Reports about public
agencies are never auto-hidden; they require explicit moderator action.

**Age rating:** 17+. A blocking age gate appears on first launch and
must be answered before the app is usable.

**Third-party services (all disclosures below are accurate):**

- **Groq** — (a) report formalization: report body text is sent
  server-side to be summarized; (b) voice transcription: audio files
  attached to report voice testimony and voice comments are sent to
  Groq Whisper for transcription and moderation. Groq never receives
  session identifiers or account data.
- **Resend** — transactional email only (account confirmation, password
  reset).
- **Supabase** — database, storage, authentication.
- **Vercel** — hosting and scheduled tasks.

**No tracking, no ads, no IDFA.** No analytics SDKs installed.

**Languages:** English and Nigerian Pidgin.

**Demo notes for reviewers:**

- The app is fully usable without creating a report. Browsing Talk Am,
  Spaces, public chats, and DMs works immediately after sign-in.
- To test the reporting flow: open any post or comment, tap the •••
  menu, tap "Report this post".
- To test the chat flow: join a public Space from the home screen.
- To test account deletion: **do not complete deletion.** The reviewer
  account is shared across review rounds. If you need to verify the
  deletion flow exists, open the confirmation dialog and cancel.
- Photo and video reports are held for human review by design. If you
  submit one and it does not appear in the feed immediately, this is
  expected behavior, not a bug.

---

## Reviewer credentials (enter in App Store Connect fields, NOT here)

- Sign-in required: **Yes**
- Email: `applereview@wetindey.app`
- Password: provided separately. Stored in `.env.test` locally.

To read the current password locally:
    Get-Content .env.test | Select-String REVIEWER_PASSWORD

To rotate it:
    1. Run the rotation script in docs/REMEDIATION-LOG.md (or the
       Supabase dashboard: Authentication → Users → applereview →
       Update user → set new password)
    2. Update `.env.test` locally with the new value
    3. Update App Store Connect → App Review Information → Sign-in
       required → password field

Never commit the password to this file or any tracked file.

## Optional context paragraph (if Apple asks for more)

Wetin Dey is a public-interest accountability platform. The civic
reporting surface (Talk Am) allows Nigerian residents to document
service failures, extortion, and misconduct in a way that is
timestamped, quotable, and legally defensible. Reports are anonymous —
no phone number, no email, no name required. The formalized version of
each report is generated server-side by an AI summarizer, then published
to a permanent URL. The platform itself is a host, not a publisher.
Voices are heard; on-the-record responses are welcome through the
right-of-reply flow.

## What's deliberately not claimed in these notes

Being honest up front is better than being caught. The following are on
the roadmap but not shipped, and are not mentioned above:

- Native push notifications on iOS
- Face ID / fingerprint app lock
- User-initiated forward to EFCC / ICPC / NPF
- Vision-based moderation of images (currently held for review)
- Voice note moderation in Spaces chat (only report voice is
  transcribed)

Do not add these back to the "Draft text" section until the code exists
and has been tested on a device.
## Known limitations (deliberate, not bugs)

### Ban evasion by anonymous users is mitigated, not solved

We ban an IP hash for 30 days when a session is banned, and refuse to
mint a new anonymous session from a banned IP. This stops the common
case: a user clears cookies and retries from the same WiFi.

It does **not** stop:
- VPN / proxy rotation
- Mobile carrier CGNAT rotation (airplane mode = new IP)
- Signing up as a named user (verified email). This is the intended
  escape hatch — accountability replaces anonymity.

False positives are bounded by a 30-day window and by the fact that
named signup always succeeds regardless of IP ban.

### Session revocation is near-instant, not instant

Signout, password reset, and recovery-code rotation each bump a
per-session `session_epoch`. Cookies are bound to the epoch via HMAC,
so any cookie issued before the bump stops working.

`getSessionId` caches the epoch for **30 seconds per server instance**.
After a bump, a stolen cookie can still authenticate for up to 30
seconds against any warm instance that already cached the old epoch.
This is acceptable for the theft threat model (an attacker who has the
cookie already has the session), but it is **not** "instant logout
everywhere." If that property is ever needed, drop the cache TTL or
add an explicit pub/sub invalidation channel.