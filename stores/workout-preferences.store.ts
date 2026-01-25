import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_WORKOUT_EXERCISES, getDefaultExerciseNames } from '@/constants/default-workouts';

interface WorkoutExercisePreferences {
  // Maps workout type (e.g., 'Push', 'Pull') to user's selected exercise names
  [workoutType: string]: string[];
}

interface WorkoutPreferencesState {
  // User's customized exercise lists for default workouts
  exercisePreferences: WorkoutExercisePreferences;

  // Get exercises for a workout type (user's preferences or defaults)
  getExercisesForWorkout: (workoutType: string) => string[];

  // Update exercises for a workout type
  setExercisesForWorkout: (workoutType: string, exercises: string[]) => void;

  // Reset a workout type to its defaults
  resetWorkoutToDefaults: (workoutType: string) => void;

  // Check if a workout has been customized
  isWorkoutCustomized: (workoutType: string) => boolean;
}

export const useWorkoutPreferencesStore = create<WorkoutPreferencesState>()(
  persist(
    (set, get) => ({
      exercisePreferences: {},

      getExercisesForWorkout: (workoutType: string) => {
        const { exercisePreferences } = get();
        // Return user's preferences if they exist, otherwise return defaults
        if (exercisePreferences[workoutType]) {
          return exercisePreferences[workoutType];
        }
        return getDefaultExerciseNames(workoutType);
      },

      setExercisesForWorkout: (workoutType: string, exercises: string[]) => {
        set((state) => ({
          exercisePreferences: {
            ...state.exercisePreferences,
            [workoutType]: exercises,
          },
        }));
      },

      resetWorkoutToDefaults: (workoutType: string) => {
        set((state) => {
          const newPreferences = { ...state.exercisePreferences };
          delete newPreferences[workoutType];
          return { exercisePreferences: newPreferences };
        });
      },

      isWorkoutCustomized: (workoutType: string) => {
        const { exercisePreferences } = get();
        return !!exercisePreferences[workoutType];
      },
    }),
    {
      name: 'workout-preferences-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
