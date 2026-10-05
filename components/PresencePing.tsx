"use client";

import { useEffect } from "react";

function ping() {
  fetch("/api/ping", { method: "POST", keepalive: true }).catch(() => {});
}

export function PresencePing() {
  useEffect(() => {
    // Ping on load
    ping();

    // Ping every 60 seconds while visible
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      ping();
    }, 60000);

    // Ping on focus / tab return
    function onVisibility() {
      if (document.visibilityState === "visible") ping();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", ping);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", ping);
    };
  }, []);

  return null;
}