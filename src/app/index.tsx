import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Flame,
  Search,
  Settings,
  Trophy,
  CalendarDays,
  Plus
} from 'lucide-react-native';
import { Theme } from '../constants/theme';
import { useAppTheme } from '../hooks/useAppTheme';
import { useTranslation } from '../hooks/useTranslation';
import { FormattedPreviewText } from '../components/FormattedPreviewText';
import { OnThisDayCard } from '../components/OnThisDayCard';
import {
  getPastDays,
  getStreak,
  subscribeToStreak,
  getWeeklySummariesHistory,
  getMonthlySummariesHistory,
  migrateEntriesToDays,
  cleanupDuplicateDays,
  backfillMonthDay,
  getTodayDateString,
  getOnThisDayEntries
} from '../services/db';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useDataStore } from '../store/useDataStore';
import type { DayEntry, StreakMeta, WeeklySummary, MonthlySummary } from '../types';
import { format, parseISO, differenceInDays } from 'date-fns';
import { WeeklySummaryModal } from '../components/WeeklySummaryModal';
import { mergeTimelineItems, TimelineItem } from '../utils/timelineUtils';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function TimelineFeedScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t, formatDateDual } = useTranslation();

  const {
    streak,
    streakLoading,
    todayDoc,
    timelineDays: listDays,
    onThisDayEntries,
    weeklies,
    monthlies,
    setStreak,
    setTodayDoc,
    setTimelineDays: setListDays,
    setOnThisDayEntries,
    setWeeklies,
    setMonthlies,
  } = useDataStore();

  const [loading, setLoading] = useState(listDays.length === 0);
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDocId, setLastDocId] = useState<string | undefined>();

  // Summary Modal View
  const [selectedSummary, setSelectedSummary] = useState<WeeklySummary | MonthlySummary | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.18,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [pulseAnim]);

  // Real-time listener for today's document & streak meta
  useEffect(() => {
    if (!user) return;
    const today = getTodayDateString();
    const docId = `${user.uid}_${today}`;
    
    const q = query(
      collection(db, 'days'),
      where('userId', '==', user.uid),
      where('date', '==', today)
    );

    const unsubscribeToday = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        setTodayDoc({ id: docSnap.id, ...docSnap.data() } as DayEntry);
      } else {
        setTodayDoc({
          id: docId,
          userId: user.uid,
          date: today,
          contentMarkdown: '',
          mood: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }, (error) => {
      console.warn('onSnapshot today query error:', error);
      setTodayDoc({
        id: docId,
        userId: user.uid,
        date: today,
        contentMarkdown: '',
        mood: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const unsubscribeStreak = subscribeToStreak(user.uid);

    return () => {
      unsubscribeToday();
      unsubscribeStreak();
    };
  }, [user?.uid]);

  const initialLoad = useCallback(async () => {
    if (!user) return;
    try {
      if (listDays.length === 0) {
        setLoading(true);
      }
      await migrateEntriesToDays(user.uid);
      await cleanupDuplicateDays(user.uid);
      await backfillMonthDay(user.uid);

      const [streakData, initialPastDays, initialWeeklies, initialMonthlies, onThisDayData] = await Promise.all([
        getStreak(user.uid),
        getPastDays(user.uid, undefined, 20),
        getWeeklySummariesHistory(user.uid),
        getMonthlySummariesHistory(user.uid),
        getOnThisDayEntries(user.uid)
      ]);

      setStreak(streakData);
      setListDays(initialPastDays);
      setWeeklies(initialWeeklies);
      setMonthlies(initialMonthlies);
      setOnThisDayEntries(onThisDayData);

      setHasMore(initialPastDays.length >= 20);
      if (initialPastDays.length > 0) {
        setLastDocId(initialPastDays[initialPastDays.length - 1].id);
      }
    } catch (error) {
      console.error('Failed to load timeline data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, listDays.length]);

  const loadMorePastDays = async () => {
    if (!user || !hasMore || listLoadingMore) return;
    try {
      setListLoadingMore(true);
      const newDays = await getPastDays(user.uid, lastDocId, 20);
      setHasMore(newDays.length >= 20);
      if (newDays.length > 0) {
        setLastDocId(newDays[newDays.length - 1].id);
        setListDays(prev => {
          // avoid duplicates just in case
          const existingIds = new Set(prev.map(d => d.id));
          const filteredNew = newDays.filter(d => !existingIds.has(d.id));
          return [...prev, ...filteredNew];
        });
      }
    } catch (e) {
      console.error('Failed to load more past days:', e);
    } finally {
      setListLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      initialLoad();
    }, [initialLoad])
  );

  const timelineItems = useMemo(() => {
    return mergeTimelineItems(listDays, todayDoc, weeklies, monthlies);
  }, [listDays, todayDoc, weeklies, monthlies]);

  const handleOpenEntry = (id: string) => {
    if (id === 'today') {
      router.push(`/entry/${id}` as any);
    } else {
      router.push(`/read/${id}` as any);
    }
  };

  const renderTimelineItem = ({ item, index }: { item: TimelineItem; index: number }) => {
    // Find next DayEntry to determine if dashed line is needed
    let isDashed = false;
    let nextDayStr: string | null = null;
    
    // Scan ahead for the next actual day to see if there's a gap
    for (let i = index + 1; i < timelineItems.length; i++) {
      if (timelineItems[i].type === 'day' || timelineItems[i].type === 'today') {
        nextDayStr = (timelineItems[i].data as DayEntry).date;
        break;
      }
    }

    if (item.type === 'day' || item.type === 'today') {
      const currentDayStr = (item.data as DayEntry).date;
      if (nextDayStr) {
        const diff = differenceInDays(parseISO(currentDayStr), parseISO(nextDayStr));
        if (diff > 1) {
          isDashed = true;
        }
      }
    }

    const isLastItem = index === timelineItems.length - 1;

    // Checkpoint Card
    if (item.type === 'weekly_summary' || item.type === 'monthly_summary') {
      const isWeekly = item.type === 'weekly_summary';
      const summary = item.data as WeeklySummary | MonthlySummary;
      const Icon = isWeekly ? Trophy : CalendarDays;
      const accentColor = isWeekly ? theme.colors.weeklyCheckpoint : theme.colors.monthlyCheckpoint; // Distinguish visually
      
      return (
        <View style={styles.nodeRow}>
          <View style={styles.leftCol}>
            <View style={[styles.checkpointNode, { backgroundColor: accentColor }]}>
              <Icon size={16} color="#FFF" />
            </View>
            {!isLastItem && <View style={[styles.verticalLine, isDashed && styles.dashedLine]} />}
          </View>
          <TouchableOpacity 
            style={styles.checkpointCard}
            onPress={() => setSelectedSummary(summary)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.checkpointTitle}>
                {isWeekly ? t('weeklySummary') : t('monthlySummary')}
              </Text>
              <Text style={styles.checkpointSub}>
                {summary.daysWrittenCount} {t('daysWritten')} · {t('bestStreak')}: {
                  isWeekly 
                    ? (summary as WeeklySummary).streakAtEndOfWeek
                    : (summary as MonthlySummary).longestStreakInMonth
                }
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    // Day Node (Today or Past Day)
    const day = item.data as DayEntry;
    const isToday = item.type === 'today';
    const hasContent = day.contentMarkdown && day.contentMarkdown.trim().length > 0;
    
    const d = parseISO(day.date);
    const { primaryDate } = formatDateDual(d);

    return (
      <TouchableOpacity 
        style={styles.nodeRow}
        activeOpacity={0.7}
        onPress={() => handleOpenEntry(isToday ? 'today' : day.date)}
      >
        <View style={styles.leftCol}>
          {isToday ? (
            <View style={[styles.todayNode, !day.mood && styles.pastNodeEmpty]}>
              {day.mood ? (
                <Text style={styles.nodeEmoji}>{day.mood}</Text>
              ) : (
                <Plus size={22} color={theme.colors.accent} />
              )}
            </View>
          ) : (
            <View style={[styles.pastNode, !day.mood && styles.pastNodeEmpty]}>
              {day.mood && <Text style={styles.pastNodeEmoji}>{day.mood}</Text>}
            </View>
          )}
          {!isLastItem && (
            <View style={[
              styles.verticalLine, 
              isDashed && styles.dashedLine,
              isToday && { marginTop: 4 } // Adjust for larger ring
            ]} />
          )}
        </View>
        <View style={styles.rightCol}>
          <Text style={[styles.dayDateText, isToday && styles.todayDateText]}>
            {isToday ? t('today') : primaryDate}
          </Text>
          {hasContent ? (
            <FormattedPreviewText markdown={day.contentMarkdown} style={styles.dayPreviewText} />
          ) : (
            isToday && <Text style={styles.emptyPromptText}>{t('noReflectionsSub')}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const { secondaryDate, time } = formatDateDual(new Date());

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.streakBadge}>
          <Animated.View style={[styles.flameWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <Flame size={20} color={theme.colors.streak} fill={theme.colors.streak} />
          </Animated.View>
          {streakLoading ? (
            <ActivityIndicator size="small" color={theme.colors.streak} style={{ marginHorizontal: 2 }} />
          ) : (
            <Text style={styles.streakNumber}>{streak?.currentStreak || 0}</Text>
          )}
        </View>

        <View style={styles.headerDateContainer}>
          <Text style={styles.gregorianDate}>{secondaryDate}</Text>
          <Text style={styles.ethiopianDate}>{time}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/search')} style={styles.iconButton}>
            <Search size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.iconButton}>
            <Settings size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Timeline Feed */}
      {loading && timelineItems.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={timelineItems}
          keyExtractor={(item) => item.id}
          renderItem={renderTimelineItem}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMorePastDays}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            onThisDayEntries.length > 0 ? (
              <OnThisDayCard entries={onThisDayEntries} />
            ) : null
          }
          ListFooterComponent={
            listLoadingMore ? <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 20 }} /> : null
          }
        />
      )}

      {/* Reusable Summary Modal */}
      <WeeklySummaryModal
        visible={!!selectedSummary}
        summary={selectedSummary}
        onClose={() => setSelectedSummary(null)}
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
    backgroundColor: theme.colors.surface,
    zIndex: 10,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  flameWrapper: {
    marginRight: theme.spacing.xs,
  },
  streakNumber: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  headerDateContainer: {
    alignItems: 'center',
  },
  gregorianDate: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  ethiopianDate: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  nodeRow: {
    flexDirection: 'row',
  },
  leftCol: {
    width: 50,
    alignItems: 'center',
  },
  rightCol: {
    flex: 1,
    paddingBottom: 32, // space between rows
    paddingTop: 4, // align with node
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginTop: 4,
    marginBottom: -8, // slight overlap to next row
  },
  dashedLine: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
    width: 1,
  },
  // Today Node
  todayNode: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeEmoji: {
    fontSize: 22,
  },
  // Past Day Node
  pastNode: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  pastNodeEmpty: {
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  pastNodeEmoji: {
    fontSize: 18,
  },
  // Checkpoint Node
  checkpointNode: {
    width: 28,
    height: 28,
    borderRadius: 8, // Square-ish icon instead of circle
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  // Row Text
  dayDateText: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  todayDateText: {
    fontSize: 19,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.accent,
  },
  dayPreviewText: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  emptyPromptText: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.regular,
    fontStyle: 'italic',
    color: theme.colors.textSecondary,
  },
  // Checkpoint Card Text
  checkpointCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 32,
    marginTop: 2,
  },
  checkpointTitle: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  checkpointSub: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
  },
});
