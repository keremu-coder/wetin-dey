import "server-only";
import webpush from "web-push";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || "mailto:support@wetindey.app";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subj, pub, priv);
  vapidReady = true;
  return true;
}

// ---------------------------------------------------------------------------
// FCM v1 (native push: iOS via APNs relay, Android direct)
// ---------------------------------------------------------------------------

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

let fcmSaCache: ServiceAccount | null | undefined = undefined;
let fcmTokenCache: { token: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccount | null {
  if (fcmSaCache !== undefined) return fcmSaCache;
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    fcmSaCache = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (
      !parsed.project_id ||
      !parsed.client_email ||
      !parsed.private_key
    ) {
      fcmSaCache = null;
      return null;
    }
    fcmSaCache = parsed as ServiceAccount;
    return fcmSaCache;
  } catch {
    fcmSaCache = null;
    return null;
  }
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signJwtRS256(payload: Record<string, unknown>, privateKey: string) {
  const header = { alg: "RS256", typ: "JWT" };
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const signingInput = `${encHeader}.${encPayload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${signingInput}.${b64url(signature)}`;
}

async function getFcmAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Date.now();
  if (fcmTokenCache && fcmTokenCache.expiresAt > now + 60_000) {
    return fcmTokenCache.token;
  }

  const iat = Math.floor(now / 1000);
  const jwt = signJwtRS256(
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600
    },
    sa.private_key
  );

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) return null;
    fcmTokenCache = {
      token: json.access_token,
      expiresAt: now + (json.expires_in ?? 3600) * 1000
    };
    return json.access_token;
  } catch {
    return null;
  }
}

type NativeTarget = {
  id: string;
  session_id: string;
  platform: "ios" | "android";
  token: string;
};

async function sendNativePush(
  targets: NativeTarget[],
  payload: { title: string; body: string; tag?: string; url?: string }
): Promise<void> {
  if (targets.length === 0) return;
  const sa = loadServiceAccount();
  if (!sa) return;

  const accessToken = await getFcmAccessToken(sa);
  if (!accessToken) return;

  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const staleIds: string[] = [];

  await Promise.all(
    targets.map(async (t) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            message: {
              token: t.token,
              notification: {
                title: payload.title,
                body: payload.body
              },
              data: {
                url: payload.url ?? "/",
                tag: payload.tag ?? "wetindey"
              },
              apns: {
                payload: {
                  aps: {
                    sound: "default",
                    "thread-id": payload.tag ?? "wetindey"
                  }
                }
              },
              android: {
                notification: {
                  tag: payload.tag ?? "wetindey",
                  sound: "default"
                }
              }
            }
          })
        });

        if (res.status === 404 || res.status === 410) {
          staleIds.push(t.id);
          return;
        }
        if (!res.ok) {
          // 400 = invalid argument (bad token shape). Treat as stale.
          if (res.status === 400) staleIds.push(t.id);
        }
      } catch {
        /* network — retry next time */
      }
    })
  );

  if (staleIds.length > 0) {
    try {
      await sb().from("native_push_tokens").delete().in("id", staleIds);
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

type PushTarget = {
  session_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function sendWebPush(
  sessionIds: string[],
  payload: { title: string; body: string; tag?: string; url?: string }
): Promise<void> {
  if (!ensureVapid()) return;

  const { data, error } = await sb()
    .from("push_subscriptions")
    .select("session_id, endpoint, p256dh, auth")
    .in("session_id", sessionIds);

  if (error || !data) return;

  const targets = data as PushTarget[];
  const deadEndpoints: string[] = [];

  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: t.endpoint,
            keys: { p256dh: t.p256dh, auth: t.auth }
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            tag: payload.tag ?? "wetindey",
            url: payload.url ?? "/"
          })
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          deadEndpoints.push(t.endpoint);
        }
      }
    })
  );

  if (deadEndpoints.length > 0) {
    await sb()
      .from("push_subscriptions")
      .delete()
      .in("endpoint", deadEndpoints);
  }
}

async function loadNativeTargets(
  sessionIds: string[]
): Promise<NativeTarget[]> {
  const { data, error } = await sb()
    .from("native_push_tokens")
    .select("id, session_id, platform, token")
    .in("session_id", sessionIds);

  if (error || !data) return [];
  return data as NativeTarget[];
}

export async function sendPushToSessions(
  sessionIds: string[],
  payload: { title: string; body: string; tag?: string; url?: string }
): Promise<void> {
  if (sessionIds.length === 0) return;

  const nativeTargets = await loadNativeTargets(sessionIds);

  await Promise.all([
    sendWebPush(sessionIds, payload),
    sendNativePush(nativeTargets, payload)
  ]);
}

export async function notifyCommunityMembers(params: {
  communityId: string;
  senderSessionId: string;
  senderHandle: string;
  communityName: string;
  communitySlug: string;
  body: string | null;
  hasAudio: boolean;
}): Promise<void> {
  const {
    communityId,
    senderSessionId,
    senderHandle,
    communityName,
    communitySlug,
    body,
    hasAudio
  } = params;

  const { data: members, error } = await sb()
    .from("community_members")
    .select("session_id")
    .eq("community_id", communityId);

  if (error || !members) return;

  const recipients = (members as Array<{ session_id: string }>)
    .map((m) => m.session_id)
    .filter((id) => id && id !== senderSessionId);

  if (recipients.length === 0) return;

  const preview = body
    ? body.slice(0, 90)
    : hasAudio
      ? "🎤 Voice note"
      : "New message";

  await sendPushToSessions(recipients, {
    title: `${senderHandle} in ${communityName}`,
    body: preview,
    tag: `chat-${communityId}`,
    url: `/c/${communitySlug}/chat`
  });
}

export async function notifyDMRecipient(params: {
  recipientSessionId: string;
  senderHandle: string;
  threadId: string;
  body: string;
}): Promise<void> {
  const { recipientSessionId, senderHandle, threadId, body } = params;

  // Skip push if the recipient was active in the last 30 seconds.
  // Reduces notification spam during active conversation.
  try {
    const { data: recipient } = await sb()
      .from("sessions")
      .select("last_seen_at")
      .eq("id", recipientSessionId)
      .maybeSingle();

    if (recipient?.last_seen_at) {
      const age = Date.now() - new Date(recipient.last_seen_at).getTime();
      if (age < 30 * 1000) return;
    }
  } catch {
    /* ignore */
  }

  const preview = body.length > 90 ? body.slice(0, 90) + "…" : body;

  await sendPushToSessions([recipientSessionId], {
    title: `@${senderHandle} sent you a message`,
    body: preview,
    tag: `dm-${threadId}`,
    url: `/inbox/${threadId}`
  });
}