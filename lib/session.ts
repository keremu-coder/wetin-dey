// lib/session.ts

import { nanoid } from "nanoid";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "./constants";
import {
  generateCleanHandle,
  generateFallbackHandle,
  generateLegacyHandle
} from "./handles";
import { createServiceClient } from "./supabase/server";

const encoder = new TextEncoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET must be set to a long random string");
  }
  return s;
}

async function hmacBase64Url(id: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(id));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(id: string): Promise<string> {
  const mac = await hmacBase64Url(id);
  return `${id}.${mac}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function verifySessionValue(raw: string | undefined): Promise<string | null> {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  if (id.length < 8 || id.length > 64) return null;
  const expected = await hmacBase64Url(id);
  if (!constantTimeEqual(mac, expected)) return null;
  return id;
}

export async function issueSessionCookieValue(): Promise<{ id: string; value: string }> {
  const id = nanoid();
  return { id, value: await sign(id) };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 400
  };
}

export async function getSessionId(): Promise<string | null> {
  const jar = cookies();
  return await verifySessionValue(jar.get(COOKIE_NAME)?.value);
}

export async function requireSessionId(): Promise<string> {
  const id = await getSessionId();
  if (!id) {
    throw new Error("no session");
  }
  return id;
}

export async function parseCookieHeader(cookieHeader: string | null): Promise<string | null> {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE_NAME) {
      return await verifySessionValue(rest.join("="));
    }
  }
  return null;
}

/* ─── handle validation ─────────────────────────────────── */

export function isValidHandleFormat(handle: string): boolean {
  if (handle.length < 3 || handle.length > 20) return false;
  return /^[a-zA-Z0-9_]+$/.test(handle);
}

/* ─── session profile ───────────────────────────────────── */

export type SessionProfile = {
  id: string;
  handle: string;
  handle_kind: "anonymous" | "named";
  display_name: string | null;
  email: string | null;
  phone: string | null;
  auth_provider: string | null;
  bio: string | null;
  avatar_url: string | null;
  karma: number;
  verified_reporter: boolean;
  follower_count: number;
  following_count: number;
  post_count: number;
  created_at: string;
};

export async function getOrCreateSessionProfile(
  sessionId: string
): Promise<SessionProfile | null> {
  const db = createServiceClient();

  const { data: existing } = await db
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (existing) return existing as SessionProfile;

  async function tryHandle(candidate: string): Promise<boolean> {
    const { data: clash } = await db
      .from("sessions")
      .select("id")
      .eq("handle", candidate)
      .maybeSingle();
    return !clash;
  }

  let handle: string | null = null;

  for (let i = 0; i < 8; i++) {
    const candidate = generateCleanHandle();
    if (await tryHandle(candidate)) {
      handle = candidate;
      break;
    }
  }

  if (!handle) {
    for (let i = 0; i < 5; i++) {
      const candidate = generateFallbackHandle();
      if (await tryHandle(candidate)) {
        handle = candidate;
        break;
      }
    }
  }

  if (!handle) {
    for (let i = 0; i < 5; i++) {
      const candidate = generateLegacyHandle();
      if (await tryHandle(candidate)) {
        handle = candidate;
        break;
      }
    }
  }

  if (!handle) {
    handle = `User_${Date.now().toString().slice(-6)}`;
  }

  const { data: created, error } = await db
    .from("sessions")
    .insert({
      id: sessionId,
      handle,
      handle_kind: "anonymous",
      auth_provider: "none"
    })
    .select("*")
    .single();

  if (error) {
    console.error("session create failed:", error);
    return null;
  }

  return created as SessionProfile;
}

export async function getCurrentProfile(): Promise<SessionProfile | null> {
  const id = await getSessionId();
  if (!id) return null;
  return await getOrCreateSessionProfile(id);
}