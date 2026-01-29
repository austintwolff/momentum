import { useEffect } from 'react';
import { useRollingScoresStore } from '@/stores/rolling-scores.store';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Hook to access rolling scores for the Home screen.
 *
 * Auto-fetches scores on mount if the user is logged in.
 * Returns null values while loading or if not calibrated.
 */
export function useRollingScores() {
  const { user } = useAuthStore();
  const {
    scores,
    breakdown,
    isCalibrated,
    isLoading,
    error,
    fetchScores,
  } = useRollingScoresStore();

  useEffect(() => {
    if (user?.id) {
      fetchScores(user.id);
    }
  }, [user?.id, fetchScores]);

  return {
    progression: scores?.progression ?? null,
    load: scores?.load ?? null,
    consistency: scores?.consistency ?? null,
    breakdown,
    isCalibrated,
    isLoading,
    error,
  };
}
