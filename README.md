# Naija Archive

Anonymous corruption reporting for Nigeria. Permanent URLs. Pidgin-first. No identity.

## Setup

1. Copy `.env.example` to `.env.local` and set:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
SESSION_SECRET
```

`SESSION_SECRET` must be a long random string. It signs the anonymous session cookie.

2. Run the SQL migration against your Supabase project:

```bash
npx supabase db query --file migrations/001_initial.sql
```

Or paste `migrations/001_initial.sql` into the Supabase SQL editor and run it.

3. Install and run:

```bash
npm install
npm run dev
```

## First admin

Visit the site once so the `na_session` cookie is issued. In DevTools → Application → Cookies, copy the value of `na_session` **before the first dot**. That is your `session_id`.

```sql
INSERT INTO admins (session_id) VALUES ('PASTE_NANOID_FROM_COOKIE');
```

Then open `/admin`.

## Tests

```bash
npm test
```

`lib/exif.test.ts` fails if GPS survives the client or server EXIF strip.

## Rules

- Reports are never deleted.
- Formalization runs after publish and must not block the report URL.
- No analytics packages.
