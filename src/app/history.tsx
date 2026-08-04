import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from '../hooks/useTranslation';
import {
  getPastDays,
  getMonthDays,
  getWeeklySummariesHistory,
  generateAndSaveWeeklySummary,
  getMonthlySummariesHistory,
  generateAndSaveMonthlySummary
} from '../services/db';
import type { DayEntry, WeeklySummary, MonthlySummary } from '../types';
import { Theme } from '../constants/theme';
import { useAppTheme } from '../hooks/useAppTheme';
import { FormattedPreviewText } from '../components/FormattedPreviewText';
import { ArrowLeft, Calendar as CalendarIcon, List as ListIcon, Trophy, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, subWeeks, subMonths, parseISO } from 'date-fns';
import { WeeklySummaryModal } from '../components/WeeklySummaryModal';
import { CalendarGrid } from '../components/CalendarGrid';
export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme } = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { t, formatDateDual } = useTranslation();

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // List View State
  const [listDays, setListDays] = useState<DayEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const [lastDocId, setLastDocId] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  // Calendar View State
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [monthDays, setMonthDays] = useState<DayEntry[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(new Date());

  // Summary Modal State
  const [selectedSummary, setSelectedSummary] = useState<WeeklySummary | MonthlySummary | null>(null);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [summaryType, setSummaryType] = useState<'weekly' | 'monthly'>('weekly');

  // Load initial past days for list view
  const loadInitialPastDays = useCallback(async () => {
    if (!user) return;
    try {
      setListLoading(true);
      const data = await getPastDays(user.uid, undefined, 20);
      setListDays(data);
      setHasMore(data.length >= 20);
      if (data.length > 0) {
        setLastDocId(data[data.length - 1].id);
      }
    } catch (e) {
      console.error('Failed to load past days:', e);
    } finally {
      setListLoading(false);
    }
  }, [user?.uid]);

  const loadMorePastDays = async () => {
    if (!user || !hasMore || listLoadingMore) return;
    try {
      setListLoadingMore(true);
      const newDays = await getPastDays(user.uid, lastDocId, 20);
      setHasMore(newDays.length >= 20);
      if (newDays.length > 0) {
        setLastDocId(newDays[newDays.length - 1].id);
        setListDays(prev => [...prev, ...newDays]);
      }
    } catch (e) {
      console.error('Failed to load more past days:', e);
    } finally {
      setListLoadingMore(false);
    }
  };

  // Load days for current calendar month
  const loadMonthDaysData = useCallback(async (date: Date) => {
    if (!user) return;
    try {
      setMonthLoading(true);
      const year = date.getFullYear();
      const month = date.getMonth();
      const days = await getMonthDays(user.uid, year, month);
      setMonthDays(days);
    } catch (e) {
      console.error('Failed to load month days:', e);
    } finally {
      setMonthLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadInitialPastDays();
  }, [loadInitialPastDays]);

  useEffect(() => {
    if (viewMode === 'calendar') {
      loadMonthDaysData(currentMonthDate);
    }
  }, [viewMode, currentMonthDate, loadMonthDaysData]);

  // Load weekly or monthly summaries history
  const handleOpenSummaries = async (type: 'weekly' | 'monthly' = 'weekly') => {
    if (!user) return;
    try {
      setSummaryType(type);
      if (type === 'weekly') {
        let summaries = await getWeeklySummariesHistory(user.uid);
        if (summaries.length === 0) {
          const lastWeekSummary = await generateAndSaveWeeklySummary(user.uid, subWeeks(new Date(), 1));
          if (lastWeekSummary) summaries = [lastWeekSummary];
        }
        if (summaries.length > 0) {
          setSelectedSummary(summaries[0]);
          setSummaryModalVisible(true);
        }
      } else {
        let monthSummaries = await getMonthlySummariesHistory(user.uid);
        if (monthSummaries.length === 0) {
          const lastMonthSummary = await generateAndSaveMonthlySummary(user.uid, subMonths(new Date(), 1));
          if (lastMonthSummary) monthSummaries = [lastMonthSummary];
        }
        if (monthSummaries.length > 0) {
          setSelectedSummary(monthSummaries[0]);
          setSummaryModalVisible(true);
        }
      }
    } catch (e) {
      console.error('Failed to load summaries:', e);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const renderDayCard = ({ item }: { item: DayEntry }) => {
    const d = item.date ? parseISO(item.date) : new Date(item.createdAt);
    const { primaryDate } = formatDateDual(d);

    return (
      <TouchableOpacity
        style={styles.entryCard}
        onPress={() => router.push(`/entry/${item.date}`)}
      >
        <View style={styles.entryHeader}>
          <Text style={[styles.dateText, { flex: 1, marginRight: theme.spacing.xs }]} numberOfLines={1}>
            {primaryDate}
          </Text>
          {item.mood && <Text style={styles.moodText}>{item.mood}</Text>}
        </View>
        <FormattedPreviewText markdown={item.contentMarkdown || ''} style={styles.entryPreview} numberOfLines={3} />
      </TouchableOpacity>
    );
  };

  const selectedDayDoc = selectedCalendarDate
    ? monthDays.find(d => d.date === format(selectedCalendarDate, 'yyyy-MM-dd')) || null
    : null;

  const daysWithEntries = monthDays.map(d => d.date);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('history')}</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => handleOpenSummaries('weekly')} style={styles.iconButton}>
            <Trophy size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleOpenSummaries('monthly')} style={styles.iconButton}>
            <CalendarIcon size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.toggleSection}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.togglePill, viewMode === 'list' && styles.togglePillActive]}
            onPress={() => setViewMode('list')}
          >
            <ListIcon size={18} color={viewMode === 'list' ? '#FFFFFF' : theme.colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
              {t('listView')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.togglePill, viewMode === 'calendar' && styles.togglePillActive]}
            onPress={() => setViewMode('calendar')}
          >
            <CalendarIcon size={18} color={viewMode === 'calendar' ? '#FFFFFF' : theme.colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.toggleText, viewMode === 'calendar' && styles.toggleTextActive]}>
              {t('calendarView')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List Mode View */}
      {viewMode === 'list' ? (
        listLoading && listDays.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : (
          <FlatList
            data={listDays}
            keyExtractor={(item) => item.id}
            renderItem={renderDayCard}
            contentContainerStyle={styles.listContent}
            onEndReached={loadMorePastDays}
            onEndReachedThreshold={0.4}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            ListFooterComponent={
              listLoadingMore ? (
                <ActivityIndicator color={theme.colors.accent} style={styles.footerLoader} />
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{t('noReflections')}</Text>
              </View>
            }
          />
        )
      ) : (
        /* Calendar Mode View */
        <ScrollView style={styles.calendarScroll}>
          <CalendarGrid 
            currentMonthDate={currentMonthDate}
            onMonthChange={setCurrentMonthDate}
            isLoading={monthLoading}
            daysWithEntries={daysWithEntries}
            selectionMode="single"
            selectedDate={selectedCalendarDate}
            onDateSelect={setSelectedCalendarDate}
          />

          {/* Selected Date Entries Container */}
          {selectedCalendarDate && (
            <View style={styles.selectedDaySection}>
              <Text style={styles.selectedDateTitle}>
                {formatDateDual(selectedCalendarDate).primaryDate}
              </Text>
              {selectedDayDoc ? (
                renderDayCard({ item: selectedDayDoc })
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{t('noReflections')}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Weekly Summary Modal */}
      <WeeklySummaryModal
        visible={summaryModalVisible}
        summary={selectedSummary}
        onClose={() => setSummaryModalVisible(false)}
      />
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
  headerTitle: {
    fontSize: theme.typography.sizes.h3,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleSection: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  togglePillActive: {
    backgroundColor: theme.colors.accent,
  },
  toggleText: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
  },
  toggleTextActive: {
    color: theme.colors.accentForeground,
    fontFamily: theme.typography.fontFamily.bold,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: theme.spacing.md,
  },
  entryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  dateText: {
    fontSize: theme.typography.sizes.small,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  moodText: {
    fontSize: 16,
  },
  entryPreview: {
    fontSize: theme.typography.sizes.regular,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: 20,
  },
  footerLoader: {
    marginVertical: theme.spacing.md,
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.typography.sizes.regular,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  calendarScroll: {
    flex: 1,
  },
  entryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.accent,
    marginTop: 2,
  },
  selectedDaySection: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  selectedDateTitle: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
});
