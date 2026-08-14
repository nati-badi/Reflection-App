import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayEntry, StreakMeta, WeeklySummary, MonthlySummary } from '../types';

export interface PendingWriteItem {
  id: string; // e.g. "day_userId_2026-08-14" or "streak_userId"
  type: 'day' | 'streak';
  userId: string;
  date?: string;
  data: any;
  timestamp: number;
}

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

  // Durable Pending Writes Outbox
  pendingWrites: PendingWriteItem[];

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

  // Pending Writes Outbox Actions
  addPendingWrite: (item: PendingWriteItem) => void;
  removePendingWrite: (id: string) => void;
  clearPendingWrites: () => void;

  // Single Day Update helper across screens
  updateCachedDay: (updatedDay: DayEntry) => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
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
      pendingWrites: [],

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

      addPendingWrite: (item) =>
        set((state) => {
          const filtered = state.pendingWrites.filter((p) => p.id !== item.id);
          return { pendingWrites: [...filtered, item] };
        }),
      removePendingWrite: (id) =>
        set((state) => ({
          pendingWrites: state.pendingWrites.filter((p) => p.id !== id),
        })),
      clearPendingWrites: () => set({ pendingWrites: [] }),

      updateCachedDay: (updatedDay) =>
        set((state) => {
          const isToday = state.todayDoc?.date === updatedDay.date;
          const existsInTimeline = state.timelineDays.some((d) => d.date === updatedDay.date);
          const updatedTimeline = existsInTimeline
            ? state.timelineDays.map((d) => (d.date === updatedDay.date ? updatedDay : d))
            : [updatedDay, ...state.timelineDays].sort((a, b) => b.date.localeCompare(a.date));

          const updatedOnThisDay = state.onThisDayEntries.map((d) => (d.date === updatedDay.date ? updatedDay : d));

          return {
            todayDoc: isToday ? updatedDay : state.todayDoc,
            timelineDays: updatedTimeline,
            onThisDayEntries: updatedOnThisDay,
          };
        }),
    }),
    {
      name: 'reflection-app-data-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        streak: state.streak,
        todayDoc: state.todayDoc,
        timelineDays: state.timelineDays,
        onThisDayEntries: state.onThisDayEntries,
        weeklies: state.weeklies,
        monthlies: state.monthlies,
        pendingWrites: state.pendingWrites,
      }),
    }
  )
);
