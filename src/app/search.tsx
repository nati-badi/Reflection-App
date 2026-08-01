import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search as SearchIcon } from 'lucide-react-native';
import { searchDays } from '../services/db';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from '../hooks/useTranslation';
import { theme } from '../constants/theme';
import type { DayEntry } from '../types';
import { parseISO } from 'date-fns';

export default function SearchScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t, formatDateDual } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const performSearch = async () => {
      if (!user || !searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        setLoading(true);
        const data = await searchDays(user.uid, searchQuery);
        setSearchResults(data);
      } catch (error) {
        console.error('Failed to search days:', error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  const renderDayCard = ({ item }: { item: DayEntry }) => {
    const d = item.date ? parseISO(item.date) : new Date(item.createdAt);
    const { primaryDate } = formatDateDual(d);

    return (
      <TouchableOpacity 
        style={styles.entryCard} 
        onPress={() => router.push(`/entry/${item.date}`)}
      >
        <View style={styles.entryHeader}>
          <Text style={[styles.dateText, { flex: 1, marginRight: theme.spacing.xs }]} numberOfLines={1}>
            {primaryDate}
          </Text>
          {item.mood && <Text style={styles.moodText}>{item.mood}</Text>}
        </View>
        <Text style={styles.entryPreview} numberOfLines={2}>
          {item.contentMarkdown ? item.contentMarkdown.replace(/[*#]/g, '') : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <SearchIcon size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('searchPlaceholder')}
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
      </View>

      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        renderItem={renderDayCard}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          searchQuery.trim() ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('noSearchResults')}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    marginRight: theme.spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.regular,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  entryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  dateText: {
    fontSize: theme.typography.sizes.small,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily.medium,
  },
  moodText: {
    fontSize: 16,
  },
  entryPreview: {
    fontSize: theme.typography.sizes.regular,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: 20,
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.typography.sizes.regular,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
});
