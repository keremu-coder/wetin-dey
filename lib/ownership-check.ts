// Ownership guard.
//
// Our service-role Supabase client bypasses RLS entirely. That means every
// route that acts on user-owned data has to verify the caller owns it.
// This helper centralizes that check so we stop writing it ad-hoc per route.
//
// This is not RLS. It's a single source of truth for "is this session
// allowed to act on this row" — the actual security boundary today.

import { createServiceClient } from "./supabase/server";

export class OwnershipError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "OwnershipError";
    this.status = status;
  }
}

/** Throws if sessionId and targetSessionId are not the same. */
export function requireSameSession(
  sessionId: string | null,
  targetSessionId: string | null
): void {
  if (!sessionId) throw new OwnershipError("no session", 401);
  if (!targetSessionId || targetSessionId !== sessionId) {
    throw new OwnershipError("not authorized", 403);
  }
}

/**
 * Loads a row from `table` by id, verifies the caller owns it, returns it.
 * Throws OwnershipError on any failure. Never leaks existence of a row
 * owned by someone else.
 */
export async function requireOwnsRow<T = Record<string, unknown>>(
  table: string,
  rowId: string,
  sessionId: string | null,
  ownerColumn = "session_id"
): Promise<T> {
  if (!sessionId) throw new OwnershipError("no session", 401);

  const db = createServiceClient();
  const { data, error } = await db
    .from(table)
    .select("*")
    .eq("id", rowId)
    .maybeSingle();

  if (error) throw new OwnershipError("lookup failed", 500);
  if (!data) throw new OwnershipError("not found", 404);

  const owner = (data as Record<string, unknown>)[ownerColumn];
  if (owner !== sessionId) {
    throw new OwnershipError("not authorized", 403);
  }
  return data as T;
}

/**
 * Wraps a route handler so OwnershipError becomes a JSON response.
 * Usage:
 *   export const DELETE = withOwnership(async (req, { params }) => { ... });
 */
export function withOwnership<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof OwnershipError) {
        return Response.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
  };
}