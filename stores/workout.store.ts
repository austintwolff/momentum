import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { Exercise } from '@/types/database';
import {
  ExerciseBaselineData,
  POINTS_CONFIG,
  GoalBucket,
  checkForPR,
} from '@/lib/points-engine';

// Web storage adapter (same pattern as other stores)
const webStorage: StateStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(name, value);
    } catch {
      // Ignore storage errors
    }
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore storage errors
    }
  },
};

// Custom storage that handles Date and Map serialization
const baseStorage = Platform.OS === 'web'
  ? webStorage
  : (createJSONStorage(() => AsyncStorage) as unknown as StateStorage);

const workoutStorage: StateStorage = {
  getItem: async (name: string) => {
    const raw = await baseStorage.getItem(name);
    if (!raw) return raw;

    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const state = parsed?.state;
    if (!state?.activeWorkout) return raw;

    // Rehydrate Date fields
    if (state.activeWorkout.startedAt) {
      state.activeWorkout.startedAt = new Date(state.activeWorkout.startedAt);
    }

    // Rehydrate muscleSetsCount from plain object back to Map
    if (state.activeWorkout.muscleSetsCount && !(state.activeWorkout.muscleSetsCount instanceof Map)) {
      state.activeWorkout.muscleSetsCount = new Map(Object.entries(state.activeWorkout.muscleSetsCount));
    }

    // Rehydrate completedAt in sets
    for (const exercise of state.activeWorkout.exercises || []) {
      for (const set of exercise.sets || []) {
        if (set.completedAt) {
          set.completedAt = new Date(set.completedAt);
        }
      }
    }

    return typeof raw === 'string' ? JSON.stringify(parsed) : parsed;
  },
  setItem: async (name: string, value: string) => {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    const state = parsed?.state;

    if (state?.activeWorkout?.muscleSetsCount instanceof Map) {
      state.activeWorkout.muscleSetsCount = Object.fromEntries(state.activeWorkout.muscleSetsCount);
    }

    const serialized = typeof value === 'string' ? JSON.stringify(parsed) : parsed;
    return baseStorage.setItem(name, serialized);
  },
  removeItem: async (name: string) => {
    return baseStorage.removeItem(name);
  },
};

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  setType: 'warmup' | 'working' | 'dropset' | 'failure';
  weight: number | null;
  reps: number;
  isBodyweight: boolean;
  isPR: boolean;
  completedAt: Date;
  muscleGroups: string[];
}

export interface WorkoutExercise {
  id: string;
  exercise: Exercise;
  sets: WorkoutSet[];
  isCompleted: boolean;
}

interface ActiveWorkout {
  id: string;
  name: string;
  goal: GoalBucket;
  startedAt: Date;
  exercises: WorkoutExercise[];
  totalVolume: number;
  muscleSetsCount: Map<string, number>;
}

interface WorkoutState {
  activeWorkout: ActiveWorkout | null;
  currentExerciseIndex: number;
  isRestTimerActive: boolean;
  restTimeRemaining: number;
  exerciseBaselines: Map<string, ExerciseBaselineData>;

  // Actions
  startWorkout: (name: string, goal: GoalBucket) => void;
  endWorkout: () => ActiveWorkout | null;
  cancelWorkout: () => void;

  addExercise: (exercise: Exercise) => void;
  removeExercise: (exerciseId: string) => void;
  setCurrentExercise: (index: number) => void;
  markExerciseCompleted: (exerciseId: string) => void;

  setExerciseBaselines: (baselines: Map<string, ExerciseBaselineData>) => void;

  logSet: (params: {
    weight: number | null;
    reps: number;
    setType?: 'warmup' | 'working' | 'dropset' | 'failure';
    userBodyweight: number;
    muscleGroups?: string[];
  }) => { isPR: boolean } | null;

  saveSetsForExercise: (params: {
    exerciseIndex: number;
    sets: Array<{
      id: string;
      weight: number | null;
      reps: number;
      isWarmup: boolean;
    }>;
    userBodyweight: number;
  }) => { prCount: number };

  logSimpleSets: (params: {
    exerciseIndex: number;
    setCount: number;
  }) => void;

  startRestTimer: (seconds: number) => void;
  stopRestTimer: () => void;
  tickRestTimer: () => void;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
  activeWorkout: null,
  currentExerciseIndex: 0,
  isRestTimerActive: false,
  restTimeRemaining: 0,
  exerciseBaselines: new Map(),

  startWorkout: (name: string, goal: GoalBucket) => {
    set({
      activeWorkout: {
        id: uuidv4(),
        name,
        goal,
        startedAt: new Date(),
        exercises: [],
        totalVolume: 0,
        muscleSetsCount: new Map(),
      },
      currentExerciseIndex: 0,
      isRestTimerActive: false,
      restTimeRemaining: 0,
    });
  },

  endWorkout: () => {
    const { activeWorkout } = get();
    if (!activeWorkout) return null;

    const finalWorkout = { ...activeWorkout };

    set({
      activeWorkout: null,
      currentExerciseIndex: 0,
      isRestTimerActive: false,
      restTimeRemaining: 0,
    });

    return finalWorkout;
  },

  cancelWorkout: () => {
    set({
      activeWorkout: null,
      currentExerciseIndex: 0,
      isRestTimerActive: false,
      restTimeRemaining: 0,
    });
  },

  addExercise: (exercise: Exercise) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const workoutExercise: WorkoutExercise = {
      id: uuidv4(),
      exercise,
      sets: [],
      isCompleted: false,
    };

    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: [...activeWorkout.exercises, workoutExercise],
      },
      currentExerciseIndex: activeWorkout.exercises.length,
    });
  },

  removeExercise: (exerciseId: string) => {
    const { activeWorkout, currentExerciseIndex } = get();
    if (!activeWorkout) return;

    const newExercises = activeWorkout.exercises.filter(
      (ex) => ex.id !== exerciseId
    );

    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: newExercises,
      },
      currentExerciseIndex: Math.min(
        currentExerciseIndex,
        Math.max(0, newExercises.length - 1)
      ),
    });
  },

  setCurrentExercise: (index: number) => {
    set({ currentExerciseIndex: index });
  },

  markExerciseCompleted: (exerciseId: string) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;

    const updatedExercises = activeWorkout.exercises.map((ex) => {
      if (ex.id === exerciseId) {
        return { ...ex, isCompleted: true };
      }
      return ex;
    });

    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: updatedExercises,
      },
    });
  },

  setExerciseBaselines: (baselines: Map<string, ExerciseBaselineData>) => {
    set({ exerciseBaselines: baselines });
  },

  logSet: (params) => {
    const { activeWorkout, currentExerciseIndex, exerciseBaselines } = get();
    if (!activeWorkout || activeWorkout.exercises.length === 0) return null;

    const currentExercise = activeWorkout.exercises[currentExerciseIndex];
    if (!currentExercise) return null;

    const exercise = currentExercise.exercise;
    const isBodyweight = exercise.exercise_type === 'bodyweight';
    const primaryMuscle = exercise.muscle_group;

    const muscleGroups = params.muscleGroups?.length
      ? params.muscleGroups
      : [primaryMuscle];

    // Get baseline for PR detection
    const baseline = exerciseBaselines.get(exercise.id) || null;

    // Check for PR
    const effectiveWeight = isBodyweight
      ? params.userBodyweight * POINTS_CONFIG.BODYWEIGHT_FACTOR
      : (params.weight || 0);
    const prResult = checkForPR(effectiveWeight, params.reps, activeWorkout.goal, baseline);

    const newSet: WorkoutSet = {
      id: uuidv4(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setNumber: currentExercise.sets.length + 1,
      setType: params.setType || 'working',
      weight: params.weight,
      reps: params.reps,
      isBodyweight,
      isPR: prResult.isPR,
      completedAt: new Date(),
      muscleGroups,
    };

    // Calculate volume
    const setVolume = isBodyweight
      ? params.userBodyweight * POINTS_CONFIG.BODYWEIGHT_FACTOR * params.reps
      : (params.weight || 0) * params.reps;

    const updatedExercises = activeWorkout.exercises.map((ex, index) => {
      if (index === currentExerciseIndex) {
        return {
          ...ex,
          sets: [...ex.sets, newSet],
        };
      }
      return ex;
    });

    // Update muscle set counts
    const newMuscleSetsCount = new Map(activeWorkout.muscleSetsCount);
    for (const muscle of muscleGroups) {
      newMuscleSetsCount.set(muscle, (newMuscleSetsCount.get(muscle) || 0) + 1);
    }

    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: updatedExercises,
        totalVolume: activeWorkout.totalVolume + setVolume,
        muscleSetsCount: newMuscleSetsCount,
      },
    });

    return { isPR: prResult.isPR };
  },

  saveSetsForExercise: (params) => {
    const { activeWorkout, exerciseBaselines } = get();
    if (!activeWorkout || activeWorkout.exercises.length === 0) return { prCount: 0 };

    const currentExercise = activeWorkout.exercises[params.exerciseIndex];
    if (!currentExercise) return { prCount: 0 };

    const exercise = currentExercise.exercise;
    const isBodyweight = exercise.exercise_type === 'bodyweight';
    const primaryMuscle = exercise.muscle_group;
    const muscleGroups = [primaryMuscle];

    // Get baseline for PR detection
    const baseline = exerciseBaselines.get(exercise.id) || null;

    let prCount = 0;
    let totalVolumeAdded = 0;

    // Create new WorkoutSets from the provided sets
    const newSets: WorkoutSet[] = params.sets.map((set, index) => {
      // Check for PR (only for non-warmup sets)
      const effectiveWeight = isBodyweight
        ? params.userBodyweight * POINTS_CONFIG.BODYWEIGHT_FACTOR
        : (set.weight || 0);

      const prResult = !set.isWarmup
        ? checkForPR(effectiveWeight, set.reps, activeWorkout.goal, baseline)
        : { isPR: false };

      if (prResult.isPR) prCount++;

      // Calculate volume for this set
      const setVolume = isBodyweight
        ? params.userBodyweight * POINTS_CONFIG.BODYWEIGHT_FACTOR * set.reps
        : (set.weight || 0) * set.reps;

      totalVolumeAdded += setVolume;

      return {
        id: set.id,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        setNumber: index + 1,
        setType: set.isWarmup ? 'warmup' : 'working',
        weight: set.weight,
        reps: set.reps,
        isBodyweight,
        isPR: prResult.isPR,
        completedAt: new Date(),
        muscleGroups,
      };
    });

    // Update the exercise with new sets (replacing any existing sets)
    const updatedExercises = activeWorkout.exercises.map((ex, index) => {
      if (index === params.exerciseIndex) {
        return {
          ...ex,
          sets: newSets,
        };
      }
      return ex;
    });

    // Calculate the volume difference (new - old)
    const oldVolume = currentExercise.sets.reduce((sum, s) => {
      const vol = s.isBodyweight
        ? params.userBodyweight * POINTS_CONFIG.BODYWEIGHT_FACTOR * s.reps
        : (s.weight || 0) * s.reps;
      return sum + vol;
    }, 0);

    const volumeDiff = totalVolumeAdded - oldVolume;

    // Update muscle set counts (based on working sets only)
    const newMuscleSetsCount = new Map(activeWorkout.muscleSetsCount);
    const oldWorkingSetCount = currentExercise.sets.filter(s => s.setType !== 'warmup').length;
    const newWorkingSetCount = params.sets.filter(s => !s.isWarmup).length;
    const setCountDiff = newWorkingSetCount - oldWorkingSetCount;

    for (const muscle of muscleGroups) {
      const current = newMuscleSetsCount.get(muscle) || 0;
      newMuscleSetsCount.set(muscle, Math.max(0, current + setCountDiff));
    }

    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: updatedExercises,
        totalVolume: activeWorkout.totalVolume + volumeDiff,
        muscleSetsCount: newMuscleSetsCount,
      },
    });

    return { prCount };
  },

  logSimpleSets: (params) => {
    const { activeWorkout } = get();
    if (!activeWorkout || activeWorkout.exercises.length === 0) return;

    const currentExercise = activeWorkout.exercises[params.exerciseIndex];
    if (!currentExercise) return;

    const exercise = currentExercise.exercise;
    const isBodyweight = exercise.exercise_type === 'bodyweight';
    const primaryMuscle = exercise.muscle_group;
    const muscleGroups = [primaryMuscle];

    // Create simple WorkoutSets (null weight, 0 reps indicates count-only logging)
    const newSets: WorkoutSet[] = Array.from({ length: params.setCount }, (_, index) => ({
      id: uuidv4(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setNumber: index + 1,
      setType: 'working',
      weight: null,
      reps: 0,
      isBodyweight,
      isPR: false,
      completedAt: new Date(),
      muscleGroups,
    }));

    // Update the exercise with simple sets
    const updatedExercises = activeWorkout.exercises.map((ex, index) => {
      if (index === params.exerciseIndex) {
        return {
          ...ex,
          sets: newSets,
        };
      }
      return ex;
    });

    // Update muscle set counts
    const newMuscleSetsCount = new Map(activeWorkout.muscleSetsCount);
    const oldWorkingSetCount = currentExercise.sets.filter(s => s.setType !== 'warmup').length;
    const setCountDiff = params.setCount - oldWorkingSetCount;

    for (const muscle of muscleGroups) {
      const current = newMuscleSetsCount.get(muscle) || 0;
      newMuscleSetsCount.set(muscle, Math.max(0, current + setCountDiff));
    }

    set({
      activeWorkout: {
        ...activeWorkout,
        exercises: updatedExercises,
        muscleSetsCount: newMuscleSetsCount,
      },
    });
  },

  startRestTimer: (seconds: number) => {
    set({
      isRestTimerActive: true,
      restTimeRemaining: seconds,
    });
  },

  stopRestTimer: () => {
    set({
      isRestTimerActive: false,
      restTimeRemaining: 0,
    });
  },

  tickRestTimer: () => {
    const { restTimeRemaining, isRestTimerActive } = get();
    if (!isRestTimerActive) return;

    if (restTimeRemaining <= 1) {
      set({
        isRestTimerActive: false,
        restTimeRemaining: 0,
      });
    } else {
      set({
        restTimeRemaining: restTimeRemaining - 1,
      });
    }
  },
    }),
    {
      name: 'momentum-active-workout',
      storage: workoutStorage as any,
      partialize: (state) => ({
        activeWorkout: state.activeWorkout,
        currentExerciseIndex: state.currentExerciseIndex,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.activeWorkout?.startedAt) {
          const age = Date.now() - state.activeWorkout.startedAt.getTime();
          if (age > 24 * 60 * 60 * 1000) {
            state.activeWorkout = null;
            state.currentExerciseIndex = 0;
          }
        }
      },
    }
  )
);
