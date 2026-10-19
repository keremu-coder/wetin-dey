"use client";

import Link from "next/link";
import { PresenceDot, presenceFromLastSeen } from "./PresenceDot";
import { StatusLine } from "./StatusLine";
import { avatarColor, type Member } from "@/lib/chat";
import type { SoundPrefs } from "@/lib/sound-prefs";
import {
  requestNotificationPermission,
  notificationPermission
} from "@/lib/sounds";

type Props = {
  open: boolean;
  onClose: () => void;
  members: Member[];
  onlineCount: number;
  isOwner: boolean;
  prefs: SoundPrefs;
  notifPerm: NotificationPermission | "unsupported";
  onNotifPermChange: (p: NotificationPermission | "unsupported") => void;
  autocorrectOn: boolean;
  onAutocorrectChange: (v: boolean) => void;
  onOpenInvite: () => void;
  onOpenBroadcast: () => void;
  statusByHandle: Record<string, string>;
};

export function ChatRoomMembers({
  open,
  onClose,
  members,
  onlineCount,
  isOwner,
  prefs,
  notifPerm,
  onNotifPermChange,
  autocorrectOn,
  onAutocorrectChange,
  onOpenInvite,
  onOpenBroadcast,
  statusByHandle
}: Props) {
  if (!open) return null;

  const online = members.filter(
    (m) => presenceFromLastSeen(m.last_seen_at) === "online"
  );
  const away = members.filter(
    (m) => presenceFromLastSeen(m.last_seen_at) === "away"
  );
  const offline = members.filter(
    (m) => presenceFromLastSeen(m.last_seen_at) === "offline"
  );

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 fade-in"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-[60] h-full w-[85%] max-w-sm overflow-y-auto border-l border-border bg-paper slide-in-right">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-paper/95 px-4 py-3 backdrop-blur-xl">
          <div>
            <p className="font-serif text-[1.05rem] font-semibold text-ink">
              Members
            </p>
            <p className="text-[0.65rem] text-faint">
              {onlineCount} online · {members.length} total
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close members"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenInvite();
            }}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-brand-soft"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Invite people
          </button>

          {isOwner ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBroadcast();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-paper px-3 py-2.5 text-[0.8125rem] font-semibold text-ink transition-colors hover:bg-ink/5"
            >
              <span className="text-[1rem]">📢</span>
              Send a broadcast
            </button>
          ) : null}
        </div>

        <Link
          href="/settings/sounds"
          className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-ink/5"
        >
          <span className="text-[1.1rem]">🔊</span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.875rem] font-medium text-ink">
              Sound settings
            </p>
            <p className="text-[0.7rem] text-muted">
              Profile: {prefs.profile} ·{" "}
              {prefs.send ? "send on" : "send off"} ·{" "}
              {prefs.receive ? "receive on" : "receive off"}
            </p>
          </div>
          <span className="text-faint">›</span>
        </Link>

        {notifPerm === "granted" ? null : notifPerm === "default" ? (
          <button
            type="button"
            onClick={async () => {
              await requestNotificationPermission();
              onNotifPermChange(notificationPermission());
            }}
            className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-ink/5"
          >
            <span className="text-[1.1rem]">🔔</span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.875rem] font-medium text-ink">
                Enable notifications
              </p>
              <p className="text-[0.7rem] text-muted">
                Get notified when a message arrives
              </p>
            </div>
            <span className="text-faint">›</span>
          </button>
        ) : null}

        <div className="border-b border-border px-4 py-3">
          <p className="mb-2 text-[0.65rem] text-faint">
            Chat settings
          </p>
          <div className="flex items-center justify-between py-2">
            <span className="text-[0.875rem] text-ink">Autocorrect</span>
            <button
              type="button"
              onClick={() => onAutocorrectChange(!autocorrectOn)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                autocorrectOn ? "bg-brand" : "bg-ink/10"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  autocorrectOn ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        <MemberGroup
          label="Online"
          members={online}
          emptyText="Nobody here right now"
          statusByHandle={statusByHandle}
        />
        <MemberGroup
          label="Away"
          members={away}
          statusByHandle={statusByHandle}
        />
        <MemberGroup
          label="Offline"
          members={offline}
          statusByHandle={statusByHandle}
        />
      </aside>
    </>
  );
}

function MemberGroup({
  label,
  members,
  emptyText,
  statusByHandle
}: {
  label: string;
  members: Member[];
  emptyText?: string;
  statusByHandle: Record<string, string>;
}) {
  if (members.length === 0 && !emptyText) return null;

  return (
    <section className="py-2">
      <p className="px-4 py-2 text-[0.65rem] text-faint">
        {label} — {members.length}
      </p>
      {members.length === 0 ? (
        <p className="px-4 py-2 text-[0.8125rem] text-muted">{emptyText}</p>
      ) : (
        members.map((m) => {
          const presence = presenceFromLastSeen(m.last_seen_at);
          const bg = avatarColor(m.handle);
          const status = statusByHandle[m.handle];
          return (
            <Link
              key={m.session_id}
              href={`/u/${encodeURIComponent(m.handle)}`}
              className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink/5"
            >
              <div className="relative shrink-0">
                {m.avatar_url ? (
                  <img
                    src={m.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[0.85rem] font-semibold text-white"
                    style={{ background: bg }}
                  >
                    {m.handle.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5">
                  <PresenceDot state={presence} size="md" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-medium text-ink">
                  @{m.handle}
                </p>
                {status ? (
                  <StatusLine
                    status={status}
                    className="mt-0.5 !text-[0.75rem]"
                  />
                ) : (
                  <p className="text-[0.7rem] capitalize text-muted">
                    {m.role}
                  </p>
                )}
              </div>
            </Link>
          );
        })
      )}
    </section>
  );
}
