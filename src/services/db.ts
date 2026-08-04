import { collection, doc, getDocs, query, orderBy, limit, setDoc, getDoc, where, startAfter, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { DayEntry, StreakMeta, WeeklySummary, MonthlySummary } from '../types';
import { format, startOfWeek, endOfWeek, subWeeks, subDays, parseISO, startOfMonth, endOfMonth, subMonths, eachDayOfInterval } from 'date-fns';

// --- Utility Functions ---
export const getTodayDateString = (): string => format(new Date(), 'yyyy-MM-dd');
export const getDocIdForDate = (userId: string, dateStr: string): string => `${userId}_${dateStr}`;
export const getTodayDocId = (userId: string): string => getDocIdForDate(userId, getTodayDateString());

// --- Day Document Services ---

export const getOrCreateTodayDocument = async (userId: string): Promise<DayEntry> => {
  const today = getTodayDateString();
  const docId = getTodayDocId(userId);
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
  const docId = getDocIdForDate(userId, date);
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
  const docId = getDocIdForDate(userId, date);
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

export const searchDays = async (userId: string, searchQuery: string, startDate?: string, endDate?: string): Promise<DayEntry[]> => {
  // If only searching by date range, allow empty query
  if (!searchQuery.trim() && !startDate && !endDate) return [];

  const conditions: any[] = [where('userId', '==', userId)];
  
  if (startDate) conditions.push(where('date', '>=', startDate));
  if (endDate) conditions.push(where('date', '<=', endDate));

  const q = query(
    collection(db, 'days'),
    ...conditions,
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

// --- Monthly Summary Services ---

export const getMonthlySummary = async (userId: string, month: string): Promise<MonthlySummary | null> => {
  try {
    const docRef = doc(db, 'monthlySummaries', `${userId}_${month}`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as MonthlySummary;
    }
  } catch (error) {
    console.warn('getMonthlySummary failed:', error);
  }
  return null;
};

export const generateAndSaveMonthlySummary = async (
  userId: string,
  targetDate: Date = subMonths(new Date(), 1)
): Promise<MonthlySummary | null> => {
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);
  const startDateStr = format(monthStart, 'yyyy-MM-dd');
  const endDateStr = format(monthEnd, 'yyyy-MM-dd');
  const month = format(monthStart, 'yyyy-MM');

  const docId = `${userId}_${month}`;

  // 1. Idempotency Check: check if summary already exists
  const existing = await getMonthlySummary(userId, month);
  if (existing) {
    return existing;
  }

  // 2. Query days in this month
  const q = query(
    collection(db, 'days'),
    where('userId', '==', userId),
    where('date', '>=', startDateStr),
    where('date', '<=', endDateStr),
    orderBy('date', 'desc')
  );

  let monthDays: DayEntry[] = [];
  try {
    const querySnapshot = await getDocs(q);
    monthDays = querySnapshot.docs
      .map(docSnap => docSnap.data() as DayEntry)
      .filter(d => d.contentMarkdown && d.contentMarkdown.trim().length > 0);
  } catch (e) {
    console.warn('Failed to query month days:', e);
    return null;
  }

  // 3. Suppress creation if 0 days written in that month
  if (monthDays.length === 0) {
    return null;
  }

  // 4. Compute metrics
  const moodBreakdown: Record<string, number> = {};
  const writtenDatesSet = new Set<string>();

  monthDays.forEach(day => {
    writtenDatesSet.add(day.date);
    if (day.mood) {
      moodBreakdown[day.mood] = (moodBreakdown[day.mood] || 0) + 1;
    }
  });

  // 5. Compute longest streak within this specific month
  const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  let maxStreakInMonth = 0;
  let currentRun = 0;

  allDaysInMonth.forEach(d => {
    const dateStr = format(d, 'yyyy-MM-dd');
    if (writtenDatesSet.has(dateStr)) {
      currentRun++;
      if (currentRun > maxStreakInMonth) {
        maxStreakInMonth = currentRun;
      }
    } else {
      currentRun = 0;
    }
  });

  const summaryData: MonthlySummary = {
    userId,
    month,
    startDate: startDateStr,
    endDate: endDateStr,
    daysWrittenCount: writtenDatesSet.size,
    moodBreakdown,
    longestStreakInMonth: maxStreakInMonth,
    createdAt: Date.now(),
  };

  try {
    const docRef = doc(db, 'monthlySummaries', docId);
    await setDoc(docRef, summaryData);
  } catch (error) {
    console.warn('Saving monthlySummary to Firestore failed, serving in-memory:', error);
  }

  return { id: docId, ...summaryData };
};

export const getMonthlySummariesHistory = async (userId: string): Promise<MonthlySummary[]> => {
  try {
    const q = query(
      collection(db, 'monthlySummaries'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as MonthlySummary));
  } catch (error) {
    console.warn('getMonthlySummariesHistory failed:', error);
    return [];
  }
};

// --- One-Time Duplicate Cleanup Script ---

export const cleanupDuplicateDays = async (userId: string): Promise<void> => {
  try {
    const metaRef = doc(db, 'meta', userId);
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data().hasCleanedDuplicateDays === true) {
      return; // Already cleaned up
    }

    const q = query(collection(db, 'days'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      await setDoc(metaRef, { hasCleanedDuplicateDays: true }, { merge: true });
      return;
    }

    const byDate: Record<string, DayEntry[]> = {};
    querySnapshot.forEach(docSnap => {
      const data = { id: docSnap.id, ...docSnap.data() } as DayEntry;
      if (!data.date) return;
      if (!byDate[data.date]) byDate[data.date] = [];
      byDate[data.date].push(data);
    });

    let foundDuplicates = false;

    for (const date in byDate) {
      const docs = byDate[date];
      if (docs.length > 1) {
        foundDuplicates = true;
        // Sort by createdAt ASC so oldest is first
        docs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        
        const canonicalId = getDocIdForDate(userId, date);
        let mergedContent = '';
        let canonicalMood = null;
        let oldestCreatedAt = docs[0].createdAt || Date.now();
        let newestUpdatedAt = docs[0].updatedAt || Date.now();

        docs.forEach(d => {
          if (d.contentMarkdown && d.contentMarkdown.trim()) {
            mergedContent += (mergedContent ? '\n\n' : '') + d.contentMarkdown.trim();
          }
          if (d.mood) canonicalMood = d.mood;
          if (d.updatedAt && d.updatedAt > newestUpdatedAt) newestUpdatedAt = d.updatedAt;
        });

        console.log(`[Duplicate Cleanup] Merging ${docs.length} documents for date: ${date}`);
        console.log(`[Duplicate Cleanup] Canonical ID: ${canonicalId}`);
        console.log(`[Duplicate Cleanup] Final Merged Content:`, mergedContent);

        // Write canonical doc
        const canonicalRef = doc(db, 'days', canonicalId);
        await setDoc(canonicalRef, {
          userId,
          date,
          contentMarkdown: mergedContent,
          mood: canonicalMood,
          createdAt: oldestCreatedAt,
          updatedAt: newestUpdatedAt
        }, { merge: true });

        // Delete non-canonical docs
        for (const d of docs) {
          if (d.id !== canonicalId) {
            console.log(`[Duplicate Cleanup] Deleting duplicate docId: ${d.id}`);
            await deleteDoc(doc(db, 'days', d.id));
          }
        }
      }
    }

    if (!foundDuplicates) {
      console.log('[Duplicate Cleanup] No duplicates found.');
    }

    await setDoc(metaRef, { hasCleanedDuplicateDays: true }, { merge: true });
    
  } catch (error) {
    console.warn('[Duplicate Cleanup] error:', error);
  }
};

// --- Account Deletion ---
export const deleteUserAccount = async (userId: string, authUser: any) => {
  // 1. Delete Days
  let daysQuery = query(collection(db, 'days'), where('userId', '==', userId));
  let daysSnap = await getDocs(daysQuery);
  while (!daysSnap.empty) {
    const batch = writeBatch(db);
    daysSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    daysSnap = await getDocs(daysQuery); // Check if more remain
  }

  // 2. Delete Weekly Summaries
  let weeklyQuery = query(collection(db, 'weeklySummaries'), where('userId', '==', userId));
  let weeklySnap = await getDocs(weeklyQuery);
  while (!weeklySnap.empty) {
    const batch = writeBatch(db);
    weeklySnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    weeklySnap = await getDocs(weeklyQuery);
  }

  // 3. Delete Monthly Summaries
  let monthlyQuery = query(collection(db, 'monthlySummaries'), where('userId', '==', userId));
  let monthlySnap = await getDocs(monthlyQuery);
  while (!monthlySnap.empty) {
    const batch = writeBatch(db);
    monthlySnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    monthlySnap = await getDocs(monthlyQuery);
  }

  // 4. Delete Meta
  let metaQuery = query(collection(db, 'meta'), where('userId', '==', userId));
  let metaSnap = await getDocs(metaQuery);
  while (!metaSnap.empty) {
    const batch = writeBatch(db);
    metaSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    metaSnap = await getDocs(metaQuery);
  }

  // 5. Delete Firebase Auth User
  if (authUser) {
    const { deleteUser } = await import('firebase/auth');
    await deleteUser(authUser);
  }
};
