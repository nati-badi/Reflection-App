import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Settings, Search, Plus } from 'lucide-react-native';
import { getEntries, getStreak } from '../services/db';
import { useAuthStore } from '../store/useAuthStore';
import { theme } from '../constants/theme';
import type { Entry, StreakMeta } from '../types';
import { format } from 'date-fns';
import { EthDateTime } from 'ethiopian-calendar-date-converter';

const ethMonthNames = ['Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yakatit', 'Magabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'];

export default function TimelineScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [entries, setEntries] = useState<Entry[]>([]);
  const [streak, setStreak] = useState<StreakMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDocId, setLastDocId] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
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

  const fetchStreak = async () => {
    if (user) {
      const data = await getStreak(user.uid);
      setStreak(data);
    }
  };

  const loadEntries = async (isLoadMore = false) => {
    if (!user) return;
    if (isLoadMore && (!hasMore || loadingMore)) return;

    try {
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      const newEntries = await getEntries(user.uid, isLoadMore ? lastDocId : undefined, 15);
      
      if (newEntries.length < 15) {
        setHasMore(false);
      }

      if (newEntries.length > 0) {
        setLastDocId(newEntries[newEntries.length - 1].id);
      }

      if (isLoadMore) {
        setEntries(prev => [...prev, ...newEntries]);
      } else {
        setEntries(newEntries);
      }
    } catch (error) {
      console.error('Failed to load entries:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStreak();
      loadEntries();
      setHasMore(true);
    }, [user])
  );

  const renderEntry = ({ item }: { item: Entry }) => {
    const d = new Date(item.createdAt);
    const ethDate = EthDateTime.fromEuropeanDate(d);
    
    return (
      <TouchableOpacity 
        style={styles.entryCard} 
        onPress={() => router.push(`/entry/${item.id}`)}
      >
        <View style={styles.entryHeader}>
          <Text style={styles.dateText}>
            {format(d, 'MMM d, yyyy')} • {ethMonthNames[ethDate.month - 1]} {ethDate.date}, {ethDate.year}
          </Text>
          {item.mood && <Text style={styles.moodText}>{item.mood}</Text>}
        </View>
        <Text style={styles.entryPreview} numberOfLines={3}>
          {item.contentMarkdown.replace(/[*#]/g, '')}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.streakContainer}>
          <Animated.View style={[styles.animatedStreakIcon, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.streakNumberText}>{streak?.currentStreak || 0}</Text>
          </Animated.View>
          <Text style={styles.streakText}>Day Streak</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/search')} style={styles.iconButton}>
            <Search size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.iconButton}>
            <Settings size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed */}
      {loading && entries.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id!}
          renderItem={renderEntry}
          contentContainerStyle={styles.listContent}
          onEndReached={() => {
            if (entries.length > 0 && hasMore && !loadingMore) {
              loadEntries(true);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footerLoader} color={theme.colors.accent} /> : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No reflections yet.</Text>
              <Text style={styles.emptySubText}>Tap the + button to write your first entry.</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => router.push('/entry/new')}
      >
        <Plus size={32} color="#FFF" />
      </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl, // Assuming no safe area provider for simplicity, normally use useSafeAreaInsets
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  animatedStreakIcon: {
    backgroundColor: '#007AFF', // Blue color
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  streakNumberText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.bold,
  },
  streakText: {
    fontSize: theme.typography.sizes.h3,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: theme.spacing.md,
    padding: theme.spacing.xs,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 100, // Space for FAB
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
    marginBottom: theme.spacing.sm,
  },
  dateText: {
    fontSize: theme.typography.sizes.small,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textSecondary,
  },
  moodText: {
    fontSize: theme.typography.sizes.regular,
  },
  entryPreview: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    right: theme.spacing.xl,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    marginVertical: theme.spacing.md,
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: theme.typography.sizes.h3,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  emptySubText: {
    fontSize: theme.typography.sizes.regular,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
