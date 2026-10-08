# Store disclosures — Apple + Google Play

Ready answers for the privacy nutrition label (Apple) and Data Safety
form (Google Play). Copy-paste these values directly into the store
consoles when you submit.

Last updated: 2026-10-08.

---

## URLs for the store listing

- **Privacy policy URL:** https://9jawatindey.vercel.app/privacy
- **Delete account URL:** https://9jawatindey.vercel.app/delete-account
- **Terms of use URL:** https://9jawatindey.vercel.app/terms
- **Community guidelines URL:** https://9jawatindey.vercel.app/guidelines
- **Support URL:** https://9jawatindey.vercel.app/support

---

## Apple — App Privacy nutrition label

### Data used to track you

**None.** We do not track users across apps or websites owned by other
companies. No IDFA. No cross-app tracking. No advertising SDKs.

### Data linked to you

Under Apple's definition, "linked to you" means tied to a real-world
identity (name, email, phone number, etc.). Most of our data is
**not linked** because anonymous sessions have no such identity.

**Contact Info**
- Email address — **Linked**, **Not used for tracking**
  - Purpose: App Functionality (account recovery, optional)
  - Notes: Optional. Users can attach an email to their session for
    recovery. Never required.
- Phone number — **Linked**, **Not used for tracking**
  - Purpose: App Functionality (optional recovery)
  - Notes: Optional. Same as email.

**User Content**
- Photos or videos — **Not Linked** (for anonymous uploads), **Not used for tracking**
  - Purpose: App Functionality (evidence on civic reports)
- Audio data — **Not Linked**, **Not used for tracking**
  - Purpose: App Functionality (voice notes, broadcasts)
- Other user content — **Not Linked**, **Not used for tracking**
  - Purpose: App Functionality (text reports, comments, chat)

**Identifiers**
- User ID — **Not Linked**, **Not used for tracking**
  - Purpose: App Functionality
  - Notes: Signed session cookie. Not a device identifier. No IDFA.

**Usage Data**
- Product interaction — **Not Linked**, **Not used for tracking**
  - Purpose: App Functionality (last-seen timestamp for presence)

**Diagnostics**
- Crash data — **Not Linked**, **Not used for tracking**
  - Purpose: App Functionality
  - Notes: Only if we add crash reporting; currently we do not.

**Location**
- Coarse location — **Not Linked**, **Not used for tracking**
  - Purpose: App Functionality (Radar rounds to ~1 km grid)
  - Notes: Never stored as precise coordinates.

### Data used to track you

**None.** See above.

### Data not collected

- Browsing history
- Search history
- Contacts
- Health & fitness
- Financial info (payments not currently supported)
- Precise location
- Sensitive info

---

## Google Play — Data Safety form

### Data collection and security

**Does your app collect or share any of the required user data types?**
Yes.

**Is all of the user data collected by your app encrypted in transit?**
Yes.

**Do you provide a way for users to request that their data is
deleted?**
Yes. See https://9jawatindey.vercel.app/delete-account

### Data types collected

| Data type | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Email address | Yes | No | Yes | Account recovery (optional) |
| Phone number | Yes | No | Yes | Account recovery (optional) |
| Photos | Yes | No | No | Attach evidence to reports |
| Videos | Yes | No | No | Attach evidence to reports |
| Audio (voice notes) | Yes | No | No | Voice comments, chat, broadcasts |
| Name (handle) | Yes | No | No | Public username |
| User IDs (session id) | Yes | No | No | Session identification |
| Approximate location | Yes | No | Yes | Radar signal buckets (~1 km) |
| App interactions | Yes | No | No | Presence, last-seen |
| Device or other IDs | No | — | — | — |

### Data sharing

- **Supabase** — data processor (database, storage, auth)
- **Vercel** — data processor (hosting, CDN, blob storage)
- **Groq** — data processor (AI text formalization only, no files)
- **Resend** — data processor (verification emails)
- **Telegram** — public mirror of reviewed reports only

No third-party advertising. No analytics SDK.

### Data retention

- Reports and comments stay in the permanent archive (detached on
  account deletion).
- Voice notes and chat messages stay until the user or a moderator
  deletes them.
- Broadcasts expire automatically after 24 hours.
- Email, phone, handle, auth record, avatars, broadcasts, followers,
  blocks, push tokens, check-ins, votes, reactions, and Radar signals
  are deleted immediately when the user deletes their account.
- Direct messages stay visible to the other participant, disconnected
  from the deleted user's identity.

---

## Apple — App Review notes

Copy this into the "Notes" field when submitting for review.

### App overview

Wetin Dey is a community platform for Nigerian citizens. It has two
tabs: Talk Am (civic reports about agencies and public services) and
Community (free-form posts and Spaces). Users may participate
anonymously with no phone or email. Every report on Talk Am requires
attached evidence — a photo, video, audio, voice note, or public link.

### UGC moderation

- **Report:** every piece of user content (reports, comments, chat
  messages, DMs, broadcasts, user profiles, Spaces) can be reported via
  a Report action. Reports go to a moderator queue.
- **Block:** users can block any other user from post menus, chat
  messages, comment threads, DMs, and profiles. A block is
  bidirectional — neither user sees the other's content anywhere in the
  app.
- **24-hour review:** reported content is reviewed by a human moderator
  within 24 hours.
- **Auto-hide:** content reported by 3 or more distinct trusted
  accounts is automatically hidden from public view pending human
  review. Civic reports (`report_a`) are never auto-hidden.
- **Ban:** repeated violations result in a permanent ban. Banned users
  cannot post, comment, chat, send DMs, vote, react, change their
  handle, or update their profile.
- **Zero tolerance:** our Terms of Use and Community Guidelines state
  that objectionable content and abusive users are removed from the
  platform.

### Demo account for review

Email: kpekpes@wetindey.app
Password: REMOVED-CREDENTIAL

Use this account to explore:

- Talk Am feed and report detail page
- Community feed
- Any public Space (chat, members, check-in)
- Report a post, comment, or chat message
- Block a user from any post menu
- Settings → Account (verify email banner)
- Settings → Delete account (do not complete the deletion)

### Permissions used

- **Microphone** — record voice notes, voice comments, and voice
  broadcasts.
- **Camera / Photo library** — attach evidence to reports and posts.
- **Notifications** — browser and native push for DMs and chat.
- **Location (approximate)** — Radar signals, rounded to ~1 km. Never
  stored as precise coordinates.

We do not request precise location, contacts, calendar, health data,
or advertising identifiers.

---

## Assumptions

- Email addresses are used for account recovery only, and are optional.
- The demo account was created during development and has no real user
  data attached.
- We do not currently run advertising or analytics SDKs. If we ever do,
  both the Apple privacy label and the Google Data Safety form must be
  updated before the change ships.