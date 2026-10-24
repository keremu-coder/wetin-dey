# HANDOFF — continue here in a fresh chat

Last updated: 2026-10-10, late session. Write a new section whenever a
chat fills up.

## What this file is

Self-contained continuation doc. If you (an AI) are reading this at the
start of a new chat, everything you need is here. Do not start from
scratch. Confirm the current HEAD with `git log --oneline -5` and then
read this top to bottom before doing anything.

## How to work with this repo (the pattern that works)

- Terminal: PowerShell on Windows. Working dir C:\Users\kerem\Projects\naija-archive
- The user does not edit code by hand. Give COMPLETE paste-able PowerShell
  scripts that read the file, do .Replace() calls with Write-Host step
  markers, then WriteAllText with UTF8 no-BOM.
- ALWAYS write ONE FILE PER PASTE. Long multi-block pastes get the here-string
  opener eaten by the terminal and the content runs as commands. This has
  happened twice. Do not repeat it.
- After every paste: expect a step-marker output and a before/after length
  line. Then run a Select-String to verify the change landed.
- Then `git add` + commit + push. Vercel rebuilds. Confirm the Deployments
  page top row goes green before moving to the next item.
- Do NOT commit dead code. If a change needs a second half, do both halves
  in the same session before committing.

## Where we are right now

- Repo: https://github.com/keremu-coder/wetin-dey
- Live: https://wetindey.app
- HEAD: latest commit after the textareaRef type fix (Vercel green).
- Working tree: clean.
- Docs synced this session: SESSION_LOG.md, PROJECT.md, BACKLOG.md.

## What shipped this session (notifications feature)

13 commits. All live. What's in it:

- migration 012: public.notifications table (recipient_id cascade,
  actor_id set-null, two indexes, RLS enabled)
- lib/notifications.ts: createNotification() helper — self-check +
  bidirectional block check + 140-char preview slice + swallowed errors
- GET /api/notifications (50 rows, cursor via ?before=, actor handle join)
- GET /api/notifications/unread (count for badge)
- POST /api/notifications/read ({all:true} or {id})
- createNotification wired into chat replies, chat mentions (matched on
  sessions.handle_lower), report comments (top-level only)
- scripts/check-schema.mjs now guards sessions.handle_lower
- LiveStateProvider: polls /api/notifications/unread every 30s + on
  visibilitychange/focus; exposes useLiveNotificationsUnread +
  useLiveRefreshNotifications
- app/notifications/page.tsx (server) + NotificationsList.tsx (client)
- Nav bell between Search and Post, accent/green badge, distinct from
  the red DM badge on the burger

Known v1 gap: tapping a reply/mention notification lands on /inbox, not
the actual space. Deep-link needs a community_messages -> communities join.

## The type-fix that unblocked Vercel

Every commit from `ChatRoom: ren...` downward was red on Vercel for one
root cause: React 18 typings reject `useRef<HTMLTextAreaElement | null>(null)`.
The `| null` in the generic is React 19 style. Fixed in two files:

- components/ChatComposer.tsx: prop type changed to
  `React.RefObject<HTMLTextAreaElement>` (no | null)
- app/c/[slug]/chat/ChatRoom.tsx: useRef generic changed to
  `useRef<HTMLTextAreaElement>(null)` (no | null)

Local `npm run build` then passed. Push. Vercel went green.

## Verified clean (Audit verified 2026-10-24)

The external pre-flight review flagged a live password leak in a public
repo. Items to verify / fix:

- docs/STORE_DISCLOSURES.md has the demo password in plaintext
- .env.test is not in .gitignore
- Same account the Apple reviewer would log in as

Steps:
1. Rotate password in Supabase dashboard -> Authentication -> Users
2. Remove the credential line from STORE_DISCLOSURES.md
3. Add .env.test to .gitignore
4. Purge from git history (git filter-repo or BFG) — the old commit is
   public, so removal from HEAD alone is not enough
5. Create a separate reviewer@wetindey.app account for App Store review
   (do NOT have reviewers log in as the seeded author)

## Master priority list (from docs/PRE-FLIGHT-REVIEW.md)

Read that file first. Then work this list in order.

### Phase 1 — Quick wins (one session)
- [x] (Done) Gate PushNotifications.register()
      (components/PushRegistrar.tsx) — currently calls register() on
      startup; may crash Android without google-services.json
- [x] (Done) Remove "Coming soon" copy
- [x] (Done) Hide Radar tab until it has real data
- [x] (Done) FlagSheet categories
      (components/FlagSheet.tsx) — currently has spam/harassment/hate/
      false-info/scam/other
- [ ] Create reviewer@wetindey.app with a non-author seed report
- [x] (Done) Verify age gate (PROJECT.md claims
      it ships — confirm on live site)
- [x] (Done) Verify evidence thumbnails (Apple 2.3.1 —
      "evidence required" is the core claim)

### Phase 2 — Android + data safety (one session)
- [x] (Done) Remove READ_MEDIA_IMAGES and READ_MEDIA_VIDEO from
      android/app/src/main/AndroidManifest.xml
- [ ] Keep CAMERA and RECORD_AUDIO
- [ ] Rewrite Data Safety answers: photos/videos optional, Telegram
      mirror disclosed
- [ ] Fix STORE_DISCLOSURES.md inaccuracies

### Phase 3 — Apple 4.2 part 1: native push (two sessions)
- [ ] Create Firebase project
- [ ] Add google-services.json to android/app/
- [ ] Wire FCM in the Capacitor app
- [ ] iOS: add Push capability in Xcode, generate .entitlements, wire
      AppDelegate.swift to forward device tokens
- [ ] Test on physical devices both platforms

### Phase 4 — Apple 4.2 part 2: biometric lock (one session)
- [ ] Install @capacitor/biometric or capacitor-native-biometric
- [ ] Add Settings -> "Require Face ID / fingerprint to open"
- [ ] Hook into app shell launch
- Rationale: a Safari bookmark cannot lock itself with your face. This
  is the native-only feature Apple 4.2 wants.

### Phase 5 — Populated first screen (one session)
- [ ] Public Spaces shown on signed-out Spaces tab
- [ ] "Recommended spaces" section for new users with no memberships
- [ ] Seed content: 3-5 spaces with a handful of messages

### Then submit.

## Legal decision — one-tap agency forward (v2, after submission)

User's original idea: a bot that auto-emails complaints to agencies
(EFCC, ICPC, NPF). We are NOT building it that way. Reason:

- Right now Wetin Dey is a HOST. Auto-emailing makes it the PUBLISHER,
  which carries direct defamation exposure in Nigeria.
- Nigerian law does not have a US-style Section 230 safe harbor. The
  Falana v. Meta ruling in Lagos State High Court found Meta liable even
  after removal. NITDA's Code of Practice for Internet Intermediaries
  and the proposed Online Harms Protection Bill both push toward
  duty-of-care, not safe harbor.

The version we WILL build (v2, post-approval):

- On every report page: a "Forward to EFCC" / "Forward to ICPC" button
- Tap -> bottom sheet shows the AI-formalized report, evidence links,
  pre-filled subject line
- Two actions: "Open EFCC web form" (deep link) OR "Send via email"
  (opens the user's mail client, everything pre-filled)
- USER reviews and USER sends. Platform stays a host.
- Routing key: the AI already produces agency_canonical in its JSON
  output. Hardcode 8-12 agencies -> official report URLs. No scraping.

This satisfies Apple 1.7 (a real pathway to law enforcement), keeps the
platform on the host side of the line, and — per the user's product
vision — gives Talk Am a loop that closes.

ACTION: user should consult a Nigerian technology lawyer before shipping
this. The legal landscape is evolving. The citations above came from
general reasoning, not direct legal research — validate with counsel.

## Things not to lose track of

- 19 npm vulnerabilities (3 critical) from earlier session log
- No SESSION_LOG entry for 2026-10-09
- Item 2 (native nav pattern) from the original Apple 4.2 polish list
  still needs the reviewer's screenshot
- community_message notification deep-link -> /inbox is a v1 fallback,
  v2 fix is the message->community join
- Drafted feature doc for one-tap agency forward should go into
  BACKLOG.md under "Next 2 weeks"

## Reference docs to read in a fresh chat

Read these first, in this order:
1. HANDOFF.md (this file)
2. docs/PRE-FLIGHT-REVIEW.md (external review)
3. PROJECT.md (current state)
4. DECISIONS.md (why things are the way they are)
5. BACKLOG.md (what's queued)
6. SESSION_LOG.md (last 10 sessions)
7. PREFERENCES.md (how to talk to the user)

## Continuation prompt (for the next chat)

Paste this at the start of the new chat, plus the contents of this file:

---
I'm continuing work on Wetin Dey, a Next.js + Capacitor app. Read HANDOFF.md
and docs/PRE-FLIGHT-REVIEW.md first. Confirm current HEAD with
git log --oneline -5. Then work the master priority list in order, one
file per paste, verify before commit. Do not commit dead code. Do not
auto-forward content to third parties — the legal decision in HANDOFF.md
is final unless I say otherwise. Start by confirming the password leak
fix is done.
---