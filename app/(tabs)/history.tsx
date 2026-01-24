import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuthStore } from '@/stores/auth.store';
import { getWorkoutHistory } from '@/services/workout.service';
import { colors } from '@/constants/Colors';

// Custom SVG Icons
function ClockIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={colors.textMuted} strokeWidth={2} />
      <Path d="M12 6V12L16 14" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ListIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6H21" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 12H21" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 18H21" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 6H3.01" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 12H3.01" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 18H3.01" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function DumbbellIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 6.5L17.5 17.5" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 10L10 3" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 21L21 14" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

interface WorkoutItem {
  id: string;
  name: string;
  started_at: string;
  duration_seconds: number | null;
  total_volume_kg: number | null;
  workout_sets: { id: string }[];
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadWorkouts();
    }
  }, [user]);

  const loadWorkouts = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const history = await getWorkoutHistory(user.id);
      setWorkouts(history);
    } catch (error) {
      console.error('Failed to load workout history:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
    if (volumeKg >= 1000) {
      return `${(volumeKg / 1000).toFixed(1)}k`;
    }
    return Math.round(volumeKg).toString();
  };

  const renderWorkout = ({ item }: { item: WorkoutItem }) => (
    <TouchableOpacity
      style={styles.workoutCard}
      onPress={() => router.push(`/workout/${item.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} on ${formatDate(item.started_at)}`}
    >
      <View style={styles.workoutHeader}>
        <Text style={styles.workoutName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.workoutDate}>
          {formatDate(item.started_at)}
        </Text>
      </View>

      <View style={styles.workoutStats}>
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
            {formatVolume(item.total_volume_kg)} kg
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No workouts yet</Text>
      <Text style={styles.emptyDescription}>
        Start your first workout to see your history here
      </Text>
    </View>
  );

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
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 20 }]}
        ListEmptyComponent={renderEmpty}
        onRefresh={loadWorkouts}
        refreshing={isLoading}
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
    padding: 20,
    flexGrow: 1,
  },
  workoutCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: colors.bgSecondary,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
    color: colors.textPrimary,
  },
  workoutDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  workoutStats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: colors.textPrimary,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    color: colors.textSecondary,
  },
});
