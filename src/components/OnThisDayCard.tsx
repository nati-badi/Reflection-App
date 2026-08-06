import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, ChevronRight } from 'lucide-react-native';
import { parseISO } from 'date-fns';
import { useTranslation } from '../hooks/useTranslation';
import { useAppTheme } from '../hooks/useAppTheme';
import { FormattedPreviewText } from './FormattedPreviewText';
import type { DayEntry } from '../types';

interface OnThisDayCardProps {
  entries: DayEntry[];
}

export const OnThisDayCard: React.FC<OnThisDayCardProps> = ({ entries }) => {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { t, formatDateDual, language } = useTranslation();

  if (!entries || entries.length === 0) return null;

  const mostRecentEntry = entries[0];
  const entryDate = parseISO(mostRecentEntry.date);
  const currentYear = new Date().getFullYear();
  const entryYear = entryDate.getFullYear();
  const yearsAgo = currentYear - entryYear;

  let timeAgoLabel = '';
  if (yearsAgo <= 1) {
    timeAgoLabel = t('yearAgo');
  } else {
    timeAgoLabel = language === 'am' ? `ከ ${yearsAgo} ${t('yearsAgo')}` : `${yearsAgo} ${t('yearsAgo')}`;
  }

  const { primaryDate } = formatDateDual(entryDate);
  const extraCount = entries.length - 1;

  const handleOpen = () => {
    router.push(`/read/${mostRecentEntry.date}` as any);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={handleOpen}
    >
      <View style={styles.headerRow}>
        <View style={styles.badgeRow}>
          <Sparkles size={16} color={theme.colors.accent} style={{ marginRight: 6 }} />
          <Text style={styles.badgeText}>{t('onThisDay')}</Text>
          <Text style={styles.dotSeparator}>·</Text>
          <Text style={styles.timeAgoText}>{timeAgoLabel}</Text>
        </View>
        <ChevronRight size={18} color={theme.colors.textSecondary} />
      </View>

      <View style={styles.contentRow}>
        <View style={styles.dateAndMoodRow}>
          <Text style={styles.dateText}>{primaryDate}</Text>
          {mostRecentEntry.mood && (
            <Text style={styles.moodEmoji}>{mostRecentEntry.mood}</Text>
          )}
        </View>

        {mostRecentEntry.contentMarkdown ? (
          <FormattedPreviewText
            markdown={mostRecentEntry.contentMarkdown}
            style={styles.previewText}
            maxLength={65}
            numberOfLines={2}
          />
        ) : null}
      </View>

      {extraCount > 0 && (
        <View style={styles.extraBadgeContainer}>
          <Text style={styles.extraBadgeText}>
            +{extraCount} {t('moreYears')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.accent + '35',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.xs,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    badgeText: {
      fontSize: theme.typography.sizes.small,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.colors.accent,
    },
    dotSeparator: {
      fontSize: theme.typography.sizes.small,
      color: theme.colors.textSecondary,
      marginHorizontal: 6,
    },
    timeAgoText: {
      fontSize: theme.typography.sizes.small,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.textSecondary,
    },
    contentRow: {
      marginTop: 2,
    },
    dateAndMoodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    dateText: {
      fontSize: theme.typography.sizes.regular,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.colors.textPrimary,
      marginRight: theme.spacing.xs,
    },
    moodEmoji: {
      fontSize: 18,
    },
    previewText: {
      fontSize: theme.typography.sizes.regular,
      fontFamily: theme.typography.fontFamily.regular,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    extraBadgeContainer: {
      marginTop: theme.spacing.sm,
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.accent + '15',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    extraBadgeText: {
      fontSize: theme.typography.sizes.small - 1,
      fontFamily: theme.typography.fontFamily.medium,
      color: theme.colors.accent,
    },
  });
