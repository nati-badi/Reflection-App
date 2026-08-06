import { create } from 'zustand';
import type { DayEntry, StreakMeta, WeeklySummary, MonthlySummary } from '../types';

interface DataState {
  // Shared App-Level Cached State
  streak: StreakMeta | null;
  streakLoading: boolean;
  todayDoc: DayEntry | null;
  todayDocLoading: boolean;
  timelineDays: DayEntry[];
  timelineLoading: boolean;
  onThisDayEntries: DayEntry[];
  onThisDayLoading: boolean;
  weeklies: WeeklySummary[];
  monthlies: MonthlySummary[];
  
  // Setters
  setStreak: (streak: StreakMeta | null) => void;
  setStreakLoading: (loading: boolean) => void;
  setTodayDoc: (doc: DayEntry | null) => void;
  setTodayDocLoading: (loading: boolean) => void;
  setTimelineDays: (days: DayEntry[] | ((prev: DayEntry[]) => DayEntry[])) => void;
  setTimelineLoading: (loading: boolean) => void;
  setOnThisDayEntries: (entries: DayEntry[]) => void;
  setOnThisDayLoading: (loading: boolean) => void;
  setWeeklies: (weeklies: WeeklySummary[]) => void;
  setMonthlies: (monthlies: MonthlySummary[]) => void;

  // Single Day Update helper across screens
  updateCachedDay: (updatedDay: DayEntry) => void;
}

export const useDataStore = create<DataState>((set) => ({
  streak: null,
  streakLoading: true,
  todayDoc: null,
  todayDocLoading: true,
  timelineDays: [],
  timelineLoading: true,
  onThisDayEntries: [],
  onThisDayLoading: true,
  weeklies: [],
  monthlies: [],

  setStreak: (streak) => set({ streak, streakLoading: false }),
  setStreakLoading: (streakLoading) => set({ streakLoading }),
  setTodayDoc: (todayDoc) => set({ todayDoc, todayDocLoading: false }),
  setTodayDocLoading: (todayDocLoading) => set({ todayDocLoading }),
  setTimelineDays: (updater) =>
    set((state) => ({
      timelineDays: typeof updater === 'function' ? updater(state.timelineDays) : updater,
      timelineLoading: false,
    })),
  setTimelineLoading: (timelineLoading) => set({ timelineLoading }),
  setOnThisDayEntries: (onThisDayEntries) => set({ onThisDayEntries, onThisDayLoading: false }),
  setOnThisDayLoading: (onThisDayLoading) => set({ onThisDayLoading }),
  setWeeklies: (weeklies) => set({ weeklies }),
  setMonthlies: (monthlies) => set({ monthlies }),

  updateCachedDay: (updatedDay) =>
    set((state) => {
      const isToday = state.todayDoc?.date === updatedDay.date;
      const updatedTimeline = state.timelineDays.map((d) => (d.date === updatedDay.date ? updatedDay : d));
      const updatedOnThisDay = state.onThisDayEntries.map((d) => (d.date === updatedDay.date ? updatedDay : d));

      return {
        todayDoc: isToday ? updatedDay : state.todayDoc,
        timelineDays: updatedTimeline,
        onThisDayEntries: updatedOnThisDay,
      };
    }),
}));
