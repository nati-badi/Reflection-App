import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  isBiometricEnabled: boolean;
  lockTimeoutMinutes: number;
  reminderTime: string; // HH:mm format
  setBiometricEnabled: (enabled: boolean) => void;
  setLockTimeoutMinutes: (minutes: number) => void;
  setReminderTime: (time: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isBiometricEnabled: true, // Default to true as per spec
      lockTimeoutMinutes: 1, // Default to 1 minute as per spec
      reminderTime: '21:00', // Default to 9:00 PM
      setBiometricEnabled: (enabled) => set({ isBiometricEnabled: enabled }),
      setLockTimeoutMinutes: (minutes) => set({ lockTimeoutMinutes: minutes }),
      setReminderTime: (time) => set({ reminderTime: time }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
