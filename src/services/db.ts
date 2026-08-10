import { collection, doc, getDocs, query, orderBy, limit, setDoc, getDoc, where, startAfter, deleteDoc, writeBatch, onSnapshot, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { DayEntry, StreakMeta, WeeklySummary, MonthlySummary } from '../types';
import { format, startOfWeek, endOfWeek, subWeeks, subDays, parseISO, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, differenceInCalendarDays } from 'date-fns';
import { useDataStore } from '../store/useDataStore';

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

  let createdAt = undefined;
  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      createdAt = now;
    }
  } catch (e) {
    // assume new if read fails
    createdAt = now;
  }

  const monthDay = date.length >= 10 ? date.substring(5, 10) : undefined;

  const dayData: Partial<DayEntry> = {
    userId,
    date,
    ...(monthDay ? { monthDay } : {}),
    contentMarkdown,
    mood,
    updatedAt: now,
  };
  
  // Only include createdAt if it's a completely new document
  if (createdAt !== undefined) {
    dayData.createdAt = createdAt;
  }

  try {
    // merge: true ensures we don't overwrite createdAt if it exists natively
    await setDoc(docRef, dayData, { merge: true });
  } catch (error) {
    console.warn('saveDayDocument Firestore write failed (check security rules), serving in-memory:', error);
  }

  // Update streak ONLY IF user wrote actual non-empty content
  if (contentMarkdown.trim().length > 0) {
    await checkAndUpdateStreak(userId, date);
  }

  const savedEntry = { id: docId, ...dayData } as DayEntry;
  useDataStore.getState().updateCachedDay(savedEntry);
  return savedEntry;
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

export const searchDays = async (
  userId: string, 
  searchQuery: string, 
  startDate?: string, 
  endDate?: string, 
  mood?: string
): Promise<DayEntry[]> => {
  const trimmedQuery = searchQuery.trim();
  // If searching by keyword, date range, or mood, allow empty search query
  if (!trimmedQuery && !startDate && !endDate && !mood) return [];

  // Use simple userId + date ordering query (no composite index required)
  const q = query(
    collection(db, 'days'),
    where('userId', '==', userId),
    orderBy('date', 'desc'),
    limit(200)
  );

  try {
    const querySnapshot = await getDocs(q);
    let results = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as DayEntry));

    // Filter by date range
    if (startDate) {
      results = results.filter(day => day.date >= startDate);
    }
    if (endDate) {
      results = results.filter(day => day.date <= endDate);
    }

    // Filter by selected mood button
    if (mood) {
      results = results.filter(day => day.mood === mood);
    }

    // Filter by text search query (matches content markdown or mood emoji)
    if (trimmedQuery) {
      const term = trimmedQuery.toLowerCase();
      results = results.filter(day => {
        const matchesContent = day.contentMarkdown && day.contentMarkdown.toLowerCase().includes(term);
        const matchesMood = day.mood && day.mood.includes(trimmedQuery);
        return matchesContent || matchesMood;
      });
    }

    return results;
  } catch (error) {
    console.warn('searchDays error:', error);
    return [];
  }
};

export const getOnThisDayEntries = async (userId: string, targetDate: Date = new Date()): Promise<DayEntry[]> => {
  const targetMonthDay = format(targetDate, 'MM-dd');
  const currentYearStr = format(targetDate, 'yyyy');

  // Direct indexed equality query on the derived monthDay field ("MM-DD")
  const indexedQuery = query(
    collection(db, 'days'),
    where('userId', '==', userId),
    where('monthDay', '==', targetMonthDay)
  );

  try {
    const querySnapshot = await getDocs(indexedQuery);
    let results = querySnapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as DayEntry))
      .filter(day => {
        if (!day.contentMarkdown || day.contentMarkdown.trim().length === 0) return false;
        const entryYear = day.date.substring(0, 4);
        return entryYear !== currentYearStr;
      });

    // Fallback if no indexed results found (e.g. for legacy entries created before monthDay field existed)
    if (results.length === 0) {
      const fallbackQuery = query(
        collection(db, 'days'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(200)
      );
      const fallbackSnapshot = await getDocs(fallbackQuery);
      results = fallbackSnapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as DayEntry))
        .filter(day => {
          if (!day.contentMarkdown || day.contentMarkdown.trim().length === 0) return false;
          if (!day.date || day.date.length < 10) return false;
          const entryYear = day.date.substring(0, 4);
          const entryMonthDay = day.date.substring(5, 10);
          return entryMonthDay === targetMonthDay && entryYear !== currentYearStr;
        });
    }

    // Sort descending by date (most recent past year first)
    return results.sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.warn('getOnThisDayEntries error:', error);
    return [];
  }
};

// --- Streak & Meta Services ---

export const evaluateStreakData = (userId: string, data: StreakMeta): StreakMeta => {
  if (!data.lastEntryDate) return data;

  const todayStr = getTodayDateString();
  const yesterdayStr = format(subDays(parseISO(todayStr), 1), 'yyyy-MM-dd');

  // If last entry was today or yesterday, streak is still active
  if (data.lastEntryDate === todayStr || data.lastEntryDate === yesterdayStr) {
    return data;
  }

  // If last entry was prior to yesterday, streak is broken -> reset currentStreak to 0
  const daysDiff = differenceInCalendarDays(parseISO(todayStr), parseISO(data.lastEntryDate));
  if (daysDiff > 1 && data.currentStreak > 0) {
    const updated: StreakMeta = {
      ...data,
      currentStreak: 0,
    };
    // Persist reset to Firestore asynchronously
    const docRef = doc(db, 'meta', userId);
    setDoc(docRef, { currentStreak: 0 }, { merge: true }).catch((e) => {
      console.warn('Persisting evaluated streak reset failed:', e);
    });
    return updated;
  }

  return data;
};

export const getStreak = async (userId: string): Promise<StreakMeta> => {
  try {
    const docRef = doc(db, 'meta', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const rawData = docSnap.data() as StreakMeta;
      const data = evaluateStreakData(userId, rawData);
      useDataStore.getState().setStreak(data);
      return data;
    }
  } catch (e) {
    console.warn('getStreak error:', e);
  }
  const defaultStreak = { currentStreak: 0, longestStreak: 0, lastEntryDate: '' };
  useDataStore.getState().setStreak(defaultStreak);
  return defaultStreak;
};

export const subscribeToStreak = (userId: string) => {
  const docRef = doc(db, 'meta', userId);
  return onSnapshot(
    docRef,
    (docSnap: DocumentSnapshot) => {
      if (docSnap.exists()) {
        const rawData = docSnap.data() as StreakMeta;
        const data = evaluateStreakData(userId, rawData);
        useDataStore.getState().setStreak(data);
      } else {
        const defaultStreak = { currentStreak: 0, longestStreak: 0, lastEntryDate: '' };
        useDataStore.getState().setStreak(defaultStreak);
      }
    },
    (error: any) => {
      console.warn('subscribeToStreak error:', error);
    }
  );
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
  const updatedStreak: StreakMeta = {
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    lastEntryDate: targetDateStr
  };

  try {
    await setDoc(docRef, updatedStreak, { merge: true });
    useDataStore.getState().setStreak(updatedStreak);
  } catch (e) {
    console.warn('Updating streak meta failed:', e);
  }
};

// --- Consolidated Migration Check ---

export const checkAndRunMigrations = async (userId: string): Promise<void> => {
  const t0 = Date.now();
  try {
    const metaRef = doc(db, 'meta', userId);
    const metaSnap = await getDoc(metaRef);
    const data = metaSnap.exists() ? metaSnap.data() : {};

    const needsMigration = !data.migratedToDays;
    const needsTimestampRepair = !data.hasRepairedTimestamps;
    const needsDuplicateCleanup = !data.hasCleanedDuplicateDays;
    const needsMonthDayBackfill = !data.hasBackfilledMonthDay;

    if (!needsMigration && !needsTimestampRepair && !needsDuplicateCleanup && !needsMonthDayBackfill) {
      console.log(`[Migrations] All 4 migration flags already set for user ${userId} (checked in ${Date.now() - t0}ms)`);
      return;
    }

    console.log(`[Migrations] Running pending migration tasks for user ${userId}...`);
    if (needsMigration) await migrateEntriesToDays(userId);
    if (needsTimestampRepair) await repairTimestamps(userId);
    if (needsDuplicateCleanup) await cleanupDuplicateDays(userId);
    if (needsMonthDayBackfill) await backfillMonthDay(userId);
    console.log(`[Migrations] Completed pending migrations in ${Date.now() - t0}ms`);
  } catch (error) {
    console.warn('[Migrations] checkAndRunMigrations error:', error);
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

// --- One-Time Timestamp Repair Script ---
export const repairTimestamps = async (userId: string): Promise<void> => {
  try {
    const metaRef = doc(db, 'meta', userId);
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data().hasRepairedTimestamps === true) {
      return; // Already repaired
    }

    console.log(`[Repair Timestamps] Starting repair for user: ${userId}`);
    
    const daysQuery = query(collection(db, 'days'), where('userId', '==', userId));
    const daysSnap = await getDocs(daysQuery);
    if (daysSnap.empty) {
      console.log('[Repair Timestamps] No days found. Exiting.');
      await setDoc(metaRef, { hasRepairedTimestamps: true }, { merge: true });
      return;
    }
    
    const entriesQuery = query(collection(db, 'entries'), where('userId', '==', userId));
    const entriesSnap = await getDocs(entriesQuery);
    
    if (entriesSnap.empty) {
      console.log('[Repair Timestamps] No original entries found to restore from. Exiting.');
      await setDoc(metaRef, { hasRepairedTimestamps: true }, { merge: true });
      return;
    }
    
    // Group entries by date
    const entriesByDate: Record<string, any[]> = {};
    entriesSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.createdAt) return;
      
      let ms = 0;
      if (typeof data.createdAt === 'number') {
        ms = data.createdAt;
      } else if (data.createdAt.toMillis) {
        ms = data.createdAt.toMillis();
      } else if (data.createdAt.seconds) {
        ms = data.createdAt.seconds * 1000;
      }
      
      if (ms > 0) {
        const dateStr = format(new Date(ms), 'yyyy-MM-dd');
        if (!entriesByDate[dateStr]) entriesByDate[dateStr] = [];
        entriesByDate[dateStr].push({ ...data, _ts: ms });
      }
    });
    
    let repairedCount = 0;
    
    for (const dayDoc of daysSnap.docs) {
      const dayData = dayDoc.data() as DayEntry;
      const dateStr = dayData.date;
      
      const relatedEntries = entriesByDate[dateStr];
      if (relatedEntries && relatedEntries.length > 0) {
        relatedEntries.sort((a, b) => a._ts - b._ts);
        const earliest = relatedEntries[0]._ts;
        const latest = relatedEntries[relatedEntries.length - 1]._ts;
        
        const updateData: any = {};
        let needsUpdate = false;
        
        if (dayData.createdAt !== earliest) {
          updateData.createdAt = earliest;
          needsUpdate = true;
        }
        
        if (dayData.updatedAt !== latest) {
          updateData.updatedAt = latest;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          console.log(`[Repair Timestamps] Fixing ${dateStr}:`);
          console.log(`  createdAt: ${new Date(dayData.createdAt || 0).toLocaleString()} -> ${new Date(earliest).toLocaleString()}`);
          console.log(`  updatedAt: ${new Date(dayData.updatedAt || 0).toLocaleString()} -> ${new Date(latest).toLocaleString()}`);
          
          await setDoc(doc(db, 'days', dayDoc.id), updateData, { merge: true });
          repairedCount++;
        }
      }
    }
    
    await setDoc(metaRef, { hasRepairedTimestamps: true }, { merge: true });
    console.log(`[Repair Timestamps] Complete! Fixed ${repairedCount} day documents for user ${userId}`);
  } catch (error) {
    console.warn('repairTimestamps failed:', error);
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

export const backfillMonthDay = async (userId: string) => {
  try {
    const metaRef = doc(db, 'meta', userId);
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data().hasBackfilledMonthDay) {
      return; // Already backfilled for this user
    }

    console.log('[Backfill MonthDay] Running one-time monthDay backfill for user:', userId);

    const q = query(
      collection(db, 'days'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      await setDoc(metaRef, { hasBackfilledMonthDay: true }, { merge: true });
      return;
    }

    const batch = writeBatch(db);
    let count = 0;

    querySnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data.date && data.date.length >= 10 && !data.monthDay) {
        const monthDay = data.date.substring(5, 10);
        batch.update(docSnap.ref, { monthDay });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`[Backfill MonthDay] Successfully backfilled ${count} day documents with monthDay.`);
    }

    await setDoc(metaRef, { hasBackfilledMonthDay: true }, { merge: true });
  } catch (error) {
    console.warn('[Backfill MonthDay] error:', error);
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
