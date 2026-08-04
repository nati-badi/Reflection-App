import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search as SearchIcon, Calendar as CalendarIcon, List as ListIcon, X } from 'lucide-react-native';
import { searchDays, getMonthDays } from '../services/db';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from '../hooks/useTranslation';
import { Theme } from '../constants/theme';
import { useAppTheme } from '../hooks/useAppTheme';
import type { DayEntry } from '../types';
import { format, parseISO, isSameDay, isBefore } from 'date-fns';
import { CalendarGrid } from '../components/CalendarGrid';

export default function SearchScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme } = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { t, formatDateDual } = useTranslation();
  
  const [viewMode, setViewMode] = useState<'keyword' | 'calendar'>('keyword');
  
  // Keyword search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Calendar search state
  const [calendarModeState, setCalendarModeState] = useState<'jump' | 'range'>('jump');
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [monthDays, setMonthDays] = useState<DayEntry[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  
  // Range state
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  // Jump state
  const [selectedJumpDate, setSelectedJumpDate] = useState<Date | null>(null);

  useEffect(() => {
    const performSearch = async () => {
      const hasRange = rangeStart && rangeEnd;
      if (!user || (!searchQuery.trim() && !hasRange)) {
        setSearchResults([]);
        return;
      }
      try {
        setLoading(true);
        const startStr = rangeStart ? format(rangeStart, 'yyyy-MM-dd') : undefined;
        const endStr = rangeEnd ? format(rangeEnd, 'yyyy-MM-dd') : undefined;
        const data = await searchDays(user.uid, searchQuery, startStr, endStr);
        setSearchResults(data);
      } catch (error) {
        console.error('Failed to search days:', error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user, rangeStart, rangeEnd]);

  useEffect(() => {
    const loadMonthData = async () => {
      if (!user || viewMode !== 'calendar') return;
      try {
        setMonthLoading(true);
        const year = currentMonthDate.getFullYear();
        const month = currentMonthDate.getMonth();
        const days = await getMonthDays(user.uid, year, month);
        setMonthDays(days);
      } catch (e) {
        console.error('Failed to load month days:', e);
      } finally {
        setMonthLoading(false);
      }
    };
    loadMonthData();
  }, [currentMonthDate, user, viewMode]);

  const handleDateSelect = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    if (calendarModeState === 'jump') {
      setSelectedJumpDate(date);
      if (dateStr === todayStr) {
        router.push(`/entry/${dateStr}`);
      } else {
        const hasEntry = monthDays.some(d => d.date === dateStr);
        if (hasEntry) {
          router.push(`/read/${dateStr}` as any);
        }
      }
    } else {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(date);
        setRangeEnd(null);
      } else {
        if (isBefore(date, rangeStart)) {
          setRangeEnd(rangeStart);
          setRangeStart(date);
        } else {
          setRangeEnd(date);
        }
      }
    }
  };

  const clearRange = () => {
    setRangeStart(null);
    setRangeEnd(null);
    setSearchQuery('');
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
        onPress={() => {
          const dateStr = item.date;
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          if (dateStr === todayStr) {
            router.push(`/entry/${dateStr}`);
          } else {
            router.push(`/read/${dateStr}` as any);
          }
        }}
      >
        <View style={styles.entryHeader}>
          <Text style={[styles.dateText, { flex: 1, marginRight: theme.spacing.xs }]} numberOfLines={1}>
            {primaryDate}
          </Text>
          {item.mood && <Text style={styles.moodText}>{item.mood}</Text>}
        </View>
        <Text style={styles.entryPreview} numberOfLines={2}>
          {item.contentMarkdown ? item.contentMarkdown.replace(/[*_~`#>+-]/g, '').trim() : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  const daysWithEntries = monthDays.map(d => d.date);
  
  const selectedJumpDateStr = selectedJumpDate ? format(selectedJumpDate, 'yyyy-MM-dd') : null;
  const hasJumpEntry = selectedJumpDateStr ? monthDays.some(d => d.date === selectedJumpDateStr) : false;
  const isJumpToday = selectedJumpDateStr === format(new Date(), 'yyyy-MM-dd');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('search') || 'Search'}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* View Mode Toggle */}
      <View style={styles.toggleSection}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.togglePill, viewMode === 'keyword' && styles.togglePillActive]}
            onPress={() => setViewMode('keyword')}
          >
            <ListIcon size={18} color={viewMode === 'keyword' ? '#FFFFFF' : theme.colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.toggleText, viewMode === 'keyword' && styles.toggleTextActive]}>
              Keyword
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.togglePill, viewMode === 'calendar' && styles.togglePillActive]}
            onPress={() => setViewMode('calendar')}
          >
            <CalendarIcon size={18} color={viewMode === 'calendar' ? '#FFFFFF' : theme.colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.toggleText, viewMode === 'calendar' && styles.toggleTextActive]}>
              Calendar
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'keyword' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBarWrapper}>
            <View style={styles.searchContainer}>
              <SearchIcon size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('searchPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>
          </View>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderDayCard}
            contentContainerStyle={styles.listContent}
            removeClippedSubviews={Platform.OS === 'android'}
            ListEmptyComponent={
              searchQuery.trim() ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{t('noSearchResults')}</Text>
                </View>
              ) : null
            }
          />
        </View>
      ) : (
        <ScrollView style={styles.calendarScroll}>
          {/* Calendar Interaction Toggle */}
          <View style={styles.calendarSubToggleContainer}>
            <TouchableOpacity 
              style={[styles.subToggleBtn, calendarModeState === 'jump' && styles.subToggleBtnActive]}
              onPress={() => setCalendarModeState('jump')}
            >
              <Text style={[styles.subToggleText, calendarModeState === 'jump' && styles.subToggleTextActive]}>Jump to Date</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.subToggleBtn, calendarModeState === 'range' && styles.subToggleBtnActive]}
              onPress={() => setCalendarModeState('range')}
            >
              <Text style={[styles.subToggleText, calendarModeState === 'range' && styles.subToggleTextActive]}>Search Range</Text>
            </TouchableOpacity>
          </View>

          <CalendarGrid
            currentMonthDate={currentMonthDate}
            onMonthChange={setCurrentMonthDate}
            isLoading={monthLoading}
            daysWithEntries={daysWithEntries}
            selectionMode={calendarModeState === 'jump' ? 'single' : 'range'}
            selectedDate={selectedJumpDate}
            selectedRange={{ start: rangeStart, end: rangeEnd }}
            onDateSelect={handleDateSelect}
          />

          {calendarModeState === 'jump' ? (
            selectedJumpDate && !hasJumpEntry && !isJumpToday && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No reflection on this day.</Text>
              </View>
            )
          ) : (
            <View style={styles.rangeSearchSection}>
              {rangeStart && rangeEnd && (
                <View style={styles.rangeInfoRow}>
                  <Text style={styles.rangeInfoText}>
                    {format(rangeStart, 'MMM d')} - {format(rangeEnd, 'MMM d')}
                  </Text>
                  <TouchableOpacity onPress={clearRange} style={styles.clearRangeBtn}>
                    <Text style={styles.clearRangeText}>Clear Range</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.searchContainer}>
                <SearchIcon size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={rangeStart && rangeEnd ? "Search in range..." : "Select range first..."}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  editable={!!(rangeStart && rangeEnd)}
                />
              </View>
              {(rangeStart && rangeEnd) && searchResults.map(item => (
                <View key={item.id} style={{ marginTop: theme.spacing.md }}>
                  {renderDayCard({ item })}
                </View>
              ))}
              {(rangeStart && rangeEnd && searchResults.length === 0) && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{searchQuery.trim() ? t('noSearchResults') : 'No reflections in this range.'}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.h3,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleSection: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: 6,
  },
  togglePillActive: {
    backgroundColor: theme.colors.accent,
  },
  toggleText: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textSecondary,
  },
  toggleTextActive: {
    color: theme.colors.accentForeground || '#FFFFFF',
  },
  searchBarWrapper: {
    padding: theme.spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    marginRight: theme.spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.regular,
  },
  calendarScroll: {
    flex: 1,
    padding: theme.spacing.md,
  },
  calendarSubToggleContainer: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  subToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subToggleBtnActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent + '15',
  },
  subToggleText: {
    fontSize: theme.typography.sizes.small,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  subToggleTextActive: {
    color: theme.colors.accent,
    fontFamily: theme.typography.fontFamily.bold,
  },
  rangeSearchSection: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl * 2,
  },
  rangeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  rangeInfoText: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  clearRangeBtn: {
    padding: 4,
  },
  clearRangeText: {
    fontSize: theme.typography.sizes.small,
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamily.medium,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
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
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.typography.sizes.regular,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
});
