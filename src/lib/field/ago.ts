/** The words timeAgo needs. English by default; the screens pass the Hindi ones. */
export interface AgoWords {
  never: string;
  justNow: string;
  minAgo: string; // "{n} min ago"
  hourAgo: string;
  dayAgo: string;
  daysAgo: string;
}

const ENGLISH: AgoWords = {
  never: "never",
  justNow: "just now",
  minAgo: "{n} min ago",
  hourAgo: "{n} h ago",
  dayAgo: "{n} day ago",
  daysAgo: "{n} days ago",
};

/** "just now", "12 min ago", "3 h ago", "2 days ago". Plain words a salesman reads at a glance. */
export function timeAgo(iso: string | null, now: Date = new Date(), words: AgoWords = ENGLISH): string {
  if (!iso) return words.never;
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return words.justNow;
  if (mins < 60) return words.minAgo.replace("{n}", String(mins));
  const hours = Math.round(mins / 60);
  if (hours < 24) return words.hourAgo.replace("{n}", String(hours));
  const days = Math.round(hours / 24);
  return (days === 1 ? words.dayAgo : words.daysAgo).replace("{n}", String(days));
}

/** Whole days since an ISO time, or null if there is none. */
export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}
