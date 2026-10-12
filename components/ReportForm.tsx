"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import exifr from "exifr";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  NIGERIA_STATES,
  type Category
} from "@/lib/constants";
import {
  pickRecorderFormat,
  actualMime,
  extFromType
} from "@/lib/voice-recorder";

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
        <span className="ml-2 text-[0.75rem] font-normal text-faint">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

const TALK_TYPES = [
  { value: "report_am", label: "Report" },
  { value: "ask", label: "Ask" },
  { value: "help", label: "Help" }
];

const COMMUNITY_TYPES = [
  { value: "talk_am", label: "Gist" },
  { value: "news", label: "News" },
  { value: "talent", label: "Talent" },
  { value: "rant", label: "Rant" }
];

type TargetType = "public" | "private";

export function ReportForm({
  tab = "talk",
  communitySlug = null
}: {
  tab?: "talk" | "community";
  communitySlug?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [postType, setPostType] = useState(
    tab === "talk" ? "report_am" : "talk_am"
  );
  const [targetType, setTargetType] = useState<TargetType>("public");
  const [title, setTitle] = useState("");

  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceKind, setEvidenceKind] = useState<string | null>(null);
  const [publicLink, setPublicLink] = useState("");
  const [testimonyFile, setTestimonyFile] = useState<File | null>(null);
  const [testimonyUrl, setTestimonyUrl] = useState<string | null>(null);
  const [testimonySeconds, setTestimonySeconds] = useState(0);
  const [testimonyRecording, setTestimonyRecording] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const testimonyUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (testimonyUrlRef.current) URL.revokeObjectURL(testimonyUrlRef.current);
    };
  }, []);

  const requiresEvidence = tab === "talk" && postType === "report_am";

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
    else if (f.type.startsWith("audio/")) setEvidenceKind("Audio");
    else setEvidenceKind("File");
    setError("");
  }

  async function startTestimony() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const format = pickRecorderFormat();

      let mr: MediaRecorder;
      try {
        mr = format.mimeType
          ? new MediaRecorder(stream, { mimeType: format.mimeType })
          : new MediaRecorder(stream);
      } catch {
        mr = new MediaRecorder(stream);
      }

      recorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const mime = actualMime(mr, format.mimeType);
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = extFromType(mime);
        const file = new File([blob], `testimony.${ext}`, {
          type: mime || "audio/webm"
        });
        if (testimonyUrlRef.current) URL.revokeObjectURL(testimonyUrlRef.current);
        const url = URL.createObjectURL(file);
        testimonyUrlRef.current = url;
        setTestimonyFile(file);
        setTestimonyUrl(url);
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
    if (testimonyUrlRef.current) URL.revokeObjectURL(testimonyUrlRef.current);
    testimonyUrlRef.current = null;
    setTestimonyUrl(null);
    setTestimonyFile(null);
    setTestimonySeconds(0);
  }

  const hasEvidence =
    !!evidenceFile || !!testimonyFile || publicLink.trim().length > 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (requiresEvidence && !hasEvidence) {
      setError(
        "Report no go publish without evidence. Attach photo, video, audio, voice testimony, or public link."
      );
      return;
    }

    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    fd.set("post_type", postType);
    fd.set("target_type", targetType);

    if (communitySlug) {
      fd.set("community_slug", communitySlug);
    }

    if (evidenceFile && evidenceFile.type.startsWith("image/")) {
      try {
        const clean = await stripExifInBrowser(evidenceFile);
        fd.set(
          "evidence",
          new File([clean], "evidence.jpg", { type: "image/jpeg" })
        );
      } catch {
        fd.set("evidence", evidenceFile);
      }
    } else if (evidenceFile) {
      fd.set("evidence", evidenceFile);
    }

    if (testimonyFile) fd.set("voice_testimony", testimonyFile);
    if (publicLink.trim()) fd.set("public_link", publicLink.trim());

    fd.set("anonymous", "true");

    const res = await fetch("/api/reports", { method: "POST", body: fd });
    const json = (await res.json()) as { id?: string; error?: string };
    if (!res.ok || !json.id) {
      setError(json.error ?? "post no send");
      setBusy(false);
      return;
    }

    void fetch("/api/formalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: json.id }),
      keepalive: true
    });

    if (communitySlug) {
      router.push(`/c/${communitySlug}`);
    } else {
      router.push(`/r/${json.id}`);
    }
  }

  const bodyLength = body.length;
  const bodyOk = bodyLength >= 50 && bodyLength <= 5000;

  const typeOptions = tab === "talk" ? TALK_TYPES : COMMUNITY_TYPES;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <FieldLabel required>What kind of post?</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map((t) => (
            <label key={t.value} className="cursor-pointer">
              <input
                type="radio"
                name="post_type_ui"
                value={t.value}
                checked={postType === t.value}
                onChange={() => setPostType(t.value)}
                className="peer sr-only"
              />
              <span
                className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-[0.8125rem] transition-all ${
                  postType === t.value
                    ? "border-brand bg-brand text-white"
                    : "border-border-strong bg-surface text-ink hover:bg-ink/5"
                }`}
              >
                {t.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {tab === "community" || postType !== "report_am" ? (
        <div>
          <FieldLabel htmlFor="title" hint="short headline" required>
            Title
          </FieldLabel>
          <input
            id="title"
            name="title"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give am a short title"
          />
        </div>
      ) : null}

      {tab === "talk" && postType === "report_am" ? (
        <>
          <div>
            <FieldLabel required>Who is this about?</FieldLabel>
            <div className="space-y-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                  targetType === "public"
                    ? "border-brand bg-brand-tint/60"
                    : "border-border-strong hover:bg-ink/5"
                }`}
              >
                <input
                  type="radio"
                  name="target_type_ui"
                  value="public"
                  checked={targetType === "public"}
                  onChange={() => setTargetType("public")}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] font-semibold text-ink">
                    A public agency or official
                  </p>
                  <p className="mt-0.5 text-[0.75rem] leading-snug text-muted">
                    NEPA, police, customs, or a named public official acting in
                    their official capacity. Publishes immediately.
                  </p>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                  targetType === "private"
                    ? "border-gold bg-gold-soft/40"
                    : "border-border-strong hover:bg-ink/5"
                }`}
              >
                <input
                  type="radio"
                  name="target_type_ui"
                  value="private"
                  checked={targetType === "private"}
                  onChange={() => setTargetType("private")}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] font-semibold text-ink">
                    A private individual by name
                  </p>
                  <p className="mt-0.5 text-[0.75rem] leading-snug text-muted">
                    A specific person acting privately. Held for manual review
                    before publishing — higher evidence bar.
                  </p>
                </div>
              </label>
            </div>
          </div>

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
                  <span className="inline-flex items-center rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-[0.8125rem] text-ink transition-all peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white">
                    {CATEGORY_LABELS[c]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel
              htmlFor="agency"
              required
              hint="e.g. Ikeja Electric, Zone 16 Police"
            >
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
        </>
      ) : (
        <>
          <input type="hidden" name="category" value="other" />
          <input
            type="hidden"
            name="agency"
            value={title || "Community post"}
          />
          <input type="hidden" name="target_type" value="public" />
        </>
      )}

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

      <div>
        <FieldLabel htmlFor="body" hint="50–5000 chars" required>
          {tab === "talk" && postType === "report_am"
            ? "Wetin happen?"
            : "Your post"}
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
          placeholder={
            tab === "talk" && postType === "report_am"
              ? "Talk am as e happen. Wetin you see, when, where."
              : "Talk am. Say wetin dey your mind."
          }
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
          <p className="text-[0.7rem] text-faint">
            {bodyLength}/5000
          </p>
        </div>
      </div>

      {tab === "talk" && postType === "report_am" ? (
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
      ) : null}

      {requiresEvidence ? (
        <div className="rounded-2xl border-2 border-gold/40 bg-gold-soft/30 p-5">
          <div className="mb-4">
            <p className="font-serif text-[1.1rem] font-semibold text-ink">
              Evidence <span className="text-danger">*</span>
            </p>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
              Attach at least one. Reports without evidence no go publish.
            </p>
          </div>

          <div className="mb-4">
            <FieldLabel htmlFor="evidence" hint="photo, video, or audio">
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
              <p className="mt-2 text-[0.75rem] text-brand">
                ✓ {evidenceKind} attached —{" "}
                {Math.round(evidenceFile.size / 1024)} KB
              </p>
            ) : null}
          </div>

          <div className="mb-4 border-t border-border pt-4">
            <FieldLabel hint="say what happened in your own voice">
              2. Or voice testimony
            </FieldLabel>
            {!testimonyFile && !testimonyRecording ? (
              <button
                type="button"
                onClick={startTestimony}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-[0.875rem] font-medium text-white shadow-button transition-all hover:bg-brand-soft"
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
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand-tint/60 p-3">
                <audio
                  src={testimonyUrl ?? undefined}
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
          </div>

          <div className="border-t border-border pt-4">
            <FieldLabel
              htmlFor="public_link"
              hint="news article, court record, FOI response"
            >
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
      ) : (
        <div>
          <FieldLabel htmlFor="evidence" hint="optional image">
            Photo
          </FieldLabel>
          <input
            id="evidence"
            name="evidence"
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="!p-2 file:mr-3 file:rounded-lg file:border-0 file:bg-ink/5 file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-medium file:text-ink hover:file:bg-ink/10"
          />
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-brand/40">
        <input
          type="checkbox"
          name="anonymous"
          required
          defaultChecked
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#1F7A4D]"
        />
        <span className="text-[0.875rem] leading-relaxed text-ink">
          I understand say my name no go show.
          <span className="block text-[0.8125rem] text-muted">
            No name, no phone, no email. Everything here dey anonymous.
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
        disabled={busy || (requiresEvidence && !hasEvidence)}
        className="w-full rounded-2xl bg-brand px-5 py-4 font-serif text-[1.05rem] font-semibold text-white shadow-button transition-all hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy
          ? "Dey post am…"
          : requiresEvidence && !hasEvidence
            ? "Attach evidence to publish"
            : "Post am"}
      </button>
    </form>
  );
}