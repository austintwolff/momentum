import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { getWorkoutDetail, deleteWorkout } from '@/services/workout.service';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore, formatWeight, kgToLbs } from '@/stores/settings.store';
import { showAlert } from '@/lib/alert';
import { colors } from '@/constants/Colors';

// Custom SVG Icons
function BackIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 19L5 12L12 5" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TrashIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6H5H21" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StarIcon({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={colors.accent}>
      <Path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </Svg>
  );
}

function ClockIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={colors.textPrimary} strokeWidth={2} />
      <Path d="M12 6V12L16 14" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function DumbbellIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 6.5L17.5 17.5" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 10L10 3" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 21L21 14" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 14L14 3" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M10 21L21 10" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ListIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6H21" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 12H21" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 18H21" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 6H3.01" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 12H3.01" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 18H3.01" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

interface WorkoutSet {
  id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number;
  is_bodyweight: boolean;
  is_pr: boolean;
  exercise: {
    id: string;
    name: string;
    muscle_group: string;
    exercise_type: string;
  };
}

interface WorkoutDetail {
  id: string;
  name: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  total_volume_kg: number;
  workout_sets: WorkoutSet[];
}

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore(s => s.user);
  const refreshUserStats = useAuthStore(s => s.refreshUserStats);
  const weightUnit = useSettingsStore(s => s.weightUnit);
  const queryClient = useQueryClient();

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadWorkoutDetail();
    }
  }, [id]);

  const loadWorkoutDetail = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await getWorkoutDetail(id);
      setWorkout(data);
    } catch (error) {
      console.error('Failed to load workout:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
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

  const formatVolume = (volumeKg: number) => {
    const volume = weightUnit === 'lbs' ? kgToLbs(volumeKg) : volumeKg;
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}k`;
    }
    return `${Math.round(volume).toLocaleString()}`;
  };

  const handleDeleteWorkout = () => {
    showAlert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id || !user) return;
            setIsDeleting(true);
            const result = await deleteWorkout(id, user.id);
            if (result.success) {
              await refreshUserStats();
              queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });
              router.back();
            } else {
              showAlert('Error', result.error || 'Failed to delete workout');
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  // Group sets by exercise
  const groupedExercises = workout?.workout_sets?.reduce((acc, set) => {
    const exerciseId = set.exercise?.id || 'unknown';
    if (!acc[exerciseId]) {
      acc[exerciseId] = {
        exercise: set.exercise,
        sets: [],
      };
    }
    acc[exerciseId].sets.push(set);
    return acc;
  }, {} as Record<string, { exercise: WorkoutSet['exercise']; sets: WorkoutSet[] }>);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Workout</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Workout not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Details</Text>
        <TouchableOpacity
          onPress={handleDeleteWorkout}
          style={styles.deleteButton}
          disabled={isDeleting}
          accessibilityLabel="Delete workout"
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <TrashIcon />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Workout Title & Date */}
        <View style={styles.titleSection}>
          <Text style={styles.workoutName}>{workout.name}</Text>
          <Text style={styles.workoutDate}>{formatDate(workout.started_at)}</Text>
          <Text style={styles.workoutTime}>
            {formatTime(workout.started_at)} - {formatTime(workout.completed_at)}
          </Text>
        </View>

        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <ClockIcon />
            <Text style={styles.statValue}>{formatDuration(workout.duration_seconds)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>

          <View style={styles.statCard}>
            <DumbbellIcon />
            <Text style={styles.statValue}>{formatVolume(workout.total_volume_kg)}</Text>
            <Text style={styles.statLabel}>Volume ({weightUnit})</Text>
          </View>

          <View style={styles.statCard}>
            <ListIcon />
            <Text style={styles.statValue}>{workout.workout_sets?.length || 0}</Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>
        </View>

        {/* Exercises */}
        <Text style={styles.sectionTitle}>Exercises</Text>

        {groupedExercises && Object.entries(groupedExercises).map(([exerciseId, { exercise, sets }]) => (
          <View key={exerciseId} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName} numberOfLines={1}>{exercise?.name || 'Unknown Exercise'}</Text>
              <Text style={styles.muscleGroup}>{exercise?.muscle_group}</Text>
            </View>

            <View style={styles.setsContainer}>
              {sets
                .filter((set) => set.reps > 0 || (set.weight_kg != null && set.weight_kg > 0))
                .sort((a, b) => a.set_number - b.set_number)
                .map((set, index) => (
                <View key={set.id} style={styles.setRow}>
                  <Text style={styles.setNumber}>{index + 1}</Text>
                  <Text style={styles.setDetails}>
                    {set.is_bodyweight
                      ? `${set.reps} reps`
                      : `${formatWeight(set.weight_kg, weightUnit)}${weightUnit} × ${set.reps}`}
                  </Text>
                  {set.is_pr && (
                    <View style={styles.prBadge}>
                      <StarIcon />
                      <Text style={styles.prText}>PR</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Exercise summary */}
            <View style={styles.exerciseSummary}>
              <Text style={styles.summaryText}>{sets.length} sets</Text>
            </View>
          </View>
        ))}

        {(!groupedExercises || Object.keys(groupedExercises).length === 0) && (
          <View style={styles.emptyExercises}>
            <Text style={styles.emptyText}>No exercises recorded</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  placeholder: {
    width: 44,
  },
  deleteButton: {
    padding: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  titleSection: {
    marginBottom: 24,
  },
  workoutName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
    color: colors.textPrimary,
  },
  workoutDate: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  workoutTime: {
    fontSize: 14,
    marginTop: 2,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 8,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    color: colors.textMuted,
  },
  exerciseCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: colors.bgSecondary,
  },
  exerciseHeader: {
    padding: 16,
    paddingBottom: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: colors.textPrimary,
  },
  muscleGroup: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.accent,
  },
  setsContainer: {
    paddingHorizontal: 16,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  setNumber: {
    width: 28,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
  },
  setDetails: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  prText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  exerciseSummary: {
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  summaryText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyExercises: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});
