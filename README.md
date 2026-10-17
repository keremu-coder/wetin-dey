# Wetin Dey

Nigerian community platform. Anonymous civic reports with permanent URLs.
Free-form community feed. Discord-style Spaces with live chat. Pidgin-first.
No identity. No ads on Talk Am, ever.

Live at: https://9jawatindey.vercel.app

## What this is

Two tabs, one app:

- **Talk Am** — civic accountability. Reports about agencies, officials, and
  public services. Every report requires evidence (photo, video, audio,
  voice note, or public link). Anonymous by default. AI formalizes each
  report into a Pidgin summary and an English summary.
- **Community** — free-form posts, discussion, and Spaces. Group chats for
  families, churches, estates, and friends. BBM-style sounds and haptics.

**Spaces** are Discord-style communities inside the app. Public or private,
with a member list, live chat, presence indicators, and voice broadcasts.

## Stack

- Next.js 15.5.28 App Router + TypeScript (strict)
- Tailwind CSS + custom design system (dark + light mode)
- Supabase (Postgres, Storage, Realtime, RLS)
- Groq API (`openai/gpt-oss-120b`) for report formalization
- Resend + Supabase Auth SMTP for verification emails
- Web Push for browser notifications
- Vercel hosting

## Setup

1. Copy `.env.example` to `.env.local` and set:
