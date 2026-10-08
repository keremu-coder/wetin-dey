# Wetin Dey — Legal Copy (Drafts)

> **Status: draft for lawyer review.** These are plain-language drafts
> written for a Nigerian anonymous civic-reporting platform. Hand to a
> Nigerian lawyer familiar with the Cybercrimes Act 2015, the Criminal
> Code Act, the Penal Code, and the NDPR before wider launch.
>
> Owner: Wetin Dey. Last updated: 2026-10-08.

---

## 1. Disclaimer

Wetin Dey is a community platform for anonymous civic reports from
Nigerian citizens. Reports are submitted by members of the public and are
**not independently verified by Wetin Dey**.

- The presence of a report on Wetin Dey is not a statement of fact by
  Wetin Dey. It is a statement made by an anonymous member of the public.
- Wetin Dey does not endorse, adopt, or confirm any claim made in any
  report, comment, or message on the platform.
- If you are named in a report and believe it is false, you can submit a
  dispute or a right-of-reply response (see section 4).
- Wetin Dey is not a substitute for reporting a matter to the Nigerian
  Police Force, the EFCC, the ICPC, or any other appropriate authority.
- Nothing on Wetin Dey constitutes legal advice.

## 2. Privacy Policy

### What we collect

**Anonymous reports, comments, and messages:** a random session
identifier stored in a signed HTTP-only cookie. No phone number. No
email address. No IP address logged for anonymous activity.

**Optional account recovery:** you may voluntarily attach an email
address or phone number to your session for account recovery. This is
optional and can be removed at any time. Reports you post remain
anonymous regardless. Emails are **not verified** in this version of the
app; see "Email verification" below.

**Files you upload:** photos, videos, audio, and voice notes. All EXIF
metadata (including GPS coordinates, camera model, and timestamp) is
stripped before storage.

**Presence:** a "last seen" timestamp, refreshed when you use the app.
This powers the online/away/offline indicators. You can hide your
presence entirely in Settings → Presence.

**Push notifications:** if you enable them, we store a push
subscription endpoint issued by your browser. You can disable this at
any time.

### What we do NOT collect

- Phone numbers (unless you voluntarily add one for recovery)
- Email addresses (unless you voluntarily add one for recovery)
- Precise location (Radar rounds to about 1 km; nothing finer is stored)
- IP addresses for anonymous reports
- Tracking pixels, fingerprinting scripts, or third-party analytics

### Email verification

Email addresses on Wetin Dey are **optional and recovery-only**. They
are not verified, and we do not use them to identify you or to send you
marketing. Do not use an email address that does not belong to you.

Because emails are not verified, **password reset is disabled** for
accounts whose email has not been confirmed. If you lose access to your
session, use the recovery code you were shown when you first signed up.

### Who processes your data

- **Supabase** (database, file storage, realtime) — EU region
- **Vercel** (hosting, edge network, blob storage) — global
- **Groq** (AI formalization of report text only, never files) — US
- **Telegram** (public mirror of reviewed reports only) — global

We do not sell your data. We do not run ads on the Talk Am civic feed.

### Your rights (NDPR)

Under the Nigeria Data Protection Regulation you have the right to:

- Access the personal data we hold about you
- Correct inaccurate data
- Request deletion of your data
- Withdraw consent for optional processing

To exercise any of these, contact support@wetindey.app. Because reports
are never deleted (see section 3), deleting your account removes your
identifying information from our system but does not remove the
anonymized report content itself.

## 3. Report retention and content removal

Wetin Dey operates a permanent archive. Reports are **never deleted**.
They are published at a permanent, timestamped URL and remain accessible
unless they violate our content rules (see section 6).

### Content that IS removed from public view

The following content is removed from public view **within 24 hours** of
being reported or detected:

- Threats of violence against any person or group
- Doxxing (someone's private contact info, home address, or financial details)
- Any content naming a person under 18 years old
- Sexual content involving minors
- Content promoting hatred of any ethnic, religious, or political group
- Content that is illegal under Nigerian law
- Confirmed defamation (see section 4)

"Removed from public view" means the content is no longer shown to any
user on the platform, in feeds, in search, or via the public JSON feed.
The underlying record is preserved in our internal records solely for
legal defense and audit purposes, and is never shown to the public again.
It is not exposed via any API or cached in any public surface.

### Content that is NOT removed

Reports that do not violate our rules are never deleted, even if their
subject disputes them. If a report is contested, we label it
**Disputed** and publish any verified rebuttal alongside it. The original
report and any attached evidence remain publicly accessible at the same
permanent URL.

### Account deletion

When you delete your account:

- **Removed immediately:** your email and phone number, your Supabase
  sign-in record, your avatar and any space avatars you uploaded, your
  voice broadcasts and their audio, your followers, following, and
  blocks, your push notification subscriptions, your check-ins, daily
  answers, radar signals, reactions, votes, and profile status.
- **Detached from you:** your reports and comments stay visible in the
  archive, but their session id and handle are replaced with a placeholder
  so they can no longer be linked to you.
- **Left in place:** your direct messages stay visible to the other
  participant, because removing them would erase their copy of the
  conversation. Their sender id points to a ghost profile with no email,
  no login, and a generic handle — it cannot be logged into again.

### Why this policy

This protects the integrity of the public archive, provides a legal safe
harbor for reporting on matters of public interest, and satisfies the
Apple App Store and Google Play requirements that objectionable content
is removed from user view within 24 hours.

## 4. Takedown and dispute process

If you are named in a report and believe it is false, misleading, or
defamatory:

1. Open the report page and click **"I'm named in this report — submit a
   reply"**.
2. Provide your full name, a contact method (email or phone), and your
   response.
3. A moderator reviews your submission within a reasonable period.
4. If approved, your response is published attached to the report,
   visible to every reader, and marked **✓ Verified**.
5. If rejected, you are notified with the reason.

You may also request a formal takedown by emailing
support@wetindey.app with the report URL and the specific grounds for
removal. If the report violates our content rules (section 6), it is
removed from public view within 24 hours. If the report does not violate
our content rules, we will not remove it; we will label it **Disputed**
and add your verified response.

## 5. Terms of Use

By using Wetin Dey you agree:

- You are at least 17 years old.
- You will not publish content that is knowingly false, defamatory,
  threatening, harassing, or that incites violence.
- You will not publish another person's private information (phone
  numbers, home addresses, financial details) with intent to harm.
- You will not publish content that promotes hatred of any ethnic,
  religious, or political group.
- You will not use the platform to impersonate another person, a
  government official, or a public agency.
- You accept that reports you submit become part of a permanent public
  archive, except where they violate our content rules, in which case
  they are removed from public view within 24 hours as described in
  section 3.

Wetin Dey may label any content **Disputed**, publish a verified
rebuttal alongside it, or (in cases of threats, doxxing, content naming
a minor, hate speech, or illegal content) remove it from public view
within 24 hours. Wetin Dey will not remove content merely because it
criticizes a public agency or a public official acting in their official
capacity.

## 6. Content that is not allowed

- Threats of violence against any person or group
- Doxxing (publishing someone's private contact info or home address)
- Any content naming a person under 18 years old
- Sexual content involving minors
- Content promoting hatred of any ethnic, religious, or political group
- Impersonation of a government agency, official, or another user
- Spam, scams, or fraudulent offers
- Deliberate misinformation known to be false at time of posting

Content that violates this section is removed from public view within 24
hours. Abusive users are ejected. Repeated violations result in a
permanent ban.

## 7. Religion and politics

Wetin Dey does not allow attacks on any religion. Sharing personal
spiritual expression (testimony, prayer, faith practice) is allowed and
protected. Stoking religious conflict is not.

Political criticism of public officials acting in their official
capacity is allowed. Party slogans, tribal attacks, and calls to
violence are not.

## 8. Contact

- Support: support@wetindey.app
- Takedown requests: support@wetindey.app (subject: "Takedown")
- Data protection: support@wetindey.app (subject: "NDPR")

---

*End of draft. Every section above needs a Nigerian lawyer's review
before this file is treated as binding. The plain-language tone is
intentional — it is what users will actually read.*