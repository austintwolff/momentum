import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface CustomWorkout {
  id: string;
  name: string;
  muscleGroups: string[];
  exercises: string[]; // Exercise names
  createdAt: string;
}

interface CustomWorkoutState {
  customWorkouts: CustomWorkout[];
  addCustomWorkout: (name: string, muscleGroups: string[], exercises: string[]) => void;
  updateCustomWorkout: (id: string, name: string, muscleGroups: string[], exercises: string[]) => void;
  removeCustomWorkout: (id: string) => void;
}

// Storage adapter that works on both web and native
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

const storage = Platform.OS === 'web'
  ? webStorage
  : createJSONStorage(() => AsyncStorage);

export const useCustomWorkoutStore = create<CustomWorkoutState>()(
  persist(
    (set, get) => ({
      customWorkouts: [],

      addCustomWorkout: (name: string, muscleGroups: string[], exercises: string[]) => {
        const newWorkout: CustomWorkout = {
          id: `custom-${Date.now()}`,
          name,
          muscleGroups,
          exercises,
          createdAt: new Date().toISOString(),
        };
        set({ customWorkouts: [...get().customWorkouts, newWorkout] });
      },

      updateCustomWorkout: (id: string, name: string, muscleGroups: string[], exercises: string[]) => {
        set({
          customWorkouts: get().customWorkouts.map(w =>
            w.id === id ? { ...w, name, muscleGroups, exercises } : w
          ),
        });
      },

      removeCustomWorkout: (id: string) => {
        set({ customWorkouts: get().customWorkouts.filter(w => w.id !== id) });
      },
    }),
    {
      name: 'momentum-custom-workouts',
      storage: storage as any,
    }
  )
);
