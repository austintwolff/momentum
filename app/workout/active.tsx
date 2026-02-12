import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  AppState,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { showAlert } from '@/lib/alert';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useWorkoutStore, WorkoutExercise } from '@/stores/workout.store';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { saveWorkoutToDatabase } from '@/services/workout.service';
import { GoalBucket } from '@/lib/points-engine';
import ExercisePicker from '@/components/workout/ExercisePicker';
import { colors } from '@/constants/Colors';

// Self-contained timer component — owns its own state so the parent doesn't re-render every second
function WorkoutTimer({ startedAt, elapsedRef }: { startedAt: Date; elapsedRef: React.MutableRefObject<number> }) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const update = () => {
      const elapsed = Math.floor(
        (Date.now() - startedAt.getTime()) / 1000
      );
      setElapsedTime(elapsed);
      elapsedRef.current = elapsed;
    };

    const interval = setInterval(update, 1000);

    // When the app returns from background, force an immediate recalculation
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [startedAt]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return <Text style={styles.timer}>{formatTime(elapsedTime)}</Text>;
}

// Custom SVG Icons
function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18" stroke={colors.error} strokeWidth={2} strokeLinecap="round" />
      <Path d="M6 6L18 18" stroke={colors.error} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CheckIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17L4 12" stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18L15 12L9 6" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M5 12H19" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Muscle group icons
const MUSCLE_ICONS: Record<string, string> = {
  'chest': '🫁',
  'upper back': '🔙',
  'lower back': '⬇️',
  'shoulders': '🎯',
  'biceps': '💪',
  'triceps': '💪',
  'forearms': '🤚',
  'core': '🎯',
  'quads': '🦵',
  'hamstrings': '🦵',
  'glutes': '🍑',
  'calves': '🦶',
};

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; goal?: string }>();

  // Goal mode from setup screen (for future use)
  const goalMode = params.goal as 'Strength' | 'Hypertrophy' | 'Endurance' | undefined;

  const user = useAuthStore(s => s.user);
  const refreshUserStats = useAuthStore(s => s.refreshUserStats);
  const weightUnit = useSettingsStore(s => s.weightUnit);
  const activeWorkout = useWorkoutStore(s => s.activeWorkout);
  const startWorkout = useWorkoutStore(s => s.startWorkout);
  const endWorkout = useWorkoutStore(s => s.endWorkout);
  const cancelWorkout = useWorkoutStore(s => s.cancelWorkout);
  const addExercise = useWorkoutStore(s => s.addExercise);

  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const elapsedRef = useRef(0);

  // Start workout on mount
  useEffect(() => {
    if (!activeWorkout) {
      const goal: GoalBucket = goalMode || 'Hypertrophy';
      startWorkout(params.name || 'Workout', goal);
    }
  }, []);

  const handleFinishWorkout = () => {
    showAlert(
      'Finish Workout',
      'Are you sure you want to finish this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          onPress: async () => {
            if (!activeWorkout || !user) return;

            setIsSaving(true);
            const completedAt = new Date();
            const finishedWorkout = endWorkout();

            if (finishedWorkout) {
              // Save to database
              const saveResult = await saveWorkoutToDatabase({
                userId: user.id,
                workoutId: finishedWorkout.id,
                name: finishedWorkout.name,
                goal: finishedWorkout.goal,
                startedAt: finishedWorkout.startedAt,
                completedAt,
                durationSeconds: elapsedRef.current,
                exercises: finishedWorkout.exercises,
                totalVolume: finishedWorkout.totalVolume,
                weightUnit,
              });

              if (!saveResult.success) {
                console.error('Failed to save workout:', saveResult.error);
              }

              // TODO: Re-enable HealthKit once nitro-modules compatibility is resolved
              // saveWorkoutToHealthKit({
              //   startedAt: finishedWorkout.startedAt,
              //   completedAt,
              //   durationSeconds: elapsedRef.current,
              //   workoutName: finishedWorkout.name,
              //   exerciseCount: finishedWorkout.exercises.length,
              //   totalSets: finishedWorkout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
              //   totalVolumeKg: finishedWorkout.totalVolume,
              // });

              // Refresh user stats
              await refreshUserStats();

              router.replace({
                pathname: '/workout/summary',
                params: {
                  workoutScore: (saveResult.workoutScore ?? 0).toString(),
                  progressScore: (saveResult.progressScore ?? 0).toString(),
                  maintenanceBonus: (saveResult.maintenanceBonus ?? 0).toString(),
                  workScore: (saveResult.workScore ?? 0).toString(),
                  consistencyScore: (saveResult.consistencyScore ?? 0).toString(),
                  eprPrCount: (saveResult.eprPrCount ?? 0).toString(),
                  weightPrCount: (saveResult.weightPrCount ?? 0).toString(),
                  nearPRCount: (saveResult.nearPRCount ?? 0).toString(),
                  closenessRatio: (saveResult.closenessRatio ?? 0).toString(),
                  topPerformerName: saveResult.topPerformerName ?? '',
                  topPerformerPercent: (saveResult.topPerformerPercent ?? 0).toString(),
                  totalVolume: finishedWorkout.totalVolume.toString(),
                  totalSets: finishedWorkout.exercises
                    .reduce((sum, ex) => sum + ex.sets.length, 0)
                    .toString(),
                  duration: elapsedRef.current.toString(),
                  exerciseCount: finishedWorkout.exercises.length.toString(),
                },
              });
            }
            setIsSaving(false);
          },
        },
      ]
    );
  };

  const handleCancelWorkout = () => {
    showAlert(
      'Cancel Workout',
      'Are you sure you want to cancel? All progress will be lost.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Cancel Workout',
          style: 'destructive',
          onPress: () => {
            cancelWorkout();
            router.back();
          },
        },
      ]
    );
  };

  const handleExercisePress = (index: number) => {
    router.push(`/workout/exercise?index=${index}`);
  };

  const handleAddExercise = (exercise: Parameters<typeof addExercise>[0]) => {
    const newIndex = activeWorkout?.exercises.length || 0;
    addExercise(exercise);
    setShowExercisePicker(false);
    // Navigate to the newly added exercise
    router.push(`/workout/exercise?index=${newIndex}`);
  };

  const totalSets = activeWorkout?.exercises.reduce((sum, ex) => sum + ex.sets.length, 0) || 0;

  if (!activeWorkout) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const renderExerciseCard = (exercise: WorkoutExercise, index: number) => {
    const muscleGroup = exercise.exercise.muscle_group?.toLowerCase() || '';
    const icon = MUSCLE_ICONS[muscleGroup] || '💪';

    return (
      <TouchableOpacity
        key={exercise.id}
        style={styles.exerciseCard}
        onPress={() => handleExercisePress(index)}
        activeOpacity={0.7}
      >
        <View style={styles.exerciseCardLeft}>
          <Text style={styles.exerciseIcon}>{icon}</Text>
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName} numberOfLines={1}>
              {exercise.exercise.name}
            </Text>
            <Text style={styles.exerciseMuscle}>
              {exercise.exercise.muscle_group}
            </Text>
          </View>
        </View>
        <View style={styles.exerciseCardRight}>
          <Text style={styles.exerciseSets}>
            {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
          </Text>
        </View>
        <ChevronIcon />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancelWorkout} style={styles.headerButton} accessibilityLabel="Cancel workout">
          <CloseIcon />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.workoutName}>
            {activeWorkout.name}
          </Text>
          <WorkoutTimer startedAt={activeWorkout.startedAt} elapsedRef={elapsedRef} />
        </View>

        <TouchableOpacity
          onPress={handleFinishWorkout}
          style={styles.headerButton}
          disabled={isSaving}
          accessibilityLabel="Finish workout"
        >
          <View style={isSaving ? { opacity: 0.5 } : undefined}>
            <CheckIcon />
          </View>
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {totalSets}
          </Text>
          <Text style={styles.statLabel}>sets</Text>
        </View>
        <Text style={styles.statDivider}>|</Text>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {activeWorkout.exercises.length}
          </Text>
          <Text style={styles.statLabel}>exercises</Text>
        </View>
      </View>

      {/* Exercise List */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeWorkout.exercises.length > 0 ? (
          <View style={styles.exerciseList}>
            {activeWorkout.exercises.map((exercise, index) => renderExerciseCard(exercise, index))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>
              No exercises yet
            </Text>
            <Text style={styles.emptyDescription}>
              Add your first exercise to start tracking your workout
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Exercise Button */}
      <TouchableOpacity
        style={styles.addExerciseButton}
        onPress={() => setShowExercisePicker(true)}
      >
        <PlusIcon />
        <Text style={styles.addExerciseText}>Add Exercise</Text>
      </TouchableOpacity>

      {/* Exercise Picker Modal */}
      <ExercisePicker
        visible={showExercisePicker}
        onClose={() => setShowExercisePicker(false)}
        onSelectExercise={handleAddExercise}
        workoutName={activeWorkout?.name}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  loadingText: {
    color: colors.textPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timer: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
    backgroundColor: colors.bgSecondary,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statDivider: {
    fontSize: 16,
    fontWeight: '300',
    color: colors.border,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  exerciseList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.bgSecondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  exerciseCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  exerciseIcon: {
    fontSize: 28,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    color: colors.textPrimary,
  },
  exerciseMuscle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  exerciseCardRight: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  exerciseSets: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
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
    lineHeight: 20,
    color: colors.textSecondary,
  },
  addExerciseButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addExerciseText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
