import React, { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { LockScreen } from '../components/LockScreen';
import { 
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAppTheme } from '../hooks/useAppTheme';
import { StatusBar } from 'expo-status-bar';
import { View, Platform } from 'react-native';

export default function RootLayout() {
  const { user, setUser, setLoading, loading } = useAuthStore();
  const { lockTimeoutMinutes, isBiometricEnabled } = useSettingsStore();
  const [isLocked, setIsLocked] = useState(isBiometricEnabled);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });
  
  const { theme, isDark } = useAppTheme();
  
  const router = useRouter();
  const segments = useSegments();
  
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to the login page.
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect away from the login page.
      router.replace('/');
    }
  }, [user, segments, loading]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (backgroundTime.current && isBiometricEnabled) {
          const timeElapsed = (Date.now() - backgroundTime.current) / 1000 / 60;
          if (timeElapsed >= lockTimeoutMinutes) {
            setIsLocked(true);
          }
        }
      } else if (nextAppState.match(/inactive|background/)) {
        backgroundTime.current = Date.now();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [lockTimeoutMinutes, isBiometricEnabled]);

  const handleUnlock = () => {
    setIsLocked(false);
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {Platform.OS === 'web' && (
        <style>{`
          input:focus, textarea:focus, [contenteditable]:focus {
            outline: none !important;
            box-shadow: none !important;
            border-color: ${theme.colors.accent}80 !important;
          }
          *:focus {
            outline: none !important;
          }
        `}</style>
      )}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
      {isLocked && <LockScreen onUnlock={handleUnlock} />}
    </View>
  );
}
