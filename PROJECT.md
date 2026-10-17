# Wetin Dey — Project State

## What it is
Nigerian community platform. Anonymous civic reports + social community + Discord-style spaces.
Live at: https://9jawatindey.vercel.app
Repo: https://github.com/keremu-coder/wetin-dey

## Login (for testing)
Test credentials live in .env.test (gitignored). Do not commit them here.

## Stack
- Next.js 15.5.28 App Router + TypeScript
- Tailwind CSS + custom design system (dark + light mode)
- Supabase (Postgres, Storage, Realtime, RLS)
- Groq API (openai/gpt-oss-120b) for AI formalization
- Resend + Supabase Auth SMTP for verification emails
- Web Push for browser notifications
- Capacitor native shell (iOS + Android) — scaffolded, not yet shipped
- Vercel hosting
- Working directory: C:\Users\kerem\Projects\naija-archive

## Live sections
- / — Talk Am feed (civic reports, evidence required)
- /community — Normal Feed (free-form posts)
- /communities — Spaces list (Discord-style)
- /c/[slug] — Space detail page
- /c/[slug]/chat — Live group chat with BBM ping
- /r/[id] — Report detail + comments + voting
- /me — My profile (shows my spaces, my posts)
- /notifications — In-app notifications (replies, mentions, comments)
- /settings — Twitter-style settings hub
- /search, /inbox, /takedown, /signin, /join, /forgot-password

## Working features
- Anonymous reporting (no phone/email required)
- Evidence-required reports (photo/video/audio/voice/link)
- AI formalization (Pidgin + English summaries)
- Two-tab + Spaces structure
- Text + voice comments with replies
- Post + comment voting (up/down/me-too, toggle)
- Community chat with realtime, presence, BBM ping
- Follow, block, profile pages
- Light + dark theme with persistence
- Age gate, legal pages, dispute flow
- Search, settings sub-pages (10 of them)
- Presence (online/away/offline)
- In-app notifications bell (reply, mention, comment) with 30s polling + unread badge
- Logged-out homepage hero (identity + trust markers + recent record + CTA) - `components/HomeLoggedOut.tsx`
- Report card with 16px radius, theme-safe status badges, ✓ on resolved, "e dey affect me too" me-too phrasing
- AI disclosure on report detail (visible "AI-generated" chip + collapsible "Read clean English version")
- Rate limiting on 20+ routes (see `lib/rate-limit.ts` callers)
- Evidence cleanup on report hide - `lib/evidence-cleanup.ts`
- Reputation schema + computeTier helper - `lib/reputation.ts` (backend only, no UI)

## Missing / TODO
- Live video rooms (Phase 4)
- Real DMs with contact filter
- Government ID verification for institutions
- Cold-start seeding (5 reports in, target 20)
- Native shell: build + run on device (Android needs JDK 17 + Android Studio; iOS needs a Mac with Xcode)
- Native push wiring (needs Firebase project + FCM_SERVICE_ACCOUNT_JSON env var)
- Notification deep-link for reply/mention to actual space (currently lands on /inbox)

## Not committed to (decisions we made)
- NO ads on Talk Am, ever
- NO AI with delete/ban/approve authority
- Non-violating reports are never deleted — labeled Disputed instead. Violating content (threats, doxxing, hate, sexual content, minors, illegal content, confirmed defamation) is removed from public view within 24h; the row is preserved for legal and audit purposes.
- NO political slogans or tribal attacks
- NO religion attacks — but personal spiritual expression allowed