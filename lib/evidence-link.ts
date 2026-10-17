// Validates public evidence links submitted with a report.
//
// C7 fix (audit): the previous check `/^https?:\/\/.+\..+/` was too
// loose. It accepted 127.0.0.1, 192.168.x.x, 169.254.169.254 (cloud
// metadata endpoint), *.local, *.internal, and — because it wasn't
// anchored — any string that merely *contained* a matching substring.
//
// We now parse with new URL(), require http/https, require a public
// (non-RFC1918, non-loopback, non-link-local, non-CGNAT, non-multicast,
// non-broadcast) hostname, and reject special-use suffix domains
// (.local, .localhost, .internal, .test, .invalid, .example).
//
// This is a shape validator. It does NOT fetch the URL. Fetching
// user-supplied URLs server-side is SSRF territory and out of scope
// for this fix.

const PRIVATE_IPV4_BLOCKS: Array<[number, number]> = [
  // 0.0.0.0/8
  [0x00000000, 0x00ffffff],
  // 10.0.0.0/8
  [0x0a000000, 0x0affffff],
  // 100.64.0.0/10 (CGNAT, RFC 6598 — used by some Nigerian ISPs)
  [0x64400000, 0x647fffff],
  // 127.0.0.0/8 (loopback)
  [0x7f000000, 0x7fffffff],
  // 169.254.0.0/16 (link-local, includes AWS/GCP/Azure metadata 169.254.169.254)
  [0xa9fe0000, 0xa9feffff],
  // 172.16.0.0/12
  [0xac100000, 0xac1fffff],
  // 192.168.0.0/16
  [0xc0a80000, 0xc0a8ffff],
  // 224.0.0.0/4 (multicast)
  [0xe0000000, 0xefffffff],
  // 240.0.0.0/4 (reserved; includes 255.255.255.255 broadcast)
  [0xf0000000, 0xffffffff]
];

const BLOCKED_SUFFIXES = [
  ".local",
  ".localhost",
  ".internal",
  ".test",
  ".invalid",
  ".example"
];

function ipv4ToInt(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const octets = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (octets.some((o) => o < 0 || o > 255)) return null;
  return (
    (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>>
      0)
  );
}

function isPrivateIPv4(hostname: string): boolean {
  const n = ipv4ToInt(hostname);
  if (n === null) return false;
  return PRIVATE_IPV4_BLOCKS.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateIPv6(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // fc00::/7
  if (
    h.startsWith("fe8") ||
    h.startsWith("fe9") ||
    h.startsWith("fea") ||
    h.startsWith("feb")
  ) {
    return true; // fe80::/10
  }
  return false;
}

export type EvidenceLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function validateEvidenceLink(raw: string): EvidenceLinkResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "Public link is empty." };
  }
  if (trimmed.length > 2000) {
    return { ok: false, error: "Public link is too long." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Public link is not a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      error: "Public link must start with http:// or https://"
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) {
    return { ok: false, error: "Public link has no hostname." };
  }
  if (host.length > 253) {
    return { ok: false, error: "Public link has an invalid hostname." };
  }
  if (!host.includes(".")) {
    return { ok: false, error: "Public link must point to a public site." };
  }
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, error: "Public link must point to a public site." };
  }

  if (/^\d/.test(host) && isPrivateIPv4(host)) {
    return { ok: false, error: "Public link must point to a public site." };
  }
  if (host.startsWith("[") && isPrivateIPv6(host)) {
    return { ok: false, error: "Public link must point to a public site." };
  }

  return { ok: true, url: parsed.toString() };
}
