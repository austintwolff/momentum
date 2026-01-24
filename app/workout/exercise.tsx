import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { showAlert } from '@/lib/alert';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useWorkoutStore } from '@/stores/workout.store';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore, kgToLbs } from '@/stores/settings.store';
import { getBestSetFromRecentWorkouts, BestSetResult } from '@/services/workout.service';
import SetLogger from '@/components/workout/SetLogger';
import RestTimer from '@/components/workout/RestTimer';
import { colors } from '@/constants/Colors';

// Custom SVG Icons
function TrashIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6H5H21" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17L4 12" stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
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

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ index: string }>();
  const exerciseIndex = parseInt(params.index || '0', 10);

  const { user, profile } = useAuthStore();
  const { weightUnit } = useSettingsStore();
  const {
    activeWorkout,
    isRestTimerActive,
    restTimeRemaining,
    setCurrentExercise,
    logSet,
    removeExercise,
    startRestTimer,
    stopRestTimer,
    tickRestTimer,
  } = useWorkoutStore();

  const [historicalBestSet, setHistoricalBestSet] = useState<BestSetResult | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Set current exercise on mount
  useEffect(() => {
    setCurrentExercise(exerciseIndex);
  }, [exerciseIndex]);

  // Fetch historical best set when exercise changes
  useEffect(() => {
    const fetchHistoricalData = async () => {
      const currentEx = activeWorkout?.exercises[exerciseIndex];
      if (!currentEx || !user?.id) {
        setHistoricalBestSet(null);
        return;
      }

      const bestSet = await getBestSetFromRecentWorkouts(user.id, currentEx.exercise.id, 3);
      setHistoricalBestSet(bestSet);
    };

    fetchHistoricalData();
  }, [exerciseIndex, user?.id]);

  // Rest timer
  useEffect(() => {
    if (isRestTimerActive) {
      restTimerRef.current = setInterval(() => {
        tickRestTimer();
      }, 1000);
    } else {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    }

    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, [isRestTimerActive]);

  const currentExercise = activeWorkout?.exercises[exerciseIndex];

  const handleBack = () => {
    router.back();
  };

  const handleRemoveExercise = () => {
    if (!currentExercise) return;

    showAlert(
      'Remove Exercise',
      `Remove ${currentExercise.exercise.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeExercise(currentExercise.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleLogSet = (weight: number | null, reps: number) => {
    const result = logSet({
      weight,
      reps,
      userBodyweight: profile?.bodyweight_kg ?? 70,
    });

    return result;
  };

  if (!activeWorkout || !currentExercise) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerButton} />
          <Text style={styles.headerTitle}>
            Exercise
          </Text>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerButton}
            accessibilityLabel="Go back"
          >
            <CheckIcon />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Exercise not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleRemoveExercise}
          style={styles.headerButton}
          accessibilityLabel="Remove exercise"
        >
          <TrashIcon />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentExercise.exercise.name}
          </Text>
          <Text style={styles.headerSubtitle}>
            {currentExercise.exercise.muscle_group}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.headerButton}
          accessibilityLabel="Complete exercise"
        >
          <CheckIcon />
        </TouchableOpacity>
      </View>

      {/* Rest Timer */}
      <RestTimer
        timeRemaining={restTimeRemaining}
        isActive={isRestTimerActive}
        onStop={stopRestTimer}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Exercise Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {currentExercise.sets.length}
            </Text>
            <Text style={styles.statLabel}>sets</Text>
          </View>
        </View>

        {/* Completed Sets */}
        {currentExercise.sets.length > 0 && (
          <View style={styles.completedSets}>
            <Text style={styles.completedTitle}>
              Completed Sets
            </Text>
            {currentExercise.sets.map((set, index) => (
              <View
                key={set.id}
                style={styles.completedSet}
              >
                <Text style={styles.setNumber}>
                  {index + 1}
                </Text>
                <Text style={styles.setDetails}>
                  {set.isBodyweight
                    ? `${set.reps} reps`
                    : `${set.weight}${weightUnit} × ${set.reps}`}
                </Text>
                {set.isPR && (
                  <View style={styles.prBadge}>
                    <StarIcon />
                    <Text style={styles.prText}>PR</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Set Logger */}
        <SetLogger
          exerciseName={currentExercise.exercise.name}
          exerciseType={currentExercise.exercise.exercise_type as 'weighted' | 'bodyweight'}
          setNumber={currentExercise.sets.length + 1}
          previousWeight={
            currentExercise.sets.length > 0
              ? currentExercise.sets[currentExercise.sets.length - 1].weight || undefined
              : undefined
          }
          previousReps={
            currentExercise.sets.length > 0
              ? currentExercise.sets[currentExercise.sets.length - 1].reps
              : undefined
          }
          historicalWeight={
            historicalBestSet
              ? weightUnit === 'lbs'
                ? kgToLbs(historicalBestSet.weight)
                : historicalBestSet.weight
              : undefined
          }
          historicalReps={historicalBestSet?.reps}
          onLogSet={handleLogSet}
          onStartRest={startRestTimer}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
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
  headerButton: {
    padding: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    gap: 24,
    backgroundColor: colors.bgSecondary,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  completedSets: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  completedTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
    color: colors.textSecondary,
  },
  completedSet: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: colors.bgSecondary,
  },
  setNumber: {
    width: 24,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});
