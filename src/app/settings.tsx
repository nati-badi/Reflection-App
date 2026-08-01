import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Platform, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from '../hooks/useTranslation';
import { getStreak } from '../services/db';
import type { StreakMeta } from '../types';
import { theme } from '../constants/theme';
import { ArrowLeft, LogOut, Flame, Trophy, Check, X } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';

const REMINDER_TIME_OPTIONS = ['18:00', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30', '00:00'];

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, language, setLanguage, formatDateDual } = useTranslation();
  const [streak, setStreak] = useState<StreakMeta | null>(null);
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);

  const { 
    isBiometricEnabled, 
    setBiometricEnabled, 
    lockTimeoutMinutes, 
    setLockTimeoutMinutes,
    reminderTime,
    setReminderTime
  } = useSettingsStore();

  useEffect(() => {
    if (user) {
      getStreak(user.uid).then(setStreak);
    }
  }, [user]);

  const getFormattedReminderTime = () => {
    const [hours, minutes] = reminderTime.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return formatDateDual(d).time;
  };

  const handleSelectTime = (timeStr: string) => {
    scheduleReminder(timeStr);
    setTimePickerVisible(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (e) {
      Alert.alert('Error', t('signOutError'));
    }
  };

  const scheduleReminder = async (timeString: string) => {
    if (Platform.OS === 'web') {
      Alert.alert('Web Mode', t('webModeNotice'));
      setReminderTime(timeString);
      return;
    }

    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('permissionRequired'), t('enableNotificationsMsg'));
        return;
      }
      
      await Notifications.cancelAllScheduledNotificationsAsync();
    
      const [hours, minutes] = timeString.split(':').map(Number);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('reminderTitle'),
          body: t('reminderBody'),
        },
        trigger: {
          hour: hours,
          minute: minutes,
          repeats: true,
        } as any,
      });
      setReminderTime(timeString);
      Alert.alert(t('notifications'), `${t('reminderSetMsg')} ${timeString}`);
    } catch (error) {
      console.log("Failed to schedule notification", error);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Language Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('language')}</Text>
        <View style={styles.languageToggleContainer}>
          <TouchableOpacity 
            style={[styles.languagePill, language === 'en' && styles.languagePillActive]}
            onPress={() => setLanguage('en')}
          >
            <Text style={[styles.languagePillText, language === 'en' && styles.languagePillTextActive]}>
              {t('languageEn')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.languagePill, language === 'am' && styles.languagePillActive]}
            onPress={() => setLanguage('am')}
          >
            <Text style={[styles.languagePillText, language === 'am' && styles.languagePillTextActive]}>
              {t('languageAm')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Reflection Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('reflectionStats')}</Text>
        
        <View style={styles.settingRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Flame size={18} color="#FF5500" style={{ marginRight: theme.spacing.sm }} />
            <Text style={styles.settingLabel}>{t('currentStreak')}</Text>
          </View>
          <Text style={styles.statsValue}>{streak?.currentStreak || 0} {t('days')}</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Trophy size={18} color="#FFB800" style={{ marginRight: theme.spacing.sm }} />
            <Text style={styles.settingLabel}>{t('bestStreak')}</Text>
          </View>
          <Text style={styles.statsValue}>{streak?.longestStreak || 0} {t('days')}</Text>
        </View>
      </View>

      {/* Security */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('security')}</Text>
        
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>{t('appLock')}</Text>
            <Text style={styles.settingDescription}>{t('appLockDesc')}</Text>
          </View>
          <Switch 
            value={isBiometricEnabled}
            onValueChange={setBiometricEnabled}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
          />
        </View>

        <View style={[styles.settingRow, !isBiometricEnabled && { opacity: 0.5 }]}>
          <View>
            <Text style={styles.settingLabel}>{t('lockTimeout')}</Text>
            <Text style={styles.settingDescription}>{t('lockTimeoutDesc')}</Text>
          </View>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setLockTimeoutMinutes(lockTimeoutMinutes === 1 ? 5 : 1)}
            disabled={!isBiometricEnabled}
          >
            <Text style={styles.actionButtonText}>{lockTimeoutMinutes} {t('minutesUnit')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('notifications')}</Text>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>{t('dailyReminder')}</Text>
            <Text style={styles.settingDescription}>{t('dailyReminderDesc')}</Text>
          </View>
          <TouchableOpacity style={styles.actionButton} onPress={() => setTimePickerVisible(true)}>
            <Text style={styles.actionButtonText}>{getFormattedReminderTime()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color={theme.colors.error} style={{ marginRight: theme.spacing.sm }} />
          <Text style={styles.signOutText}>{t('signOut')}</Text>
        </TouchableOpacity>
      </View>

      {/* Time Picker Modal */}
      <Modal
        visible={isTimePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setTimePickerVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('selectReminderTime')}</Text>
              <TouchableOpacity onPress={() => setTimePickerVisible(false)}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.timeOptionList}>
              {REMINDER_TIME_OPTIONS.map((timeStr) => {
                const [h, m] = timeStr.split(':').map(Number);
                const d = new Date();
                d.setHours(h, m, 0, 0);
                const formatted = formatDateDual(d).time;
                const isSelected = reminderTime === timeStr;

                return (
                  <TouchableOpacity
                    key={timeStr}
                    style={[styles.timeOptionItem, isSelected && styles.timeOptionItemSelected]}
                    onPress={() => handleSelectTime(timeStr)}
                  >
                    <Text style={[styles.timeOptionText, isSelected && styles.timeOptionTextSelected]}>
                      {formatted}
                    </Text>
                    {isSelected && <Check size={18} color={theme.colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
  languageToggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  languagePill: {
    flex: 1,
    height: 38,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  languagePillActive: {
    backgroundColor: theme.colors.accent,
  },
  languagePillText: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
  },
  languagePillTextActive: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.bold,
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
  statsValue: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: theme.spacing.md,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  timeOptionList: {
    maxHeight: 300,
  },
  timeOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 8,
    marginVertical: 2,
  },
  timeOptionItemSelected: {
    backgroundColor: theme.colors.surface,
  },
  timeOptionText: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
  },
  timeOptionTextSelected: {
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.accent,
  },
});
