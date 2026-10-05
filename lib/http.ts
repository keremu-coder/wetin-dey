const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://9jawatindey.vercel.app",
  "https://wetin-dey-gamma.vercel.app",
  "https://wetindey.vercel.app"
];

// Accepts both Request and NextRequest — anything with .headers.get()
type HasHeaders = { headers: { get(name: string): string | null } };

export function originAllowed(req: HasHeaders): boolean {
  const origin = req.headers.get("origin");

  if (!origin) {
    const referer = req.headers.get("referer") ?? "";
    return ALLOWED_ORIGINS.some((o) => referer.startsWith(o));
  }

  return ALLOWED_ORIGINS.some((o) => origin === o);
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}