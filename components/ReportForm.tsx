"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import exifr from "exifr";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  NIGERIA_STATES,
  type Category
} from "@/lib/constants";

async function stripExifInBrowser(file: File): Promise<Blob> {
  try {
    await exifr.parse(file, { gps: true });
  } catch {
    /* still re-encode */
  }
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.86)
  );
  if (!blob) throw new Error("re-encode failed");
  return blob;
}

/* ─── small helpers ─────────────────────────────────────── */

function FieldLabel({
  htmlFor,
  children,
  hint
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block">
      <span className="text-[0.8125rem] font-semibold text-ink">{children}</span>
      {hint ? (
        <span className="ml-2 text-[0.75rem] font-normal text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

/* ─── component ─────────────────────────────────────────── */

export function ReportForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("evidence");
    if (file instanceof File && file.size > 0) {
      const clean = await stripExifInBrowser(file);
      fd.set("evidence", new File([clean], "evidence.jpg", { type: "image/jpeg" }));
    }
    fd.set("anonymous", fd.get("anonymous") ? "true" : "false");

    const res = await fetch("/api/reports", { method: "POST", body: fd });
    const json = (await res.json()) as { id?: string; error?: string };
    if (!res.ok || !json.id) {
      setError(json.error ?? "report no send");
      setBusy(false);
      return;
    }

    void fetch("/api/formalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: json.id }),
      keepalive: true
    });

    router.push(`/r/${json.id}`);
  }

  const bodyLength = body.length;
  const bodyOk = bodyLength >= 50 && bodyLength <= 5000;
  const bodyCount = `${bodyLength}/5000`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ─── trust banner ─── */}
      <div className="rounded-2xl border border-accent/25 bg-accent-soft/60 p-4">
        <p className="text-[0.8125rem] leading-relaxed text-accent-deep">
          <strong className="font-semibold">We no go promise government reply.</strong>{" "}
          We go post your report with a permanent link, and send am to every known
          public channel for this agency where one dey exist.
        </p>
      </div>

      {/* ─── category ─── */}
      <div>
        <FieldLabel htmlFor="category">Category</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c: Category) => (
            <label key={c} className="cursor-pointer">
              <input
                type="radio"
                name="category"
                value={c}
                required
                defaultChecked={c === "other"}
                className="peer sr-only"
              />
              <span className="inline-flex items-center rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-[0.8125rem] text-ink transition-all peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                {CATEGORY_LABELS[c]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* ─── agency ─── */}
      <div>
        <FieldLabel htmlFor="agency" hint="e.g. Ikeja Electric, Zone 16 Police">
          Which agency / office?
        </FieldLabel>
        <input
          id="agency"
          name="agency"
          required
          minLength={2}
          maxLength={200}
          placeholder="Type the office name"
        />
      </div>

      {/* ─── state + LGA ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="state">State</FieldLabel>
          <select id="state" name="state" required defaultValue="Lagos">
            {NIGERIA_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="lga" hint="optional">
            LGA
          </FieldLabel>
          <input id="lga" name="lga" maxLength={80} placeholder="e.g. Egor" />
        </div>
      </div>

      {/* ─── body ─── */}
      <div>
        <FieldLabel htmlFor="body" hint="50–5000 chars">
          Wetin happen?
        </FieldLabel>
        <textarea
          id="body"
          name="body"
          required
          minLength={50}
          maxLength={5000}
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Talk am as e happen. Wetin you see, when, where."
        />
        <div className="mt-1.5 flex items-center justify-between">
          <p
            className={`text-[0.75rem] ${
              bodyOk ? "text-faint" : "text-faint/70"
            }`}
          >
            {bodyOk
              ? "Ready when you are."
              : bodyLength === 0
                ? "Minimum 50 characters."
                : `${50 - bodyLength} more characters needed.`}
          </p>
          <p className="font-mono text-[0.7rem] text-faint">{bodyCount}</p>
        </div>
      </div>

      {/* ─── amount ─── */}
      <div>
        <FieldLabel htmlFor="amount" hint="optional">
          How much dem demand?
        </FieldLabel>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-serif text-lg text-faint">
            ₦
          </span>
          <input
            id="amount"
            name="amount"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            className="!pl-9"
          />
        </div>
      </div>

      {/* ─── evidence ─── */}
      <div>
        <FieldLabel htmlFor="evidence" hint="optional — EXIF/GPS go komot">
          Evidence photo
        </FieldLabel>
        <input
          id="evidence"
          name="evidence"
          type="file"
          accept="image/*"
          className="!p-2 file:mr-3 file:rounded-lg file:border-0 file:bg-ink/5 file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-medium file:text-ink hover:file:bg-ink/10"
        />
      </div>

      {/* ─── anonymous confirm ─── */}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
        <input
          type="checkbox"
          name="anonymous"
          required
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#1F7A4D]"
        />
        <span className="text-[0.875rem] leading-relaxed text-ink">
          I confirm say this post dey anonymous.
          <span className="block text-[0.8125rem] text-muted">
            No name, no phone, no email.
          </span>
        </span>
      </label>

      {/* ─── error ─── */}
      {error ? (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3">
          <p className="text-[0.875rem] text-danger">{error}</p>
        </div>
      ) : null}

      {/* ─── submit ─── */}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-warm px-5 py-4 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-warm-deep hover:shadow-card disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Dey post am…" : "Post am"}
      </button>

      <p className="text-center text-[0.75rem] text-faint">
        You fit delete am later if you want. Nothing go carry your name.
      </p>
    </form>
  );
}