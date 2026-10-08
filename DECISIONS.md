# Architecture decisions (why we built it this way)

## Product decisions

- **Two-tab split**: Talk Am (civic) vs Community (free form). Reason:
  keeps civic accountability sacred, allows social.
- **Spaces** = Discord-style communities. Public and private both.
  Reason: users need places, not just feeds.
- **BBM-style chat**: Ping sound, haptic, warm palette. Reason: Nigerian
  nostalgia, feels alive.
- **Evidence-required reports**: No evidence, no publish on Talk Am.
  Reason: credibility + defamation defense.
- **Never delete reports that don't violate rules**: Label Disputed
  instead. Reason: archive integrity + legal safe harbor.
- **Violating content is removed from public view within 24 hours**:
  threats, doxxing, hate, sexual content, minors, illegal content, and
  confirmed defamation. Reason: Apple 1.2 and Google Play UGC policy
  require 24-hour removal. The row is preserved for legal defense but is
  never shown publicly again.
- **Anonymity first**: No phone/email for anonymous reports. Reason:
  reporter safety in Nigeria.
- **No ads on Talk Am**: Ever. Reason: trust model. Community tab can
  monetize later.
- **Two identities eventually**: Reporter vs social. NOT built yet.
  Reason: legal armor.
- **Age gate 17+**: Apple + Play requirement.
- **Design language**: Amber/terracotta icons, green only for CTAs.
  Reason: Nigerian warmth, not Silicon Valley.
- **Email is optional and recovery-only**: Not verified in this version
  unless the user completes Supabase email confirmation. Password reset
  is disabled for unverified emails to prevent takeover of an address
  the user doesn't control.
- **Account deletion keeps reports + comments**: They are detached from
  the user (session_id tombstoned to "deleted", author_handle nulled) so
  the archive stays intact but the user is unlinkable. DM messages keep
  their sender_id because it has an FK to sessions; the sessions row is
  scrubbed (email nulled, auth_user_id nulled, handle changed) so it
  cannot be logged into again.

## Technical decisions

- **Supabase module singletons** (not React `cache`): works on Next 14.2,
  actual ~30% speedup.
- **Realtime chat, no polling**: subscribe to `community_messages`
  inserts, use payload directly. Reason: was re-fetching 100 messages per
  new message.
- **Presence via last_seen_at**: ping every 60s, dot turns
  green/orange/grey at <2min/<15min/>15min.
- **Voice notes as first-class**: storage in `voice-notes` bucket.
  Reason: Nigerian default comm mode.
- **Chat sounds synthesized**: Web Audio API, not audio files. Reason: no
  download cost.
- **RLS on every table**: even when client uses service role. Reason:
  defense in depth.
- **Exact-match handle lookups via generated `handle_lower` column**:
  `ilike` treats `_` and `%` as wildcards, so blocking "john_doe" could
  match "johnxdoe". The generated column removes that class of bug.
- **Ban + terms guards via `lib/guards.ts`**: one helper instead of
  repeating the same 403 check in every write route.
- **Blocks are bidirectional**: if A blocks B, neither sees the other's
  content. Implemented as a single `getBlockedIds()` query that returns
  the union of both directions.
- **Auto-hide requires trusted reporters**: only sessions with an email
  or 24h+ age count toward the 3-reporter auto-hide threshold. Civic
  reports (`report_am`) are never auto-hidden.
- **Supabase Auth SMTP via Resend**: signup confirmation emails go
  through Supabase's auth flow, which is wired to Resend as the SMTP
  provider. We do not send our own auth emails.

## Things we tried and abandoned

- **Gemini API**: API key format is broken on REST endpoint.
- **llama-3.3-70b-versatile on Groq**: retired Aug 2026. Using
  `openai/gpt-oss-120b` instead.
- **React `cache` for Supabase client**: not exported in Next 14.2,
  silently failed.

## Open questions

- Live video rooms: LiveKit vs Agora vs custom WebRTC
- Government ID verification: requires NIMC/CBN approval, 3-month process
- When to ship native mobile app