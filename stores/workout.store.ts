import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Exercise } from '@/types/database';
import {
  ExerciseBaselineData,
  POINTS_CONFIG,
  GoalBucket,
  checkForPR,
} from '@/lib/points-engine';

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

  startRestTimer: (seconds: number) => void;
  stopRestTimer: () => void;
  tickRestTimer: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
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
}));
