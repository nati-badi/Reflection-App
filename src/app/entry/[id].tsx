import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDayDocument, saveDayDocument } from '../../services/db';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from '../../hooks/useTranslation';
import { Theme } from '../../constants/theme';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Check, ArrowLeft, Bold, Italic, Heading, List, ListOrdered, Smile } from 'lucide-react-native';

import { processEditorTextChange, renumberContentLists } from '../../utils/editorUtils';
import { WYSIWYGEditor } from '../../components/WYSIWYGEditor';

const MOODS = ['😁', '😊', '😐', '😔', '😠'];

const QUICK_EMOJIS = ['✨', '❤️', '💡', '📝', '🎯', '🙏', '☀️', '🌧️', '☕', '📌', '🔥', '💭', '📅', '🔖', '⭐', '💪', '🎉', '😊', '🤔', '🙌'];
const QUICK_SYMBOLS = ['—', '•', '…', '«', '»', '“', '”', '→', '←', '↑', '↓', '©', '™', '§', '°', '±', '≠', '≈'];

export default function EntryScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { theme } = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { t, formatDateDual } = useTranslation();
  
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date());

  const [showQuickInsert, setShowQuickInsert] = useState(true);
  const [quickCategory, setQuickCategory] = useState<'emoji' | 'symbol'>('emoji');

  const editorBridgeRef = useRef<any>(null);

  const targetDateStr = typeof id === 'string' && id !== 'new' && id !== 'today' ? id : format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    loadEntry();
  }, [id, user?.uid]);

  const loadEntry = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const dayDoc = await getDayDocument(user.uid, targetDateStr);
      if (dayDoc) {
        const loadedContent = dayDoc.contentMarkdown ? renumberContentLists(dayDoc.contentMarkdown) : '';
        setContent(loadedContent);
        setMood(dayDoc.mood || null);
        if (dayDoc.createdAt || dayDoc.updatedAt) {
          setEntryDate(new Date(dayDoc.createdAt || dayDoc.updatedAt));
        } else if (dayDoc.date) {
          setEntryDate(parseISO(dayDoc.date));
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const finalContent = renumberContentLists(content);
      await saveDayDocument(user.uid, targetDateStr, finalContent, mood);
      handleBack();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', t('saveError'));
      setSaving(false);
    }
  };

  const insertText = (str: string) => {
    if (editorBridgeRef.current?.insertTextAtCursor) {
      editorBridgeRef.current.insertTextAtCursor(str);
    } else if (editorBridgeRef.current?.insertContent) {
      editorBridgeRef.current.insertContent(str);
    } else {
      setContent(prev => prev + str);
    }
  };

  const toggleBold = () => {
    if (editorBridgeRef.current?.toggleBold) {
      editorBridgeRef.current.toggleBold();
    }
  };

  const toggleItalic = () => {
    if (editorBridgeRef.current?.toggleItalic) {
      editorBridgeRef.current.toggleItalic();
    }
  };

  const cycleHeading = () => {
    if (editorBridgeRef.current?.toggleHeading) {
      editorBridgeRef.current.toggleHeading(2);
    }
  };

  const toggleBulletList = () => {
    if (editorBridgeRef.current?.toggleBulletList) {
      editorBridgeRef.current.toggleBulletList();
    }
  };

  const toggleOrderedList = () => {
    if (editorBridgeRef.current?.toggleOrderedList) {
      editorBridgeRef.current.toggleOrderedList();
    }
  };

  const { secondaryDate, time } = formatDateDual(entryDate);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerDateContainer}>
          <Text style={styles.gregorianDate}>{secondaryDate}</Text>
          <Text style={styles.ethiopianDate}>{time}</Text>
        </View>

        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.iconButton}>
          {saving ? <ActivityIndicator color={theme.colors.accent} size="small" /> : <Check size={24} color={theme.colors.accent} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentContainer}>
        {/* Mood Picker */}
        <View style={styles.moodContainer}>
          {MOODS.map(m => (
            <TouchableOpacity 
              key={m} 
              onPress={() => setMood(m === mood ? null : m)}
              style={[styles.moodItem, mood === m && styles.moodItemSelected]}
            >
              <Text style={styles.moodEmoji}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* WYSIWYG Editor Container */}
        <View style={styles.editorContainer}>
          <WYSIWYGEditor
            initialContent={content}
            onChangeMarkdown={setContent}
            theme={theme}
            onBridgeReady={(bridge) => {
              editorBridgeRef.current = bridge;
            }}
          />
        </View>
      </ScrollView>

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
        <TouchableOpacity style={styles.toolbarBtn} onPress={toggleBold}>
          <Bold size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={toggleItalic}>
          <Italic size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={cycleHeading}>
          <Heading size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={toggleBulletList}>
          <List size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={toggleOrderedList}>
          <ListOrdered size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toolbarBtn, showQuickInsert && styles.toolbarBtnActive]} 
          onPress={() => setShowQuickInsert(!showQuickInsert)}
        >
          <Smile size={20} color={showQuickInsert ? theme.colors.accent : theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderColor: theme.colors.accent + '60',
    backgroundColor: theme.colors.surface,
  },
  moodEmoji: {
    fontSize: 24,
  },
  editorContainer: {
    flex: 1,
    minHeight: 280,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  editor: {
    flex: 1,
    minHeight: 250,
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
    color: theme.colors.accentForeground,
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

