"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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

function FieldLabel({
  htmlFor,
  children,
  hint,
  required
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block">
      <span className="text-[0.8125rem] font-semibold text-ink">
        {children}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      {hint ? (
        <span className="ml-2 text-[0.75rem] font-normal text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export function ReportForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");

  // Evidence state
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceKind, setEvidenceKind] = useState<string | null>(null);
  const [publicLink, setPublicLink] = useState("");
  const [testimonyFile, setTestimonyFile] = useState<File | null>(null);
  const [testimonySeconds, setTestimonySeconds] = useState(0);
  const [testimonyRecording, setTestimonyRecording] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setEvidenceFile(null);
      setEvidenceKind(null);
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError("File too large (max 25MB)");
      e.target.value = "";
      return;
    }
    setEvidenceFile(f);
    if (f.type.startsWith("image/")) setEvidenceKind("Photo");
    else if (f.type.startsWith("video/")) setEvidenceKind("Video");
    else if (f.type.startsWith("audio/")) setEvidenceKind("Audio recording");
    else setEvidenceKind("File");
    setError("");
  }

  async function startTestimony() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "testimony.webm", { type: "audio/webm" });
        setTestimonyFile(file);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setTestimonyRecording(true);
      setTestimonySeconds(0);
      timerRef.current = setInterval(() => {
        setTestimonySeconds((s) => {
          if (s >= 120) {
            stopTestimony();
            return 120;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone no work. Check permission.");
    }
  }

  function stopTestimony() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setTestimonyRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function clearTestimony() {
    setTestimonyFile(null);
    setTestimonySeconds(0);
  }

  const hasEvidence =
    !!evidenceFile || !!testimonyFile || publicLink.trim().length > 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!hasEvidence) {
      setError(
        "Report no go publish without evidence. Attach photo, video, audio, voice testimony, or public link."
      );
      return;
    }

    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    // Strip EXIF if image
    if (evidenceFile && evidenceFile.type.startsWith("image/")) {
      try {
        const clean = await stripExifInBrowser(evidenceFile);
        fd.set(
          "evidence",
          new File([clean], "evidence.jpg", { type: "image/jpeg" })
        );
      } catch {
        // fall back to original — server strips again
        fd.set("evidence", evidenceFile);
      }
    } else if (evidenceFile) {
      fd.set("evidence", evidenceFile);
    }

    if (testimonyFile) {
      fd.set("voice_testimony", testimonyFile);
    }
    if (publicLink.trim()) {
      fd.set("public_link", publicLink.trim());
    }

    fd.set("anonymous", "true");

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

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Trust banner */}
      <div className="rounded-2xl border border-accent/25 bg-accent-soft/60 p-4">
        <p className="text-[0.8125rem] leading-relaxed text-accent-deep">
          <strong className="font-semibold">Evidence is required.</strong> A report
          cannot publish without at least one attached evidence — photo, video, audio,
          voice testimony, or a link to a public source. Reports wey no get evidence
          no go fly out.
        </p>
      </div>

      {/* Category */}
      <div>
        <FieldLabel required>Category</FieldLabel>
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

      {/* Agency */}
      <div>
        <FieldLabel htmlFor="agency" hint="e.g. Ikeja Electric, Zone 16 Police" required>
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

      {/* State + LGA */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="state" required>
            State
          </FieldLabel>
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

      {/* Body */}
      <div>
        <FieldLabel htmlFor="body" hint="50–5000 chars" required>
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
          <p className={`text-[0.75rem] ${bodyOk ? "text-faint" : "text-faint/70"}`}>
            {bodyOk
              ? "Ready when you are."
              : bodyLength === 0
              ? "Minimum 50 characters."
              : `${50 - bodyLength} more characters needed.`}
          </p>
          <p className="font-mono text-[0.7rem] text-faint">{bodyLength}/5000</p>
        </div>
      </div>

      {/* Amount */}
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

      {/* ─── EVIDENCE SECTION ─────────────────────────────── */}
      <div className="rounded-2xl border-2 border-warm/40 bg-warm-soft/30 p-5">
        <div className="mb-4">
          <p className="font-serif text-[1.1rem] font-semibold text-ink">
            Evidence <span className="text-danger">*</span>
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            Attach at least one. Your report will not publish without it.
          </p>
        </div>

        {/* Evidence file */}
        <div className="mb-4">
          <FieldLabel htmlFor="evidence" hint="photo, video, or audio of the incident">
            1. File evidence
          </FieldLabel>
          <input
            id="evidence"
            name="evidence"
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={onFileChange}
            className="!p-2 file:mr-3 file:rounded-lg file:border-0 file:bg-ink/5 file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-medium file:text-ink hover:file:bg-ink/10"
          />
          {evidenceKind && evidenceFile ? (
            <p className="mt-2 text-[0.75rem] text-accent-deep">
              ✓ {evidenceKind} attached — {Math.round(evidenceFile.size / 1024)} KB
            </p>
          ) : null}
        </div>

        {/* Voice testimony */}
        <div className="mb-4 border-t border-border pt-4">
          <FieldLabel hint="say what happened in your own voice">
            2. Or voice testimony
          </FieldLabel>
          {!testimonyFile && !testimonyRecording ? (
            <button
              type="button"
              onClick={startTestimony}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[0.875rem] font-medium text-white shadow-button transition-all hover:bg-accent-deep"
            >
              🎙️ Record your account
            </button>
          ) : null}
          {testimonyRecording ? (
            <button
              type="button"
              onClick={stopTestimony}
              className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2 text-[0.875rem] font-medium text-white"
            >
              ■ Stop ({testimonySeconds}s / 120s max)
            </button>
          ) : null}
          {testimonyFile ? (
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft/40 p-3">
              <audio
                src={URL.createObjectURL(testimonyFile)}
                controls
                className="h-8 flex-1"
              />
              <button
                type="button"
                onClick={clearTestimony}
                className="rounded-lg px-2 py-1 text-[0.75rem] font-medium text-danger hover:bg-danger-soft"
              >
                Remove
              </button>
            </div>
          ) : null}
          <p className="mt-2 text-[0.75rem] leading-relaxed text-faint">
            Voice testimony is labeled as first-person account, not recorded
            evidence. It is weaker, but still valid.
          </p>
        </div>

        {/* Public link */}
        <div className="border-t border-border pt-4">
          <FieldLabel htmlFor="public_link" hint="news article, court record, FOI response">
            3. Or link to public source
          </FieldLabel>
          <input
            id="public_link"
            type="url"
            value={publicLink}
            onChange={(e) => setPublicLink(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      {/* Anonymous confirm */}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
        <input
          type="checkbox"
          name="anonymous"
          required
          defaultChecked
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#1F7A4D]"
        />
        <span className="text-[0.875rem] leading-relaxed text-ink">
          I confirm say this post dey anonymous.
          <span className="block text-[0.8125rem] text-muted">
            No name, no phone, no email.
          </span>
        </span>
      </label>

      {error ? (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3">
          <p className="text-[0.875rem] text-danger">{error}</p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy || !hasEvidence}
        className="w-full rounded-2xl bg-warm px-5 py-4 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-warm-deep hover:shadow-card disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy
          ? "Dey post am…"
          : hasEvidence
          ? "Post am"
          : "Attach evidence to publish"}
      </button>

      <p className="text-center text-[0.75rem] text-faint">
        You fit delete am later if you want. Nothing go carry your name.
      </p>
    </form>
  );
}