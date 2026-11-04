export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * Report a server-side error with a short correlation ref.
 *
 * The ref is written to Vercel runtime logs alongside the full error,
 * and returned to the client. Users see "Something went wrong" plus a
 * short id; you grep the logs for that id and get the exact cause in
 * one search. Never exposes the raw error or a stack trace to the
 * client.
 */
export function serverError(scope: string, err: unknown) {
  const ref = Math.random().toString(36).slice(2, 10);
  console.error(`[${scope}] ref=${ref}`, err);
  return Response.json(
    { error: "Something went wrong", ref },
    { status: 500 }
  );
}