import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { v4 as uuidv4 } from 'uuid';
import { showAlert } from '@/lib/alert';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useWorkoutStore } from '@/stores/workout.store';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore, getWeightIncrement } from '@/stores/settings.store';
import { getBestSetFromRecentWorkouts, BestSetResult } from '@/services/workout.service';
import SetRow from '@/components/workout/SetRow';
import RestTimer from '@/components/workout/RestTimer';
import { colors } from '@/constants/Colors';

// Local set state for editing
interface LocalSet {
  id: string;
  weight: string;
  reps: string;
  isWarmup: boolean;
  isNew: boolean;
}

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

function MinusIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12H19" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function PlusIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M5 12H19" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export default function ExerciseDetailScreenV2() {
  const router = useRouter();
  const params = useLocalSearchParams<{ index: string }>();
  const exerciseIndex = parseInt(params.index || '0', 10);

  const user = useAuthStore(s => s.user);
  const profile = useAuthStore(s => s.profile);
  const weightUnit = useSettingsStore(s => s.weightUnit);
  const weightIncrement = getWeightIncrement(weightUnit);
  const activeWorkout = useWorkoutStore(s => s.activeWorkout);
  const isRestTimerActive = useWorkoutStore(s => s.isRestTimerActive);
  const restTimeRemaining = useWorkoutStore(s => s.restTimeRemaining);
  const setCurrentExercise = useWorkoutStore(s => s.setCurrentExercise);
  const saveSetsForExercise = useWorkoutStore(s => s.saveSetsForExercise);
  const removeExercise = useWorkoutStore(s => s.removeExercise);
  const startRestTimer = useWorkoutStore(s => s.startRestTimer);
  const stopRestTimer = useWorkoutStore(s => s.stopRestTimer);
  const tickRestTimer = useWorkoutStore(s => s.tickRestTimer);

  const [localSets, setLocalSets] = useState<LocalSet[]>([]);
  const [historicalBestSet, setHistoricalBestSet] = useState<BestSetResult | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentExercise = activeWorkout?.exercises[exerciseIndex];
  const isBodyweight = currentExercise?.exercise.exercise_type === 'bodyweight';

  // Set current exercise on mount
  useEffect(() => {
    setCurrentExercise(exerciseIndex);
  }, [exerciseIndex]);

  // Initialize local sets from store on mount
  useEffect(() => {
    if (!currentExercise) return;

    if (currentExercise.sets.length > 0) {
      // Initialize from existing sets
      setLocalSets(
        currentExercise.sets.map((set) => ({
          id: set.id,
          weight: set.weight?.toString() || '',
          reps: set.reps.toString(),
          isWarmup: set.setType === 'warmup',
          isNew: false,
        }))
      );
    } else {
      // Start with one empty row
      setLocalSets([
        { id: uuidv4(), weight: '', reps: '', isWarmup: false, isNew: true },
      ]);
    }
  }, [currentExercise?.id]);

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

  // Derived state
  const workingSetsCount = localSets.length;
  const filledSets = localSets.filter((s) => s.weight || s.reps);
  const showHelper = filledSets.length === 0;

  // Handlers for Working Sets Stepper
  const handleIncrementSets = () => {
    setLocalSets((prev) => [
      ...prev,
      { id: uuidv4(), weight: '', reps: '', isWarmup: false, isNew: true },
    ]);
  };

  const handleDecrementSets = () => {
    if (localSets.length === 0) return;

    const lastSet = localSets[localSets.length - 1];
    const hasData = lastSet.weight || lastSet.reps;

    if (!hasData) {
      // Remove immediately
      setLocalSets((prev) => prev.slice(0, -1));
    } else {
      // Show confirmation
      showAlert(
        'Remove Set?',
        `Remove Set ${localSets.length}? This will delete its details.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              setLocalSets((prev) => prev.slice(0, -1));
            },
          },
        ]
      );
    }
  };

  // Handler for Add Set button
  const handleAddSet = () => {
    handleIncrementSets();
  };

  // Handler for Copy Previous
  const handleCopyPrevious = () => {
    if (localSets.length < 2) return;
    const prevSet = localSets[localSets.length - 2];
    setLocalSets((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        weight: prevSet.weight,
        reps: prevSet.reps,
      };
      return updated;
    });
  };

  // Handler for Repeat Last
  const handleRepeatLast = () => {
    if (localSets.length === 0) return;
    const lastSet = localSets[localSets.length - 1];
    setLocalSets((prev) => [
      ...prev,
      {
        id: uuidv4(),
        weight: lastSet.weight,
        reps: lastSet.reps,
        isWarmup: false,
        isNew: true,
      },
    ]);
  };

  // Set row handlers
  const updateSet = (index: number, field: 'weight' | 'reps' | 'isWarmup', value: string | boolean) => {
    setLocalSets((prev) => {
      const updated = [...prev];
      if (field === 'isWarmup') {
        updated[index] = { ...updated[index], isWarmup: value as boolean };
      } else {
        updated[index] = { ...updated[index], [field]: value as string };
      }
      return updated;
    });
  };

  // Navigation handlers
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

  // Finish Exercise - save all sets
  const handleFinish = () => {
    if (!currentExercise) {
      router.back();
      return;
    }

    // Filter to sets with data
    const setsToSave = localSets.filter((s) => s.reps);

    // Convert to save format
    const saveSets = setsToSave.map((s) => ({
      id: s.id,
      weight: isBodyweight ? null : (parseFloat(s.weight) || null),
      reps: parseInt(s.reps, 10) || 0,
      isWarmup: s.isWarmup,
    }));

    // Save to store
    const result = saveSetsForExercise({
      exerciseIndex,
      sets: saveSets,
      userBodyweight: profile?.bodyweight_kg ?? 70,
    });

    // Start rest timer if sets were logged
    if (saveSets.length > 0) {
      startRestTimer(90);
    }

    router.back();
  };

  if (!activeWorkout || !currentExercise) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerButton} />
          <Text style={styles.headerTitle}>Exercise</Text>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerButton}
            accessibilityLabel="Go back"
          >
            <CheckIcon />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Exercise not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
            onPress={handleFinish}
            style={styles.headerButton}
            accessibilityLabel="Finish exercise"
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

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Working Sets Stepper */}
          <View style={styles.stepperCard}>
            <Text style={styles.stepperLabel}>Working Sets</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperButton, workingSetsCount === 0 && styles.stepperButtonDisabled]}
                onPress={handleDecrementSets}
                disabled={workingSetsCount === 0}
                accessibilityLabel="Decrease set count"
              >
                <MinusIcon />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{workingSetsCount}</Text>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={handleIncrementSets}
                accessibilityLabel="Increase set count"
              >
                <PlusIcon />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sets Table */}
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colSet]}>SET</Text>
              {!isBodyweight && (
                <Text style={[styles.tableHeaderText, styles.colWeight]}>WEIGHT</Text>
              )}
              <Text style={[styles.tableHeaderText, styles.colReps]}>REPS</Text>
              <Text style={[styles.tableHeaderText, styles.colWarmup]}>W</Text>
            </View>

            {/* Set Rows */}
            {localSets.map((set, index) => (
              <SetRow
                key={set.id}
                setNumber={index + 1}
                weight={set.weight}
                reps={set.reps}
                isWarmup={set.isWarmup}
                isBodyweight={isBodyweight}
                weightUnit={weightUnit}
                weightIncrement={weightIncrement}
                onWeightChange={(value) => updateSet(index, 'weight', value)}
                onRepsChange={(value) => updateSet(index, 'reps', value)}
                onWarmupToggle={() => updateSet(index, 'isWarmup', !set.isWarmup)}
              />
            ))}

            {/* Empty State */}
            {localSets.length === 0 && (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyRowText}>
                  Tap + to add your first set
                </Text>
              </View>
            )}
          </View>

          {/* Speed Controls */}
          <View style={styles.speedControls}>
            <TouchableOpacity
              style={styles.speedButton}
              onPress={handleAddSet}
              accessibilityLabel="Add set"
            >
              <Text style={styles.speedButtonText}>+ Add Set</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.speedButton, localSets.length < 2 && styles.speedButtonDisabled]}
              onPress={handleCopyPrevious}
              disabled={localSets.length < 2}
              accessibilityLabel="Copy previous set"
            >
              <Text style={[styles.speedButtonText, localSets.length < 2 && styles.speedButtonTextDisabled]}>
                Copy Previous
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.speedButton, localSets.length === 0 && styles.speedButtonDisabled]}
              onPress={handleRepeatLast}
              disabled={localSets.length === 0}
              accessibilityLabel="Repeat last set"
            >
              <Text style={[styles.speedButtonText, localSets.length === 0 && styles.speedButtonTextDisabled]}>
                Repeat
              </Text>
            </TouchableOpacity>
          </View>

          {/* Helper Text */}
          {showHelper && (
            <View style={styles.helperContainer}>
              <Text style={styles.helperText}>
                Log 1-2 top sets to boost Progression.
              </Text>
            </View>
          )}

          {/* Historical Reference */}
          {historicalBestSet && (
            <View style={styles.historyCard}>
              <Text style={styles.historyLabel}>Recent Best</Text>
              <Text style={styles.historyValue}>
                {isBodyweight
                  ? `${historicalBestSet.reps} reps`
                  : `${Math.round(historicalBestSet.weight)}${weightUnit} × ${historicalBestSet.reps}`}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Finish Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.finishButton}
            onPress={handleFinish}
            accessibilityLabel="Finish exercise"
          >
            <Text style={styles.finishButtonText}>Finish Exercise</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  keyboardView: {
    flex: 1,
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
    paddingBottom: 20,
  },
  // Stepper Card
  stepperCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
  },
  stepperLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    fontSize: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    minWidth: 50,
    textAlign: 'center',
  },
  // Table
  tableContainer: {
    marginHorizontal: 20,
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  colSet: {
    width: 28,
    textAlign: 'center',
  },
  colWeight: {
    flex: 1,
    textAlign: 'center',
  },
  colReps: {
    flex: 1,
    textAlign: 'center',
  },
  colWarmup: {
    width: 36,
    textAlign: 'center',
  },
  emptyRow: {
    padding: 20,
    alignItems: 'center',
  },
  emptyRowText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  // Speed Controls
  speedControls: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    gap: 8,
  },
  speedButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
  },
  speedButtonDisabled: {
    opacity: 0.5,
  },
  speedButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  speedButtonTextDisabled: {
    color: colors.textMuted,
  },
  // Helper
  helperContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 10,
    backgroundColor: colors.accent + '15',
  },
  helperText: {
    fontSize: 14,
    color: colors.accent,
    textAlign: 'center',
  },
  // History Card
  historyCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 10,
    backgroundColor: colors.bgSecondary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  historyValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  finishButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  finishButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
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
