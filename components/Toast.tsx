"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { tapFeedback, notifyFeedback } from "@/lib/haptics";

type ToastKind = "info" | "success" | "error";

type ToastData = {
  id: number;
  message: string;
  kind: ToastKind;
};

type ToastContextValue = {
  show: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 2600;

/**
 * In-app toast. Replaces window.alert() everywhere.
 *
 * Why: on iOS, alert() shows the system dialog — grey box, "OK" button,
 * system font. Every WhatsApp, Telegram, Instagram, Twitter in-app
 * message is a small pill that slides down from the top and fades after
 * a couple seconds. That difference is one of the clearest "web app"
 * tells a reviewer sees.
 *
 * Single toast at a time — a new one replaces the current one. Enough
 * for the dozen or so call sites across the app.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safety net. Every caller is inside ToastProvider in app/layout.tsx;
    // this branch only fires if someone renders a caller outside the tree.
    return {
      show: (message: string) => {
        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.warn("[toast outside provider]", message);
        }
      }
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const trimmed = message.trim();
    if (!trimmed) return;
    idRef.current += 1;
    setToast({ id: idRef.current, message: trimmed, kind });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), DURATION_MS);
    if (kind === "error") void notifyFeedback();
    else void tapFeedback();
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast }: { toast: ToastData }) {
  const tone =
    toast.kind === "error"
      ? "border-danger/40 bg-danger-soft text-danger"
      : toast.kind === "success"
        ? "border-accent/40 bg-accent-soft text-accent-deep"
        : "border-border bg-surface text-ink";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-4 fade-in"
      style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto max-w-md rounded-2xl border px-4 py-2.5 text-[0.875rem] font-medium shadow-lg backdrop-blur-md ${tone}`}
      >
        {toast.message}
      </div>
    </div>
  );
}