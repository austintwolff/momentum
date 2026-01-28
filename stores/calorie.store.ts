import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface CalorieState {
  currentCalories: number;
  calorieGoal: number;
  lastUpdatedDate: string; // ISO date string (YYYY-MM-DD)
  selectedIncrement: 50 | 100 | 250;

  // Actions
  addCalories: () => void;
  subtractCalories: () => void;
  setSelectedIncrement: (increment: 50 | 100 | 250) => void;
  setCalorieGoal: (goal: number) => void;
  checkAndResetDaily: () => void;
}

function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

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

export const useCalorieStore = create<CalorieState>()(
  persist(
    (set, get) => ({
      currentCalories: 0,
      calorieGoal: 2500,
      lastUpdatedDate: getTodayDateString(),
      selectedIncrement: 100,

      addCalories: () => {
        const { selectedIncrement, currentCalories } = get();
        set({ currentCalories: currentCalories + selectedIncrement });
      },

      subtractCalories: () => {
        const { selectedIncrement, currentCalories } = get();
        set({ currentCalories: Math.max(0, currentCalories - selectedIncrement) });
      },

      setSelectedIncrement: (increment: 50 | 100 | 250) => {
        set({ selectedIncrement: increment });
      },

      setCalorieGoal: (goal: number) => {
        set({ calorieGoal: goal });
      },

      checkAndResetDaily: () => {
        const { lastUpdatedDate } = get();
        const today = getTodayDateString();

        if (lastUpdatedDate !== today) {
          set({
            currentCalories: 0,
            lastUpdatedDate: today,
          });
        }
      },
    }),
    {
      name: 'momentum-calories',
      storage: storage as any,
    }
  )
);
