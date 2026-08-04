import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Theme } from '../constants/theme';
import { useAppTheme } from '../hooks/useAppTheme';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval } from 'date-fns';

export interface CalendarGridProps {
  currentMonthDate: Date;
  onMonthChange: (date: Date) => void;
  isLoading?: boolean;
  daysWithEntries?: string[]; // array of 'yyyy-MM-dd'
  
  selectionMode?: 'single' | 'range';
  selectedDate?: Date | null;
  selectedRange?: { start: Date | null; end: Date | null };
  onDateSelect: (date: Date) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentMonthDate,
  onMonthChange,
  isLoading = false,
  daysWithEntries = [],
  selectionMode = 'single',
  selectedDate,
  selectedRange,
  onDateSelect
}) => {
  const { theme, isDark } = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const monthStart = startOfMonth(currentMonthDate);
  const monthEnd = endOfMonth(currentMonthDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = (monthStart.getDay() + 6) % 7; // Monday = 0

  return (
    <View style={styles.calendarContainer}>
      {/* Month Header Navigation */}
      <View style={styles.monthHeader}>
        <TouchableOpacity
          onPress={() => onMonthChange(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1))}
          style={styles.iconButton}
        >
          <ChevronLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {format(currentMonthDate, 'MMMM yyyy')}
        </Text>
        <TouchableOpacity
          onPress={() => onMonthChange(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1))}
          style={styles.iconButton}
        >
          <ChevronRight size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekdayRow}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, index) => (
          <Text key={index} style={styles.weekdayText}>{dayName}</Text>
        ))}
      </View>

      {/* Days Grid */}
      {isLoading ? (
        <View style={styles.calendarLoaderContainer}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <View style={styles.daysGrid}>
          {/* Empty cells before start of month */}
          {Array.from({ length: startDayOfWeek }).map((_, index) => (
            <View key={`empty-${index}`} style={styles.dayCellEmpty} />
          ))}

          {/* Days of month */}
          {daysInMonth.map((dayDate) => {
            const dateStr = format(dayDate, 'yyyy-MM-dd');
            const hasEntry = daysWithEntries.includes(dateStr);
            
            let isSelected = false;
            let isRangeStart = false;
            let isRangeEnd = false;
            let isInRange = false;

            if (selectionMode === 'single') {
              isSelected = selectedDate ? isSameDay(dayDate, selectedDate) : false;
            } else if (selectionMode === 'range' && selectedRange) {
              if (selectedRange.start && isSameDay(dayDate, selectedRange.start)) {
                isSelected = true;
                isRangeStart = true;
              }
              if (selectedRange.end && isSameDay(dayDate, selectedRange.end)) {
                isSelected = true;
                isRangeEnd = true;
              }
              if (selectedRange.start && selectedRange.end) {
                isInRange = isWithinInterval(dayDate, { start: selectedRange.start, end: selectedRange.end });
              }
            }

            const isRangeHighlight = isInRange && !(isRangeStart && isRangeEnd);
            const washColor = isDark ? theme.colors.accent + '66' : theme.colors.accent + '30';

            return (
              <View
                key={dateStr}
                style={styles.dayCellContainer}
              >
                {/* Background Wash */}
                {isRangeHighlight && (
                  <View style={[
                    styles.rangeWash,
                    { backgroundColor: washColor },
                    isRangeStart && { left: '50%', width: '50%' },
                    isRangeEnd && { left: 0, width: '50%' },
                    (!isRangeStart && !isRangeEnd) && { left: 0, width: '100%' }
                  ]} />
                )}
                
                <TouchableOpacity
                  style={[
                    styles.dayCell,
                    hasEntry && styles.dayCellWithEntry,
                    isSelected && styles.dayCellSelected,
                  ]}
                  onPress={() => onDateSelect(dayDate)}
                >
                  <Text style={[
                    styles.dayCellText,
                    hasEntry && styles.dayCellTextWithEntry,
                    isSelected && styles.dayCellTextSelected,
                    isInRange && !isSelected && styles.dayCellTextInRange
                  ]}>
                  {format(dayDate, 'd')}
                </Text>
                {hasEntry && <View style={[styles.entryDot, (isSelected || (isInRange && !isSelected)) && styles.entryDotSelected]} />}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  calendarContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  iconButton: {
    padding: theme.spacing.xs,
  },
  monthTitle: {
    fontSize: theme.typography.sizes.h3,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.sm,
  },
  weekdayText: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textSecondary,
    width: 32,
    textAlign: 'center',
  },
  calendarLoaderContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    height: 48,
  },
  dayCellContainer: {
    width: `${100 / 7}%`,
    height: 48,
    marginBottom: theme.spacing.xs,
    position: 'relative',
  },
  rangeWash: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  dayCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  dayCellWithEntry: {
    backgroundColor: 'transparent',
  },
  dayCellSelected: {
    backgroundColor: theme.colors.accent,
  },

  dayCellText: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textPrimary,
  },
  dayCellTextWithEntry: {
    fontFamily: theme.typography.fontFamily.bold,
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.bold,
  },
  dayCellTextInRange: {
    color: theme.colors.accentForeground || theme.colors.textPrimary,
  },
  entryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.accent,
    position: 'absolute',
    bottom: 6,
  },
  entryDotSelected: {
    backgroundColor: '#FFFFFF',
  }
});
