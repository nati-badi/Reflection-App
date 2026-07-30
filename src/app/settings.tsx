import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useSettingsStore } from '../store/useSettingsStore';
import { theme } from '../constants/theme';
import { ArrowLeft, LogOut } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';

export default function SettingsScreen() {
  const router = useRouter();
  const { 
    isBiometricEnabled, 
    setBiometricEnabled, 
    lockTimeoutMinutes, 
    setLockTimeoutMinutes,
    reminderTime,
    setReminderTime
  } = useSettingsStore();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (e) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const scheduleReminder = async (timeString: string) => {
    if (Platform.OS === 'web') {
      Alert.alert('Web Mode', 'Push notifications are only available on the iOS and Android apps.');
      setReminderTime(timeString);
      return;
    }

    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please enable notifications in your phone settings.');
        return;
      }
      
      await Notifications.cancelAllScheduledNotificationsAsync();
    
    const [hours, minutes] = timeString.split(':').map(Number);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time to reflect",
        body: "Don't lose your streak — reflect on today",
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true,
      } as any,
    });
    setReminderTime(timeString);
    Alert.alert('Reminder set', `Daily reminder set for ${timeString}`);
    } catch (error) {
      console.log("Failed to schedule notification", error);
    }
  };

  // Mock a simple time picker for MVP (can be extended with a real DateTimePicker later)
  const toggleReminderTime = () => {
    const nextTime = reminderTime === '21:00' ? '22:00' : '21:00';
    scheduleReminder(nextTime);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>App Lock</Text>
            <Text style={styles.settingDescription}>Require biometric/passcode to open</Text>
          </View>
          <Switch 
            value={isBiometricEnabled}
            onValueChange={setBiometricEnabled}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
          />
        </View>

        <View style={[styles.settingRow, !isBiometricEnabled && { opacity: 0.5 }]}>
          <View>
            <Text style={styles.settingLabel}>Lock Timeout</Text>
            <Text style={styles.settingDescription}>Idle time before lock</Text>
          </View>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setLockTimeoutMinutes(lockTimeoutMinutes === 1 ? 5 : 1)}
            disabled={!isBiometricEnabled}
          >
            <Text style={styles.actionButtonText}>{lockTimeoutMinutes} min</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Daily Reminder</Text>
            <Text style={styles.settingDescription}>Time to get a push notification</Text>
          </View>
          <TouchableOpacity style={styles.actionButton} onPress={toggleReminderTime}>
            <Text style={styles.actionButtonText}>{reminderTime}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color={theme.colors.error} style={{ marginRight: theme.spacing.sm }} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconButton: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.h3,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  section: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  settingLabel: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  settingDescription: {
    fontSize: theme.typography.sizes.small,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonText: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  signOutText: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
  },
});
