# Migration plan: Next.js 14.2 → 15.5.27 backport, then optionally 16.4

**Status:** planning document, not yet executed.
**Generated:** 2026-10-10. Updated 2026-10-11: dead commit hash removed.

**Prerequisite:** `sharp` has already been bumped to 0.35.5.

## Why this is needed

`npm audit` flags 7 critical/high advisories in the Next 14.2 line. Two of them
apply to our configuration:

- **Unauthenticated RCE in Image Optimization API when AVIF is used**
  (GHSA-2xp9-vwfh-vxw4). We serve user-uploaded images through Next's image
  pipeline. Applicable.
- **SSRF in rewrites via attacker-controlled destination hostname**
  (GHSA-p9j2-gv94-2wf4). We have `rewrites` in next.config.mjs. Applicable.

The remaining 21 advisories are either not applicable to our config (Windows-hosted
RCE, CSP nonce XSS, i18n middleware bypass) or are DoS against narrow endpoints.
The two above are the reason to upgrade. Not urgency, but not ignorable either.

## Why this is not a small task

**44 files** in `app/` read `params` or `searchParams` synchronously. Next 15
made those into Promises. Every single one breaks the moment we upgrade.

30 API routes:
  app/api/comments/[id]/vote/route.ts
  app/api/communities/[slug]/avatar/route.ts
  app/api/communities/[slug]/broadcasts/route.ts
  app/api/communities/[slug]/checkins/request/route.ts
  app/api/communities/[slug]/checkins/route.ts
  app/api/communities/[slug]/join/route.ts
  app/api/communities/[slug]/members/route.ts
  app/api/communities/[slug]/messages/route.ts
  app/api/communities/[slug]/route.ts
  app/api/communities/route.ts
  app/api/dm/threads/[id]/messages/route.ts
  app/api/dm/threads/[id]/read/route.ts
  app/api/dm/threads/[id]/route.ts
  app/api/messages/[id]/react/route.ts
  app/api/posts/[id]/vote/route.ts
  app/api/posts/[id]/route.ts
  app/api/radar/route.ts
  app/api/reports/[id]/comments/route.ts
  app/api/reports/[id]/dispute/route.ts
  app/api/reports/[id]/flag/route.ts
  app/api/reports/[id]/me-too/route.ts
  app/api/reports/[id]/reply/route.ts
  app/api/reports/[id]/route.ts
  app/api/reports/route.ts
  app/api/search/route.ts
  app/api/sessions/fonts/route.ts
  app/api/sessions/profiles/route.ts
  app/api/sessions/statuses/route.ts
  app/api/settings/font/route.ts
  app/api/settings/status/route.ts

14 pages:
  app/c/[slug]/chat/page.tsx
  app/c/[slug]/checkin/page.tsx
  app/c/[slug]/page.tsx
  app/community/page.tsx
  app/explore/page.tsx
  app/inbox/[thread_id]/page.tsx
  app/me/page.tsx
  app/r/[id]/page.tsx
  app/radar/page.tsx
  app/reset-password/page.tsx
  app/submit/page.tsx
  app/talk/page.tsx
  app/u/[handle]/followers/page.tsx
  app/u/[handle]/following/page.tsx
  app/u/[handle]/page.tsx

## Change pattern

API route before:
  export async function GET(req, { params }: { params: { slug: string } }) {
    const x = params.slug;
  }

API route after:
  export async function GET(req, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const x = slug;
  }

Page before:
  export default async function Page({ params, searchParams }: {
    params: { id: string };
    searchParams: { tab?: string };
  }) { const x = params.id; const y = searchParams.tab; }

Page after:
  export default async function Page({ params, searchParams }: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ tab?: string }>;
  }) { const { id } = await params; const sp = await searchParams;
       const x = id; const y = sp.tab; }

## Order

Phase 1 (Next 14 -> 15): pages first, routes second. Build locally after each
change. Commit + push + verify on Vercel per file. Est 3-4 hours.

Phase 2 (Next 15 -> 16): React 18 -> 19. Only after Phase 1 is verified on
device for 24h. Est 2-3 hours.

## Config changes (Phase 2)

next.config.mjs:
  - experimental.serverComponentsExternalPackages -> serverExternalPackages
  - experimental.staleTimes -> cacheLife (different shape)
  - verify next/image remotePatterns schema

## React 19 changes to grep for (Phase 2)

  - useFormState -> useActionState
  - forwardRef (works but deprecated; ref is a regular prop now)
  - children union types simplified to ReactNode
  - Strict Mode double-invocation is stricter; non-idempotent effects will fail

## Known gotchas

1. searchParams becomes a Promise but TS only warns. Forgetting await silently
   renders [object Promise]. Check visually on every page.
2. generateMetadata receives async params too. Grep for it before starting.
3. @vercel/og (0.6.8) and satori (0.12.1) may need bumps for React 19.
   Check BEFORE starting Phase 2.
4. next/font loader changes in 16. We use FONT_VARIABLE_CLASSES in lib/fonts.ts.
5. Capacitor native shell loads production URL. During the upgrade the shell
   will load a broken build. Recommend: point server.url at a preview deploy
   during migration, swap back when verified.
6. Hydration mismatches from React 19 are different from 18. Re-run the
   Africa/Lagos timezone checks and console-clean checks on every page.

## Verify before running npm audit fix --force

It will do Next 14 -> 16 in one shot and break every page.
Do NOT run it. Do the phases manually.

## Verification checklist (Phase 1 complete means)

- npm run build passes clean
- Every one of the 14 pages loads without hydration warnings
- Every one of the 30 routes responds (test one POST + one GET each)
- Image upload still strips EXIF
- Chat realtime still works (open two browsers)
- Push notifications still fire
- Bottom nav icons still render filled/outline
- Toast system still fires on errors
- No CSP violations in console