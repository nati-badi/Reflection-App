import * as SQLite from 'expo-sqlite';
import type { DayEntry, StreakMeta, WeeklySummary, MonthlySummary } from '../types';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getLocalDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('reflection_app.db');
  await initTables(dbInstance);
  return dbInstance;
};

const initTables = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS days (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      monthDay TEXT,
      contentMarkdown TEXT,
      mood TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      syncStatus TEXT DEFAULT 'synced'
    );

    CREATE INDEX IF NOT EXISTS idx_days_user_date ON days(userId, date DESC);
    CREATE INDEX IF NOT EXISTS idx_days_user_monthday ON days(userId, monthDay);

    CREATE TABLE IF NOT EXISTS streak_meta (
      userId TEXT PRIMARY KEY,
      currentStreak INTEGER,
      longestStreak INTEGER,
      lastEntryDate TEXT,
      syncStatus TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS weekly_summaries (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      weekId TEXT NOT NULL,
      startDate TEXT,
      endDate TEXT,
      daysWrittenCount INTEGER,
      moodBreakdown TEXT,
      streakAtEndOfWeek INTEGER,
      createdAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS monthly_summaries (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      month TEXT NOT NULL,
      startDate TEXT,
      endDate TEXT,
      daysWrittenCount INTEGER,
      moodBreakdown TEXT,
      longestStreakInMonth INTEGER,
      createdAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS pending_writes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      userId TEXT NOT NULL,
      date TEXT,
      payload TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);
};

export const getPastDaysLocal = async (userId: string, lastDate?: string, limitCount = 20): Promise<DayEntry[]> => {
  const db = await getLocalDatabase();
  const today = new Date().toISOString().substring(0, 10);

  let sql = `SELECT * FROM days WHERE userId = ? AND date < ? AND contentMarkdown IS NOT NULL AND length(trim(contentMarkdown)) > 0`;
  const params: any[] = [userId, today];

  if (lastDate) {
    sql += ` AND date < ?`;
    params.push(lastDate);
  }

  sql += ` ORDER BY date DESC LIMIT ?`;
  params.push(limitCount);

  const rows = await db.getAllAsync(sql, params);
  return rows.map((r: any) => ({
    id: r.id,
    userId: r.userId,
    date: r.date,
    monthDay: r.monthDay,
    contentMarkdown: r.contentMarkdown,
    mood: r.mood,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
};

export const getDayByDateLocal = async (userId: string, date: string): Promise<DayEntry | null> => {
  const db = await getLocalDatabase();
  const row = await db.getFirstAsync(`SELECT * FROM days WHERE userId = ? AND date = ?`, [userId, date]);
  if (!row) return null;
  const r: any = row;
  return {
    id: r.id,
    userId: r.userId,
    date: r.date,
    monthDay: r.monthDay,
    contentMarkdown: r.contentMarkdown,
    mood: r.mood,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
};

export const saveDayLocal = async (day: DayEntry, isPending = true): Promise<void> => {
  const db = await getLocalDatabase();
  const syncStatus = isPending ? 'pending' : 'synced';
  const monthDay = day.date && day.date.length >= 10 ? day.date.substring(5, 10) : '';

  await db.runAsync(
    `INSERT OR REPLACE INTO days (id, userId, date, monthDay, contentMarkdown, mood, createdAt, updatedAt, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [day.id, day.userId, day.date, monthDay, day.contentMarkdown || '', day.mood || null, day.createdAt || Date.now(), day.updatedAt || Date.now(), syncStatus]
  );

  if (isPending) {
    const outboxId = `day_${day.id}`;
    await db.runAsync(
      `INSERT OR REPLACE INTO pending_writes (id, type, userId, date, payload, timestamp)
       VALUES (?, 'day', ?, ?, ?, ?)`,
      [outboxId, day.userId, day.date || '', JSON.stringify(day), Date.now()]
    );
  }
};

export const upsertRemoteDayLocal = async (day: DayEntry): Promise<void> => {
  const db = await getLocalDatabase();
  const existing = await db.getFirstAsync(`SELECT syncStatus FROM days WHERE id = ?`, [day.id]);
  if (existing && (existing as any).syncStatus === 'pending') {
    console.log(`[SQLite Conflict Guard] Skipping remote overwrite for pending local day ${day.id}`);
    return;
  }

  const monthDay = day.date && day.date.length >= 10 ? day.date.substring(5, 10) : '';
  await db.runAsync(
    `INSERT OR REPLACE INTO days (id, userId, date, monthDay, contentMarkdown, mood, createdAt, updatedAt, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
    [day.id, day.userId, day.date, monthDay, day.contentMarkdown || '', day.mood || null, day.createdAt || Date.now(), day.updatedAt || Date.now(), 'synced']
  );
};

export const getStreakLocal = async (userId: string): Promise<StreakMeta | null> => {
  const db = await getLocalDatabase();
  const row = await db.getFirstAsync(`SELECT * FROM streak_meta WHERE userId = ?`, [userId]);
  if (row) {
    const r: any = row;
    return {
      currentStreak: r.currentStreak,
      longestStreak: r.longestStreak,
      lastEntryDate: r.lastEntryDate,
    };
  }
  return null;
};

export const saveStreakLocal = async (streak: StreakMeta, userId: string, isPending = true): Promise<void> => {
  const db = await getLocalDatabase();
  const syncStatus = isPending ? 'pending' : 'synced';
  await db.runAsync(
    `INSERT OR REPLACE INTO streak_meta (userId, currentStreak, longestStreak, lastEntryDate, syncStatus)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, streak.currentStreak, streak.longestStreak, streak.lastEntryDate || '', syncStatus]
  );

  if (isPending) {
    const outboxId = `streak_${userId}`;
    await db.runAsync(
      `INSERT OR REPLACE INTO pending_writes (id, type, userId, payload, timestamp)
       VALUES (?, 'streak', ?, ?, ?)`,
      [outboxId, userId, JSON.stringify(streak), Date.now()]
    );
  }
};

export const upsertRemoteStreakLocal = async (streak: StreakMeta, userId: string): Promise<void> => {
  const db = await getLocalDatabase();
  const existing = await db.getFirstAsync(`SELECT syncStatus FROM streak_meta WHERE userId = ?`, [userId]);
  if (existing && (existing as any).syncStatus === 'pending') {
    console.log(`[SQLite Conflict Guard] Skipping remote overwrite for pending local streak ${userId}`);
    return;
  }

  await db.runAsync(
    `INSERT OR REPLACE INTO streak_meta (userId, currentStreak, longestStreak, lastEntryDate, syncStatus)
     VALUES (?, ?, ?, ?, 'synced')`,
    [userId, streak.currentStreak, streak.longestStreak, streak.lastEntryDate || '', 'synced']
  );
};

export const getPendingWritesLocal = async (userId: string): Promise<any[]> => {
  const db = await getLocalDatabase();
  const rows = await db.getAllAsync(`SELECT * FROM pending_writes WHERE userId = ? ORDER BY timestamp ASC`, [userId]);
  return rows.map((r: any) => ({
    id: r.id,
    type: r.type,
    userId: r.userId,
    date: r.date,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    timestamp: r.timestamp,
  }));
};

export const markWriteSyncedLocal = async (id: string, type: 'day' | 'streak', targetId: string): Promise<void> => {
  const db = await getLocalDatabase();
  await db.runAsync(`DELETE FROM pending_writes WHERE id = ?`, [id]);
  if (type === 'day') {
    await db.runAsync(`UPDATE days SET syncStatus = 'synced' WHERE id = ?`, [targetId]);
  } else if (type === 'streak') {
    await db.runAsync(`UPDATE streak_meta SET syncStatus = 'synced' WHERE userId = ?`, [targetId]);
  }
};

export const getWeeklySummariesLocal = async (userId: string): Promise<WeeklySummary[]> => {
  const db = await getLocalDatabase();
  const rows = await db.getAllAsync(`SELECT * FROM weekly_summaries WHERE userId = ? ORDER BY createdAt DESC LIMIT 20`, [userId]);
  return rows.map((r: any) => ({
    id: r.id,
    userId: r.userId,
    weekId: r.weekId,
    startDate: r.startDate,
    endDate: r.endDate,
    daysWrittenCount: r.daysWrittenCount,
    moodBreakdown: r.moodBreakdown ? JSON.parse(r.moodBreakdown) : {},
    streakAtEndOfWeek: r.streakAtEndOfWeek,
    createdAt: r.createdAt,
  }));
};

export const saveWeeklySummaryLocal = async (summary: WeeklySummary): Promise<void> => {
  const db = await getLocalDatabase();
  const docId = summary.id || `${summary.userId}_${summary.weekId}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO weekly_summaries (id, userId, weekId, startDate, endDate, daysWrittenCount, moodBreakdown, streakAtEndOfWeek, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [docId, summary.userId, summary.weekId || '', summary.startDate || '', summary.endDate || '', summary.daysWrittenCount || 0, JSON.stringify(summary.moodBreakdown || {}), summary.streakAtEndOfWeek ?? 0, summary.createdAt || Date.now()]
  );
};

export const getMonthlySummariesLocal = async (userId: string): Promise<MonthlySummary[]> => {
  const db = await getLocalDatabase();
  const rows = await db.getAllAsync(`SELECT * FROM monthly_summaries WHERE userId = ? ORDER BY createdAt DESC LIMIT 20`, [userId]);
  return rows.map((r: any) => ({
    id: r.id,
    userId: r.userId,
    month: r.month,
    startDate: r.startDate,
    endDate: r.endDate,
    daysWrittenCount: r.daysWrittenCount,
    moodBreakdown: r.moodBreakdown ? JSON.parse(r.moodBreakdown) : {},
    longestStreakInMonth: r.longestStreakInMonth,
    createdAt: r.createdAt,
  }));
};

export const saveMonthlySummaryLocal = async (summary: MonthlySummary): Promise<void> => {
  const db = await getLocalDatabase();
  const docId = summary.id || `${summary.userId}_${summary.month}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO monthly_summaries (id, userId, month, startDate, endDate, daysWrittenCount, moodBreakdown, longestStreakInMonth, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [docId, summary.userId, summary.month || '', summary.startDate || '', summary.endDate || '', summary.daysWrittenCount || 0, JSON.stringify(summary.moodBreakdown || {}), summary.longestStreakInMonth ?? 0, summary.createdAt || Date.now()]
  );
};

export const getOnThisDayEntriesLocal = async (userId: string, targetMonthDay: string): Promise<DayEntry[]> => {
  const db = await getLocalDatabase();
  const currentYear = new Date().getFullYear().toString();
  const rows = await db.getAllAsync(
    `SELECT * FROM days WHERE userId = ? AND monthDay = ? AND contentMarkdown IS NOT NULL AND length(trim(contentMarkdown)) > 0 ORDER BY date DESC`,
    [userId, targetMonthDay]
  );

  return rows
    .map((r: any) => ({
      id: r.id,
      userId: r.userId,
      date: r.date,
      monthDay: r.monthDay,
      contentMarkdown: r.contentMarkdown,
      mood: r.mood,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .filter((d: DayEntry) => d.date && d.date.substring(0, 4) !== currentYear);
};

export const searchDaysLocal = async (userId: string, queryText: string): Promise<DayEntry[]> => {
  const db = await getLocalDatabase();
  const pattern = `%${queryText.toLowerCase()}%`;
  const rows = await db.getAllAsync(
    `SELECT * FROM days WHERE userId = ? AND lower(contentMarkdown) LIKE ? ORDER BY date DESC`,
    [userId, pattern]
  );

  return rows.map((r: any) => ({
    id: r.id,
    userId: r.userId,
    date: r.date,
    monthDay: r.monthDay,
    contentMarkdown: r.contentMarkdown,
    mood: r.mood,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
};
