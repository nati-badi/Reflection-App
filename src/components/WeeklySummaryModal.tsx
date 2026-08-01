import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../hooks/useTranslation';
import type { WeeklySummary } from '../types';
import { theme } from '../constants/theme';
import { Flame, Calendar, BookOpen, Smile, X } from 'lucide-react-native';

interface WeeklySummaryModalProps {
  visible: boolean;
  summary: WeeklySummary | null;
  onClose: () => void;
}

export const WeeklySummaryModal: React.FC<WeeklySummaryModalProps> = ({
  visible,
  summary,
  onClose,
}) => {
  const { t, formatDateDual } = useTranslation();

  if (!summary) return null;

  const startDate = new Date(summary.startDate + 'T00:00:00');
  const endDate = new Date(summary.endDate + 'T23:59:59');

  const startFormatted = formatDateDual(startDate).primaryDate;
  const endFormatted = formatDateDual(endDate).primaryDate;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t('weeklySummary')}</Text>
              <Text style={styles.dateSub}>{startFormatted} – {endFormatted}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            {/* Stat Row 1: Days Written & Streak */}
            <View style={styles.statGrid}>
              <View style={styles.statBox}>
                <Calendar size={20} color={theme.colors.accent} style={styles.boxIcon} />
                <Text style={styles.statNumber}>{summary.daysWrittenCount} / 7</Text>
                <Text style={styles.statLabel}>{t('daysWritten')}</Text>
              </View>

              <View style={styles.statBox}>
                <Flame size={20} color="#FF5500" fill="#FF5500" style={styles.boxIcon} />
                <Text style={styles.statNumber}>{summary.streakAtEndOfWeek} {t('days')}</Text>
                <Text style={styles.statLabel}>{t('endOfWeekStreak')}</Text>
              </View>
            </View>

            {/* Mood Breakdown */}
            {Object.keys(summary.moodBreakdown || {}).length > 0 && (
              <View style={styles.moodSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                  <Smile size={18} color={theme.colors.textSecondary} style={{ marginRight: theme.spacing.xs }} />
                  <Text style={styles.sectionTitle}>{t('moodBreakdown')}</Text>
                </View>
                <View style={styles.moodPillsRow}>
                  {Object.entries(summary.moodBreakdown).map(([emoji, count]) => (
                    <View key={emoji} style={styles.moodPill}>
                      <Text style={styles.moodEmoji}>{emoji}</Text>
                      <Text style={styles.moodCount}>×{count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Action */}
          <TouchableOpacity style={styles.actionBtn} onPress={onClose}>
            <Text style={styles.actionBtnText}>{t('close')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: theme.spacing.md,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.sizes.h3,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  dateSub: {
    fontSize: theme.typography.sizes.small,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    marginBottom: theme.spacing.md,
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  statBox: {
    flex: 0.48,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  boxIcon: {
    marginBottom: theme.spacing.xs,
  },
  statNumber: {
    fontSize: theme.typography.sizes.h3,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontSize: theme.typography.sizes.small,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  streakBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  streakNumber: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  moodSection: {
    marginTop: theme.spacing.xs,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textSecondary,
  },
  moodPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  moodEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  moodCount: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  actionBtn: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
  },
});
