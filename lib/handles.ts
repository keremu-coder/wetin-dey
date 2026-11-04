// lib/handles.ts
// Generates persistent handles.
// Strategy: try clean Nigerian-flavored names first. Fall back to name_1234 if taken.

const CLEAN_NAMES = [
  // Nigerian-flavored short words
  "Kpekpes", "Wahala", "Naija", "Oga", "Abeg", "Ehen", "Chop", "Yarn",
  "Gist", "Sab", "Japa", "Waka", "Kolo", "Shekpe", "Gbam", "Sote",
  "Nack", "Wetin", "Wowo", "Kele", "Biko", "Wahala", "Sharwama", "Suya",
  "Egusi", "Jollof", "Puff", "Agege", "Marwa", "Danfo", "Keke", "Okada",
  "Mama", "Papa", "Aunty", "Uncle", "Bros", "Sis", "Pikin", "Omoge",
  "Araba", "Ekpere", "Ori", "Emi", "Ile", "Oja", "Owo", "Ijo",

  // Place-flavored single words
  "Lagosian", "Abujapikin", "Phcity", "Ibadan", "Kanawa", "Enugu",
  "Josian", "Benin", "Owka", "Warri", "Calabar", "Akure", "Asaba",

  // Vibe words
  "Hustler", "Watcher", "Voice", "Spirit", "Yard", "Streets", "Zone",
  "Wave", "Vibes", "Speaks", "Corner", "Base", "Mind", "Soul",

  // Standalone words for neutral handles
  "Zango", "Gaskiya", "Nagari", "Ndewo", "Sannu", "Bature", "Onye",
  "Kai", "Haba", "Yawa", "Tufia", "Mba", "Oya", "Nau", "Sha"
];

const SUFFIX_WORDS = [
  "Vibes", "Boy", "Girl", "Voice", "Watcher", "Eyes", "Spirit", "Yard",
  "Streets", "Corner", "Zone", "Wave", "Base", "Mind", "Soul", "Speaks"
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function num4(): number {
  return Math.floor(1000 + Math.random() * 9000);
}

/**
 * Generate a clean candidate (no digits) — tried first.
 * These are rare in the early user base, so early users get them.
 */
export function generateCleanHandle(): string {
  return pick(CLEAN_NAMES);
}

/**
 * Generate a fallback handle with digits — used when clean names are exhausted.
 * Format: CleanName_1234 or CleanName1234
 */
export function generateFallbackHandle(): string {
  const name = pick(CLEAN_NAMES);
  const style = Math.random();
  if (style < 0.5) return `${name}_${num4()}`;
  return `${name}${num4()}`;
}

/**
 * Generate the old-style handle (place + vibe + digits) — last resort.
 */
const PLACES = [
  "Lagos", "Abuja", "PortHarcourt", "Ibadan", "Kano", "Benin",
  "Enugu", "Kaduna", "Jos", "Owerri", "Abeokuta", "Uyo"
];

export function generateLegacyHandle(): string {
  return `${pick(PLACES)}${pick(SUFFIX_WORDS)}_${num4()}`;
}

/**
 * Validate a user-chosen handle.
 * Rules: 3–20 chars, letters/numbers/underscore only, no spaces.
 */
export function isValidHandle(handle: string): boolean {
  if (handle.length < 3 || handle.length > 20) return false;
  return /^[a-zA-Z0-9_]+$/.test(handle);
}

/**
 * Suggest digit-suffixed variants when a chosen handle is taken.
 */
export function suggestHandlesTaken(base: string): string[] {
  return [
    `${base}1`,
    `${base}7`,
    `${base}22`,
    `${base}_${num4()}`,
    `${base}${num4()}`
  ];
}