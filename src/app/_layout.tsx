import React, { useEffect, useState, useRef } from 'react';
import { AppState } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { LockScreen } from '../components/LockScreen';
import { useFonts } from 'expo-font';
import { useAppTheme } from '../hooks/useAppTheme';
import { StatusBar } from 'expo-status-bar';
import { View, Platform } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { user, setUser, setLoading, loading } = useAuthStore();
  const { lockTimeoutMinutes, isBiometricEnabled } = useSettingsStore();
  const [isLocked, setIsLocked] = useState(isBiometricEnabled);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  const [fontsLoaded] = useFonts({
    Inter_400Regular: require('../../assets/fonts/Inter_400Regular.ttf'),
    Inter_500Medium: require('../../assets/fonts/Inter_500Medium.ttf'),
    Inter_700Bold: require('../../assets/fonts/Inter_700Bold.ttf'),
  });
  
  const { theme, isDark } = useAppTheme();
  
  const router = useRouter();
  const segments = useSegments();
  
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('@has_seen_onboarding').then((val) => {
      setHasSeenOnboarding(val === 'true');
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (fontsLoaded && !loading && hasSeenOnboarding !== null) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, loading, hasSeenOnboarding]);

  useEffect(() => {
    if (loading || hasSeenOnboarding === null) return;

    const inAuthGroup = (segments[0] as any) === '(auth)';
    const inOnboarding = (segments[0] as any) === 'onboarding';

    if (!user) {
      if (!hasSeenOnboarding && !inOnboarding) {
        router.replace('/onboarding' as any);
      } else if (hasSeenOnboarding && !inAuthGroup && !inOnboarding) {
        router.replace('/(auth)/login');
      }
    } else if (user && (inAuthGroup || inOnboarding)) {
      router.replace('/');
    }
  }, [user, segments, loading, hasSeenOnboarding]);

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
