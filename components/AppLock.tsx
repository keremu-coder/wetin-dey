"use client";

import { useEffect, useState } from "react";

export function AppLock({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    // Check if the user enabled the lock in settings
    const lockEnabled = localStorage.getItem("wetindey_app_lock") === "true";
    if (lockEnabled) {
      setIsLocked(true);
    }
  }, []);

  function unlock() {
    // In the future (on a Mac), we will call Capacitor Biometric here.
    // For now, we simulate a successful unlock.
    setIsLocked(false);
  }

  if (isLocked) {
    return (
      <main className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-paper px-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-tint text-brand mb-6">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink mb-2">Wetin Dey is Locked</h1>
        <p className="text-[0.9375rem] text-muted text-center mb-8">
          Use Face ID or Fingerprint to unlock your account.
        </p>
        <button
          onClick={unlock}
          className="flex h-12 items-center justify-center rounded-full bg-brand px-8 text-[1rem] font-semibold text-white"
        >
          Unlock
        </button>
      </main>
    );
  }

  return <>{children}</>;
}
