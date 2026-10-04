export function originAllowed(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const site = req.headers.get("sec-fetch-site");
  return site === "same-origin" || site === "none";
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
