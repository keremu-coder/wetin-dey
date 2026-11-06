# Security and threat model

## Who I am protecting people from
Someone who wants to find out who filed a report: a person named in it, an
agency, or a curious stranger. They can look at everything public on the site,
and they can try to work backwards from a photo, a username or a cookie.

## What protects the reporter
- **Photos, video and audio lose their hidden data.** Every photo is re-encoded on the server, then
  checked again for GPS. If any is left, it is re-built from raw pixels. The test
  `lib/exif.test.ts` builds a JPEG that really has GPS in it and proves it is gone.
  It runs on every push in GitHub Actions. Video and audio go through ffmpeg
  with all metadata removed, and the upload is refused if that step fails.
- **No analytics.** There is no tracking script or analytics package in the app.
- **No name or email.** A visitor gets a random session ID in a cookie. The
  cookie is signed with a server secret, so it cannot be forged. It is
  `httpOnly`, `secure` and `sameSite=lax`, so page scripts cannot read it, and
  signing out makes old copies stop working.
- **Public pages never show the session ID.** The code strips it before sending.
- **IP addresses are hashed.** The hash uses a server secret. It is used for rate
  limits and for banning abusers, not for showing to anyone.
- **Reports can be removed.** If a report is hidden, its evidence file is deleted
  too, and deleting an account removes the person's data or marks it "deleted".

## What this does not protect against (known limits)
- **Me, as the operator.** The database links a report to a session ID and an IP
  hash. Anyone with my database key could see that link. I do not look, but the
  link exists.
- **What is in the picture.** A face, a street sign or a voice can identify
  someone. I strip metadata, not content.
- **Video and audio are less tested.** The metadata removal exists, but only the
  photo step has an automated test.
- **A stolen cookie.** Whoever holds the cookie is that session for up to 90 days.
- **My hosting company.** Vercel and Supabase may keep their own request logs.
- **Writing style and timing.** What a report says, and when, can point at its
  author.

## Reporting a problem
Please report security issues privately through the contact on
https://www.wetindey.app instead of opening a public issue.
