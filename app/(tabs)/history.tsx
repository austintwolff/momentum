import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore, kgToLbs } from '@/stores/settings.store';
import { getWorkoutHistory } from '@/services/workout.service';
import { colors } from '@/constants/Colors';

// Custom SVG Icons
function ClockIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={colors.accent} strokeWidth={2} />
      <Path d="M12 6V12L16 14" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ListIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6H21" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 12H21" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 18H21" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 6H3.01" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 12H3.01" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 18H3.01" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function DumbbellIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 6.5L17.5 17.5" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 10L10 3" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 21L21 14" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronRightIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18L15 12L9 6" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StarIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface WorkoutItem {
  id: string;
  name: string;
  started_at: string;
  duration_seconds: number | null;
  total_volume_kg: number | null;
  final_score: number | null;
  workout_sets: { id: string }[];
}

const PAGE_SIZE = 20;

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { weightUnit } = useSettingsStore();

  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadWorkouts();
    }
  }, [user]);

  const loadWorkouts = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, hasMore: more, totalCount: total } = await getWorkoutHistory(user.id, PAGE_SIZE, 0);
      setWorkouts(data);
      setHasMore(more);
      setTotalCount(total);
    } catch (error) {
      console.error('Failed to load workout history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreWorkouts = useCallback(async () => {
    if (!user || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const { data, hasMore: more } = await getWorkoutHistory(user.id, PAGE_SIZE, workouts.length);
      setWorkouts(prev => [...prev, ...data]);
      setHasMore(more);
    } catch (error) {
      console.error('Failed to load more workouts:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [user, isLoadingMore, hasMore, workouts.length]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatVolume = (volumeKg: number | null) => {
    if (!volumeKg) return '0';
    const volume = weightUnit === 'lbs' ? kgToLbs(volumeKg) : volumeKg;
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}k`;
    }
    return Math.round(volume).toString();
  };

  const renderWorkout = ({ item }: { item: WorkoutItem }) => (
    <TouchableOpacity
      style={styles.workoutCard}
      onPress={() => router.push(`/workout/${item.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} on ${formatDate(item.started_at)}`}
    >
      <View style={styles.workoutHeader}>
        <View style={styles.workoutInfo}>
          <Text style={styles.workoutName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.workoutDate}>
            {formatDate(item.started_at)}
          </Text>
        </View>
        <ChevronRightIcon />
      </View>

      <View style={styles.statsDivider} />

      <View style={styles.workoutStats}>
        {item.final_score != null && (
          <View style={styles.stat}>
            <StarIcon />
            <Text style={styles.statText}>
              {Math.round(item.final_score)}
            </Text>
          </View>
        )}
        <View style={styles.stat}>
          <ClockIcon />
          <Text style={styles.statText}>
            {formatDuration(item.duration_seconds)}
          </Text>
        </View>
        <View style={styles.stat}>
          <ListIcon />
          <Text style={styles.statText}>
            {item.workout_sets?.length || 0} sets
          </Text>
        </View>
        <View style={styles.stat}>
          <DumbbellIcon />
          <Text style={styles.statText}>
            {formatVolume(item.total_volume_kg)} {weightUnit}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <DumbbellIcon size={32} />
      </View>
      <Text style={styles.emptyTitle}>No workouts yet</Text>
      <Text style={styles.emptyDescription}>
        Complete your first workout to see your history here
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.screenHeader}>
      <Text style={styles.screenTitle}>History</Text>
      <Text style={styles.screenSubtitle}>
        {totalCount > 0 ? `${totalCount} workouts` : 'Your workout log'}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={workouts}
        renderItem={renderWorkout}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 16 }]}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onRefresh={loadWorkouts}
        refreshing={isLoading}
        onEndReached={loadMoreWorkouts}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  // Screen Header
  screenHeader: {
    marginBottom: 20,
    paddingTop: 8,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  screenSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  // Workout Card
  workoutCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  workoutDate: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  workoutStats: {
    flexDirection: 'row',
    gap: 20,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: colors.textPrimary,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    color: colors.textSecondary,
  },
  // Loading More
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
