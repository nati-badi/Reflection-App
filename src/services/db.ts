import { collection, doc, getDocs, query, orderBy, limit, updateDoc, setDoc, getDoc, where, startAfter } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { DayEntry, StreakMeta, WeeklySummary } from '../types';
import { format, startOfWeek, endOfWeek, subWeeks, subDays, parseISO } from 'date-fns';

// --- Day Document Services ---

export const getOrCreateTodayDocument = async (userId: string): Promise<DayEntry> => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const docId = `${userId}_${today}`;
  const docRef = doc(db, 'days', docId);

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as DayEntry;
    }
  } catch (error) {
    console.warn('getOrCreateTodayDocument error:', error);
  }

  // Return empty day object in memory without writing to Firestore until user types/saves content
  return {
    id: docId,
    userId,
    date: today,
    contentMarkdown: '',
    mood: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

export const getDayDocument = async (userId: string, date: string): Promise<DayEntry | null> => {
  const docId = `${userId}_${date}`;
  const docRef = doc(db, 'days', docId);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as DayEntry;
    }
  } catch (error) {
    console.warn('getDayDocument error:', error);
  }
  return null;
};

export const saveDayDocument = async (
  userId: string,
  date: string,
  contentMarkdown: string,
  mood: string | null
): Promise<DayEntry> => {
  const docId = `${userId}_${date}`;
  const docRef = doc(db, 'days', docId);
  const now = Date.now();

  let createdAt = now;
  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      createdAt = existingSnap.data().createdAt || now;
    }
  } catch (e) {
    // ignore read error before write
  }

  const dayData: DayEntry = {
    id: docId,
    userId,
    date,
    contentMarkdown,
    mood,
    createdAt,
    updatedAt: now,
  };

  try {
    await setDoc(docRef, dayData, { merge: true });
  } catch (error) {
    console.warn('saveDayDocument Firestore write failed (check security rules), serving in-memory:', error);
  }

  // Update streak ONLY IF user wrote actual non-empty content
  if (contentMarkdown.trim().length > 0) {
    await checkAndUpdateStreak(userId, date);
  }

  return dayData;
};

export const getPastDays = async (userId: string, lastDocId?: string, limitCount = 20): Promise<DayEntry[]> => {
  const today = format(new Date(), 'yyyy-MM-dd');

  let q = query(
    collection(db, 'days'),
    where('userId', '==', userId),
    where('date', '<', today),
    orderBy('date', 'desc'),
    limit(limitCount)
  );

  if (lastDocId) {
    try {
      const lastDocRef = await getDoc(doc(db, 'days', lastDocId));
      if (lastDocRef.exists()) {
        q = query(q, startAfter(lastDocRef));
      }
    } catch (e) {
      console.warn('Pagination lastDocRef error:', e);
    }
  }

  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as DayEntry))
      .filter(day => day.contentMarkdown && day.contentMarkdown.trim().length > 0);
  } catch (error) {
    console.warn('getPastDays error:', error);
    return [];
  }
};

export const getMonthDays = async (userId: string, year: number, month: number): Promise<DayEntry[]> => {
  const startDate = format(new Date(year, month, 1), 'yyyy-MM-dd');
  const endDate = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');

  const q = query(
    collection(db, 'days'),
    where('userId', '==', userId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc')
  );

  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as DayEntry))
      .filter(day => day.contentMarkdown && day.contentMarkdown.trim().length > 0);
  } catch (error) {
    console.warn('getMonthDays error:', error);
    return [];
  }
};

export const searchDays = async (userId: string, searchQuery: string): Promise<DayEntry[]> => {
  if (!searchQuery.trim()) return [];

  const q = query(
    collection(db, 'days'),
    where('userId', '==', userId),
    orderBy('date', 'desc'),
    limit(100)
  );

  try {
    const querySnapshot = await getDocs(q);
    const term = searchQuery.toLowerCase();
    return querySnapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as DayEntry))
      .filter(day => day.contentMarkdown && day.contentMarkdown.toLowerCase().includes(term));
  } catch (error) {
    console.warn('searchDays error:', error);
    return [];
  }
};

// --- Streak & Meta Services ---

export const getStreak = async (userId: string): Promise<StreakMeta> => {
  try {
    const docRef = doc(db, 'meta', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as StreakMeta;
    }
  } catch (e) {
    console.warn('getStreak error:', e);
  }
  return { currentStreak: 0, longestStreak: 0, lastEntryDate: '' };
};

const checkAndUpdateStreak = async (userId: string, targetDateStr: string = format(new Date(), 'yyyy-MM-dd')) => {
  const streakData = await getStreak(userId);

  if (streakData.lastEntryDate === targetDateStr) {
    return; // Already recorded for this date
  }

  const docRef = doc(db, 'meta', userId);
  const targetDate = parseISO(targetDateStr);
  const yesterdayStr = format(subDays(targetDate, 1), 'yyyy-MM-dd');

  let newCurrentStreak = 1;
  if (streakData.lastEntryDate === yesterdayStr) {
    newCurrentStreak = streakData.currentStreak + 1;
  }

  const newLongestStreak = Math.max(streakData.longestStreak, newCurrentStreak);

  try {
    await setDoc(docRef, {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastEntryDate: targetDateStr
    }, { merge: true });
  } catch (e) {
    console.warn('Updating streak meta failed:', e);
  }
};

// --- One-Time Migration Script (entries -> days) ---

export const migrateEntriesToDays = async (userId: string): Promise<void> => {
  try {
    const metaRef = doc(db, 'meta', userId);
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data().migratedToDays === true) {
      return; // Already migrated
    }

    const q = query(
      collection(db, 'entries'),
      where('userId', '==', userId),
      orderBy('createdAt', 'asc')
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      await setDoc(metaRef, { migratedToDays: true }, { merge: true });
      return;
    }

    const groupedByDate: Record<string, { contents: string[]; moods: string[]; createdAt: number }> = {};

    querySnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const dateStr = format(new Date(data.createdAt), 'yyyy-MM-dd');
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = { contents: [], moods: [], createdAt: data.createdAt };
      }
      if (data.contentMarkdown && data.contentMarkdown.trim()) {
        groupedByDate[dateStr].contents.push(data.contentMarkdown.trim());
      }
      if (data.mood) {
        groupedByDate[dateStr].moods.push(data.mood);
      }
    });

    for (const [dateStr, group] of Object.entries(groupedByDate)) {
      if (group.contents.length > 0) {
        const docId = `${userId}_${dateStr}`;
        const dayRef = doc(db, 'days', docId);
        const combinedContent = group.contents.join('\n\n');
        const lastMood = group.moods.length > 0 ? group.moods[group.moods.length - 1] : null;

        await setDoc(dayRef, {
          id: docId,
          userId,
          date: dateStr,
          contentMarkdown: combinedContent,
          mood: lastMood,
          createdAt: group.createdAt,
          updatedAt: Date.now(),
        }, { merge: true });
      }
    }

    // Mark migration as complete without deleting old entries collection
    await setDoc(metaRef, { migratedToDays: true }, { merge: true });
    console.log(`Successfully migrated ${Object.keys(groupedByDate).length} days for user ${userId}`);
  } catch (error) {
    console.warn('Migration entriesToDays failed:', error);
  }
};

// --- Weekly Summary Services ---

export const getWeeklySummary = async (userId: string, weekId: string): Promise<WeeklySummary | null> => {
  try {
    const docRef = doc(db, 'weeklySummaries', `${userId}_${weekId}`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as WeeklySummary;
    }
  } catch (error) {
    console.warn('getWeeklySummary failed:', error);
  }
  return null;
};

export const generateAndSaveWeeklySummary = async (
  userId: string,
  targetDate: Date = subWeeks(new Date(), 1)
): Promise<WeeklySummary | null> => {
  const monStart = startOfWeek(targetDate, { weekStartsOn: 1 });
  const sunEnd = endOfWeek(targetDate, { weekStartsOn: 1 });
  const monStartStr = format(monStart, 'yyyy-MM-dd');
  const sunEndStr = format(sunEnd, 'yyyy-MM-dd');

  const weekId = format(monStart, "yyyy-'W'II");
  const docId = `${userId}_${weekId}`;

  // 1. Idempotency Check: if summary already exists, return it directly!
  const existing = await getWeeklySummary(userId, weekId);
  if (existing) {
    return existing;
  }

  // 2. Fetch all days written during this Mon-Sun week
  const q = query(
    collection(db, 'days'),
    where('userId', '==', userId),
    where('date', '>=', monStartStr),
    where('date', '<=', sunEndStr),
    orderBy('date', 'desc')
  );

  let weekDays: DayEntry[] = [];
  try {
    const querySnapshot = await getDocs(q);
    weekDays = querySnapshot.docs
      .map(docSnap => docSnap.data() as DayEntry)
      .filter(d => d.contentMarkdown && d.contentMarkdown.trim().length > 0);
  } catch (e) {
    console.warn('Failed to query week days:', e);
    return null;
  }

  // 3. If zero days written in that week, suppress summary creation
  if (weekDays.length === 0) {
    return null;
  }

  // 4. Compute metrics
  const moodBreakdown: Record<string, number> = {};
  const writtenDatesSet = new Set<string>();

  weekDays.forEach(day => {
    writtenDatesSet.add(day.date);
    if (day.mood) {
      moodBreakdown[day.mood] = (moodBreakdown[day.mood] || 0) + 1;
    }
  });

  // 5. Calculate historical streak as it stood at EOD Sunday
  const sundayStr = format(sunEnd, 'yyyy-MM-dd');
  let streakAtEndOfWeek = 0;

  if (writtenDatesSet.has(sundayStr)) {
    let checkDate = new Date(sunEnd);
    while (true) {
      const dStr = format(checkDate, 'yyyy-MM-dd');
      if (writtenDatesSet.has(dStr)) {
        streakAtEndOfWeek++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        const daySnap = await getDayDocument(userId, dStr);
        if (daySnap && daySnap.contentMarkdown && daySnap.contentMarkdown.trim().length > 0) {
          streakAtEndOfWeek++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break; // Gap found
        }
      }
    }
  }

  const summaryData: WeeklySummary = {
    userId,
    weekId,
    startDate: monStartStr,
    endDate: sunEndStr,
    daysWrittenCount: writtenDatesSet.size,
    moodBreakdown,
    streakAtEndOfWeek,
    createdAt: Date.now(),
  };

  try {
    const docRef = doc(db, 'weeklySummaries', docId);
    await setDoc(docRef, summaryData);
  } catch (error) {
    console.warn('Saving weeklySummary to Firestore failed, serving in-memory:', error);
  }

  return { id: docId, ...summaryData };
};

export const getWeeklySummariesHistory = async (userId: string): Promise<WeeklySummary[]> => {
  try {
    const q = query(
      collection(db, 'weeklySummaries'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as WeeklySummary));
  } catch (error) {
    console.warn('getWeeklySummariesHistory failed:', error);
    return [];
  }
};
