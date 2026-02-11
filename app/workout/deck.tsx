import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import { showAlert } from '@/lib/alert';
import { colors } from '@/constants/Colors';
import { useWorkoutStore } from '@/stores/workout.store';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore, lbsToKg, kgToLbs } from '@/stores/settings.store';
import { saveWorkoutToDatabase, getTopRecentSetsForExercise, calculateE1RM, RecentTopSet, getUserTopAndRecentExercises } from '@/services/workout.service';
import { syncAndFetchExercises, clearExerciseCache, deleteCustomExercise } from '@/services/exercise-sync.service';
import ExercisePicker from '@/components/workout/ExercisePicker';
import ExerciseLogPopup, { DetailedSet } from '@/components/workout/ExerciseLogPopup';
import { Exercise } from '@/types/database';
import { GoalBucket } from '@/lib/points-engine';
import { getRecommendedExercises, getEquipmentType } from '@/services/recommendation.service';
import { useWorkoutPreferencesStore } from '@/stores/workout-preferences.store';

// Self-contained timer — isolates per-second re-renders from the parent
function DeckTimer({ startedAt, elapsedRef }: { startedAt: Date; elapsedRef: React.MutableRefObject<number> }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const e = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      setElapsed(e);
      elapsedRef.current = e;
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const formatted = hrs > 0
    ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${mins}:${secs.toString().padStart(2, '0')}`;

  return <Text style={deckTimerStyle}>{formatted}</Text>;
}

const deckTimerStyle = {
  fontSize: 36,
  fontWeight: '800' as const,
  color: colors.textPrimary,
  fontVariant: ['tabular-nums' as const],
};

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

  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const profile = useAuthStore(s => s.profile);
  const refreshUserStats = useAuthStore(s => s.refreshUserStats);
  const weightUnit = useSettingsStore(s => s.weightUnit);
  const activeWorkout = useWorkoutStore(s => s.activeWorkout);
  const startWorkout = useWorkoutStore(s => s.startWorkout);
  const addExercise = useWorkoutStore(s => s.addExercise);
  const cancelWorkout = useWorkoutStore(s => s.cancelWorkout);
  const endWorkout = useWorkoutStore(s => s.endWorkout);
  const markExerciseCompleted = useWorkoutStore(s => s.markExerciseCompleted);
  const saveSetsForExercise = useWorkoutStore(s => s.saveSetsForExercise);
  const logSimpleSets = useWorkoutStore(s => s.logSimpleSets);
  const removeExercise = useWorkoutStore(s => s.removeExercise);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'deck' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const elapsedRef = useRef(0);

  // Popup state for quick logging from list view
  const [logPopupVisible, setLogPopupVisible] = useState(false);
  const [logPopupExercise, setLogPopupExercise] = useState<Exercise | null>(null);

  // Draft sets per exercise — survives popup open/close for superset support
  const [draftSets, setDraftSets] = useState<Map<string, DetailedSet[]>>(new Map());

  // Animation state for exercise completion
  const [completingExerciseId, setCompletingExerciseId] = useState<string | null>(null);
  const returningFromExerciseRef = useRef<{ exerciseId: string; index: number } | null>(null);
  const completingCardIndexRef = useRef<number>(0);

  // Recent sets data for each exercise (keyed by exercise.id)
  const [recentSetsMap, setRecentSetsMap] = useState<Map<string, RecentTopSet[]>>(new Map());

  // User's prioritized exercises (top by usage + recent)
  const [prioritizedExerciseIds, setPrioritizedExerciseIds] = useState<Set<string>>(new Set());

  const flatListRef = useRef<FlatList>(null);
  const listViewRef = useRef<FlatList>(null);

  const workoutName = params.name || 'Workout';
  const goalMode = params.goal as 'Strength' | 'Hypertrophy' | 'Endurance' | undefined;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  // Detect returning from exercise screen and mark as complete
  useFocusEffect(
    useCallback(() => {
      if (returningFromExerciseRef.current && activeWorkout) {
        const { exerciseId, index } = returningFromExerciseRef.current;
        const exerciseItem = activeWorkout.exercises.find(ex => ex.id === exerciseId);

        // Only trigger completion if exercise has sets (user actually logged something)
        if (exerciseItem && exerciseItem.sets.length > 0 && !exerciseItem.isCompleted) {
          // Small delay to let the screen settle
          setTimeout(() => {
            handleExerciseComplete(exerciseId, index);
          }, 100);
        }

        // Clear the ref
        returningFromExerciseRef.current = null;
      }
    }, [activeWorkout, handleExerciseComplete])
  );

  // Get workout preferences
  const getExercisesForWorkout = useWorkoutPreferencesStore(s => s.getExercisesForWorkout);

  // Get workout type from workout name (e.g., "Push Day" -> "Push")
  const workoutType = useMemo(() => {
    const name = workoutName.toLowerCase();
    if (name.includes('push')) return 'Push';
    if (name.includes('pull')) return 'Pull';
    if (name.includes('leg')) return 'Legs';
    if (name.includes('full')) return 'Full Body';
    return '';
  }, [workoutName]);

  // Combined initialization effect - handles full flow in proper sequence
  useEffect(() => {
    async function initializeWorkout() {
      // Guard: Already initialized
      if (isInitialized) {
        setIsLoading(false);
        return;
      }

      // Guard: Need profile to load personalized deck
      if (!profile?.id) {
        console.log('[Deck] Waiting for profile...');
        return;
      }

      // Step 1: Start workout if needed
      if (!activeWorkout) {
        console.log('[Deck] Starting workout...');
        const goal: GoalBucket = goalMode || 'Hypertrophy';
        startWorkout(workoutName, goal);
        // Don't continue - wait for next render with activeWorkout
        return;
      }

      // Step 2: Load exercises
      console.log('[Deck] Loading exercises...');
      setIsLoading(true);

      // Clear cache to ensure fresh data on new workout
      clearExerciseCache();
      const allExercises = await syncAndFetchExercises();

      console.log(`[Deck] Loaded ${allExercises.length} exercises`);
      setExercises(allExercises);

      // Step 2.5: Fetch user's top and recent exercises for prioritization
      const { topExerciseIds, recentExerciseIds } = await getUserTopAndRecentExercises(
        profile.id,
        workoutMuscleGroups,
        10,
        5
      );
      const prioritizedIds = new Set([...topExerciseIds, ...recentExerciseIds]);
      setPrioritizedExerciseIds(prioritizedIds);
      console.log(`[Deck] Prioritized ${prioritizedIds.size} exercises (${topExerciseIds.length} top + ${recentExerciseIds.length} recent)`);

      // Step 3: Populate deck with preferred + recommended exercises
      const preferredExerciseNames = workoutType ? getExercisesForWorkout(workoutType) : [];

      // Find matching exercises from the pool
      const preferredExercises = preferredExerciseNames
        .map(name => {
          const nameLower = name.toLowerCase();
          return allExercises.find(ex => ex.name.toLowerCase() === nameLower);
        })
        .filter((ex): ex is Exercise => ex !== undefined);

      // Add preferred exercises first
      const addedNames = new Set<string>();
      preferredExercises.forEach(exercise => {
        addExercise(exercise);
        addedNames.add(exercise.name.toLowerCase());
      });

      // If we need more exercises to fill the deck, get recommendations
      const remainingSlots = DECK_LIMIT - preferredExercises.length;
      if (remainingSlots > 0) {
        const recommended = await getRecommendedExercises(
          profile.id,
          allExercises.filter(ex => !addedNames.has(ex.name.toLowerCase())),
          workoutMuscleGroups,
          [], // No completed exercises yet
          remainingSlots
        );

        // Add recommended exercises to fill remaining slots
        recommended.forEach(exercise => {
          addExercise(exercise);
        });
      }

      setIsInitialized(true);
      setIsLoading(false);
      console.log('[Deck] Initialization complete');
    }

    initializeWorkout();
  }, [profile?.id, activeWorkout, isInitialized, workoutName, goalMode, workoutType, workoutMuscleGroups, addExercise, getExercisesForWorkout, startWorkout]);

  // Fetch recent sets for exercises in the deck
  useEffect(() => {
    async function fetchRecentSets() {
      if (!activeWorkout || !user?.id) return;

      const newMap = new Map(recentSetsMap);
      let hasChanges = false;

      for (const exerciseItem of activeWorkout.exercises) {
        const exerciseId = exerciseItem.exercise.id;
        // Skip if we already have data for this exercise
        if (newMap.has(exerciseId)) continue;

        const recentSets = await getTopRecentSetsForExercise(user.id, exerciseId, 14, 5);
        newMap.set(exerciseId, recentSets);
        hasChanges = true;
      }

      if (hasChanges) {
        setRecentSetsMap(newMap);
      }
    }

    fetchRecentSets();
  }, [activeWorkout?.exercises.length, user?.id]);

  // Handle exercise selection from picker
  const handleSelectExercise = useCallback((exercise: Exercise) => {
    addExercise(exercise);
    setShowExercisePicker(false);
    // Open log popup after the picker modal fully dismisses
    setTimeout(() => {
      setLogPopupExercise(exercise);
      setLogPopupVisible(true);
    }, 400);
  }, [addExercise]);

  // Handle starting an exercise
  const handleStartExercise = useCallback((index: number) => {
    const exerciseItem = activeWorkout?.exercises[index];
    if (exerciseItem) {
      // Track which exercise we're navigating to
      returningFromExerciseRef.current = { exerciseId: exerciseItem.id, index };
    }
    router.push(`/workout/exercise-v2?index=${index}`);
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
                durationSeconds: elapsedRef.current,
                exercises: finishedWorkout.exercises,
                totalVolume: finishedWorkout.totalVolume,
                weightUnit,
              });

              if (!saveResult.success) {
                console.error('Failed to save workout:', saveResult.error);
              }

              // Invalidate cached queries so next workout setup shows fresh data
              queryClient.invalidateQueries({ queryKey: ['topExercises'] });
              queryClient.invalidateQueries({ queryKey: ['workoutTypeStats'] });

              await refreshUserStats();

              // Navigate to summary with all workout data
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
                  totalVolume: Math.round(finishedWorkout.totalVolume).toString(),
                  totalSets: finishedWorkout.exercises
                    .reduce((sum, ex) => sum + ex.sets.length, 0)
                    .toString(),
                  duration: elapsedRef.current.toString(),
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
  }, [activeWorkout, user, endWorkout, weightUnit, refreshUserStats, router]);

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

  // Filter and organize exercises for list view
  // Returns { prioritized: Exercise[], rest: Exercise[] }
  const organizedListExercises = useMemo(() => {
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

      // Ensure exercises in the active workout always appear, even if muscle group doesn't match
      const filteredIds = new Set(filtered.map(ex => ex.id));
      const deckExerciseIds = new Set(deckExercises.map(item => item.exercise.id));
      const missing = exercises.filter(
        ex => deckExerciseIds.has(ex.id) && !filteredIds.has(ex.id)
      );
      if (missing.length > 0) {
        filtered = [...filtered, ...missing];
      }
    }

    // Apply search query if present
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(exercise =>
        exercise.name.toLowerCase().includes(query) ||
        exercise.muscle_group.toLowerCase().includes(query)
      );
    }

    // Split into prioritized and rest
    const prioritized: Exercise[] = [];
    const rest: Exercise[] = [];

    for (const exercise of filtered) {
      if (prioritizedExerciseIds.has(exercise.id)) {
        prioritized.push(exercise);
      } else {
        rest.push(exercise);
      }
    }

    // Sort: completed exercises sink to bottom, alphabetical within each group
    const isExerciseCompleted = (id: string) =>
      deckExercises.find(item => item.exercise.id === id)?.isCompleted ?? false;

    const sortWithCompletedLast = (a: Exercise, b: Exercise) => {
      const ac = isExerciseCompleted(a.id);
      const bc = isExerciseCompleted(b.id);
      if (ac !== bc) return ac ? 1 : -1;
      return a.name.localeCompare(b.name);
    };

    prioritized.sort(sortWithCompletedLast);
    rest.sort(sortWithCompletedLast);

    return { prioritized, rest };
  }, [exercises, workoutMuscleGroups, searchQuery, prioritizedExerciseIds, deckExercises]);

  // Combined list with divider marker for FlatList
  type ListItem = Exercise | { type: 'divider' };
  const listDataWithDivider = useMemo((): ListItem[] => {
    const { prioritized, rest } = organizedListExercises;
    const items: ListItem[] = [...prioritized];

    // Only add divider if we have both sections
    if (prioritized.length > 0 && rest.length > 0) {
      items.push({ type: 'divider' });
    }

    items.push(...rest);
    return items;
  }, [organizedListExercises]);

  // Get deck exercise index by exercise ID (returns -1 if not in deck)
  const getDeckIndex = useCallback((exerciseId: string): number => {
    return deckExercises.findIndex(item => item.exercise.id === exerciseId);
  }, [deckExercises]);

  // Get deck exercise data (sets, completion status) if in deck
  const getDeckExerciseData = useCallback((exerciseId: string) => {
    const deckItem = deckExercises.find(item => item.exercise.id === exerciseId);
    if (!deckItem) return null;
    return {
      setsCompleted: deckItem.sets.length,
      isCompleted: deckItem.isCompleted,
    };
  }, [deckExercises]);

  // Format date for recent sets display
  const formatSetDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderCard = useCallback(({ item, index }: { item: any; index: number }) => {
    const exercise = item.exercise as Exercise;
    const muscles = getExerciseMuscles(exercise);
    const setsCompleted = item.sets.length;
    const equipmentType = getEquipmentType(exercise.equipment, exercise.exercise_type);
    const isCompleted = item.isCompleted;
    const isBodyweight = exercise.exercise_type === 'bodyweight';

    // Get best set by e1RM from current workout
    const bestSet = item.sets.length > 0
      ? item.sets.reduce((best: any, set: any) => {
          const setE1RM = calculateE1RM(set.weight || 0, set.reps);
          const bestE1RM = calculateE1RM(best.weight || 0, best.reps);
          return setE1RM > bestE1RM ? set : best;
        }, item.sets[0])
      : null;

    // Get recent top sets for this exercise
    const recentSets = recentSetsMap.get(exercise.id) || [];

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

          {/* Stats Row: Best Set | Total Sets */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Best Set</Text>
              <Text style={styles.statValue}>
                {bestSet
                  ? isBodyweight
                    ? `${bestSet.reps} reps`
                    : `${bestSet.weight}${weightUnit} × ${bestSet.reps}`
                  : '—'}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Sets</Text>
              <Text style={[styles.statValue, { fontVariant: ['tabular-nums'] }]}>
                {setsCompleted}
              </Text>
            </View>
          </View>
        </View>

        {/* Muscle Tags */}
        <View style={[styles.muscleTagsContainer, isCompleted && { opacity: 0.4 }]}>
          {muscles.map((muscle, idx) => (
            <View key={idx} style={styles.muscleTag}>
              <Text style={styles.muscleTagText}>
                {MUSCLE_DISPLAY_NAMES[muscle] || muscle}
              </Text>
            </View>
          ))}
        </View>

        {/* Top Recent Sets Section */}
        <View style={[styles.recentSetsSection, isCompleted && { opacity: 0.4 }]}>
          <Text style={styles.recentSetsTitle}>Top Recent Sets (14 days)</Text>
          {recentSets.length > 0 ? (
            <View style={styles.recentSetsList}>
              {recentSets.slice(0, 4).map((set, idx) => (
                <View key={idx} style={styles.recentSetRow}>
                  <Text style={styles.recentSetWeight}>
                    {isBodyweight
                      ? `${set.reps} reps`
                      : `${Math.round(set.weight)}${weightUnit} × ${set.reps}`}
                  </Text>
                  <Text style={styles.recentSetDate}>
                    {formatSetDate(set.date)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.recentSetsEmpty}>No recent data</Text>
          )}
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
  }, [handleStartExercise, weightUnit, recentSetsMap]);

  // Handle starting an exercise from the list view - opens popup
  const handleStartFromList = useCallback((exercise: Exercise) => {
    setLogPopupExercise(exercise);

    // Priority: draft > completed sets > fresh
    const draft = draftSets.get(exercise.id);
    if (draft) {
      setLogPopupVisible(true);
      return;
    }

    // Check for completed exercise with saved sets — convert to draft for editing
    const deckItem = deckExercises.find(item => item.exercise.id === exercise.id);
    if (deckItem?.isCompleted && deckItem.sets.length > 0) {
      const isDumbbell = exercise.equipment?.some(e => e.toLowerCase() === 'dumbbell') ?? false;
      const converted: DetailedSet[] = deckItem.sets.map(s => {
        let displayWeight = '';
        if (s.weight !== null && s.weight !== undefined) {
          const inUnit = weightUnit === 'lbs' ? kgToLbs(s.weight) : s.weight;
          const perHand = isDumbbell ? inUnit / 2 : inUnit;
          displayWeight = Math.round(perHand).toString();
        }
        return { id: s.id, reps: s.reps > 0 ? s.reps.toString() : '', weight: displayWeight, isComplete: true, isEdited: true };
      });
      setDraftSets(prev => new Map(prev).set(exercise.id, converted));
    }

    setLogPopupVisible(true);
  }, [draftSets, deckExercises, weightUnit]);

  // Handle finishing an exercise from the popup
  const handleFinishExerciseFromPopup = useCallback((
    setCount: number,
    detailedSets?: DetailedSet[]
  ) => {
    if (!logPopupExercise || !profile) return;

    // Get or add exercise to deck
    let deckIndex = getDeckIndex(logPopupExercise.id);
    if (deckIndex === -1) {
      addExercise(logPopupExercise);
      deckIndex = deckExercises.length;
    }

    // Need to wait a tick for the exercise to be added to the store
    setTimeout(() => {
      const currentDeckIndex = deckIndex === deckExercises.length ? deckIndex : deckIndex;

      const exerciseIsDumbbell = logPopupExercise.equipment?.some(
        (e: string) => e.toLowerCase() === 'dumbbell'
      ) ?? false;

      if (detailedSets && detailedSets.some(s => s.reps || s.weight)) {
        // Detailed logging - convert DetailedSet[] to the format saveSetsForExercise expects
        const setsToSave = detailedSets
          .filter(s => s.reps || s.weight) // Only save sets with data
          .map((s, i) => {
            let weightKg: number | null = null;
            if (s.weight) {
              const parsed = parseFloat(s.weight);
              // Convert from display unit to kg
              const inKg = weightUnit === 'lbs' ? lbsToKg(parsed) : parsed;
              // Double for dumbbells (user enters per-hand, we store total)
              weightKg = exerciseIsDumbbell ? inKg * 2 : inKg;
            }
            return {
              id: s.id,
              weight: weightKg,
              reps: parseInt(s.reps) || 0,
              isWarmup: false,
            };
          });

        if (setsToSave.length > 0) {
          saveSetsForExercise({
            exerciseIndex: currentDeckIndex,
            sets: setsToSave,
            userBodyweight: profile.bodyweight_kg || 70,
          });
        }
      } else {
        // Simple count-only logging
        logSimpleSets({
          exerciseIndex: currentDeckIndex,
          setCount,
        });
      }

      // Mark exercise completed — read fresh state (closure's activeWorkout is stale)
      const freshWorkout = useWorkoutStore.getState().activeWorkout;
      const freshItem = freshWorkout?.exercises.find(
        ex => ex.exercise.id === logPopupExercise.id
      );
      if (freshItem) {
        markExerciseCompleted(freshItem.id);
      }

      // Clear draft for this exercise
      if (logPopupExercise) {
        setDraftSets(prev => {
          const next = new Map(prev);
          next.delete(logPopupExercise.id);
          return next;
        });
      }

      // Close popup
      setLogPopupVisible(false);
      setLogPopupExercise(null);
    }, 50);
  }, [logPopupExercise, profile, getDeckIndex, addExercise, deckExercises.length, saveSetsForExercise, logSimpleSets, markExerciseCompleted]);

  // Render list view row (shows full pool of exercises) or divider
  const renderListItem = useCallback(({ item }: { item: ListItem }) => {
    // Check if it's a divider
    if ('type' in item && item.type === 'divider') {
      return (
        <View style={styles.listDividerContainer}>
          <View style={styles.listDivider}>
            <View style={styles.listDividerLine} />
          </View>
          <Text style={styles.sectionHeader}>Other Exercises</Text>
        </View>
      );
    }

    const exercise = item as Exercise;
    const equipmentType = getEquipmentType(exercise.equipment, exercise.exercise_type);
    const deckData = getDeckExerciseData(exercise.id);
    const isCompleted = deckData?.isCompleted ?? false;
    const hasDraft = draftSets.has(exercise.id);

    return (
      <View style={[
        styles.listRow,
        isCompleted && styles.listRowCompleted,
      ]}>
        <TouchableOpacity
          style={styles.listRowContent}
          onPress={() => handleStartFromList(exercise)}
          activeOpacity={0.7}
        >
          <View style={styles.listRowLeft}>
            <View style={styles.listRowNameRow}>
              <Text style={[
                styles.listRowName,
                isCompleted && styles.listRowNameCompleted,
              ]} numberOfLines={1}>
                {exercise.name}
              </Text>
            </View>
            <View style={styles.listRowMeta}>
              <Text style={[
                styles.listRowMuscle,
                isCompleted && styles.listRowMetaCompleted,
              ]}>
                {exercise.muscle_group}
              </Text>
              <Text style={[
                styles.listRowDot,
                isCompleted && styles.listRowMetaCompleted,
              ]}>•</Text>
              <Text style={[
                styles.listRowEquipment,
                isCompleted && styles.listRowMetaCompleted,
              ]}>
                {equipmentType}
              </Text>
            </View>
          </View>
          <View style={styles.listRowRight}>
            {/* Hide set count for completed exercises */}
          </View>
        </TouchableOpacity>
        {isCompleted ? (
          <TouchableOpacity style={styles.listRowCompletedButton} onPress={() => handleStartFromList(exercise)} activeOpacity={0.8}>
            <Text style={styles.listRowCompletedText}>Completed</Text>
          </TouchableOpacity>
        ) : hasDraft ? (
          <TouchableOpacity style={styles.listRowInProgressButton} onPress={() => handleStartFromList(exercise)} activeOpacity={0.8}>
            <Text style={styles.listRowInProgressText}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.listRowStartButton}
            onPress={() => handleStartFromList(exercise)}
            activeOpacity={0.8}
          >
            <Text style={styles.listRowStartText}>Start</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [getDeckExerciseData, handleStartFromList, draftSets]);

  // Render Add Exercise row and Favorites header at top of list
  const renderListHeader = useCallback(() => (
    <View>
      <View style={styles.listRow}>
        <TouchableOpacity
          style={styles.addExerciseContent}
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
      </View>
      {organizedListExercises.prioritized.length > 0 && (
        <Text style={styles.sectionHeader}>Top Exercises</Text>
      )}
    </View>
  ), [organizedListExercises.prioritized.length]);

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

        {/* Toggle button hidden - keeping list view only */}
        <View style={styles.iconButton} />
      </View>

      {/* Timer */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerLabel}>
          Duration
        </Text>
        {activeWorkout && (
          <DeckTimer startedAt={activeWorkout.startedAt} elapsedRef={elapsedRef} />
        )}
      </View>

      {/* Exercise Deck or List View */}
      {isLoading ? (
        <View style={styles.deckContainer}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading exercises...</Text>
          </View>
        </View>
      ) : viewMode === 'deck' ? (
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
            data={listDataWithDivider}
            renderItem={renderListItem}
            keyExtractor={(item, index) => 'type' in item ? `divider-${index}` : item.id}
            ListHeaderComponent={renderListHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.listEmpty}>
                <Text style={styles.listEmptyText}>
                  {searchQuery ? 'No exercises match your search' : 'No exercises yet'}
                </Text>
              </View>
            }
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
        excludeExerciseIds={deckExercises.map(item => item.exercise.id)}
      />

      {/* Exercise Log Popup for quick logging from list view */}
      <ExerciseLogPopup
        visible={logPopupVisible}
        exercise={logPopupExercise}
        initialSets={logPopupExercise ? draftSets.get(logPopupExercise.id) : undefined}
        isEditing={
          logPopupExercise
            ? deckExercises.some(d => d.exercise.id === logPopupExercise.id && d.isCompleted)
            : false
        }
        onDraftSave={(sets) => {
          if (logPopupExercise) {
            setDraftSets(prev => new Map(prev).set(logPopupExercise.id, sets));
          }
          setLogPopupVisible(false);
          setLogPopupExercise(null);
        }}
        onClose={() => {
          setLogPopupVisible(false);
          setLogPopupExercise(null);
        }}
        onFinish={handleFinishExerciseFromPopup}
        onDelete={async (exerciseId) => {
          const success = await deleteCustomExercise(exerciseId);
          if (success) {
            removeExercise(exerciseId);
            setExercises(prev => prev.filter(ex => ex.id !== exerciseId));
            setLogPopupVisible(false);
            setLogPopupExercise(null);
          }
        }}
        weightUnit={weightUnit}
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
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
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
  // Muscle Tags
  muscleTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  muscleTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.bgTertiary,
  },
  muscleTagText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  // Recent Sets Section
  recentSetsSection: {
    flex: 1,
    backgroundColor: colors.bgTertiary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  recentSetsTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
  },
  recentSetsList: {
    gap: 6,
  },
  recentSetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentSetWeight: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  recentSetDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  recentSetsEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
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
  addExerciseContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: colors.bgSecondary,
  },
  listRowCompleted: {
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  listRowNameCompleted: {
    color: colors.textSecondary,
  },
  listRowMetaCompleted: {
    color: colors.textMuted,
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
  listRowCompletedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  listRowCompletedText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  listRowInProgressButton: {
    backgroundColor: colors.bgTertiary,
    borderWidth: 1,
    borderColor: colors.accentLight,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  listRowInProgressText: {
    color: colors.accentLight,
    fontSize: 13,
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
  listDividerContainer: {
    marginTop: 8,
  },
  listDivider: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  listDividerLine: {
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },
});
