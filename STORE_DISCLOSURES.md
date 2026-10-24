# Wetin Dey — Store Disclosures & Data Collection

This document outlines the data collected by the Wetin Dey application for App Store and Google Play compliance.

## 1. Location Data
- **State and LGA Collection:** When a user submits a report or post, they optionally select a State and Local Government Area (LGA). This is used solely for categorizing the report in the public feed and is tied to the report, not the user's identity.
- **Radar Background Location:** The Radar feature uses device geolocation to broadcast a private, temporary safety signal to the user's approved "Circle" contacts. Location is only transmitted when the user explicitly triggers a Radar signal and is set to expire automatically.

## 2. User Content and Identity
- **Anonymous by Default:** Users can interact, post, and message entirely anonymously without providing a phone number or email.
- **Optional Account Linking:** If a user chooses to create a named account, we collect their chosen handle and optionally an email address for account recovery.
- **View-Once Media:** Photos and videos sent in DMs are stored in a private, encrypted storage bucket. They are only accessible via short-lived signed URLs generated on the server after verifying the recipient. We do not claim these are impossible to screenshot, but they are not saved to the public web.

## 3. Native App Features (Capacitor Shell)
Wetin Dey is built using a hybrid architecture (Next.js wrapped in Capacitor) to provide a native mobile experience. The native shell includes:
- Native Push Notifications.
- Background Location tracking (exclusive to the Radar safety feature).
- Offline fallback handling (if the user loses connection, they see an offline screen rather than a browser error).
- Native Safe Area handling (adapting to iPhone notches).

## 4. Data Deletion
- Users can initiate account deletion directly in the app (Settings > Delete Account).
- The current flow deletes DM threads/messages and the user's community messages. Public reports and comments are detached from the account and retained in the archive. There is no "Delete content" checkbox.

## 5. App Privacy answers (must match ios/App/App/PrivacyInfo.xcprivacy)
Every item below is collected and **linked to the user** (tied to their handle/session); none is used for tracking:
- Email address (only if the user adds one)
- User ID (session id / handle)
- Device ID (push token, stored against the session)
- Precise location (Radar signals only) and coarse location (state-level on reports)
- Photos or videos, Audio data, Other user content (reports, comments, messages)