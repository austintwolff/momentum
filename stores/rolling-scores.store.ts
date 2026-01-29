import { create } from 'zustand';
import {
  calculateRollingScores,
  RollingScoresResult,
  ScoresBreakdown,
} from '@/services/rolling-scores.service';

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

interface RollingScoresState {
  scores: {
    progression: number | null;
    load: number | null;
    consistency: number | null;
  } | null;
  breakdown: ScoresBreakdown | null;
  isCalibrated: boolean;
  isLoading: boolean;
  lastCalculated: number | null;
  error: string | null;

  fetchScores: (userId: string, force?: boolean) => Promise<void>;
  invalidate: () => void;
  reset: () => void;
}

export const useRollingScoresStore = create<RollingScoresState>((set, get) => ({
  scores: null,
  breakdown: null,
  isCalibrated: false,
  isLoading: false,
  lastCalculated: null,
  error: null,

  fetchScores: async (userId: string, force = false) => {
    const state = get();

    // Check if we have a valid cached result
    if (!force && state.scores && state.lastCalculated) {
      const age = Date.now() - state.lastCalculated;
      if (age < CACHE_TTL_MS) {
        return;
      }
    }

    if (state.isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const result: RollingScoresResult = await calculateRollingScores(userId);

      set({
        scores: {
          progression: result.progression,
          load: result.load,
          consistency: result.consistency,
        },
        breakdown: result.breakdown,
        isCalibrated: result.isCalibrated,
        isLoading: false,
        lastCalculated: Date.now(),
        error: null,
      });
    } catch (error) {
      console.error('[RollingScoresStore] Error fetching scores:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  invalidate: () => {
    set({ lastCalculated: null });
  },

  reset: () => {
    set({
      scores: null,
      breakdown: null,
      isCalibrated: false,
      isLoading: false,
      lastCalculated: null,
      error: null,
    });
  },
}));
