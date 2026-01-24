import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  FlatList,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { showAlert } from '@/lib/alert';
import { colors } from '@/constants/Colors';
import { useWorkoutStore } from '@/stores/workout.store';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { getUserMuscleLevels } from '@/services/baseline.service';
import { fetchExercisesFromDatabase, saveWorkoutToDatabase } from '@/services/workout.service';
import { DEFAULT_EXERCISES } from '@/constants/exercises';
import { MuscleLevelBadge } from '@/components/workout/MuscleLevelBadge';
import ExercisePicker from '@/components/workout/ExercisePicker';
import { Exercise, MuscleLevel } from '@/types/database';
import { GoalBucket } from '@/lib/points-engine';
import {
  xpForMuscleLevel,
  MUSCLE_XP_CONFIG,
  calculateMuscleDecay,
  estimateExerciseXpGains,
  EstimatedMuscleXpGain,
} from '@/lib/muscle-xp';
import { AnimatedMuscleSection } from '@/components/workout/AnimatedMuscleSection';
import { getRecommendedExercises, getEquipmentType, EquipmentType } from '@/services/recommendation.service';

const DECK_LIMIT = 15; // Max exercises shown in deck view

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_GAP = 12;

// Map workout type to muscle groups (same as ExercisePicker)
const WORKOUT_MUSCLE_MAP: Record<string, string[]> = {
  'Push Day': ['Chest', 'Shoulders', 'Triceps'],
  'Pull Day': ['Back', 'Biceps', 'Forearms'],
  'Leg Day': ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'],
  'Full Body': [], // Empty means all exercises
};

// Get muscle groups for a workout name
function getWorkoutMuscleGroups(workoutName: string): string[] {
  for (const [key, muscles] of Object.entries(WORKOUT_MUSCLE_MAP)) {
    if (workoutName.toLowerCase().includes(key.toLowerCase().split(' ')[0])) {
      return muscles;
    }
  }
  return [];
}

// Map exercise muscle groups to the muscle_levels table format (lowercase)
const MUSCLE_GROUP_MAP: Record<string, string> = {
  'Chest': 'chest',
  'Back': 'upper back',
  'Upper Back': 'upper back',
  'Lower Back': 'lower back',
  'Shoulders': 'shoulders',
  'Biceps': 'biceps',
  'Triceps': 'triceps',
  'Forearms': 'forearms',
  'Core': 'core',
  'Quadriceps': 'quads',
  'Quads': 'quads',
  'Hamstrings': 'hamstrings',
  'Glutes': 'glutes',
  'Calves': 'calves',
};

// Get up to 3 muscles for an exercise (primary + secondary for compounds)
function getExerciseMuscles(exercise: Exercise): string[] {
  const muscles: string[] = [];
  const primary = MUSCLE_GROUP_MAP[exercise.muscle_group] || exercise.muscle_group.toLowerCase();
  muscles.push(primary);

  // For compound exercises, add secondary muscles (simplified mapping)
  if (exercise.is_compound) {
    const name = exercise.name.toLowerCase();
    if (name.includes('bench') || name.includes('push')) {
      if (!muscles.includes('triceps')) muscles.push('triceps');
      if (!muscles.includes('shoulders')) muscles.push('shoulders');
    } else if (name.includes('row') || name.includes('pull')) {
      if (!muscles.includes('biceps')) muscles.push('biceps');
    } else if (name.includes('squat') || name.includes('leg press')) {
      if (!muscles.includes('glutes')) muscles.push('glutes');
      if (!muscles.includes('hamstrings')) muscles.push('hamstrings');
    } else if (name.includes('deadlift')) {
      if (!muscles.includes('hamstrings')) muscles.push('hamstrings');
      if (!muscles.includes('glutes')) muscles.push('glutes');
    } else if (name.includes('shoulder press') || name.includes('overhead')) {
      if (!muscles.includes('triceps')) muscles.push('triceps');
    }
  }

  return muscles.slice(0, 3);
}

// Display names for muscle groups
const MUSCLE_DISPLAY_NAMES: Record<string, string> = {
  'chest': 'Chest',
  'upper back': 'Upper Back',
  'lower back': 'Lower Back',
  'shoulders': 'Shoulders',
  'biceps': 'Biceps',
  'triceps': 'Triceps',
  'forearms': 'Forearms',
  'core': 'Core',
  'quads': 'Quadriceps',
  'hamstrings': 'Hamstrings',
  'glutes': 'Glutes',
  'calves': 'Calves',
};


// Custom SVG Icons
function PlusIcon({ size = 28, color = colors.textPrimary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M5 12H19" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ListIcon({ size = 24, color = colors.textPrimary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6H21" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 12H21" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 18H21" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 6H3.01" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 12H3.01" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 18H3.01" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function GridIcon({ size = 24, color = colors.textPrimary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 3H10V10H3V3Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 3H21V10H14V3Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 14H21V21H14V14Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 14H10V21H3V14Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function ExerciseDeckScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; goal?: string }>();

  // Always use dark theme
  const isDark = true;

  const { user, profile, refreshUserStats } = useAuthStore();
  const { weightUnit } = useSettingsStore();
  const { activeWorkout, startWorkout, addExercise, cancelWorkout, endWorkout, markExerciseCompleted } = useWorkoutStore();

  const [muscleLevels, setMuscleLevels] = useState<MuscleLevel[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'deck' | 'list'>('deck');
  const [searchQuery, setSearchQuery] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Animation state for exercise completion
  const [completingExerciseId, setCompletingExerciseId] = useState<string | null>(null);
  const returningFromExerciseRef = useRef<{ exerciseId: string; index: number } | null>(null);
  const completingCardIndexRef = useRef<number>(0);

  // Muscle XP animation state
  const [animatingCardId, setAnimatingCardId] = useState<string | null>(null);
  const [muscleXpGains, setMuscleXpGains] = useState<EstimatedMuscleXpGain[]>([]);
  const [pendingCompletion, setPendingCompletion] = useState<{
    exerciseId: string;
    index: number;
  } | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const listViewRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const workoutName = params.name || 'Workout';
  const goalMode = params.goal as 'Strength' | 'Hypertrophy' | 'Endurance' | undefined;

  const [isInitialized, setIsInitialized] = useState(false);

  // Elapsed time timer
  useEffect(() => {
    if (activeWorkout) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeWorkout]);

  // Get muscle groups for this workout type (defined early for use in handleExerciseComplete)
  const workoutMuscleGroups = useMemo(() => {
    return getWorkoutMuscleGroups(workoutName);
  }, [workoutName]);

  // Handle exercise completion - mark complete and scroll to next
  const handleExerciseComplete = useCallback((exerciseId: string, cardIndex: number) => {
    if (!activeWorkout || !profile?.id) return;

    // Get the completed exercise's sets
    const exerciseItem = activeWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exerciseItem) return;

    // Mark exercise as completed (card darkens)
    markExerciseCompleted(exerciseId);

    setCompletingExerciseId(exerciseId);
    completingCardIndexRef.current = cardIndex;

    // Find next non-completed card index to scroll to
    const nextIndex = activeWorkout.exercises.findIndex(
      (ex, idx) => idx > cardIndex && !ex.isCompleted && ex.id !== exerciseId
    );

    // Try to add a new exercise to the deck
    const exercisesInDeck = new Set(activeWorkout.exercises.map(ex => ex.exercise.id));
    const availableExercises = exercises.filter(ex => {
      // Not already in deck
      if (exercisesInDeck.has(ex.id)) return false;
      // Matches workout muscle groups (if specified)
      if (workoutMuscleGroups.length > 0) {
        return workoutMuscleGroups.some(
          muscle => ex.muscle_group.toLowerCase() === muscle.toLowerCase()
        );
      }
      return true;
    });

    if (availableExercises.length > 0) {
      // Pick a random available exercise
      const randomExercise = availableExercises[Math.floor(Math.random() * availableExercises.length)];
      addExercise(randomExercise);
    }

    // Scroll to next card after a short delay
    setTimeout(() => {
      if (flatListRef.current) {
        if (nextIndex >= 0) {
          const offset = nextIndex * (CARD_WIDTH + CARD_GAP);
          flatListRef.current.scrollToOffset({ offset, animated: true });
          setCurrentIndex(nextIndex);
        } else {
          // No more non-completed cards after this one, scroll to newly added card (end)
          const newIndex = activeWorkout.exercises.length;
          const offset = newIndex * (CARD_WIDTH + CARD_GAP);
          flatListRef.current.scrollToOffset({ offset, animated: true });
          setCurrentIndex(newIndex);
        }
      }
      setCompletingExerciseId(null);
    }, 300);
  }, [activeWorkout, profile?.id, markExerciseCompleted, exercises, workoutMuscleGroups, addExercise]);

  // Get muscle data by group name (with decay applied)
  const getMuscleData = useCallback((muscleGroup: string) => {
    const found = muscleLevels.find(
      m => m.muscle_group.toLowerCase() === muscleGroup.toLowerCase()
    );

    const storedLevel = found?.current_level || 0;
    const storedXp = found?.current_xp || 0;
    const lastTrainedAt = found?.last_trained_at || null;

    // Calculate XP progress as percentage (0-1)
    const xpNeeded = storedLevel >= MUSCLE_XP_CONFIG.MAX_LEVEL
      ? 0
      : xpForMuscleLevel(storedLevel + 1);
    const storedProgress = xpNeeded > 0 ? storedXp / xpNeeded : 0;

    // Apply decay
    const decay = calculateMuscleDecay(storedLevel, storedProgress, lastTrainedAt);

    return {
      level: decay.effectiveLevel,
      progress: decay.effectiveProgress,
      isDecaying: decay.decayStatus === 'decaying' || decay.decayStatus === 'resting',
    };
  }, [muscleLevels]);

  // Handle muscle XP animation completion - update local state and trigger completion
  const handleMuscleXpAnimationComplete = useCallback((gains: EstimatedMuscleXpGain[]) => {
    setAnimatingCardId(null);

    // Update local muscleLevels state with new XP values so all cards reflect the change
    if (gains.length > 0) {
      setMuscleLevels(prevLevels => {
        const updated = [...prevLevels];
        gains.forEach(gain => {
          const index = updated.findIndex(
            m => m.muscle_group.toLowerCase() === gain.muscleGroup.toLowerCase()
          );
          if (index >= 0) {
            // Update existing muscle level
            const xpForNextLevel = gain.endLevel >= MUSCLE_XP_CONFIG.MAX_LEVEL
              ? 0
              : xpForMuscleLevel(gain.endLevel + 1);
            updated[index] = {
              ...updated[index],
              current_level: gain.endLevel,
              current_xp: Math.round(gain.endProgress * xpForNextLevel),
              last_trained_at: new Date().toISOString(),
            };
          } else {
            // Add new muscle entry
            const xpForNextLevel = gain.endLevel >= MUSCLE_XP_CONFIG.MAX_LEVEL
              ? 0
              : xpForMuscleLevel(gain.endLevel + 1);
            updated.push({
              id: `temp-${gain.muscleGroup}`,
              user_id: profile?.id || '',
              muscle_group: gain.muscleGroup,
              current_level: gain.endLevel,
              current_xp: Math.round(gain.endProgress * xpForNextLevel),
              total_xp_earned: gain.xpGained,
              last_trained_at: new Date().toISOString(),
              decay_applied_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        });
        return updated;
      });
    }

    if (pendingCompletion) {
      const { exerciseId, index } = pendingCompletion;
      setPendingCompletion(null);
      handleExerciseComplete(exerciseId, index);
    }
  }, [pendingCompletion, handleExerciseComplete, profile?.id]);

  // Detect returning from exercise screen
  useFocusEffect(
    useCallback(() => {
      // Check if we're returning from an exercise
      if (returningFromExerciseRef.current && activeWorkout) {
        const { exerciseId, index } = returningFromExerciseRef.current;
        const exerciseItem = activeWorkout.exercises.find(ex => ex.id === exerciseId);

        // Only trigger completion if exercise has sets (user actually logged something)
        if (exerciseItem && exerciseItem.sets.length > 0 && !exerciseItem.isCompleted) {
          // Get muscles worked by this exercise
          const muscles = getExerciseMuscles(exerciseItem.exercise);

          // Count sets and PRs
          const setCount = exerciseItem.sets.length;
          const prCount = exerciseItem.sets.filter(s => s.isPR).length;

          // Build current levels map from muscleLevels state
          const currentLevelsMap = new Map<string, { level: number; progress: number }>();
          muscles.forEach(muscle => {
            const data = getMuscleData(muscle);
            currentLevelsMap.set(muscle.toLowerCase(), {
              level: data.level,
              progress: data.progress,
            });
          });

          // Calculate estimated XP gains
          const gains = estimateExerciseXpGains(muscles, setCount, prCount, currentLevelsMap);

          // Small delay to let the screen settle before animation
          setTimeout(() => {
            if (gains.length > 0) {
              // Show muscle XP animation on the card, then complete
              setMuscleXpGains(gains);
              setPendingCompletion({ exerciseId, index });
              setAnimatingCardId(exerciseId);
            } else {
              // No muscles to animate, go straight to completion
              handleExerciseComplete(exerciseId, index);
            }
          }, 100);
        }

        // Clear the ref
        returningFromExerciseRef.current = null;
      }
    }, [activeWorkout, handleExerciseComplete, getMuscleData])
  );

  // Load muscle levels
  useEffect(() => {
    async function loadMuscleLevels() {
      if (!profile?.id) return;
      const levels = await getUserMuscleLevels(profile.id);
      setMuscleLevels(levels);
    }
    loadMuscleLevels();
  }, [profile?.id]);

  // Initialize workout on mount
  useEffect(() => {
    if (!activeWorkout && !isInitialized) {
      const goal: GoalBucket = goalMode || 'Hypertrophy';
      startWorkout(workoutName, goal);
    }
  }, [activeWorkout, workoutName, goalMode, isInitialized]);

  // Load exercises and populate deck based on workout type with recommendations
  useEffect(() => {
    async function loadAndPopulateDeck() {
      // Wait for workout to be initialized and user to be logged in
      if (!activeWorkout || isInitialized || !profile?.id) return;

      const dbExercises = await fetchExercisesFromDatabase();

      // Convert local exercises to Exercise format
      const localExercises: Exercise[] = DEFAULT_EXERCISES.map((ex, index) => ({
        id: `local-${index}`,
        name: ex.name,
        description: ex.description,
        exercise_type: ex.exerciseType,
        muscle_group: ex.muscleGroup,
        equipment: ex.equipment,
        is_compound: ex.isCompound,
        created_by: null,
        is_public: true,
        created_at: new Date().toISOString(),
      }));

      // Merge: database takes precedence
      const dbNames = new Set(dbExercises.map(e => e.name.toLowerCase()));
      const allExercises = [
        ...dbExercises,
        ...localExercises.filter(e => !dbNames.has(e.name.toLowerCase())),
      ];

      // Store all exercises for list view
      setExercises(allExercises);

      // Get recommended exercises using the recommendation engine
      const recommended = await getRecommendedExercises(
        profile.id,
        allExercises,
        workoutMuscleGroups,
        [], // No completed exercises yet
        DECK_LIMIT
      );

      // Add recommended exercises to the deck
      recommended.forEach(exercise => {
        addExercise(exercise);
      });

      setIsInitialized(true);
    }

    loadAndPopulateDeck();
  }, [activeWorkout, workoutMuscleGroups, isInitialized, addExercise, profile?.id]);

  // Handle exercise selection from picker
  const handleSelectExercise = useCallback((exercise: Exercise) => {
    addExercise(exercise);
    setShowExercisePicker(false);
    // Scroll to the new card
    const newIndex = (activeWorkout?.exercises.length || 0);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
      setCurrentIndex(newIndex);
    }, 100);
  }, [addExercise, activeWorkout?.exercises.length]);

  // Handle starting an exercise
  const handleStartExercise = useCallback((index: number) => {
    const exerciseItem = activeWorkout?.exercises[index];
    if (exerciseItem) {
      // Track which exercise we're navigating to
      returningFromExerciseRef.current = { exerciseId: exerciseItem.id, index };
    }
    router.push(`/workout/exercise?index=${index}`);
  }, [router, activeWorkout]);

  // Handle cancel workout
  const handleCancel = useCallback(() => {
    showAlert(
      'Cancel Workout',
      'Are you sure you want to cancel? All progress will be lost.',
      [
        { text: 'Keep Working', style: 'cancel' },
        {
          text: 'Cancel Workout',
          style: 'destructive',
          onPress: () => {
            cancelWorkout();
            router.replace('/(tabs)');
          },
        },
      ]
    );
  }, [cancelWorkout, router]);

  // Handle finish workout
  const handleFinish = useCallback(() => {
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
              const saveResult = await saveWorkoutToDatabase({
                userId: user.id,
                workoutId: finishedWorkout.id,
                name: finishedWorkout.name,
                goal: finishedWorkout.goal,
                startedAt: finishedWorkout.startedAt,
                completedAt,
                durationSeconds: elapsedTime,
                exercises: finishedWorkout.exercises,
                totalVolume: finishedWorkout.totalVolume,
                weightUnit,
              });

              if (!saveResult.success) {
                console.error('Failed to save workout:', saveResult.error);
              }

              await refreshUserStats();

              // Navigate to summary
              router.replace({
                pathname: '/workout/summary',
                params: {
                  totalSets: finishedWorkout.exercises
                    .reduce((sum, ex) => sum + ex.sets.length, 0)
                    .toString(),
                  duration: elapsedTime.toString(),
                  exerciseCount: finishedWorkout.exercises
                    .filter(ex => ex.sets.length > 0)
                    .length.toString(),
                },
              });
            }
            setIsSaving(false);
          },
        },
      ]
    );
  }, [activeWorkout, user, endWorkout, elapsedTime, weightUnit, refreshUserStats, router]);

  // Toggle between deck and list view, preserving position
  const handleToggleView = useCallback(() => {
    if (viewMode === 'deck') {
      setViewMode('list');
      // Scroll list to current deck position after render
      setTimeout(() => {
        if (listViewRef.current && currentIndex > 0) {
          listViewRef.current.scrollToIndex({ index: currentIndex, animated: false });
        }
      }, 50);
    } else {
      setViewMode('deck');
      setSearchQuery('');
      // Scroll deck to current position after render
      setTimeout(() => {
        if (flatListRef.current && currentIndex > 0) {
          flatListRef.current.scrollToIndex({ index: currentIndex, animated: false });
        }
      }, 50);
    }
  }, [viewMode, currentIndex]);

  // Track current card index on scroll
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Card data from active workout
  const deckExercises = activeWorkout?.exercises || [];

  // Filter exercises by search query (for list view - shows full pool)
  const filteredListExercises = useMemo(() => {
    // Filter all exercises by workout type first
    let filtered: Exercise[];
    if (workoutMuscleGroups.length === 0) {
      filtered = exercises;
    } else {
      filtered = exercises.filter(ex =>
        workoutMuscleGroups.some(muscle =>
          ex.muscle_group.toLowerCase() === muscle.toLowerCase()
        )
      );
    }

    // Then filter by search query
    if (!searchQuery.trim()) return filtered;
    const query = searchQuery.toLowerCase();
    return filtered.filter(exercise =>
      exercise.name.toLowerCase().includes(query) ||
      exercise.muscle_group.toLowerCase().includes(query)
    );
  }, [exercises, workoutMuscleGroups, searchQuery]);

  // Get deck exercise index by exercise ID (returns -1 if not in deck)
  const getDeckIndex = useCallback((exerciseId: string): number => {
    return deckExercises.findIndex(item => item.exercise.id === exerciseId);
  }, [deckExercises]);

  // Get deck exercise data (sets) if in deck
  const getDeckExerciseData = useCallback((exerciseId: string) => {
    const deckItem = deckExercises.find(item => item.exercise.id === exerciseId);
    if (!deckItem) return null;
    return {
      setsCompleted: deckItem.sets.length,
    };
  }, [deckExercises]);

  const renderCard = useCallback(({ item, index }: { item: any; index: number }) => {
    const exercise = item.exercise as Exercise;
    const muscles = getExerciseMuscles(exercise);
    const setsCompleted = item.sets.length;
    const equipmentType = getEquipmentType(exercise.equipment, exercise.exercise_type);
    const isCompleted = item.isCompleted;

    // Get best set for PR display
    const bestSet = item.sets.length > 0
      ? item.sets.reduce((best: any, set: any) => {
          const setVolume = (set.weight || 0) * set.reps;
          const bestVolume = (best.weight || 0) * best.reps;
          return setVolume > bestVolume ? set : best;
        }, item.sets[0])
      : null;

    return (
      <View
        style={[
          styles.card,
          isCompleted && styles.cardCompleted,
        ]}
      >
        {/* Equipment Badge - Top Right */}
        <View style={[
          styles.equipmentBadge,
          isCompleted && { opacity: 0.5 },
        ]}>
          <Text style={styles.equipmentBadgeText}>
            {equipmentType}
          </Text>
        </View>

        {/* Fixed Header Section */}
        <View style={[styles.cardHeader, isCompleted && { opacity: 0.4 }]}>
          {/* Exercise Name - single line with truncation */}
          <Text
            style={styles.exerciseName}
            numberOfLines={1}
          >
            {exercise.name}
          </Text>

          {/* Stats Row: PR | Total Sets */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Best</Text>
              <Text style={styles.statValue}>
                {bestSet
                  ? bestSet.isBodyweight
                    ? `${bestSet.reps} reps`
                    : `${bestSet.weight}${weightUnit} × ${bestSet.reps}`
                  : '—'}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Sets</Text>
              <Text style={[styles.statValue, { fontVariant: ['tabular-nums'] }]}>
                {setsCompleted}
              </Text>
            </View>
          </View>
        </View>

        {/* Fixed Muscle Section */}
        <View style={[styles.muscleSection, isCompleted && { opacity: 0.4 }]}>
          <AnimatedMuscleSection
            muscles={muscles.map(muscle => {
              const data = getMuscleData(muscle);
              return {
                muscle,
                level: data.level,
                progress: data.progress,
                isDecaying: data.isDecaying,
              };
            })}
            isAnimating={animatingCardId === item.id}
            animationGains={animatingCardId === item.id ? muscleXpGains : null}
            onAnimationComplete={handleMuscleXpAnimationComplete}
            isDark={isDark}
          />
        </View>

        {/* Start Exercise Button or Completed State */}
        {isCompleted ? (
          <TouchableOpacity
            style={styles.completedButton}
            onPress={() => handleStartExercise(index)}
            activeOpacity={0.8}
          >
            <Text style={styles.completedButtonText}>✓ Completed</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => handleStartExercise(index)}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>Start Exercise</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [getMuscleData, handleStartExercise, weightUnit, animatingCardId, muscleXpGains, handleMuscleXpAnimationComplete]);

  // Handle starting an exercise from the list view
  const handleStartFromList = useCallback((exercise: Exercise) => {
    let deckIndex = getDeckIndex(exercise.id);

    // If exercise is not in deck, add it first
    if (deckIndex === -1) {
      addExercise(exercise);
      // The new exercise will be at the end of the deck
      deckIndex = deckExercises.length;
    }

    // Navigate to the exercise
    router.push(`/workout/exercise?index=${deckIndex}`);
  }, [getDeckIndex, addExercise, deckExercises.length, router]);

  // Render list view row (shows full pool of exercises)
  const renderListRow = useCallback(({ item }: { item: Exercise }) => {
    const exercise = item;
    const equipmentType = getEquipmentType(exercise.equipment, exercise.exercise_type);
    const deckData = getDeckExerciseData(exercise.id);

    return (
      <View style={styles.listRow}>
        <TouchableOpacity
          style={styles.listRowContent}
          onPress={() => {
            const deckIndex = getDeckIndex(exercise.id);
            if (deckIndex >= 0) {
              setCurrentIndex(deckIndex);
              setViewMode('deck');
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: deckIndex, animated: false });
              }, 50);
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.listRowLeft}>
            <View style={styles.listRowNameRow}>
              <Text style={styles.listRowName} numberOfLines={1}>
                {exercise.name}
              </Text>
            </View>
            <View style={styles.listRowMeta}>
              <Text style={styles.listRowMuscle}>
                {exercise.muscle_group}
              </Text>
              <Text style={styles.listRowDot}>•</Text>
              <Text style={styles.listRowEquipment}>
                {equipmentType}
              </Text>
            </View>
          </View>
          <View style={styles.listRowRight}>
            {deckData && deckData.setsCompleted > 0 && (
              <View style={styles.listRowStats}>
                <Text style={styles.listRowSets}>
                  {deckData.setsCompleted} {deckData.setsCompleted === 1 ? 'set' : 'sets'}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.listRowStartButton}
          onPress={() => handleStartFromList(exercise)}
          activeOpacity={0.8}
        >
          <Text style={styles.listRowStartText}>Start</Text>
        </TouchableOpacity>
      </View>
    );
  }, [getDeckExerciseData, getDeckIndex, handleStartFromList]);

  // Render Add Exercise row at top of list
  const renderListHeader = useCallback(() => (
    <TouchableOpacity
      style={styles.addExerciseRow}
      onPress={() => setShowExercisePicker(true)}
      activeOpacity={0.7}
    >
      <View style={styles.addExerciseIcon}>
        <PlusIcon size={20} color={colors.textPrimary} />
      </View>
      <Text style={styles.addExerciseText}>
        Add Exercise
      </Text>
    </TouchableOpacity>
  ), []);

  // Empty state when no exercises in deck
  const renderEmptyState = () => (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>
        No exercises yet
      </Text>
      <Text style={styles.emptySubtitle}>
        Tap the + button to add your first exercise
      </Text>
      <TouchableOpacity
        style={styles.addFirstButton}
        onPress={() => setShowExercisePicker(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.addFirstButtonText}>Add Exercise</Text>
      </TouchableOpacity>
    </View>
  );

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setShowExercisePicker(true)}
          activeOpacity={0.7}
          accessibilityLabel="Add exercise"
        >
          <PlusIcon size={28} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.workoutName}>
            {workoutName}
          </Text>
          {goalMode && (
            <Text style={styles.goalBadge}>
              {goalMode}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleToggleView}
          activeOpacity={0.7}
          accessibilityLabel={viewMode === 'deck' ? 'Switch to list view' : 'Switch to deck view'}
        >
          {viewMode === 'deck' ? <ListIcon size={24} /> : <GridIcon size={24} />}
        </TouchableOpacity>
      </View>

      {/* Timer */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerLabel}>
          Duration
        </Text>
        <Text style={styles.timerValue}>
          {formatTime(elapsedTime)}
        </Text>
      </View>

      {/* Exercise Deck or List View */}
      {viewMode === 'deck' ? (
        <View style={styles.deckContainer}>
          {deckExercises.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              ref={flatListRef}
              data={deckExercises}
              renderItem={renderCard}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={styles.deckContent}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={(_, index) => ({
                length: CARD_WIDTH + CARD_GAP,
                offset: (CARD_WIDTH + CARD_GAP) * index,
                index,
              })}
            />
          )}
        </View>
      ) : (
        <View style={styles.listContainer}>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <SearchIcon />
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercises..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Exercise List */}
          <FlatList
            ref={listViewRef}
            data={filteredListExercises}
            renderItem={renderListRow}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.listEmpty}>
                <Text style={styles.listEmptyText}>
                  {searchQuery ? 'No exercises match your search' : 'No exercises yet'}
                </Text>
              </View>
            }
            getItemLayout={(_, index) => ({
              length: 72,
              offset: 72 * (index + 1), // +1 for header
              index,
            })}
          />
        </View>
      )}

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          activeOpacity={0.7}
          disabled={isSaving}
        >
          <Text style={styles.cancelButtonText}>
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.finishButton, isSaving && styles.finishButtonDisabled]}
          onPress={handleFinish}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          <Text style={styles.finishButtonText}>
            {isSaving ? 'Saving...' : 'Finish'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Exercise Picker Modal */}
      <ExercisePicker
        visible={showExercisePicker}
        onClose={() => setShowExercisePicker(false)}
        onSelectExercise={handleSelectExercise}
        workoutName={workoutName}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    gap: 4,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  goalBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  // Timer
  timerContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
    color: colors.textSecondary,
  },
  timerValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  // Deck
  deckContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  deckContent: {
    paddingHorizontal: 24,
  },
  // Card
  card: {
    width: CARD_WIDTH,
    marginRight: CARD_GAP,
    borderRadius: 20,
    padding: 20,
    height: 500,
    backgroundColor: colors.bgSecondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardCompleted: {
    opacity: 0.7,
  },
  completedButton: {
    backgroundColor: colors.textMuted,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  completedButtonText: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  equipmentBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
    backgroundColor: colors.bgTertiary,
  },
  equipmentBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  // Card Header Section - Fixed height
  cardHeader: {
    height: 95,
    marginBottom: 16,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 28,
    marginBottom: 10,
    lineHeight: 22,
    paddingRight: 90,
    color: colors.textPrimary,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: 2,
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  // Muscle Section - Fixed position
  muscleSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  // Muscle Cards (like progress screen)
  muscleCards: {
    gap: 8,
  },
  muscleCard: {
    padding: 10,
    borderRadius: 10,
  },
  muscleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  muscleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  muscleIcon: {
    fontSize: 18,
  },
  muscleName: {
    fontSize: 15,
    fontWeight: '600',
  },
  progressContainer: {
    gap: 4,
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  progressFillMax: {
    backgroundColor: colors.warning,
  },
  progressFillResting: {
    backgroundColor: colors.textMuted,
  },
  // Start Button
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  startButtonText: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  // Empty State
  emptyCard: {
    marginHorizontal: 24,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    backgroundColor: colors.bgSecondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  addFirstButton: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  addFirstButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  // Footer
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  finishButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  finishButtonDisabled: {
    opacity: 0.6,
  },
  finishButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // List View
  listContainer: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: colors.bgSecondary,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    marginLeft: 8,
    color: colors.textPrimary,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '300',
    color: colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  addExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    backgroundColor: colors.bgSecondary,
  },
  addExerciseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addExerciseText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: colors.bgSecondary,
  },
  listRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 12,
  },
  listRowLeft: {
    flex: 1,
    marginRight: 8,
  },
  listRowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  listRowName: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
    color: colors.textPrimary,
  },
  listRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listRowMuscle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  listRowDot: {
    fontSize: 10,
    color: colors.textMuted,
  },
  listRowEquipment: {
    fontSize: 12,
    color: colors.textMuted,
  },
  listRowRight: {
    alignItems: 'flex-end',
  },
  listRowStats: {
    alignItems: 'flex-end',
  },
  listRowSets: {
    fontSize: 12,
    marginBottom: 2,
    color: colors.textSecondary,
  },
  listRowStartButton: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  listRowStartText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  listEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  listEmptyText: {
    fontSize: 15,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});
