# Admin access: threat model

## How admin works
- A visitor has a random session ID in a cookie named `na_session`.
- The cookie looks like `<id>.<epoch>.<signature>`. The signature is HMAC-SHA256 over
  `id:epoch`, made with the server-only `SESSION_SECRET` (at least 32 characters). The
  server checks it in constant time. Without the secret, nobody can make a valid cookie
  for a chosen ID.
- Admin means one thing: your session ID is a row in the `admins` table. Every admin page
  and admin API reads the cookie, verifies the signature, then looks that ID up on the
  server. Nothing the browser sends can say "I am admin".

## Making the first admin
Insert only the **session ID**, which is the part of the cookie before the first dot. Do
not paste the whole cookie. The ID alone is useless to an attacker because they still
need a valid signature. The insert runs in the Supabase SQL editor with the project owner's
access.

## Why a visitor cannot make themselves admin
- `admins` has row-level security turned on and no public policy. Only the server's
  service key can write to it. The public API key cannot read or write it.
- Cookies are `httpOnly`, `secure` and `sameSite=lax`, and the site sends a strict
  Content-Security-Policy. Page scripts cannot read another visitor's cookie.
- Seeing another visitor's session ID does not help: a forged cookie needs the signature.

## Revoking access
The epoch number is inside the signature. Signing out, or rotating the recovery code,
raises it, and every older cookie stops working.

## What is still weak (honest list)
1. **The cookie is the only proof.** If someone steals the admin's cookie (a stolen or
   unlocked phone, malware on the device), they are admin until it is revoked.
2. **It lasts 90 days.** There is no shorter limit for admin sessions.
3. **No second factor.** There is no code or device check at the admin page.
4. **No rate limiting on `/admin` or the admin APIs.** Non-admins get a 404, and guessing
   a valid signature is not realistic, but a limit would still be good practice. The
   admin APIs also check the request origin.

## What I would add next
Shorter admin session lifetime, a re-check of the admin's session every day, a second
factor for admin actions, and a rate limit on admin routes.
