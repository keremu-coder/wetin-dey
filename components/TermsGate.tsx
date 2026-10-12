"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ACCEPTED_KEY = "wetindey:terms-accepted:v1";

/**
 * One-time consent gate shown to sessions that haven't accepted the
 * Terms of Use and Community Guidelines yet.
 *
 * On mount: checks sessionStorage first. If the flag is already there,
 * we skip the network call entirely — this is the common case (user
 * accepted once, then navigates around the app). Otherwise we ask
 * /api/accept-terms (GET) and show the modal if needed.
 *
 * Fail-closed: if we cannot confirm acceptance (network error or a
 * non-ok response), we show the modal. Consent is required, not optional.
 */
export function TermsGate() {
  const [checking, setChecking] = useState(true);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Fast path: already accepted this browser session.
    try {
      if (window.sessionStorage.getItem(ACCEPTED_KEY) === "1") {
        setChecking(false);
        return;
      }
    } catch {
      /* sessionStorage unavailable, fall through */
    }

    let cancelled = false;

    fetch("/api/accept-terms", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        // No session yet: no consent to record. Let them through.
        if (!d || d.has_session !== true) {
          setChecking(false);
          return;
        }
        // Fail-closed: only skip the modal on a definitive yes.
        if (d.accepted === true) {
          try {
            window.sessionStorage.setItem(ACCEPTED_KEY, "1");
          } catch {
            /* ignore */
          }
          setNeedsConsent(false);
        } else {
          setNeedsConsent(true);
        }
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Fail-closed: network error means we cannot verify. Show the modal.
        setNeedsConsent(true);
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/accept-terms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accepted: true })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Could not save. Try again.");
        setBusy(false);
        return;
      }

      try {
        window.sessionStorage.setItem(ACCEPTED_KEY, "1");
      } catch {
        /* ignore */
      }

      setNeedsConsent(false);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(20);
        } catch {
          /* ignore */
        }
      }
    } catch {
      setError("Network error. Check your connection.");
      setBusy(false);
    }
  }

  if (checking || !needsConsent) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 px-4 py-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-card-hover">
        <h2
          id="terms-gate-title"
          className="font-serif text-[1.35rem] font-semibold leading-tight text-ink"
        >
          Before you continue
        </h2>

        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          Wetin Dey has rules to keep the space safe. Please read and agree
          before you post.
        </p>

        <ul className="mt-4 space-y-2 text-[0.875rem] leading-relaxed text-ink/90">
          <li className="flex items-start gap-2">
            <span className="mt-1 text-accent">·</span>
            <span>
              <strong>No threats, doxxing, or hate.</strong> Content that
              breaks these rules is removed within 24 hours.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-accent">·</span>
            <span>
              <strong>No attacks on religion, ethnicity, or politics.</strong>{" "}
              Criticism of officials acting in their official capacity is
              allowed.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-accent">·</span>
            <span>
              <strong>Abusive users are ejected.</strong> Reports of abuse go
              to a moderator, not the other person.
            </span>
          </li>
        </ul>

        <div className="mt-5 space-y-2 text-[0.8125rem]">
          <p>
            Read the full{" "}
            <Link href="/terms" className="text-brand underline">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/guidelines" className="text-brand underline">
              Community Guidelines
            </Link>
            .
          </p>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={accept}
          disabled={busy}
          className="mt-5 w-full rounded-2xl bg-brand py-3.5 font-serif text-[1rem] font-semibold text-white shadow-button transition-all hover:bg-brand-soft disabled:opacity-60"
        >
          {busy ? "Saving…" : "I agree"}
        </button>

        <p className="mt-3 text-center text-[0.7rem] text-faint">
          You can change your mind later by leaving Wetin Dey.
        </p>
      </div>
    </div>
  );
}