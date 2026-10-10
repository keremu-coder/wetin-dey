# Wetin Dey — App Store Connect review notes

Paste the section below into **App Store Connect → App Review Information
→ Notes**. Keep it under 4000 characters. The credentials go in the
"Sign-in required" fields above it, not in the notes text itself.

---

## Draft text (paste into App Store Connect)

Wetin Dey is a Nigerian community platform with two surfaces:

1. **Talk Am** — anonymous civic reporting about public services and
   agencies (power, roads, water, police conduct). Every report requires
   evidence (photo, video, voice note, or public URL). Reports get a
   permanent URL and are moderated for defamation.
2. **Spaces** — Discord-style group chat for families, churches, estates,
   and friends. Voice-first, Nigerian Pidgin default.

**What this app does that a Safari bookmark cannot:**

- Native push notifications via APNs (wired in the Capacitor shell)
- Haptics on every action (BBM-style tap feedback)
- Native share sheet
- Native status bar theming (light/dark follows the app theme)
- Native splash screen, no white flash
- Offline-aware banner via @capacitor/network
- Edge-swipe-to-go-back gesture (iOS)
- Swipe-right-to-reply on chat messages

**Account deletion:** in-app at /settings/delete and on the web at
/delete-account. Deletes the auth user first; refuses to scrub the
profile if that fails.

**Reporting user-generated content:** every post, comment, chat message,
DM, profile, report, and broadcast has a report action. Report reasons
cover spam, harassment, hate speech, threats, doxxing, sexual content,
minors, false info, and scam.

**Blocking:** bidirectional. If A blocks B, neither sees the other's
content or notifications.

**Filtering:** text is filtered on submit for threats, hate speech, and
profanity across chat, comments, and DMs. Violating content is held for
review (not published) and removed from public view within 24 hours
per our Community Guidelines.

**Civic reporting pathway:** Talk Am reports about specific agencies can
be forwarded by the user to EFCC, ICPC, or the Nigerian Police via their
official reporting channels, pre-filled with the formalized report text.
The platform does not auto-forward; the user reviews and sends.

**Age rating:** 17+. A blocking age gate appears on first launch and
must be answered before the app is usable.

**Third-party services:** Groq (report formalization; the report text
is sent server-side for AI summarization), Resend (transactional email
for password recovery). Both are disclosed in the privacy policy at
https://9jawatindey.vercel.app/privacy.

**No tracking, no ads, no IDFA.** No analytics SDKs installed.

**Languages:** English and Nigerian Pidgin.

**Demo notes for reviewers:**
- The app is fully usable without creating a report; browsing Talk Am,
  Spaces, public chats, and DMs works immediately after sign-in.
- To test the reporting flow: open any post or comment, tap ••• →
  "Report this post".
- To test the chat flow: join a public Space from the home screen.
- To test account deletion: Settings → Account → Delete account.

---

## Review credentials (enter in App Store Connect fields, NOT in notes)

- Sign-in required: **Yes**
- Username: `applereview@wetindey.app`
- Password: `REMOVED-CREDENTIAL`

## Optional context paragraph (if Apple asks for more)

Wetin Dey is a public-interest accountability platform. The civic
reporting surface (Talk Am) allows Nigerian residents to document
service failures, extortion, and misconduct in a way that is
timestamped, quotable, and legally defensible. Reports are anonymous —
no phone number, no email, no name. The formalized version of each
report is generated server-side by an AI summarizer, then published to
a permanent URL. Users can forward reports to the relevant agency
(EFCC, ICPC, or NPF) via the platform's "Forward to agency" action,
which opens the user's mail client with the report pre-filled. The
platform itself is a host, not a publisher — no content is ever sent
to a third party without an explicit user action.

## What to update when the review account password changes

If you rotate the reviewer password, update it in three places:
1. Supabase → Authentication → Users → applereview@wetindey.app
2. This file (docs/APP-REVIEW-NOTES.md)
3. App Store Connect → App Review Information → Sign-in required

Do NOT commit the credentials to the public repo. .env.test is
gitignored and holds only the local test account, not the reviewer
account.