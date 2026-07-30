import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search as SearchIcon } from 'lucide-react-native';
import { getEntries } from '../services/db';
import { useAuthStore } from '../store/useAuthStore';
import { theme } from '../constants/theme';
import type { Entry } from '../types';
import { format } from 'date-fns';

export default function SearchScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For MVP, fetch a large chunk of entries for client-side search
    // In a real app with many entries, you'd use a server-side search or Algolia
    const loadAllEntries = async () => {
      if (user) {
        const entries = await getEntries(user.uid, undefined, 500);
        setAllEntries(entries);
        setFilteredEntries(entries);
      }
      setLoading(false);
    };
    loadAllEntries();
  }, [user]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEntries(allEntries);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = allEntries.filter(entry => 
      entry.contentMarkdown.toLowerCase().includes(lowerQuery) ||
      (entry.mood && entry.mood.includes(lowerQuery))
    );
    setFilteredEntries(filtered);
  }, [searchQuery, allEntries]);

  const renderEntry = ({ item }: { item: Entry }) => (
    <TouchableOpacity 
      style={styles.entryCard} 
      onPress={() => router.push(`/entry/${item.id}`)}
    >
      <View style={styles.entryHeader}>
        <Text style={styles.dateText}>{format(new Date(item.createdAt), 'MMM d, yyyy')}</Text>
        {item.mood && <Text style={styles.moodText}>{item.mood}</Text>}
      </View>
      <Text style={styles.entryPreview} numberOfLines={2}>
        {item.contentMarkdown.replace(/[*#]/g, '')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <SearchIcon size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search entries..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
      </View>

      <FlatList
        data={filteredEntries}
        keyExtractor={item => item.id!}
        renderItem={renderEntry}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No results found.</Text>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconButton: {
    padding: theme.spacing.xs,
    marginRight: theme.spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
  },
  searchIcon: {
    marginRight: theme.spacing.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.sizes.regular,
    color: theme.colors.textPrimary,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  entryCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: 8,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  dateText: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textSecondary,
  },
  moodText: {
    fontSize: theme.typography.sizes.small,
  },
  entryPreview: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.regular,
  },
});
