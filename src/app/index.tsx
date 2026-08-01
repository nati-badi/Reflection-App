import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Flame,
  Search,
  Settings,
  Clock,
  Bold,
  Italic,
  Heading,
  List,
  ListOrdered,
  Smile
} from 'lucide-react-native';
import { theme } from '../constants/theme';
import { useTranslation } from '../hooks/useTranslation';
import {
  getOrCreateTodayDocument,
  saveDayDocument,
  getStreak,
  generateAndSaveWeeklySummary,
  migrateEntriesToDays
} from '../services/db';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import type { DayEntry, StreakMeta, WeeklySummary } from '../types';
import { format, startOfWeek, subWeeks } from 'date-fns';
import { WeeklySummaryModal } from '../components/WeeklySummaryModal';
import { processEditorTextChange, renumberContentLists } from '../utils/editorUtils';

const MOODS = ['😁', '😊', '😐', '😔', '😠'];

const QUICK_EMOJIS = ['✨', '❤️', '💡', '📝', '🎯', '🙏', '☀️', '🌧️', '☕', '📌', '🔥', '💭', '📅', '🔖', '⭐', '💪', '🎉', '😊', '🤔', '🙌'];
const QUICK_SYMBOLS = ['—', '•', '…', '«', '»', '“', '”', '→', '←', '↑', '↓', '©', '™', '§', '°', '±', '≠', '≈'];

export default function TimelineScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, formatDateDual } = useTranslation();
  const { lastSeenWeeklySummaryWeek, setLastSeenWeeklySummaryWeek } = useSettingsStore();

  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakMeta | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick insert & formatting toolbar states
  const [showQuickInsert, setShowQuickInsert] = useState(true);
  const [quickCategory, setQuickCategory] = useState<'emoji' | 'symbol'>('emoji');
  const inputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const isProgrammaticInsert = useRef(false);

  // Auto-save debouncing & flush refs
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStateRef = useRef({ content: '', mood: null as string | null });

  // Weekly Summary Auto-Prompt Modal State
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Keep latest state ref synced for immediate flush on app backgrounding/unmount
  useEffect(() => {
    latestStateRef.current = { content, mood };
  }, [content, mood]);

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

  // Immediate Save Flush function
  const flushSave = useCallback(async () => {
    if (!user) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const { content: currentContent, mood: currentMood } = latestStateRef.current;
    
    // Save to Firestore & update streak if non-empty
    await saveDayDocument(user.uid, todayStr, currentContent, currentMood);
    const updatedStreak = await getStreak(user.uid);
    setStreak(updatedStreak);
  }, [user]);

  // Schedule debounced auto-save (~800ms)
  const scheduleAutoSave = useCallback((newContent: string, newMood: string | null) => {
    if (!user) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await saveDayDocument(user.uid, todayStr, newContent, newMood);
      const updatedStreak = await getStreak(user.uid);
      setStreak(updatedStreak);
    }, 800);
  }, [user]);

  // AppState change listener for immediate flush on app background/device lock
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        flushSave();
      }
    });

    return () => {
      subscription.remove();
      flushSave();
    };
  }, [flushSave]);

  // Initial load: Migrate entries to days, fetch today's document & streak
  const initialLoad = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Run one-time migration if needed
      await migrateEntriesToDays(user.uid);

      const [streakData, todayDoc] = await Promise.all([
        getStreak(user.uid),
        getOrCreateTodayDocument(user.uid)
      ]);

      setStreak(streakData);
      const initialContent = todayDoc.contentMarkdown ? renumberContentLists(todayDoc.contentMarkdown) : '';
      setContent(initialContent);
      setMood(todayDoc.mood || null);
      latestStateRef.current = { content: initialContent, mood: todayDoc.mood || null };
    } catch (error) {
      console.error('Failed to load today page:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Check for unviewed previous week summary auto-prompt
  const checkWeeklySummaryPrompt = useCallback(async () => {
    if (!user) return;
    const prevWeekMon = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    const prevWeekId = format(prevWeekMon, "yyyy-'W'II");

    if (lastSeenWeeklySummaryWeek !== prevWeekId) {
      setLastSeenWeeklySummaryWeek(prevWeekId);
      const summary = await generateAndSaveWeeklySummary(user.uid, subWeeks(new Date(), 1));
      if (summary && summary.daysWrittenCount > 0) {
        setWeeklySummary(summary);
        setSummaryModalVisible(true);
      }
    }
  }, [user?.uid, lastSeenWeeklySummaryWeek, setLastSeenWeeklySummaryWeek]);

  useEffect(() => {
    initialLoad();
    checkWeeklySummaryPrompt();
  }, [initialLoad, checkWeeklySummaryPrompt]);

  // Screen focus refresh & blur flush
  useFocusEffect(
    useCallback(() => {
      return () => {
        flushSave();
      };
    }, [flushSave])
  );

  // Editor Selection & Formatting Helpers
  const applySelection = (newPos: number) => {
    isProgrammaticInsert.current = true;
    setSelection({ start: newPos, end: newPos });

    setTimeout(() => {
      inputRef.current?.focus();
      if (Platform.OS === 'web' && inputRef.current) {
        try {
          const domInput = (inputRef.current as any)._inputElement || (inputRef.current as any).node || (inputRef.current as any);
          if (domInput && typeof domInput.setSelectionRange === 'function') {
            domInput.setSelectionRange(newPos, newPos);
          }
        } catch (e) {
          // ignore web DOM exception
        }
      }
      setTimeout(() => {
        isProgrammaticInsert.current = false;
      }, 100);
    }, 20);
  };

  const handleSelectionChange = (e: any) => {
    if (isProgrammaticInsert.current) return;
    setSelection(e.nativeEvent.selection);
  };

  const handleTextChange = (newText: string) => {
    const cursorPos = selection.start;
    const { content: processedContent, newCursorPos } = processEditorTextChange(content, newText, cursorPos);
    
    setContent(processedContent);
    scheduleAutoSave(processedContent, mood);

    if (newCursorPos !== cursorPos) {
      applySelection(newCursorPos);
    }
  };

  const handleMoodSelect = (selectedMood: string) => {
    const newMood = selectedMood === mood ? null : selectedMood;
    setMood(newMood);
    scheduleAutoSave(content, newMood);
  };

  const insertText = (str: string) => {
    const start = selection.start;
    const end = selection.end;
    const newText = content.substring(0, start) + str + content.substring(end);
    const renumbered = renumberContentLists(newText);
    const newPos = start + str.length;

    setContent(renumbered);
    scheduleAutoSave(renumbered, mood);
    applySelection(newPos);
  };

  const cycleHeading = () => {
    const start = selection.start;
    const end = selection.end;
    
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = content.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = content.length;
    
    const lineText = content.substring(lineStart, lineEnd);
    let newHeadingPrefix = '# ';
    let strippedLine = lineText;
    
    if (lineText.startsWith('### ')) {
      newHeadingPrefix = '';
      strippedLine = lineText.substring(4);
    } else if (lineText.startsWith('## ')) {
      newHeadingPrefix = '### ';
      strippedLine = lineText.substring(3);
    } else if (lineText.startsWith('# ')) {
      newHeadingPrefix = '## ';
      strippedLine = lineText.substring(2);
    }
    
    const newLineText = newHeadingPrefix + strippedLine;
    const newContent = content.substring(0, lineStart) + newLineText + content.substring(lineEnd);
    const renumbered = renumberContentLists(newContent);
    const posOffset = newLineText.length - lineText.length;
    const newPos = Math.max(lineStart, end + posOffset);

    setContent(renumbered);
    scheduleAutoSave(renumbered, mood);
    applySelection(newPos);
  };

  const toggleListMarkdown = (type: 'bullet' | 'number') => {
    const start = selection.start;
    const end = selection.end;
    
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = content.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = content.length;
    
    const lineText = content.substring(lineStart, lineEnd);
    const isBullet = /^(\s*)([-*•])\s+/.test(lineText);
    const isNumber = /^(\s*)(\d+)\.\s+/.test(lineText);

    let newLineText = '';
    if (type === 'bullet') {
      if (isBullet) {
        newLineText = lineText.replace(/^(\s*)([-*•])\s+/, '$1');
      } else {
        const stripped = lineText.replace(/^(\s*)(\d+)\.\s+/, '$1');
        newLineText = `- ${stripped}`;
      }
    } else if (type === 'number') {
      if (isNumber) {
        newLineText = lineText.replace(/^(\s*)(\d+)\.\s+/, '$1');
      } else {
        const stripped = lineText.replace(/^(\s*)([-*•])\s+/, '$1');
        newLineText = `1. ${stripped}`;
      }
    }

    const rawContent = content.substring(0, lineStart) + newLineText + content.substring(lineEnd);
    const updatedContent = renumberContentLists(rawContent);
    const posOffset = newLineText.length - lineText.length;
    const newPos = Math.max(lineStart, end + posOffset);

    setContent(updatedContent);
    scheduleAutoSave(updatedContent, mood);
    applySelection(newPos);
  };

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const start = selection.start;
    const end = selection.end;
    const selectedText = content.substring(start, end);
    const newText = content.substring(0, start) + prefix + selectedText + suffix + content.substring(end);
    const renumbered = renumberContentLists(newText);
    const newPos = start + prefix.length + selectedText.length + suffix.length;

    setContent(renumbered);
    scheduleAutoSave(renumbered, mood);
    applySelection(newPos);
  };

  const { secondaryDate, time } = formatDateDual(new Date());

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.streakBadge}>
          <Animated.View style={[styles.flameWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <Flame size={20} color="#FF5500" fill="#FF5500" />
          </Animated.View>
          <Text style={styles.streakNumber}>{streak?.currentStreak || 0}</Text>
        </View>

        <View style={styles.headerDateContainer}>
          <Text style={styles.gregorianDate}>{secondaryDate}</Text>
          <Text style={styles.ethiopianDate}>{time}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => { flushSave(); router.push('/history'); }} style={styles.iconButton}>
            <Clock size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { flushSave(); router.push('/search'); }} style={styles.iconButton}>
            <Search size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { flushSave(); router.push('/settings'); }} style={styles.iconButton}>
            <Settings size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Today Journal Editor View */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <ScrollView style={styles.contentContainer}>
          {/* Single Mood Picker for the Day (Last Tap Wins) */}
          <View style={styles.moodContainer}>
            {MOODS.map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => handleMoodSelect(m)}
                style={[styles.moodItem, mood === m && styles.moodItemSelected]}
              >
                <Text style={styles.moodEmoji}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bordered Editor Container for Today's Reflection */}
          <View style={styles.editorContainer}>
            <TextInput
              ref={inputRef}
              style={styles.editor}
              multiline
              placeholder={t('placeholderContent')}
              placeholderTextColor={theme.colors.textSecondary}
              value={content}
              onChangeText={handleTextChange}
              selection={selection}
              onSelectionChange={handleSelectionChange}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      )}

      {/* Quick Insert Strip */}
      {showQuickInsert && (
        <View style={styles.quickInsertContainer}>
          <View style={styles.categoryTabs}>
            <TouchableOpacity
              onPress={() => setQuickCategory('emoji')}
              style={[styles.categoryTab, quickCategory === 'emoji' && styles.categoryTabActive]}
            >
              <Text style={[styles.categoryTabText, quickCategory === 'emoji' && styles.categoryTabTextActive]}>
                {t('emojiTab')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setQuickCategory('symbol')}
              style={[styles.categoryTab, quickCategory === 'symbol' && styles.categoryTabActive]}
            >
              <Text style={[styles.categoryTabText, quickCategory === 'symbol' && styles.categoryTabTextActive]}>
                {t('symbolTab')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickScrollContent}
          >
            {(quickCategory === 'emoji' ? QUICK_EMOJIS : QUICK_SYMBOLS).map((item, index) => (
              <TouchableOpacity key={index} style={styles.quickItem} onPress={() => insertText(item)}>
                <Text style={styles.quickItemText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Formatting Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => insertMarkdown('**', '**')}>
          <Bold size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => insertMarkdown('*', '*')}>
          <Italic size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={cycleHeading}>
          <Heading size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => toggleListMarkdown('bullet')}>
          <List size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => toggleListMarkdown('number')}>
          <ListOrdered size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolbarBtn, showQuickInsert && styles.toolbarBtnActive]}
          onPress={() => setShowQuickInsert(!showQuickInsert)}
        >
          <Smile size={20} color={showQuickInsert ? theme.colors.accent : theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Auto-Prompt Weekly Summary Modal */}
      <WeeklySummaryModal
        visible={summaryModalVisible}
        summary={weeklySummary}
        onClose={() => setSummaryModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
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
  contentContainer: {
    flex: 1,
    padding: theme.spacing.md,
  },
  moodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  moodItem: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  moodItemSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface,
  },
  moodEmoji: {
    fontSize: 24,
  },
  editorContainer: {
    flex: 1,
    minHeight: 320,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  editor: {
    flex: 1,
    minHeight: 290,
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    lineHeight: 24,
  },
  quickInsertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  categoryTabs: {
    flexDirection: 'row',
    marginRight: theme.spacing.xs,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingRight: theme.spacing.xs,
  },
  categoryTab: {
    paddingHorizontal: 12,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 17,
    marginRight: 6,
    backgroundColor: 'transparent',
  },
  categoryTabActive: {
    backgroundColor: theme.colors.accent,
  },
  categoryTabText: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.textSecondary,
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.bold,
  },
  quickScrollContent: {
    alignItems: 'center',
    paddingRight: theme.spacing.md,
  },
  quickItem: {
    height: 34,
    minWidth: 34,
    paddingHorizontal: 8,
    marginHorizontal: 3,
    borderRadius: 17,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickItemText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  toolbarBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarBtnActive: {
    backgroundColor: theme.colors.border,
    borderRadius: 8,
  },
});
