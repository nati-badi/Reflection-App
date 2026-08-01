import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDefaultLanguage } from '../utils/localization';

export type Language = 'en' | 'am';

interface SettingsState {
  isBiometricEnabled: boolean;
  lockTimeoutMinutes: number;
  reminderTime: string; // HH:mm format
  language: Language;
  lastSeenWeeklySummaryWeek: string | null;
  setBiometricEnabled: (enabled: boolean) => void;
  setLockTimeoutMinutes: (minutes: number) => void;
  setReminderTime: (time: string) => void;
  setLanguage: (language: Language) => void;
  setLastSeenWeeklySummaryWeek: (weekId: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isBiometricEnabled: true, // Default to true as per spec
      lockTimeoutMinutes: 1, // Default to 1 minute as per spec
      reminderTime: '21:00', // Default to 9:00 PM
      language: getDefaultLanguage(), // Auto-detect device language on first launch
      lastSeenWeeklySummaryWeek: null,
      setBiometricEnabled: (enabled) => set({ isBiometricEnabled: enabled }),
      setLockTimeoutMinutes: (minutes) => set({ lockTimeoutMinutes: minutes }),
      setReminderTime: (time) => set({ reminderTime: time }),
      setLanguage: (language) => set({ language }),
      setLastSeenWeeklySummaryWeek: (weekId) => set({ lastSeenWeeklySummaryWeek: weekId }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
