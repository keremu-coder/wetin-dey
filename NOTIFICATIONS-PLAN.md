# Notifications bell — build plan

**Status:** planning doc.
**Generated:** 2026-10-10.
**Scope:** v1 — reply, mention, comment. No reactions, no follows, no votes.

## Why
A reviewer taps the bell expecting to see who replied to them. Right now
there is no bell. DMs have an unread badge; chats and reports have nothing.

## Data model

New table `notifications`:

- id            uuid primary key default gen_random_uuid()
- recipient_id  text not null references sessions(id) on delete cascade
- actor_id      text references sessions(id) on delete set null
- kind          text not null  (reply | mention | comment)
- target_type   text not null  (community_message | report)
- target_id     text not null  (the message or report id the recipient taps)
- preview       text           (short body for the list row)
- created_at    timestamptz default now()
- read_at       timestamptz

Indexes:
  (recipient_id, created_at desc)
  (recipient_id, read_at) where read_at is null

RLS: enabled. Client never reads or writes this table directly. All
access goes through the service-role API routes. Same pattern as
dm_messages.

## Where notifications get created

1. Reply — in `app/api/communities/[slug]/messages/route.ts`, POST handler,
   after the insert, if parent_id was resolved: create a notification for
   the parent author. Skip if parent author === sender (replying to self).

2. Mention — same handler, same insert. Parse the body for `@handle`
   tokens (reuse `containsMentionOf` semantics). For each unique handle
   found, create a notification. Skip self-mentions. Skip if a reply
   notification is already being created for the same (recipient, target)
   pair — a reply that also mentions should not double-notify.

3. Comment — in `app/api/reports/[id]/comments/route.ts`, POST handler,
   after the insert: create a notification for the report author. Skip
   if author === commenter.

Shared helper `lib/notifications.ts`:

  createNotification(db, { recipientId, actorId, kind, targetType,
    targetId, preview })
    - Skip if recipientId === actorId
    - Skip if recipient has blocked the actor (reuse getBlockedIds)
    - Insert one row

## API routes

GET  /api/notifications          List (paginated, cursor = created_at)
POST /api/notifications/read     Mark one or all as read
GET  /api/notifications/unread   Count of unread for the bell badge

All three: session-gated, service-role DB access.

## Client

LiveStateProvider:
  - Add `notificationsUnread` to context
  - Poll /api/notifications/unread every 30s on the existing tick
  - Expose `refreshNotifications()` for the page to call after marking read

Nav.tsx:
  - Add bell icon next to the search icon
  - Badge shows notificationsUnread when > 0

app/notifications/page.tsx:
  - Server component fetching the first 50 rows
  - Client list rendering them
  - On mount: POST /api/notifications/read { all: true }
  - Tap a row → navigate to /r/[target_id] or /c/[slug]/chat (target_type
    tells us which)

## Order of execution

1. migrations/012_notifications.sql  (run in Supabase first)
2. lib/notifications.ts               (helper)
3. app/api/notifications/route.ts     (list)
4. app/api/notifications/unread/route.ts
5. app/api/notifications/read/route.ts
6. app/api/communities/[slug]/messages/route.ts (MODIFY — add triggers)
7. app/api/reports/[id]/comments/route.ts       (MODIFY — add trigger)
8. components/LiveStateProvider.tsx   (MODIFY — add count)
9. app/notifications/page.tsx         (new)
10. components/Nav.tsx                (MODIFY — add bell)

Ten commits. Verify after 6, after 8, and after 10.

## Test checklist (after step 10)

- User A replies to User B in a chat → B sees bell badge within 30s
- User A @mentions User C → C sees the mention
- User D comments on User E's report → E sees the comment
- Tapping a notification navigates to the right place
- Opening /notifications clears the badge
- Blocking A then having A reply → no notification created for the blocker
- Self-replies do not notify
- Reply that also mentions the parent author → one notification, not two

## What this does NOT include

- Realtime delivery (30s polling matches DMs)
- Push notifications for these events (separate — push already exists for
  chat and DM, this is only the in-app bell)
- Notification preferences (all or nothing for v1)
- Grouping / digests
- Reactions, follows, votes