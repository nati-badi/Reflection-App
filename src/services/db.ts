import { collection, doc, addDoc, getDocs, query, orderBy, limit, updateDoc, setDoc, getDoc, where, startAfter } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Entry, StreakMeta } from '../types';
import { format } from 'date-fns';

export const addEntry = async (userId: string, contentMarkdown: string, mood: string | null) => {
  const now = Date.now();
  const entryData: Entry = {
    userId,
    createdAt: now,
    contentMarkdown,
    mood,
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, 'entries'), entryData);
  await checkAndUpdateStreak(userId);
  return { ...entryData, id: docRef.id };
};

export const getEntries = async (userId: string, lastDocId?: string, limitCount = 20) => {
  let q = query(
    collection(db, 'entries'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  if (lastDocId) {
    const lastDocRef = await getDoc(doc(db, 'entries', lastDocId));
    if (lastDocRef.exists()) {
      q = query(q, startAfter(lastDocRef));
    }
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Entry));
};

export const updateEntry = async (id: string, contentMarkdown: string, mood: string | null) => {
  const docRef = doc(db, 'entries', id);
  await updateDoc(docRef, {
    contentMarkdown,
    mood,
    updatedAt: Date.now(),
  });
};

export const getStreak = async (userId: string): Promise<StreakMeta> => {
  const docRef = doc(db, 'meta', userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as StreakMeta;
  }
  
  return { currentStreak: 0, longestStreak: 0, lastEntryDate: '' };
};

const checkAndUpdateStreak = async (userId: string) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const streakData = await getStreak(userId);
  
  if (streakData.lastEntryDate === today) {
    // Already wrote today, no change
    return;
  }
  
  const docRef = doc(db, 'meta', userId);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

  let newCurrentStreak = 1;
  if (streakData.lastEntryDate === yesterdayStr) {
    newCurrentStreak = streakData.currentStreak + 1;
  }

  const newLongestStreak = Math.max(streakData.longestStreak, newCurrentStreak);

  await setDoc(docRef, {
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    lastEntryDate: today
  }, { merge: true });
};
