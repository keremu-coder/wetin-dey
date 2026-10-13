# Store disclosures - Apple + Google Play

Ready answers for the privacy nutrition label (Apple) and Data Safety
form (Google Play). Copy-paste these values directly into the store
consoles when you submit.

Last updated: 2026-10-11.

---

## URLs for the store listing

- **Privacy policy URL:** https://9jawatindey.vercel.app/privacy
- **Delete account URL:** https://9jawatindey.vercel.app/delete-account
- **Terms of use URL:** https://9jawatindey.vercel.app/terms
- **Community guidelines URL:** https://9jawatindey.vercel.app/guidelines
- **Support URL:** https://9jawatindey.vercel.app/support

---

## Apple - App Privacy nutrition label

### Data used to track you

**None.** No IDFA. No cross-app tracking. No advertising SDKs.

### Data linked to you

"Linked to you" means tied to a real-world identity (name, email, phone).
Most data is **not linked** because anonymous sessions have no such
identity.

**Contact Info**
- Email address - **Linked**, **Not used for tracking**
  - Purpose: App Functionality (account recovery, optional)
- Phone number - **Linked**, **Not used for tracking**
  - Purpose: App Functionality (account recovery, optional)

**User Content**
- Photos or videos - **Not Linked**, **Not used for tracking**
  - Purpose: App Functionality (evidence on civic reports)
- Audio data - **Not Linked**, **Not used for tracking**
  - Purpose: App Functionality (voice notes, broadcasts, voice testimony)
  - Notes: Audio attached to reports (voice testimony and voice comments)
    is sent to Groq (Whisper) for transcription and moderation.
- Other user content - **Not Linked**, **Not used for tracking**
  - Purpose: App Functionality (text reports, comments, chat)
  - Notes: Report body text is sent to Groq for AI summarization. Reviewed
    reports are mirrored publicly to Telegram.

**Identifiers**
- User ID - **Not Linked**, **Not used for tracking**
  - Notes: Signed session cookie. Not a device identifier. No IDFA.

**Usage Data**
- Product interaction - **Not Linked**, **Not used for tracking**
  - Purpose: App Functionality (last-seen timestamp for presence)

**Diagnostics**
- None. No crash reporting SDK installed.

**Location**
- Precise location - **Linked**, **Not used for tracking**
  - Purpose: App Functionality (Radar Need help / Police stop signals)
  - Notes: Exact coordinates stored on the signal, updated ~every 25-30s for up to 4 hours, visible only to contacts the user chose (who must have added the user back). Deleted with the account.
- Coarse location - **Not Linked**, **Not used for tracking**
  - Purpose: App Functionality (near-you filtering; not stored)

### Data not collected

- Browsing history
- Search history
- Contacts
- Health & fitness
- Financial info (no payments)
- Sensitive info
- Advertising data / IDFA

---

## Google Play - Data Safety form

### Data collection and security

**Does your app collect or share any of the required user data types?**
Yes.

**Is all of the user data collected by your app encrypted in transit?**
Yes.

**Do you provide a way for users to request that their data is deleted?**
Yes. https://9jawatindey.vercel.app/delete-account

### Data types collected

| Data type | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Email address | Yes | No | Yes | Account recovery (optional) |
| Phone number | Yes | No | Yes | Account recovery (optional) |
| Photos | Yes | No | Yes | Attach evidence to reports (any single evidence type is enough, so photos specifically are optional per report) |
| Videos | Yes | No | Yes | Attach evidence to reports |
| Audio (voice notes / voice testimony) | Yes | Yes - Groq | Yes | Voice comments, chat, broadcasts, voice testimony. Audio attached to reports is sent to Groq Whisper for transcription and moderation. |
| Text (report body) | Yes | Yes - Groq (formalization), Telegram (public mirror of reviewed reports) | No | Civic reports |
| Name (handle) | Yes | No | No | Public username |
| User IDs (session id) | Yes | No | No | Session identification |
| Approximate location | Yes | No | Yes | Near-you filtering (not stored) |
| Precise location | Yes | No | Yes | Radar Need help / Police stop signals; visible only to chosen contacts (who must have added you back); stored up to 4h of sharing; deleted with account |
| App interactions | Yes | No | No | Presence, last-seen |
| Device or other IDs | No | - | - | - |

### Data sharing

**Service providers (processors, acting on our behalf):**
- **Supabase** - database, storage, realtime, authentication. EU region.
- **Vercel** - hosting, edge network, blob storage. Global edge network.
- **Groq** - AI text formalization of report body text, and audio
  transcription (Whisper) of voice testimony and voice comments attached
  to reports. Text and the relevant audio file are transmitted. Groq does
  not receive session identifiers, account data, or any other user
  content. US.
- **Resend** - transactional email only (account verification, password
  reset), via Supabase Auth. US.

**Public disclosure:**
- **Telegram** - a public mirror of *reviewed* (i.e. published) civic
  reports is posted to a public Telegram channel. This includes the
  formalized report text and any evidence link. It does not include DMs,
  unpublished reports, or non-civic content. This is a deliberate public
  disclosure, not a processor relationship.

**No third-party advertising. No analytics SDK.**

### Data retention

- Reports and comments stay in the permanent archive. On account
  deletion they are detached from the user's identity (session id
  tombstoned, handle nulled) but the report row itself is preserved for
  archive integrity and legal defense. Violating content is removed
  from public view within 24 hours but the row is retained.
- Voice notes and chat messages stay until the user or a moderator
  deletes them.
- Broadcasts expire automatically after 24 hours.
- Email, phone, handle, auth record, avatars, broadcasts, followers,
  blocks, push tokens, check-ins, votes, reactions, and Radar signals
  are deleted immediately when the user deletes their account.
- Direct messages sent by a deleted user remain visible to the other
  participant, disconnected from the deleted user's identity.

---

## Apple - App Review notes

The current, verified review notes live in `docs/APP-REVIEW-NOTES.md`.
Copy the "Draft text" section from there into the App Store Connect
"Notes" field when submitting. Do not duplicate the content here -
duplication is how the previous version of this doc drifted from reality.

Reviewer credentials are NOT in this file or any tracked file. They are
provided separately in the App Store Connect "Sign-in required" fields.

---

## Assumptions and maintenance

- Email and phone are used for account recovery only, and are optional.
- The reviewer account is provisioned per submission and has no real
  user data attached.
- No advertising or analytics SDKs. If any are added, both the Apple
  privacy label and the Google Data Safety form must be updated BEFORE
  the change ships.
- If the Groq integration changes (e.g. a vision model is added for
  images), the Groq row above must be updated in the same commit.
- If native push (APNs/FCM) is enabled, the "Push tokens" statement in
  the privacy policy and this doc must both be updated to say native
  tokens are stored.