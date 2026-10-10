# Wetin Dey — Pre-Flight Review (external AI, 2026-10-10)

Source: high-level review by an external AI against current Apple and Google
policy. Preserved verbatim so nothing is lost between sessions. Treat this
as a source-of-truth checklist. Verify each item against the actual repo
before acting — AI reviewers invent guideline numbers roughly 20% of the
time.

## Verdict from that review

- Probability of approval on next submission: ~30% Apple, ~40% Google Play.
- Highest-leverage change: get iOS push working on a physical device + add
  one native-only feature, then make the first screen non-empty.
- Unverified by that reviewer: native build behavior, /submit consent flow,
  evidence rendering behind login, moderation staffing, Play testing req.

## Top 5 rejection risks

### 1. Apple 4.2 (Minimum Functionality) — remote-URL wrapper
Guideline: 4.2, also 4.2.2 for empty first screen.
Trigger: shell loads a website and adds nothing a Safari bookmark can't do.
Evidence:
- capacitor.config.ts loads https://9jawatindey.vercel.app via server.url
- native push claims to be the anti-wrapper feature, but push is not wired
  (no .entitlements, no AppDelegate forwarding, no google-services.json)
- other native adds (haptics, share, splash, status bar) read as cosmetic
- new user lands on Spaces tab showing "No spaces yet"
Fix: make iOS push work on device (APNs + AppDelegate). Add one more
native-only feature (Face ID / passcode app lock). Populate the first
screen for new users.

### 2. Google Play — photo/video permissions and Data Safety
Guideline: Photo and Video Permissions policy; Data Safety accuracy.
Evidence: AndroidManifest.xml declares READ_MEDIA_IMAGES and
READ_MEDIA_VIDEO; uploads go through WebView file input and system picker,
so the permissions are not needed. STORE_DISCLOSURES.md mis-answers
Data Safety for photos/videos and the Telegram mirror.
Fix: delete both READ_MEDIA_* lines. Keep CAMERA and RECORD_AUDIO.
Re-answer Data Safety.

### 3. Reports of alleged crimes by named agencies and officials
Guideline: Apple 1.7 (crime reporting must involve local law enforcement),
1.1.1 (defamation).
Evidence: /talk shows posts alleging Customs bribe demands of N50k-N200k
per container. No law-enforcement pathway in the app.
Fix: add "Send to EFCC / ICPC" action on every report, using their real
channels. Add an App Review note naming that pathway.
NOTE FROM TEAM: we are resolving this via the one-tap user-forward model
(see HANDOFF.md, "Legal decision") — the platform never auto-forwards.

### 4. App completeness and a crash risk
Guideline: Apple 2.1(a); Google Play crash/ANR bar.
Evidence:
- PushRegistrar.tsx calls PushNotifications.register() on startup; without
  Firebase this may fail or crash natively
- Onboarding.tsx slide 3 says "Coming soon" while /radar exists
- Reviewer would log in as the same account that authored seeded content
Fix: gate push registration. Remove "Coming soon" copy. Create a separate
reviewer account.

### 5. UGC moderation gaps
Guideline: Apple 1.2; Google Play UGC policy.
Evidence:
- dm-filter.ts filters text only — no check on uploaded images/video/audio
- FlagSheet.tsx has spam, harassment, hate, false info, scam, other —
  missing threats, doxxing, sexual content, minors
- Ban is keyed to an anonymous cookie session (easy to reset)
Fix: add missing flag reasons. Add an image moderation check. Tie bans to
something harder to reset. Document who reviews the queue.

## Secondary issues

- Third-party AI (Groq) and Telegram mirror without in-flow consent.
  Apple 5.1.2(i). Add an explicit consent checkbox on /submit.
- Account deletion leaves reports, comments, DMs. Apple 5.1.1(v). Extend
  the delete route or state retention clearly on the deletion screen.
- No real age gate. The only 17+ language is a line in /terms. Add a
  first-run age confirmation. Answer rating questionnaires as UGC.
- Evidence claim vs. feed. Apple 2.3.1. Feed reports show no attachments
  in the reviewer's fetch. Show evidence badge/thumb on each card.
- Radar and check-ins as location features. Apple 1.1.6 / 5.1.1. Label as
  user-reported, not live.
- Leaked demo password in docs/STORE_DISCLOSURES.md and .env.test not in
  .gitignore. URGENT — rotate password, purge from git history.
- Play production access may need a closed-test period for new accounts.
  Verify in Play Console.
- Viewport locks zoom (user-scalable=no). Minor a11y flag.

## Already compliant (positive findings)

- Account deletion in-app + web URL (5.1.1(v), Google deletion req)
- Reporting on every content type (Apple 1.2; Google UGC)
- Bidirectional blocking with DM coverage
- Terms acceptance enforced server-side
- Published support@ and report@ contacts
- Text filter on chat and comments
- No tracking, no ads, no IDFA → no ATT, no 3.1 issues
- No third-party login → 4.8 does not apply
- Purpose strings present; coarse location only; SDK 36; no external-storage
- Defamation handling: heuristic + AI hold + right-of-reply + civic reports
  never auto-hidden

## Verdict

(a) Approval probability on next submission: ~30% Apple, ~40% Google Play
    after permission fix.
(b) First change: iOS push on a real device + one native-only feature +
    populate the first screen.