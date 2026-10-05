# Wetin Dey — Project State

## What it is
Nigerian community platform. Anonymous civic reports + social community + Discord-style spaces.
Live at: https://9jawatindey.vercel.app
Repo: https://github.com/keremu-coder/wetin-dey

## Login (for testing)
Email: kpekpes@wetindey.app
Password: REMOVED-CREDENTIAL

## Stack
- Next.js 14.2 App Router + TypeScript
- Tailwind CSS + custom design system (dark + light mode)
- Supabase (Postgres, Storage, RLS)
- Groq API (Llama 3.3 70B) for AI formalization
- Vercel hosting
- Browser at C:\Users\kerem\Projects\naija-archive

## Live sections
- `/` — Talk Am feed (civic reports, evidence required)
- `/community` — Normal Feed (free-form posts)
- `/communities` — Spaces list (Discord-style)
- `/c/[slug]` — Space detail page
- `/c/[slug]/chat` — Live group chat with BBM ping
- `/r/[id]` — Report detail + comments + voting
- `/me` — My profile (shows my spaces, my posts)
- `/settings` — Twitter-style settings hub
- `/search`, `/inbox`, `/takedown`, `/signin`, `/join`, `/forgot-password`

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

## Missing / TODO
- Live video rooms (Phase 4)
- Real DMs with contact filter
- Government ID verification for institutions
- Cold-start seeding (5 reports in, target 20)
- Native mobile app

## Not committed to (decisions we made)
- NO ads on Talk Am, ever
- NO AI with delete/ban/approve authority
- NO reports ever deleted — labeled Disputed instead
- NO political slogans or tribal attacks
- NO religion attacks — but personal spiritual expression allowed