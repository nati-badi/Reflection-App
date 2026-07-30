import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSettingsStore } from '../store/useSettingsStore';
import { theme } from '../constants/theme';
import { Lock } from 'lucide-react-native';

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const { isBiometricEnabled } = useSettingsStore();
  const [error, setError] = useState<string | null>(null);

  const authenticate = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // If device doesn't support biometric or none is enrolled, bypass or fallback to pass
        // Since we need to let the user in if they don't have biometric set up:
        onUnlock();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Daily Reflection',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        onUnlock();
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (e) {
      setError('An error occurred during authentication.');
    }
  };

  useEffect(() => {
    if (isBiometricEnabled) {
      authenticate();
    } else {
      onUnlock();
    }
  }, [isBiometricEnabled]);

  if (!isBiometricEnabled) return null;

  return (
    <View style={styles.container}>
      <Lock size={48} color={theme.colors.textPrimary} style={styles.icon} />
      <Text style={styles.title}>App Locked</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={authenticate}>
        <Text style={styles.buttonText}>Unlock</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  icon: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.h2,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xl,
  },
  button: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
  },
  error: {
    color: theme.colors.error,
    marginBottom: theme.spacing.lg,
    fontFamily: theme.typography.fontFamily.regular,
  },
});
