# Backlog — what's pending

## Post-launch security follow-ups (from audit #2)

- [ ] **Per-target-email rate limit on signin / forgot-password.** The
      current limiter buckets by session + IP, both of which rotate
      freely (new cookie + new IPv6 /64). A targeted attacker can still
      brute-force a single known email by rotating both. Fix: add a
      `signin_email_attempts` table keyed on email + window, limited
      independently of IP. ~1 session of work. (Audit finding 8 partial.)
- [ ] **Migrate `voice-notes` bucket to private + signed URLs.** Chat
      audio, voice comments, and broadcast audio all live in a public
      bucket. Moving to signed URLs on read requires touching every
      playback surface (ChatRoom, comment threads, broadcast player).
      Medium effort, real privacy win. `evidence` bucket same story —
      deferred to Batch C follow-up after store submission. (Audit
      finding 18 follow-up.)
- [ ] **Private Space invite tokens.** Private Spaces are currently
      "unlisted" — anyone with the slug can join. Real feature work:
      invite link with token, owner approval flow, member list
      visibility rules. Post-launch. (Audit finding 15.)
- [ ] **Reputation tier display UI (Batch 12).** Schema and helper are
      in place (`lib/reputation.ts`, migration 031). Scoring triggers
      not wired. Display opt-in not built. Deferred until after we see
      real user behavior for 4-6 weeks.

## 🚨 PRE-SUBMISSION BLOCKERS

These MUST be done before submitting to the App Store or Play Store.
Store reviewers will test every one of them.

- [ ] **Buy `wetindey.app` and set up email forwarding** to a working inbox.
      Currently `support@wetindey.app` is referenced in `/privacy`,
      `/terms`, `/support`, `/guidelines` and does not resolve (no MX
      records). Reviewers clicking support will find a dead address.
      After the domain is bought + forwarding configured, decide whether
      to keep the hardcoded email or extract to `NEXT_PUBLIC_SUPPORT_EMAIL`.
- [ ] **Run `npm audit`** — 16 vulnerabilities (3 critical) currently
      flagged by Dependabot. Fix or document before submission.
- [ ] **Test the AI disclosure on a live report** — verify the
      "AI-generated" label and "Read clean English version" disclosure
      render correctly on `/r/[id]`.

## Right now
- [ ] Test BBM chat on phone (ping sound, haptic, speed)
- [ ] Verify realtime: send from 2 browsers, message appears in <1s
- [ ] Seed 15 more public-record cases (have 5)
- [ ] Notifications smoke test on live site (reply / mention / comment / self-check / block-check)

## This week
- [ ] Live video rooms inside spaces (church, business)
- [ ] Real DMs with contact-info filter
- [ ] Share card images (OG images for WhatsApp)
- [ ] Cold-start: send link to 3 activists

## Next 2 weeks
- [ ] Realtime reactions on comments
- [ ] Notification deep-link for reply/mention to actual space (currently /inbox fallback)
- [ ] Public spaces discovery improvements
- [ ] Report detail page: evidence tier badge

## This month
- [ ] Government ID verification flow
- [ ] Institutional accounts (churches, schools, transport)
- [ ] Business community tier (paid)
- [ ] Native shell: build + run on device, wire native push

## Not building (decided)
- Ad network on Talk Am
- AI with delete/ban authority
- Anonymous DM without filter
- Any feature requiring phone number

## Ideas parking lot
- Civic reputation badges (Community Pillar, Truth Verifier)
- Weekly email digest
- Press kit + media outreach
- Diaspora-specific community features