export const runtime = "nodejs";
import { NextRequest } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getSessionId, getOrCreateSessionProfile } from "@/lib/session";
import { sameOrigin } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return Response.json({ error: "bad origin" }, { status: 403 });
  const sessionId = await getSessionId();
  if (!sessionId) return Response.json({ error: "no session" }, { status: 401 });
  
  const profile = await getOrCreateSessionProfile(sessionId);
  if (!profile) return Response.json({ error: "no profile" }, { status: 500 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const roomName = body.room_name;
  if (!roomName || typeof roomName !== "string") {
    return Response.json({ error: "room_name required" }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return Response.json({ error: "LiveKit config missing" }, { status: 500 });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: sessionId,
    name: profile.handle,
    ttl: "2h",
  });

  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

  return Response.json({ token: await at.toJwt() });
}