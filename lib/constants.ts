export const CATEGORIES = [
  "electricity",
  "police",
  "customs",
  "local_govt",
  "judiciary",
  "hospital",
  "school",
  "other"
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  electricity: "NEPA / light",
  police: "Police",
  customs: "Customs",
  local_govt: "Local government",
  judiciary: "Court / judiciary",
  hospital: "Hospital",
  school: "School",
  other: "Other"
};

export const STATUSES = [
  "reported",
  "forwarded",
  "acknowledged",
  "resolved",
  "disputed"
] as const;

export type Status = (typeof STATUSES)[number];

export const NIGERIA_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara"
] as const;

export type NigeriaState = (typeof NIGERIA_STATES)[number];

/** Approximate state centroids. Used only in-browser for Near you. Never stored. */
export const STATE_CENTROIDS: Record<NigeriaState, { lat: number; lng: number }> = {
  Abia: { lat: 5.4527, lng: 7.5248 },
  Adamawa: { lat: 9.3265, lng: 12.3984 },
  "Akwa Ibom": { lat: 4.9057, lng: 7.8537 },
  Anambra: { lat: 6.2209, lng: 6.937 },
  Bauchi: { lat: 10.3158, lng: 9.8442 },
  Bayelsa: { lat: 4.7719, lng: 6.0699 },
  Benue: { lat: 7.3369, lng: 8.7404 },
  Borno: { lat: 11.8846, lng: 13.1571 },
  "Cross River": { lat: 5.8702, lng: 8.5988 },
  Delta: { lat: 5.704, lng: 6.1676 },
  Ebonyi: { lat: 6.2649, lng: 8.0137 },
  Edo: { lat: 6.6342, lng: 5.9304 },
  Ekiti: { lat: 7.719, lng: 5.311 },
  Enugu: { lat: 6.4584, lng: 7.5464 },
  FCT: { lat: 9.0765, lng: 7.3986 },
  Gombe: { lat: 10.2897, lng: 11.1711 },
  Imo: { lat: 5.572, lng: 7.0588 },
  Jigawa: { lat: 12.228, lng: 9.5616 },
  Kaduna: { lat: 10.5105, lng: 7.4165 },
  Kano: { lat: 11.7471, lng: 8.5247 },
  Katsina: { lat: 12.9908, lng: 7.6006 },
  Kebbi: { lat: 11.4942, lng: 4.1995 },
  Kogi: { lat: 7.7337, lng: 6.6906 },
  Kwara: { lat: 8.9669, lng: 4.3874 },
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Nasarawa: { lat: 8.4998, lng: 8.199 },
  Niger: { lat: 9.9309, lng: 5.5983 },
  Ogun: { lat: 6.9075, lng: 3.5813 },
  Ondo: { lat: 6.9149, lng: 5.1478 },
  Osun: { lat: 7.5629, lng: 4.52 },
  Oyo: { lat: 8.1574, lng: 3.6147 },
  Plateau: { lat: 9.2182, lng: 9.5179 },
  Rivers: { lat: 4.8396, lng: 6.9112 },
  Sokoto: { lat: 13.0059, lng: 5.2476 },
  Taraba: { lat: 8.0141, lng: 10.7376 },
  Yobe: { lat: 12.2939, lng: 11.4394 },
  Zamfara: { lat: 12.1222, lng: 6.2236 }
};

export const COOKIE_NAME = "na_session";
export const PAGE_SIZE = 30;
export const FORMALIZE_TIMEOUT_MS = 10_000;
export const CONFIDENCE_REVIEW_THRESHOLD = 0.7;
export const REPORTS_PER_HOUR = 10;
export const COMMENTS_PER_HOUR = 20;
export const PUBLIC_FEED_PER_MIN = 60;

export function nearestState(lat: number, lng: number): NigeriaState {
  let best: NigeriaState = "FCT";
  let bestDist = Number.POSITIVE_INFINITY;
  for (const state of NIGERIA_STATES) {
    const c = STATE_CENTROIDS[state];
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = state;
    }
  }
  return best;
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function formatNaira(kobo: number | null | undefined): string {
  if (kobo == null) return "";
  const naira = kobo / 100;
  return `₦${naira.toLocaleString("en-NG")}`;
}
