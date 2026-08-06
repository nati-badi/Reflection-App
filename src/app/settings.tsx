import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Platform, Modal, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut, sendEmailVerification } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useSettingsStore } from '../store/useSettingsStore';
import { useDataStore } from '../store/useDataStore';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from '../hooks/useTranslation';
import { getStreak, deleteUserAccount } from '../services/db';
import { exportJournalData, exportJournalDataAsPdf } from '../services/exportService';
import type { StreakMeta } from '../types';
import { Theme } from '../constants/theme';
import { useAppTheme } from '../hooks/useAppTheme';
import { ArrowLeft, LogOut, Flame, Trophy, Check, X, Download, FileText, AlertTriangle } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';

const REMINDER_TIME_OPTIONS = ['18:00', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30', '00:00'];

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme } = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { t, language, setLanguage, formatDateDual } = useTranslation();
  const { streak, streakLoading } = useDataStore();
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [verificationSentMsg, setVerificationSentMsg] = useState('');

  useEffect(() => {
    if (auth.currentUser) {
      auth.currentUser.reload().catch(() => {});
    }
  }, []);

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setResendingEmail(true);
    setVerificationSentMsg('');
    try {
      await sendEmailVerification(auth.currentUser);
      setVerificationSentMsg(t('verificationSentMsg'));
    } catch (e: any) {
      Alert.alert('Error', e.message || t('errSomethingWentWrong'));
    } finally {
      setResendingEmail(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const res = await exportJournalData(user.uid, language as 'en' | 'am');
      if (res.success) {
        Alert.alert(t('exportSuccess'), t('exportSuccessMsg'));
      } else if (res.message) {
        Alert.alert(t('exportError'), res.message);
      }
    } catch (e: any) {
      Alert.alert(t('exportError'), e.message || t('exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!user) return;
    setIsExportingPdf(true);
    try {
      const res = await exportJournalDataAsPdf(user.uid, language as 'en' | 'am');
      if (res.success) {
        Alert.alert(t('exportSuccess'), t('exportPdfSuccessMsg'));
      } else if (res.message) {
        Alert.alert(t('exportError'), res.message);
      }
    } catch (e: any) {
      Alert.alert(t('exportError'), e.message || t('exportError'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const { 
    isBiometricEnabled, 
    setBiometricEnabled, 
    lockTimeoutMinutes, 
    setLockTimeoutMinutes,
    reminderTime,
    setReminderTime,
    themePreference,
    setThemePreference
  } = useSettingsStore();

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

  const handleDeleteAccountInitiate = () => {
    if (!user) return;
    const lastSignIn = user.metadata.lastSignInTime;
    const isRecent = lastSignIn && (Date.now() - new Date(lastSignIn).getTime() < 5 * 60 * 1000);
    
    if (!isRecent) {
      Alert.alert(
        t('reauthRequiredTitle'),
        t('reauthRequiredMsg'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('signOut'), style: 'destructive', onPress: handleSignOut }
        ]
      );
      return;
    }

    Alert.alert(
      t('deleteAccount'),
      t('deleteAccountConfirmMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('continue'), 
          style: 'destructive', 
          onPress: () => {
            setDeleteConfirmText('');
            setDeleteModalVisible(true);
          }
        }
      ]
    );
  };

  const handleDeleteAccountConfirm = async () => {
    if (deleteConfirmText !== 'DELETE' || !user) return;
    
    setIsDeleting(true);
    try {
      await deleteUserAccount(user.uid, auth.currentUser);
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.clear();
      
      setDeleteModalVisible(false);
      Alert.alert(t('accountDeletedTitle'), t('accountDeletedMsg'), [
        { text: t('ok'), onPress: () => router.replace('/(auth)/login') }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || t('deleteAccountError'));
      setIsDeleting(false);
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Email Verification Banner */}
      {auth.currentUser && !auth.currentUser.emailVerified && (
        <View style={styles.verificationCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs }}>
            <AlertTriangle size={18} color={theme.colors.accent} style={{ marginRight: 8 }} />
            <Text style={styles.verificationTitle}>{t('emailNotVerified')}</Text>
          </View>
          <Text style={styles.verificationText}>
            {t('emailNotVerifiedDesc')}
          </Text>
          {verificationSentMsg ? (
            <Text style={styles.verificationSuccessText}>{verificationSentMsg}</Text>
          ) : (
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendVerification}
              disabled={resendingEmail}
            >
              {resendingEmail ? (
                <ActivityIndicator color={theme.colors.accent} size="small" />
              ) : (
                <Text style={styles.resendButtonText}>{t('resendVerification')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Appearance & Language Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('appearance')}</Text>
        <View style={[styles.languageToggleContainer, { marginBottom: theme.spacing.md }]}>
          <TouchableOpacity 
            style={[styles.languagePill, themePreference === 'system' && styles.languagePillActive]}
            onPress={() => setThemePreference('system')}
          >
            <Text style={[styles.languagePillText, themePreference === 'system' && styles.languagePillTextActive]}>
              {t('systemTheme')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.languagePill, themePreference === 'light' && styles.languagePillActive]}
            onPress={() => setThemePreference('light')}
          >
            <Text style={[styles.languagePillText, themePreference === 'light' && styles.languagePillTextActive]}>
              {t('lightTheme')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.languagePill, themePreference === 'dark' && styles.languagePillActive]}
            onPress={() => setThemePreference('dark')}
          >
            <Text style={[styles.languagePillText, themePreference === 'dark' && styles.languagePillTextActive]}>
              {t('darkTheme')}
            </Text>
          </TouchableOpacity>
        </View>

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
            <Flame size={18} color={theme.colors.streak} style={{ marginRight: theme.spacing.sm }} />
            <Text style={styles.settingLabel}>{t('currentStreak')}</Text>
          </View>
          {streakLoading ? (
            <ActivityIndicator size="small" color={theme.colors.streak} />
          ) : (
            <Text style={styles.statsValue}>{streak?.currentStreak || 0} {t('days')}</Text>
          )}
        </View>

        <View style={styles.settingRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Trophy size={18} color="#FFB800" style={{ marginRight: theme.spacing.sm }} />
            <Text style={styles.settingLabel}>{t('bestStreak')}</Text>
          </View>
          {streakLoading ? (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          ) : (
            <Text style={styles.statsValue}>{streak?.longestStreak || 0} {t('days')}</Text>
          )}
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

        <View style={[styles.settingRow, !isBiometricEnabled && styles.settingRowDisabled]}>
          <View>
            <Text style={[styles.settingLabel, !isBiometricEnabled && styles.disabledText]}>{t('lockTimeout')}</Text>
            <Text style={[styles.settingDescription, !isBiometricEnabled && styles.disabledText]}>{t('lockTimeoutDesc')}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.actionButton, !isBiometricEnabled && styles.actionButtonDisabled]}
            onPress={() => setLockTimeoutMinutes(lockTimeoutMinutes === 1 ? 5 : 1)}
            disabled={!isBiometricEnabled}
          >
            <Text style={[styles.actionButtonText, !isBiometricEnabled && styles.disabledText]}>{lockTimeoutMinutes} {t('minutesUnit')}</Text>
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

      {/* Data & Backup */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('dataAndBackup')}</Text>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, marginRight: theme.spacing.sm }}>
            <Text style={styles.settingLabel}>{t('exportData')} (Markdown)</Text>
            <Text style={styles.settingDescription}>{t('exportSub')}</Text>
          </View>
          <TouchableOpacity
            style={[styles.actionButton, isExporting && { opacity: 0.6 }]}
            onPress={handleExport}
            disabled={isExporting || isExportingPdf}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color={theme.colors.textPrimary} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Download size={16} color={theme.colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.actionButtonText}>{t('exportBtn')}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1, marginRight: theme.spacing.sm }}>
            <Text style={styles.settingLabel}>{t('exportPdf')}</Text>
            <Text style={styles.settingDescription}>{t('exportPdfSub')}</Text>
          </View>
          <TouchableOpacity
            style={[styles.actionButton, isExportingPdf && { opacity: 0.6 }]}
            onPress={handleExportPdf}
            disabled={isExporting || isExportingPdf}
          >
            {isExportingPdf ? (
              <ActivityIndicator size="small" color={theme.colors.textPrimary} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <FileText size={16} color={theme.colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.actionButtonText}>{t('exportBtn')}</Text>
              </View>
            )}
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

      {/* Danger Zone */}
      <View style={[styles.section, { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 24, marginTop: 12 }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.error }]}>{t('dangerZone')}</Text>
        <TouchableOpacity style={[styles.signOutButton, { backgroundColor: theme.colors.error + '1A', borderColor: theme.colors.error, borderWidth: 1 }]} onPress={handleDeleteAccountInitiate}>
          <AlertTriangle size={20} color={theme.colors.error} style={{ marginRight: theme.spacing.sm }} />
          <Text style={styles.signOutText}>{t('deleteAccount')}</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

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
                const isSelected = reminderTime === timeStr;
                return (
                  <TouchableOpacity
                    key={timeStr}
                    style={[styles.timeOptionItem, isSelected && styles.timeOptionItemSelected]}
                    onPress={() => handleSelectTime(timeStr)}
                  >
                    <Text style={[styles.timeOptionText, isSelected && styles.timeOptionTextSelected]}>
                      {formatDateDual(d).time}
                    </Text>
                    {isSelected && <Check size={20} color={theme.colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={isDeleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeleting && setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 24 }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.error, marginBottom: 12 }]}>{t('deleteAccount')}</Text>
            <Text style={[styles.settingDescription, { marginBottom: 20 }]}>
              {t('typeDeletePrompt')}
            </Text>
            
            <TextInput
              style={[styles.input, { marginBottom: 24 }]}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="DELETE"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="characters"
              editable={!isDeleting}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: 'transparent' }]} 
                onPress={() => setDeleteModalVisible(false)}
                disabled={isDeleting}
              >
                <Text style={[styles.actionButtonText, { color: theme.colors.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: theme.colors.error }, (deleteConfirmText !== 'DELETE' || isDeleting) && { opacity: 0.5 }]} 
                onPress={handleDeleteAccountConfirm}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[styles.actionButtonText, { color: '#FFF' }]}>{t('deleteBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
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
  deleteModalCancelBtnText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  deleteModalConfirmBtn: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  deleteModalConfirmBtnText: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.bold,
  },
  verificationCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.accent + '40',
    borderWidth: 1,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  verificationTitle: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  verificationText: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  verificationSuccessText: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.medium,
    color: '#10B981',
    marginTop: theme.spacing.xs,
  },
  resendButton: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 6,
    backgroundColor: theme.colors.accent + '15',
  },
  resendButtonText: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.accent,
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
    color: theme.colors.accentForeground,
    fontFamily: theme.typography.fontFamily.bold,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  settingRowDisabled: {
    opacity: 0.5,
  },
  disabledText: {
    color: theme.colors.textSecondary,
  },
  actionButtonDisabled: {
    borderColor: 'transparent',
    backgroundColor: theme.colors.border,
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
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.regular,
  },
});
