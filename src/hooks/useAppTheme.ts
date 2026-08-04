import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../store/useSettingsStore';
import { lightColors, darkColors, typography, spacing, Theme } from '../constants/theme';
import { useMemo } from 'react';

export function useAppTheme() {
  const colorScheme = useColorScheme(); // 'light' | 'dark' | null
  const themePreference = useSettingsStore((state) => state.themePreference);

  const isDark = useMemo(() => {
    if (themePreference === 'dark') return true;
    if (themePreference === 'light') return false;
    return colorScheme === 'dark';
  }, [themePreference, colorScheme]);

  const theme: Theme = useMemo(
    () => ({
      colors: isDark ? darkColors : lightColors,
      typography,
      spacing,
    }),
    [isDark]
  );

  return {
    theme,
    isDark,
  };
}
