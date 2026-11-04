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
 * UPDATED FOR PERFORMANCE:
 * - Checks for slow connections (2G/Data Saver) and throttles polling to 2 mins.
 * - Skips presence pings on slow connections.
 * - Throttles focus/visibility events to prevent network spam.
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
const SLOW_TICK_MS = 120_000; // 2 minutes for 2G
const PRESENCE_EVERY_N_TICKS = 2; // every 2nd tick = 60s

function isSlowConnection() {
  if (typeof window === "undefined") return false;
  if ("connection" in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      if (conn.saveData) return true;
      if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") return true;
    }
  }
  return false;
}

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
  const lastFetchRef = useRef(0);

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
    lastFetchRef.current = Date.now();

    // Initial hit
    void refreshUnread();
    void refreshNotifications();
    if (!isSlowConnection()) {
      pingPresence();
    }

    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      
      const now = Date.now();
      const slow = isSlowConnection();
      const minInterval = slow ? SLOW_TICK_MS : TICK_MS;

      // Only fetch if enough time has passed based on connection speed
      if (now - lastFetchRef.current >= minInterval) {
        lastFetchRef.current = now;
        tickRef.current += 1;
        
        void refreshUnread();
        void refreshNotifications();
        
        if (!slow && tickRef.current % PRESENCE_EVERY_N_TICKS === 0) {
          pingPresence();
        }
      }
    }, TICK_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        const slow = isSlowConnection();
        // Throttle to 10 seconds so rapid tab switching doesn't spam
        if (now - lastFetchRef.current > 10_000) {
          lastFetchRef.current = now;
          void refreshUnread();
          void refreshNotifications();
          if (!slow) pingPresence();
        }
      }
    }

    function onFocus() {
       onVisibility();
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
