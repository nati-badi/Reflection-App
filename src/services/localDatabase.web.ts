import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayEntry, StreakMeta, WeeklySummary, MonthlySummary } from '../types';

const WEB_DAYS_KEY = 'reflection_web_sqlite_days';
const WEB_STREAK_KEY = 'reflection_web_sqlite_streak';
const WEB_WEEKLIES_KEY = 'reflection_web_sqlite_weeklies';
const WEB_MONTHLIES_KEY = 'reflection_web_sqlite_monthlies';
const WEB_PENDING_KEY = 'reflection_web_sqlite_pending';

const getStorageJSON = async (key: string) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const setStorageJSON = async (key: string, val: any) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(val));
  } catch {}
};

export const getLocalDatabase = async () => {
  return { isWeb: true };
};

export const getPastDaysLocal = async (userId: string, lastDate?: string, limitCount = 20): Promise<DayEntry[]> => {
  const items: any[] = await getStorageJSON(WEB_DAYS_KEY);
  const today = new Date().toISOString().substring(0, 10);
  let filtered = items.filter(
    (d) => d.userId === userId && d.date < today && d.contentMarkdown && d.contentMarkdown.trim().length > 0
  );
  if (lastDate) {
    filtered = filtered.filter((d) => d.date < lastDate);
  }
  filtered.sort((a, b) => b.date.localeCompare(a.date));
  return filtered.slice(0, limitCount);
};

export const getDayByDateLocal = async (userId: string, date: string): Promise<DayEntry | null> => {
  const items: any[] = await getStorageJSON(WEB_DAYS_KEY);
  return items.find((d) => d.userId === userId && d.date === date) || null;
};

export const saveDayLocal = async (day: DayEntry, isPending = true): Promise<void> => {
  const items: any[] = await getStorageJSON(WEB_DAYS_KEY);
  const idx = items.findIndex((d) => d.id === day.id);
  const row = { ...day, monthDay: day.date?.substring(5, 10), syncStatus: isPending ? 'pending' : 'synced' };
  if (idx >= 0) items[idx] = row;
  else items.push(row);
  await setStorageJSON(WEB_DAYS_KEY, items);

  if (isPending) {
    const pending: any[] = await getStorageJSON(WEB_PENDING_KEY);
    const pIdx = pending.findIndex((p) => p.id === `day_${day.id}`);
    const pItem = { id: `day_${day.id}`, type: 'day', userId: day.userId, date: day.date, payload: JSON.stringify(day), timestamp: Date.now() };
    if (pIdx >= 0) pending[pIdx] = pItem;
    else pending.push(pItem);
    await setStorageJSON(WEB_PENDING_KEY, pending);
  }
};

export const upsertRemoteDayLocal = async (day: DayEntry): Promise<void> => {
  await saveDayLocal(day, false);
};

export const getStreakLocal = async (userId: string): Promise<StreakMeta | null> => {
  const items: any[] = await getStorageJSON(WEB_STREAK_KEY);
  return items.find((s) => s.userId === userId) || null;
};

export const saveStreakLocal = async (streak: StreakMeta, userId: string, isPending = true): Promise<void> => {
  const items: any[] = await getStorageJSON(WEB_STREAK_KEY);
  const idx = items.findIndex((s) => s.userId === userId);
  const row = { userId, ...streak, syncStatus: isPending ? 'pending' : 'synced' };
  if (idx >= 0) items[idx] = row;
  else items.push(row);
  await setStorageJSON(WEB_STREAK_KEY, items);

  if (isPending) {
    const pending: any[] = await getStorageJSON(WEB_PENDING_KEY);
    const pIdx = pending.findIndex((p) => p.id === `streak_${userId}`);
    const pItem = { id: `streak_${userId}`, type: 'streak', userId, payload: JSON.stringify(streak), timestamp: Date.now() };
    if (pIdx >= 0) pending[pIdx] = pItem;
    else pending.push(pItem);
    await setStorageJSON(WEB_PENDING_KEY, pending);
  }
};

export const upsertRemoteStreakLocal = async (streak: StreakMeta, userId: string): Promise<void> => {
  await saveStreakLocal(streak, userId, false);
};

export const getPendingWritesLocal = async (userId: string): Promise<any[]> => {
  const items: any[] = await getStorageJSON(WEB_PENDING_KEY);
  return items
    .filter((p) => p.userId === userId)
    .map((p) => ({ ...p, payload: typeof p.payload === 'string' ? JSON.parse(p.payload) : p.payload }));
};

export const markWriteSyncedLocal = async (id: string, type: 'day' | 'streak', targetId: string): Promise<void> => {
  const pending: any[] = await getStorageJSON(WEB_PENDING_KEY);
  const updated = pending.filter((p) => p.id !== id);
  await setStorageJSON(WEB_PENDING_KEY, updated);
};

export const getWeeklySummariesLocal = async (userId: string): Promise<WeeklySummary[]> => {
  const items: any[] = await getStorageJSON(WEB_WEEKLIES_KEY);
  return items.filter((w) => w.userId === userId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 20);
};

export const saveWeeklySummaryLocal = async (summary: WeeklySummary): Promise<void> => {
  const items: any[] = await getStorageJSON(WEB_WEEKLIES_KEY);
  const idx = items.findIndex((w) => w.id === summary.id);
  if (idx >= 0) items[idx] = summary;
  else items.push(summary);
  await setStorageJSON(WEB_WEEKLIES_KEY, items);
};

export const getMonthlySummariesLocal = async (userId: string): Promise<MonthlySummary[]> => {
  const items: any[] = await getStorageJSON(WEB_MONTHLIES_KEY);
  return items.filter((m) => m.userId === userId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 20);
};

export const saveMonthlySummaryLocal = async (summary: MonthlySummary): Promise<void> => {
  const items: any[] = await getStorageJSON(WEB_MONTHLIES_KEY);
  const idx = items.findIndex((m) => m.id === summary.id);
  if (idx >= 0) items[idx] = summary;
  else items.push(summary);
  await setStorageJSON(WEB_MONTHLIES_KEY, items);
};

export const getOnThisDayEntriesLocal = async (userId: string, targetMonthDay: string): Promise<DayEntry[]> => {
  const items: any[] = await getStorageJSON(WEB_DAYS_KEY);
  const currentYear = new Date().getFullYear().toString();
  return items
    .filter((d) => d.userId === userId && d.monthDay === targetMonthDay && d.date?.substring(0, 4) !== currentYear && d.contentMarkdown?.trim())
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const searchDaysLocal = async (userId: string, queryText: string): Promise<DayEntry[]> => {
  const items: any[] = await getStorageJSON(WEB_DAYS_KEY);
  const q = queryText.toLowerCase();
  return items
    .filter((d) => d.userId === userId && d.contentMarkdown && d.contentMarkdown.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
};
