import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type WeightUnit = 'lbs' | 'kg';

interface SettingsState {
  weightUnit: WeightUnit;
  setWeightUnit: (unit: WeightUnit) => void;
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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      weightUnit: 'lbs', // Default to lbs
      setWeightUnit: (unit: WeightUnit) => set({ weightUnit: unit }),
    }),
    {
      name: 'momentum-settings',
      storage: storage as any,
    }
  )
);

// Conversion utilities
const KG_TO_LBS = 2.20462;
const LBS_TO_KG = 0.453592;

export function kgToLbs(kg: number): number {
  return kg * KG_TO_LBS;
}

export function lbsToKg(lbs: number): number {
  return lbs * LBS_TO_KG;
}

export function formatWeight(valueInKg: number | null, unit: WeightUnit, decimals: number = 1): string {
  if (valueInKg === null || valueInKg === undefined) return '0';

  if (unit === 'lbs') {
    const lbs = kgToLbs(valueInKg);
    return lbs % 1 === 0 ? lbs.toFixed(0) : lbs.toFixed(decimals);
  }
  return valueInKg % 1 === 0 ? valueInKg.toFixed(0) : valueInKg.toFixed(decimals);
}

export function formatWeightWithUnit(valueInKg: number | null, unit: WeightUnit, decimals: number = 1): string {
  return `${formatWeight(valueInKg, unit, decimals)}${unit}`;
}

export function parseWeightInput(value: string, unit: WeightUnit): number {
  const parsed = parseFloat(value) || 0;
  // Convert to kg for storage (database stores in kg)
  return unit === 'lbs' ? lbsToKg(parsed) : parsed;
}

export function getWeightIncrement(unit: WeightUnit): number {
  // Standard increments: 5 lbs or 2.5 kg
  return unit === 'lbs' ? 5 : 2.5;
}
