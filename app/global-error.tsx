"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary. Catches errors thrown by the root layout
 * itself — those do not bubble to app/error.tsx. Must render its own
 * <html> and <body> because it replaces the whole document.
 *
 * Minimal styling on purpose — the layout may have failed to render,
 * so globals.css may not be present. Inline styles only.
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#e7e9ea",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "2rem"
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", lineHeight: 1 }}>🛠️</div>
          <h1
            style={{
              marginTop: "1.25rem",
              fontSize: "1.5rem",
              fontWeight: 600,
              margin: "1.25rem 0 0"
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.9375rem",
              lineHeight: 1.6,
              color: "#8a9199",
              margin: "0.75rem 0 0"
            }}
          >
            The app couldn&apos;t start. Try again — if it keeps happening,
            come back in a minute.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.25rem",
              border: "none",
              borderRadius: "999px",
              background: "#1F7A4D",
              color: "#ffffff",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}