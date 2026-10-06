// Daily rotating prompt.
// Same prompt for every user all day. Rotates at midnight UTC.
// Deterministic — no DB read needed to know today's prompt.

export type DailyPrompt = {
  id: string;
  text: string;
  hint: string;
};

// Keep these short, low-pressure, Nigerian. The best ones get answered
// in one line without thinking.
export const DAILY_PROMPTS: DailyPrompt[] = [
  {
    id: "good-thing",
    text: "Wetin good happen to you today?",
    hint: "Small thing still counts"
  },
  {
    id: "small-win",
    text: "One small win from this week?",
    hint: "No matter how small"
  },
  {
    id: "appreciate",
    text: "Who you wan appreciate today?",
    hint: "Tag them with @handle"
  },
  {
    id: "look-forward",
    text: "Wetin you dey look forward to?",
    hint: "Today, this weekend, this year"
  },
  {
    id: "learn",
    text: "One thing you learn today?",
    hint: "Could be anything"
  },
  {
    id: "best-chop",
    text: "Best thing you chop today?",
    hint: "Food is life"
  },
  {
    id: "thank",
    text: "One person wey help you this week?",
    hint: "Say thank you publicly"
  },
  {
    id: "laugh",
    text: "Wetin make you laugh today?",
    hint: "Share the joy"
  },
  {
    id: "proud",
    text: "Wetin you dey proud of about yourself?",
    hint: "Big or small"
  },
  {
    id: "hope",
    text: "One thing you hope for Nigeria this week?",
    hint: "Small hope still counts"
  },
  {
    id: "wish",
    text: "If you get one wish today, wetin e go be?",
    hint: "Dream small or dream big"
  },
  {
    id: "place",
    text: "One place for Nigeria you wan visit?",
    hint: "Anywhere"
  }
];

/** YYYY-MM-DD in UTC. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Deterministic index — same prompt for everyone all day.
 * Rotation shifts at UTC midnight.
 */
export function todayPrompt(): DailyPrompt & { date: string } {
  const date = todayUtc();
  const dayNumber = Math.floor(
    new Date(date + "T00:00:00Z").getTime() / (24 * 60 * 60 * 1000)
  );
  const index =
    ((dayNumber % DAILY_PROMPTS.length) + DAILY_PROMPTS.length) %
    DAILY_PROMPTS.length;
  return { ...DAILY_PROMPTS[index], date };
}