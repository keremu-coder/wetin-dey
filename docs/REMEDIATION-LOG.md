> Note: commit hashes in this document reference the pre-2026-10-11 git history. That history was rewritten on 2026-10-11 to remove dead credentials. To find the equivalent commit, search the current history by message text instead of by hash.

# Security remediation log

Session: 2026-10-11, post-pentest. Every commit below is verified live on
Vercel. Working tree clean. Next session reads this top to bottom before
touching anything security-related.

## Commits this session

| # | Finding | Commit | What |
|---|---------|--------|------|
| — | (earlier) | 884261a..f93fec9 | Notifications bell feature + UX polish |
| 1 | Anon insert | 999cb68 | Revoke insert on reports/comments/flags/disputes/me_toos |
| 2a | Rate limit | 11d7bb4 | Fail-closed on DB error; IP-scoped bucket; use result |
| 2b | Rate limit | ec0e2ac | Pass IP to rate limiter in six write routes |
| 3 | Recovery codes | c2e070e | HMAC-SHA256 hash; one-time display; hash-based lookup |
| — | Compliance | f93fec9 | Hold no-evidence reports (matches SPEC evidence rule) |
| 5 | Cron | 8052247 | Fail closed when CRON_SECRET unset |
| 7a | Info leak | b29564e | Stop leaking "Server error: <msg>"; log server-side |
| 7b | Origin check | 5674f11 | Unify originAllowed → sameOrigin; fail-closed |
| — | Legal docs | 55b765e | NDPA 2023 replaces NDPR; reword IP claims; remove footer copy |
| 4 | Media metadata | 078e58a | ffmpeg-static stripper on video/audio uploads |
| — | Media infra | 623dd1f | Ship ffmpeg-static binary with Vercel function |
| 6 | CSP nonce | 64e3cf4 | Per-request nonce in middleware; drop unsafe-inline |

## What's still open

### Finding 7c — Next.js upgrade (dedicated session)

14.2.35 is the last 14.x release. The security backport line is
`next@15.5.27`. Upgrade breaks every route with `{ params }` — they become
`Promise<...>` and need `await params`. Also `cookies()`, `headers()`,
`draftMode()` become async. ~15-20 files. Budget 2-3 hours with testing.

**Additional change needed for the upgrade:** in `app/layout.tsx`, the
nonce read `headers().get("x-csp-nonce")` becomes
`(await headers()).get("x-csp-nonce")` and `RootLayout` becomes `async`.

### From the five-expert review, still open

- Disputed state hides body, keeps record (needs a product decision)
- Per-report handle option (pattern-of-life defense)
- Weighted flag thresholds (currently raw count)
- Moderator runbook doc
- Native push wiring (Firebase + APNs — needs Mac)
- Biometric app lock (@capacitor/biometric — needs device)
- Git history purge (BFG for the old leaked password)

### Before App Store submission

- Git history purge
- Play Data Safety form (browser, in Play Console)
- App Store Connect submission — notes drafted in APP-REVIEW-NOTES.md

## Critical lessons from this session

**PowerShell `-Include` treats `[id]` as a glob.** Every grep for files in
`app/api/reports/[id]/` missed them until we switched to
`Get-ChildItem -Filter "*.ts"` + `Select-String -LiteralPath`. When
searching this repo, always use the second form.

**Every `.Replace()` anchor must include exact leading whitespace.**
Multiple silent no-ops tonight were caused by omitting leading indentation
or by em-dash/middot mismatches. When an anchor fails, dump the byte
lengths of the target lines with `[System.Text.Encoding]::UTF8.GetBytes`
and match against that.

**One file per paste. Always.** Multi-file pastes get mangled by the
terminal — missing `@'` openers, swallowed line breaks. Every successful
change tonight was a single-file paste with `WriteAllText` + a
`Select-String` verification.

**`[System.IO.File]` uses .NET's CWD, not PowerShell's.** Always pass an
absolute path. Relative paths silently resolve to `C:\Windows\system32`.

## Resume point

HEAD when this doc was written: 64e3cf4. Vercel green. Working tree clean.
Run `git log --oneline -5` to confirm before starting.

The next thing to do — if continuing security work — is the Next.js
upgrade (finding 7c). If continuing feature work, the evidence-hold and
notification features are complete and could use real-user testing.

Read HANDOFF.md next, then TONIGHT.md, then this file.## Known follow-up (not yet fixed)

**DB-error messages leak in ~55 routes.** Pattern: Response.json({ error: error.message }, { status: 500 }) passes the raw Supabase/Postgres error text to the client, which includes column names, constraint names, and SQL fragments. Not a rejection risk under the reviewed scope (the Apple/Play reviewer did not flag it). Fix in a dedicated session with a careful regex sweep: replace each error.message in a response body with a generic string and add a console.error before the return. app/api/block/route.ts alone has 4 sites. Do NOT bulk-edit at 4am.
