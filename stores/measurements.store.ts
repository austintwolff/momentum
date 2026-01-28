import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type Sex = 'male' | 'female';

interface MeasurementsState {
  heightCm: number | null;
  weightKg: number | null;
  sex: Sex;

  // Actions
  setHeight: (heightCm: number) => void;
  setWeight: (weightKg: number) => void;
  setSex: (sex: Sex) => void;
  updateMeasurements: (data: { heightCm?: number; weightKg?: number; sex?: Sex }) => void;
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

export const useMeasurementsStore = create<MeasurementsState>()(
  persist(
    (set) => ({
      heightCm: null,
      weightKg: null,
      sex: 'male',

      setHeight: (heightCm: number) => set({ heightCm }),
      setWeight: (weightKg: number) => set({ weightKg }),
      setSex: (sex: Sex) => set({ sex }),
      updateMeasurements: (data) => set((state) => ({
        ...state,
        ...data,
      })),
    }),
    {
      name: 'momentum-measurements',
      storage: storage as any,
    }
  )
);

// Utility functions for goal calculations
const KG_TO_LBS = 2.20462;

/**
 * Calculate recommended daily protein intake
 * Formula: 1g per lb of body weight (or ~2.2g per kg)
 */
export function calculateProteinGoal(weightKg: number | null, sex: Sex): number {
  if (!weightKg) return 150; // Default
  const weightLbs = weightKg * KG_TO_LBS;
  // Slightly lower for females
  const multiplier = sex === 'female' ? 0.9 : 1.0;
  return Math.round(weightLbs * multiplier);
}

/**
 * Calculate recommended daily calorie intake for maintenance
 * Simple formula: weight (lbs) × multiplier
 * - Male: 15-16 cal/lb for moderate activity
 * - Female: 14-15 cal/lb for moderate activity
 */
export function calculateCalorieGoal(weightKg: number | null, sex: Sex): number {
  if (!weightKg) return 2500; // Default
  const weightLbs = weightKg * KG_TO_LBS;
  const multiplier = sex === 'female' ? 14 : 15;
  // Round to nearest 50
  return Math.round((weightLbs * multiplier) / 50) * 50;
}

// Height conversion utilities
const CM_TO_INCHES = 0.393701;
const INCHES_TO_CM = 2.54;

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm * CM_TO_INCHES;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches;
  return Math.round(totalInches * INCHES_TO_CM);
}

export function formatHeight(cm: number | null, useMetric: boolean = false): string {
  if (!cm) return '--';
  if (useMetric) {
    return `${cm} cm`;
  }
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}'${inches}"`;
}

export function formatWeight(kg: number | null, useMetric: boolean = false): string {
  if (!kg) return '--';
  if (useMetric) {
    return `${Math.round(kg)} kg`;
  }
  return `${Math.round(kg * KG_TO_LBS)} lbs`;
}
