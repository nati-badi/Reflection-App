import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDayDocument, saveDayDocument } from '../../services/db';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from '../../hooks/useTranslation';
import { theme } from '../../constants/theme';
import { Check, ArrowLeft, Bold, Italic, Heading, List, ListOrdered, Smile } from 'lucide-react-native';

import { processEditorTextChange, renumberContentLists } from '../../utils/editorUtils';

const MOODS = ['😁', '😊', '😐', '😔', '😠'];

const QUICK_EMOJIS = ['✨', '❤️', '💡', '📝', '🎯', '🙏', '☀️', '🌧️', '☕', '📌', '🔥', '💭', '📅', '🔖', '⭐', '💪', '🎉', '😊', '🤔', '🙌'];
const QUICK_SYMBOLS = ['—', '•', '…', '«', '»', '“', '”', '→', '←', '↑', '↓', '©', '™', '§', '°', '±', '≠', '≈'];

export default function EntryScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, formatDateDual } = useTranslation();
  
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date());

  const [showQuickInsert, setShowQuickInsert] = useState(true);
  const [quickCategory, setQuickCategory] = useState<'emoji' | 'symbol'>('emoji');

  const inputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const isProgrammaticInsert = useRef(false);

  const targetDateStr = typeof id === 'string' && id !== 'new' ? id : format(new Date(), 'yyyy-MM-dd');

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
        if (dayDoc.date) {
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

  const applySelection = (newPos: number) => {
    isProgrammaticInsert.current = true;
    setSelection({ start: newPos, end: newPos });

    setTimeout(() => {
      inputRef.current?.focus();

      if (Platform.OS === 'web' && inputRef.current) {
        try {
          const domInput = (inputRef.current as any)._inputElement || 
                          (inputRef.current as any).node || 
                          (inputRef.current as any);
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
    if (isProgrammaticInsert.current) {
      // Guard against stale native { start: 0, end: 0 } selection event fired on programmatic updates
      return;
    }
    setSelection(e.nativeEvent.selection);
  };

  const handleTextChange = (newText: string) => {
    const cursorPos = selection.start;
    const { content: processedContent, newCursorPos } = processEditorTextChange(content, newText, cursorPos);
    
    setContent(processedContent);

    if (newCursorPos !== cursorPos) {
      applySelection(newCursorPos);
    }
  };

  const insertText = (str: string) => {
    const start = selection.start;
    const end = selection.end;
    const newText = content.substring(0, start) + str + content.substring(end);
    setContent(renumberContentLists(newText));
    const newPos = start + str.length;
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
    
    setContent(renumberContentLists(newContent));
    const posOffset = newLineText.length - lineText.length;
    const newPos = Math.max(lineStart, end + posOffset);
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

    setContent(updatedContent);
    const posOffset = newLineText.length - lineText.length;
    const newPos = Math.max(lineStart, end + posOffset);
    applySelection(newPos);
  };

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const start = selection.start;
    const end = selection.end;
    const selectedText = content.substring(start, end);
    const newText = content.substring(0, start) + prefix + selectedText + suffix + content.substring(end);
    setContent(renumberContentLists(newText));
    const newPos = start + prefix.length + selectedText.length + suffix.length;
    applySelection(newPos);
  };

  const { secondaryDate, time } = formatDateDual(entryDate);

  if (loading) {
    return <View style={styles.centerContainer}><ActivityIndicator color={theme.colors.accent} /></View>;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
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

        {/* Bordered Editor Container */}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
    borderColor: theme.colors.accent,
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

