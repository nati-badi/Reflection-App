export interface Entry {
  id?: string;
  userId: string;
  createdAt: number; // Unix timestamp
  contentMarkdown: string;
  mood: string | null;
  updatedAt: number;
}

export interface StreakMeta {
  currentStreak: number;
  longestStreak: number;
  lastEntryDate: string; // YYYY-MM-DD
}
