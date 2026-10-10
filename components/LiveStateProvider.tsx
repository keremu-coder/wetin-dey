"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";

/**
 * One shared poller for the whole app.
 *
 * Before this, Nav.tsx and BottomNav.tsx each polled /api/dm/unread every
 * 30s and restarted their interval on every pathname change, and
 * PresencePing.tsx added its own 60s ping interval. That's 3 timers per
 * user, re-created on every navigation.
 *
 * LiveStateProvider replaces all three:
 *   - polls unread every 30s
 *   - pings /api/ping every 60s (every 2nd tick of the same interval)
 *   - pauses when document.hidden, resumes on visibilitychange
 *   - does NOT restart on route change (context lives above the router)
 */

type LiveState = {
  unread: number;
  notificationsUnread: number;
  refreshUnread: () => void;
  refreshNotifications: () => void;
};

const LiveStateContext = createContext<LiveState>({
  unread: 0,
  notificationsUnread: 0,
  refreshUnread: () => {},
  refreshNotifications: () => {}
});

const TICK_MS = 30_000;
const PRESENCE_EVERY_N_TICKS = 2; // every 2nd tick = 60s

async function fetchUnreadCount(): Promise<number | null> {
  try {
    const res = await fetch("/api/dm/unread", { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return typeof d?.count === "number" ? d.count : 0;
  } catch {
    return null;
  }
}

async function fetchNotificationsUnread(): Promise<number | null> {
  try {
    const res = await fetch("/api/notifications/unread", { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return typeof d?.count === "number" ? d.count : 0;
  } catch {
    return null;
  }
}

function pingPresence() {
  fetch("/api/ping", { method: "POST", keepalive: true }).catch(() => {});
}

export function LiveStateProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const aliveRef = useRef(true);
  const tickRef = useRef(0);

  const refreshUnread = useCallback(async () => {
    const n = await fetchUnreadCount();
    if (aliveRef.current && n !== null) setUnread(n);
  }, []);

  const refreshNotifications = useCallback(async () => {
    const n = await fetchNotificationsUnread();
    if (aliveRef.current && n !== null) setNotificationsUnread(n);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    tickRef.current = 0;

    // Initial hit — both unread and presence
    void refreshUnread();
    void refreshNotifications();
    pingPresence();

    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      tickRef.current += 1;
      void refreshUnread();
      void refreshNotifications();
      if (tickRef.current % PRESENCE_EVERY_N_TICKS === 0) {
        pingPresence();
      }
    }, TICK_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void refreshUnread();
        void refreshNotifications();
        pingPresence();
      }
    }

    function onFocus() {
      void refreshUnread();
      void refreshNotifications();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      aliveRef.current = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshUnread, refreshNotifications]);

  return (
    <LiveStateContext.Provider
      value={{
        unread,
        notificationsUnread,
        refreshUnread,
        refreshNotifications
      }}
    >
      {children}
    </LiveStateContext.Provider>
  );
}

export function useLiveUnread(): number {
  return useContext(LiveStateContext).unread;
}

export function useLiveNotificationsUnread(): number {
  return useContext(LiveStateContext).notificationsUnread;
}

export function useLiveRefreshNotifications(): () => void {
  return useContext(LiveStateContext).refreshNotifications;
}

export function useLiveRefreshUnread(): () => void {
  return useContext(LiveStateContext).refreshUnread;
}