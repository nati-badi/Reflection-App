import type { DayEntry, WeeklySummary, MonthlySummary } from '../types';

export type TimelineItemType = 'day' | 'today' | 'weekly_summary' | 'monthly_summary';

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  sortDate: string;
  secondarySortWeight: number;
  data: DayEntry | WeeklySummary | MonthlySummary;
}

export const mergeTimelineItems = (
  days: DayEntry[],
  today: DayEntry | null,
  weeklies: WeeklySummary[],
  monthlies: MonthlySummary[]
): TimelineItem[] => {
  const items: TimelineItem[] = [];

  // 1. Add Today
  if (today) {
    items.push({
      id: `today_${today.id}`,
      type: 'today',
      sortDate: today.date + 'T23:59:59.999', // Ensure Today is always at the absolute top for its date
      secondarySortWeight: 10,
      data: today,
    });
  }

  // 2. Add Past Days
  days.forEach(day => {
    // If it's already represented as 'today', skip it to avoid duplication
    if (today && day.id === today.id) return;

    items.push({
      id: `day_${day.id}`,
      type: 'day',
      sortDate: day.date,
      secondarySortWeight: 0,
      data: day,
    });
  });

  // 3. Add Weekly Summaries
  weeklies.forEach(week => {
    items.push({
      id: `week_${week.id}`,
      type: 'weekly_summary',
      sortDate: week.endDate + 'T23:59:59', // Appears right after the end date
      secondarySortWeight: 1, // Tie-breaker: lower than monthly
      data: week,
    });
  });

  // 4. Add Monthly Summaries
  monthlies.forEach(month => {
    items.push({
      id: `month_${month.id}`,
      type: 'monthly_summary',
      sortDate: month.endDate + 'T23:59:59', // Appears right after the end date
      secondarySortWeight: 2, // Tie-breaker: higher than weekly
      data: month,
    });
  });

  // 5. Merge Sort Descending
  items.sort((a, b) => {
    if (a.sortDate === b.sortDate) {
      return b.secondarySortWeight - a.secondarySortWeight; // Higher weight comes first
    }
    return b.sortDate.localeCompare(a.sortDate);
  });

  return items;
};
