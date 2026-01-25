import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface ProteinState {
  currentProtein: number;
  proteinGoal: number;
  lastUpdatedDate: string; // ISO date string (YYYY-MM-DD)
  selectedIncrement: 5 | 10 | 25;

  // Actions
  addProtein: () => void;
  subtractProtein: () => void;
  setSelectedIncrement: (increment: 5 | 10 | 25) => void;
  setProteinGoal: (goal: number) => void;
  checkAndResetDaily: () => void;
}

// Get today's date as YYYY-MM-DD
function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
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

export const useProteinStore = create<ProteinState>()(
  persist(
    (set, get) => ({
      currentProtein: 0,
      proteinGoal: 180,
      lastUpdatedDate: getTodayDateString(),
      selectedIncrement: 10, // Default to 10g

      addProtein: () => {
        const { selectedIncrement, currentProtein } = get();
        set({ currentProtein: currentProtein + selectedIncrement });
      },

      subtractProtein: () => {
        const { selectedIncrement, currentProtein } = get();
        // Don't go below 0
        set({ currentProtein: Math.max(0, currentProtein - selectedIncrement) });
      },

      setSelectedIncrement: (increment: 5 | 10 | 25) => {
        set({ selectedIncrement: increment });
      },

      setProteinGoal: (goal: number) => {
        set({ proteinGoal: goal });
      },

      checkAndResetDaily: () => {
        const { lastUpdatedDate } = get();
        const today = getTodayDateString();

        // If it's a new day, reset the protein count
        if (lastUpdatedDate !== today) {
          set({
            currentProtein: 0,
            lastUpdatedDate: today,
          });
        }
      },
    }),
    {
      name: 'momentum-protein',
      storage: storage as any,
    }
  )
);
