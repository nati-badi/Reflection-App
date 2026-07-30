import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { addEntry, updateEntry } from '../../services/db';
import { useAuthStore } from '../../store/useAuthStore';
import { theme } from '../../constants/theme';
import { format } from 'date-fns';
import { EthDateTime } from 'ethiopian-calendar-date-converter';
import { Check, ArrowLeft, Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered } from 'lucide-react-native';

const ethMonthNames = ['Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yakatit', 'Magabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'];

const MOODS = ['😁', '😊', '😐', '😔', '😠'];

export default function EntryScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date());

  const inputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  useEffect(() => {
    if (id !== 'new') {
      loadEntry();
    }
  }, [id]);

  const loadEntry = async () => {
    if (!id || typeof id !== 'string') return;
    try {
      const docRef = doc(db, 'entries', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setContent(data.contentMarkdown || '');
        setMood(data.mood || null);
        setEntryDate(new Date(data.createdAt));
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load entry');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !content.trim()) return;
    setSaving(true);
    try {
      if (id === 'new') {
        await addEntry(user.uid, content, mood);
      } else if (typeof id === 'string') {
        await updateEntry(id, content, mood);
      }
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save entry');
      setSaving(false);
    }
  };

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const newText = content.substring(0, selection.start) + prefix + content.substring(selection.start, selection.end) + suffix + content.substring(selection.end);
    setContent(newText);
    
    // Attempt to keep focus and cursor position (can be tricky in RN, but this is a basic implementation)
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const ethDate = EthDateTime.fromEuropeanDate(entryDate);
  const formattedGregorian = format(entryDate, 'EEEE, MMM d, yyyy');
  const formattedEthiopian = `${ethMonthNames[ethDate.month - 1]} ${ethDate.date}, ${ethDate.year}`;

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
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerDateContainer}>
          <Text style={styles.gregorianDate}>{formattedGregorian}</Text>
          <Text style={styles.ethiopianDate}>{formattedEthiopian}</Text>
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

        {/* Editor */}
        <TextInput
          ref={inputRef}
          style={styles.editor}
          multiline
          placeholder="What's on your mind today?"
          placeholderTextColor={theme.colors.textSecondary}
          value={content}
          onChangeText={setContent}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          textAlignVertical="top"
        />
      </ScrollView>

      {/* Formatting Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => insertMarkdown('**', '**')}>
          <Bold size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => insertMarkdown('*', '*')}>
          <Italic size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => insertMarkdown('# ')}>
          <Heading1 size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => insertMarkdown('## ')}>
          <Heading2 size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => insertMarkdown('### ')}>
          <Heading3 size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => insertMarkdown('- ')}>
          <List size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => insertMarkdown('1. ')}>
          <ListOrdered size={20} color={theme.colors.textPrimary} />
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
    padding: theme.spacing.xs,
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
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
  moodItem: {
    padding: theme.spacing.sm,
    borderRadius: 20,
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
  editor: {
    flex: 1,
    minHeight: 300,
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    lineHeight: 24,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  toolbarBtn: {
    padding: theme.spacing.sm,
  },
});
