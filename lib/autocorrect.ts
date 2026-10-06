// lib/autocorrect.ts
// Light-touch autocorrect for Nigerian English + Pidgin.
// Rules:
//   1. Never touch Pidgin words (whitelist below).
//   2. Fix only clear English typos (dictionary below).
//   3. Capitalize first letter of message.
//   4. Capitalize "I" when used as pronoun.
//   5. Never auto-correct inside @mentions or URLs.

const PIDGIN_WHITELIST = new Set([
  "dey", "na", "wetin", "abeg", "wahala", "sabi", "chop", "yawa",
  "waka", "gist", "oya", "sha", "sef", "nna", "oga", "ehen", "abi",
  "mumu", "yarn", "japa", "nack", "kolo", "shekpe", "gbam",
  "egusi", "jollof", "suya", "danfo", "keke", "okada", "shakara",
  "palava", "kpomo", "akara", "buka", "sallah", "owambe", "gele",
  "aso", "oke", "agbada", "babalawo", "biko", "nwanne", "ndo",
  "nne", "oma", "olo", "olu", "sannu", "kai", "haba", "tufia",
  "mba", "nau", "gaskiya", "nagari", "yau", "gobe", "kedu",
  "ndewo", "bawo", "pele", "ogbeni", "iya", "baba", "omo", "jo",
  "wetin", "comot", "waka", "shine", "yansh", "wowo", "yeye",
  "kpangolo", "kpali", "kpakpando", "nkita", "nkwu", "akwukwo"
]);

const TYPO_MAP: Record<string, string> = {
  // Common English typos
  teh: "the",
  adn: "and",
  nad: "and",
  hte: "the",
  thsi: "this",
  recieve: "receive",
  belive: "believe",
  definately: "definitely",
  seperate: "separate",
  occured: "occurred",
  accomodate: "accommodate",
  wich: "which",
  woudl: "would",
  woud: "would",
  shoudl: "should",
  shoud: "should",
  becuase: "because",
  beacuse: "because",
  freind: "friend",
  freinds: "friends",
  goign: "going",
  doign: "doing",
  wrogn: "wrong",
  tomorow: "tomorrow",
  tommorow: "tomorrow",
  tonite: "tonight",
  reccomend: "recommend",
  sucessful: "successful",
  succesful: "successful",
  neccessary: "necessary",
  necesary: "necessary",

  // Missing apostrophes — safe ones only
  dont: "don't",
  doesnt: "doesn't",
  didnt: "didn't",
  isnt: "isn't",
  wasnt: "wasn't",
  werent: "weren't",
  cant: "can't",
  wont: "won't",
  havent: "haven't",
  hasnt: "hasn't",
  hadnt: "hadn't",
  couldnt: "couldn't",
  wouldnt: "wouldn't",
  shouldnt: "shouldn't",
  aint: "ain't",
  youre: "you're",
  youve: "you've",
  youll: "you'll",
  thats: "that's",
  whats: "what's",
  wheres: "where's",
  ive: "I've",
  im: "I'm",
  lets: "let's"
};

/** True if the word looks like a URL, mention, emoji, or number. */
function shouldSkipWord(word: string): boolean {
  if (!word) return true;
  if (word.startsWith("@") || word.startsWith("#")) return true;
  if (word.startsWith("http://") || word.startsWith("https://")) return true;
  if (word.startsWith("www.")) return true;
  if (/^\d+$/.test(word)) return true;
  if (/^[\p{Emoji}]+$/u.test(word)) return true;
  if (word.length < 2) return true;
  return false;
}

/** Preserve leading/trailing punctuation while correcting the core word. */
function correctWord(raw: string): string {
  const match = raw.match(/^([^\w@#]*)([\w'@#-]+)([^\w]*)$/);
  if (!match) return raw;

  const [, leading, core, trailing] = match;
  if (!core) return raw;

  const lower = core.toLowerCase();
  if (PIDGIN_WHITELIST.has(lower)) return raw;

  if (TYPO_MAP[lower]) {
    const corrected = TYPO_MAP[lower];
    // Preserve the original case shape (Title, UPPER, lower)
    if (core === core.toUpperCase() && core.length > 1) {
      return leading + corrected.toUpperCase() + trailing;
    }
    if (core[0] === core[0].toUpperCase()) {
      return leading + corrected[0].toUpperCase() + corrected.slice(1) + trailing;
    }
    return leading + corrected + trailing;
  }

  return raw;
}

/** Capitalize the first letter of a string. */
function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Apply autocorrect to a whole message.
 * Only runs on blur or send, not on every keystroke.
 * Returns the corrected string.
 */
export function autocorrect(input: string): string {
  if (!input || !input.trim()) return input;

  // Split preserving whitespace so we can rebuild without losing spacing
  const parts = input.split(/(\s+)/);

  const corrected = parts.map((part) => {
    if (/^\s+$/.test(part)) return part;
    if (shouldSkipWord(part)) return part;
    return correctWord(part);
  });

  let result = corrected.join("");

  // Capitalize first character of the message
  result = capitalizeFirst(result);

  // Capitalize "i" when it's a standalone word
  result = result.replace(/\bi\b/g, "I");

  // Capitalize first letter after . ! ?
  result = result.replace(/([.!?]\s+)([a-z])/g, (_m, p1, p2) => p1 + p2.toUpperCase());

  return result;
}

/**
 * Returns a list of correction suggestions for the last typed word.
 * Useful for a suggestion chip above the keyboard.
 * Returns null if no suggestion.
 */
export function suggestCorrection(input: string): {
  original: string;
  suggested: string;
} | null {
  if (!input) return null;
  const match = input.match(/([a-zA-Z']+)$/);
  if (!match) return null;
  const word = match[1];
  const lower = word.toLowerCase();

  if (PIDGIN_WHITELIST.has(lower)) return null;

  const suggested = TYPO_MAP[lower];
  if (!suggested) return null;
  if (suggested.toLowerCase() === lower) return null;

  return { original: word, suggested };
}