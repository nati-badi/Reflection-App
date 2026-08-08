export const lightColors = {
  background: '#FFFFFF',
  surface: '#F9F9F9',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  border: '#B0B0B0',
  accent: '#000000', // Monochrome accent
  accentForeground: '#FFFFFF',
  error: '#D32F2F',
  weeklyCheckpoint: '#FFB800',
  monthlyCheckpoint: '#4E9FFF',
  streak: '#FF5500',
};

export const darkColors = {
  background: '#121212',
  surface: '#1E1E1E',
  textPrimary: '#F5F5F5',
  textSecondary: '#A0A0A0',
  border: '#333333',
  accent: '#D1D5DB', // Bright distinct silver/light-gray
  accentForeground: '#121212', // Dark text on top of light-gray accent
  error: '#FF6B6B',
  weeklyCheckpoint: '#FFC833',
  monthlyCheckpoint: '#73B0FF',
  streak: '#FF6A00',
};

export type ThemeColors = typeof lightColors;

export const typography = {
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    bold: 'Inter_700Bold',
  },
  sizes: {
    small: 12,
    regular: 16,
    large: 20,
    h1: 32,
    h2: 24,
    h3: 18,
  }
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export type Theme = {
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
};

// Fallback static export for non-React contexts or missed migrations
export const theme: Theme = {
  colors: lightColors,
  typography,
  spacing,
};
