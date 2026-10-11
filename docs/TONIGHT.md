> Note: commit hashes in this document reference the pre-2026-10-11 git history. That history was rewritten on 2026-10-11 to remove dead credentials. To find the equivalent commit, search the current history by message text instead of by hash.

# Session wrap — 2026-10-10 late night

Long execution session against the external pre-flight review
(docs/PRE-FLIGHT-REVIEW.md). Everything below shipped and built green.

## What closed tonight

### Reviewer items resolved

**#1 (Apple 4.2 — Minimum Functionality)** — partial. Native push is now
gated behind NEXT_PUBLIC_NATIVE_PUSH_ENABLED so no permission prompt
fires before Firebase/APNs are wired. Age gate blocks before Onboarding.
Suggested public spaces now appear for users with zero memberships, so
the first screen is never empty (4.2.2). Still open: native push wiring
(Firebase + APNs — needs Mac and physical devices), biometric app lock.

**#2 (Google Play permissions)** — closed. Removed READ_MEDIA_IMAGES and
READ_MEDIA_VIDEO from AndroidManifest.xml. System picker handles uploads,
permissions were never needed.

**#3 (Apple 1.7 — crime reporting)** — addressed via review notes wording
and age gate. No auto-forward of content to agencies; the pathway is
documented but not built (v2 feature, post-approval).

**#4 (App completeness)** — closed. PushRegistrar gated. "Coming soon"
copy removed from Onboarding. Radar tab still present but now signals
red as a discoverability cue. Reviewer account created separately:
applereview@wetindey.app (not the seed author).

**#5 (UGC moderation)** — closed. All four content types covered:
- Text: existing pattern filter (threats, hate, profanity)
- Voice notes and voice comments: Whisper transcription → same text
  filter → held if flagged
- Images: hold for moderator review
- Video: hold for moderator review

### Other work

- Password rotated on test account. Old credential (leaked in
  STORE_DISCLOSURES.md) is dead.
- Test account email moved to keremu9050+wetindey@gmail.com (routes to
  the Resend signup inbox since wetindey.app is not registered).
- Password reset verified end-to-end.
- .gitignore now covers .env.test.
- Viewport pinch-zoom restored (a11y).
- FlagSheet + API now include threats, doxxing, sexual, minors.
- Radar tab signals in red (--color-danger).

## Commits on origin/main from this session

884261a chore: gitignore .env.test
40c7a82 a11y: restore pinch-zoom
2194e4e android: drop READ_MEDIA permissions
d299905 onboarding: replace Live Radar slide with notifications
ebfb6f5 flags: add threats/doxxing/sexual/minors
768f631 docs: remove demo credentials from STORE_DISCLOSURES.md
b0db5f2 push: gate native registration behind env flag
9ed1410 nav: radar tab signals in red
93b4a11 a11y/legal: add 17+ age gate
6627bce home: show suggested spaces for new users
4f22261 docs: App Store Connect review notes draft
8ef82e6 docs: strip unbuilt features from review notes
3271044 moderation: image moderation (Groq vision attempt — reverted)
9226220 moderation: image reports hold for review
1651185 moderation: transcribe voice testimony via Whisper
87b1205 moderation: transcribe voice comments via Whisper
84b6a98 moderation: hold video reports; update App Review notes

Plus the notifications push feature earlier in the night:
89f9fd2, 13ad055, 1268fba, 3a1e5cc, 293d4a0, df864dc,
1014e6d, 76f0d9d, 876ebcf, 7872d4e, d07c695, caf2699, ade404a

## What's left before submission

### Non-blocking for codebase — do before App Store submission

1. **Git history purge.** Old commits still contain the leaked password
   in docs/STORE_DISCLOSURES.md history. The credential
   is dead, but a curious visitor to the public repo can see the string.
   Fix: git filter-repo or BFG, then force-push. Rewrites all hashes.
   Do this deliberately, last before submission.

2. **Play Data Safety form.** In Google Play Console at submission time.
   Photos/videos now marked as optional (permissions removed). Telegram
   mirror should be disclosed.

3. **App Store Connect review notes.** Draft is in docs/APP-REVIEW-NOTES.md.
   Paste into App Review Information → Notes. Sign-in credentials go in
   the fields above the notes, not the notes text.

### Needs hardware / external services

4. **Native push wiring.** Firebase project → google-services.json →
   Android FCM. iOS: APNs entitlement + AppDelegate forwarding. Needs
   Mac for iOS half. Flip NEXT_PUBLIC_NATIVE_PUSH_ENABLED=true in
   Vercel env once done.

5. **Biometric app lock.** @capacitor/biometric. Settings → Security.
   Would be a strong second "not-a-Safari-bookmark" feature for 4.2.
   Needs a physical device to test.

### Post-approval (v2)

6. One-tap agency forward (EFCC / ICPC / NPF). User reviews and sends;
   platform stays host. See HANDOFF.md for the legal reasoning.

7. Notification deep-link for reply/mention → actual space (currently
   /inbox fallback; needs community_messages → communities join).

8. Ban hardening. Currently keyed to cookie session, easy to clear.

9. Realtime reactions on comments.

10. 19 npm vulnerabilities (3 critical) — needs a dedicated session.

## Verification we haven't run

- Image classifier on a real upload (currently a hold stub, so every
  image report holds — this is intentional, but no live test yet)
- Whisper transcription on a real voice note (unit-level only)
- Suggested spaces for a brand-new account (test account has memberships)
- Native push once wired

## How to resume

Read HANDOFF.md first (session invariant). Then this file. Then
docs/PRE-FLIGHT-REVIEW.md. Then SESSION_LOG.md.

The three lines that keep this session honest:
- One file per paste. Never two.
- Always absolute paths with [System.IO.File]::WriteAllText.
- Verify with Select-String before committing.