# Architecture decisions (why we built it this way)

## Product decisions
- **Two-tab split**: Talk Am (civic) vs Community (free form). Reason: keeps civic accountability sacred, allows social.
- **Spaces** = Discord-style communities. Public and private both. Reason: users need places, not just feeds.
- **BBM-style chat**: Ping sound, haptic, warm palette. Reason: Nigerian nostalgia, feels alive.
- **Evidence-required reports**: No evidence, no publish on Talk Am. Reason: credibility + defamation defense.
- **Never delete reports**: Label Disputed instead. Reason: archive integrity + legal safe harbor.
- **Anonymity first**: No phone/email for anonymous reports. Reason: reporter safety in Nigeria.
- **No ads on Talk Am**: Ever. Reason: trust model. Community tab can monetize later.
- **Two identities eventually**: Reporter vs social. NOT built yet. Reason: legal armor.
- **Age gate 17+**: Apple + Play requirement.
- **Design language**: Amber/terracotta icons, green only for CTAs. Reason: Nigerian warmth, not Silicon Valley.

## Technical decisions
- **Supabase module singletons** (not React `cache`): works on Next 14.2, actual ~30% speedup.
- **Realtime chat, no polling**: subscribe to `community_messages` inserts, use payload directly. Reason: was re-fetching 100 messages per new message.
- **Presence via last_seen_at**: ping every 60s, dot turns green/orange/grey at <2min/<15min/>15min.
- **Voice notes as first-class**: storage in `voice-notes` bucket. Reason: Nigerian default comm mode.
- **Chat sounds synthesized**: Web Audio API, not audio files. Reason: no download cost.
- **RLS on every table**: even when client uses service role. Reason: defense in depth.

## Things we tried and abandoned
- **Gemini API**: AQ. key format is broken on REST endpoint.
- **llama-3.3-70b-versatile on Groq**: retired Aug 2026. Using `openai/gpt-oss-120b` instead.
- **React `cache` for Supabase client**: not exported in Next 14.2, silently failed.

## Open questions
- Live video rooms: LiveKit vs Agora vs custom WebRTC
- Government ID verification: requires NIMC/CBN approval, 3-month process
- When to ship native mobile app