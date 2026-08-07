import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { ShieldCheck } from 'lucide-react-native';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { useTranslation } from '../hooks/useTranslation';
import { Theme } from '../constants/theme';

interface BiometricConsentModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export const BiometricConsentModal: React.FC<BiometricConsentModalProps> = ({ visible, onDismiss }) => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const setBiometricEnabled = useSettingsStore((state) => state.setBiometricEnabled);
  const setHasPromptedBiometrics = useSettingsStore((state) => state.setHasPromptedBiometrics);

  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t('biometricConsentTitle'),
          fallbackLabel: 'Use Passcode',
        });
        if (result.success) {
          setBiometricEnabled(true);
        } else {
          // User cancelled authentication prompt — keep disabled
          setBiometricEnabled(false);
        }
      } else {
        // If hardware exists or passcode exists on device, enable app lock setting
        setBiometricEnabled(true);
      }
    } catch (e) {
      console.warn('Biometric authentication prompt error:', e);
      setBiometricEnabled(false);
    } finally {
      setLoading(false);
      setHasPromptedBiometrics(true);
      onDismiss();
    }
  };

  const handleSkip = () => {
    setBiometricEnabled(false);
    setHasPromptedBiometrics(true);
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={48} color={theme.colors.streak} />
          </View>

          <Text style={styles.title}>{t('biometricConsentTitle')}</Text>
          <Text style={styles.desc}>{t('biometricConsentDesc')}</Text>

          {/* Primary Action - Prominent Filled Accent Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleEnable}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('enableAppLock')}</Text>
            )}
          </TouchableOpacity>

          {/* Secondary Action - Less Prominent Text Link Underneath */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSkip}
            disabled={loading}
            activeOpacity={0.6}
          >
            <Text style={styles.secondaryButtonText}>{t('skipForNow')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    content: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: theme.colors.background,
      borderRadius: 20,
      padding: theme.spacing.xl,
      alignItems: 'center',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.lg,
    },
    title: {
      fontSize: theme.typography.sizes.h3,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    desc: {
      fontSize: theme.typography.sizes.regular,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: theme.spacing.xl,
    },
    primaryButton: {
      width: '100%',
      backgroundColor: theme.colors.streak,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
      elevation: 3,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: theme.typography.sizes.regular,
      fontFamily: theme.typography.fontFamily.bold,
    },
    secondaryButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.regular,
      fontFamily: theme.typography.fontFamily.medium,
    },
  });
