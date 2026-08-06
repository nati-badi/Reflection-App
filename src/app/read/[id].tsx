import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, SafeAreaView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDayDocument } from '../../services/db';
import { parseISO } from 'date-fns';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from '../../hooks/useTranslation';
import { Theme } from '../../constants/theme';
import { useAppTheme } from '../../hooks/useAppTheme';
import { ArrowLeft } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';

export default function ReadDayScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { theme } = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { t, formatDateDual } = useTranslation();
  
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryDate, setEntryDate] = useState(new Date());

  useEffect(() => {
    loadEntry();
  }, [id, user?.uid]);

  const loadEntry = async () => {
    if (!user || typeof id !== 'string') return;
    try {
      setLoading(true);
      const dayDoc = await getDayDocument(user.uid, id);
      if (dayDoc) {
        setContent(dayDoc.contentMarkdown || '');
        setMood(dayDoc.mood || null);
        if (dayDoc.createdAt || dayDoc.updatedAt) {
          setEntryDate(new Date(dayDoc.createdAt || dayDoc.updatedAt));
        } else if (dayDoc.date) {
          setEntryDate(parseISO(dayDoc.date));
        }
      } else {
        Alert.alert('Not Found', 'This entry could not be found.');
        router.back();
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

  const { compactHeader, primaryDate } = formatDateDual(entryDate);
  const dateTitle = Platform.OS === 'web' ? compactHeader : primaryDate;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={handleBack}>
          <ArrowLeft color={theme.colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{dateTitle}</Text>
        <View style={styles.iconButtonSpacer} />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.contentContainer} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <View>
            {mood && (
              <View style={styles.moodContainer}>
                <Text style={styles.moodEmoji}>{mood}</Text>
              </View>
            )}
            
            {content ? (
              <View style={styles.markdownWrapper}>
                <Markdown
                  style={{
                    body: {
                      fontSize: theme.typography.sizes.regular,
                      fontFamily: theme.typography.fontFamily.regular,
                      color: theme.colors.textPrimary,
                      lineHeight: 24,
                    },
                    heading1: {
                      fontSize: 24,
                      fontFamily: theme.typography.fontFamily.bold,
                      marginTop: 16,
                      marginBottom: 8,
                    },
                    heading2: {
                      fontSize: 20,
                      fontFamily: theme.typography.fontFamily.bold,
                      marginTop: 16,
                      marginBottom: 8,
                    },
                    heading3: {
                      fontSize: 18,
                      fontFamily: theme.typography.fontFamily.bold,
                      marginTop: 16,
                      marginBottom: 8,
                    },
                    paragraph: {
                      marginTop: 8,
                      marginBottom: 8,
                    },
                    list_item: {
                      marginVertical: 4,
                    },
                    strong: {
                      fontFamily: theme.typography.fontFamily.bold,
                    },
                    em: {
                      fontStyle: 'italic',
                    }
                  }}
                >
                  {content}
                </Markdown>
              </View>
            ) : (
              <Text style={styles.emptyText}>No content written on this day.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: Platform.OS === 'android' ? theme.spacing.xl : theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  iconButton: {
    padding: theme.spacing.xs,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonSpacer: {
    width: 44,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  moodContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  moodEmoji: {
    fontSize: 64,
  },
  markdownWrapper: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyText: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontStyle: 'italic',
  }
});
