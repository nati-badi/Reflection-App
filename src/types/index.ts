export interface DayEntry {
  id: string; // {userId}_{YYYY-MM-DD}
  userId: string;
  date: string; // YYYY-MM-DD
  contentMarkdown: string;
  mood: string | null;
  createdAt: number; // Unix timestamp first created
  updatedAt: number; // Unix timestamp last edited
}

// Backward compatibility alias during migration
export type Entry = DayEntry;

export interface StreakMeta {
  currentStreak: number;
  longestStreak: number;
  lastEntryDate: string; // YYYY-MM-DD
}

export interface WeeklySummary {
  id?: string;
  userId: string;
  weekId: string; // e.g. "2026-W30"
  startDate: string; // YYYY-MM-DD (Monday)
  endDate: string; // YYYY-MM-DD (Sunday)
  daysWrittenCount: number; // e.g. 5
  moodBreakdown: Record<string, number>; // e.g. { '😁': 3, '😊': 2 }
  streakAtEndOfWeek: number;
  createdAt: number;
}
