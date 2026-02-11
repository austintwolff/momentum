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
  const user = useAuthStore(s => s.user);
  const scores = useRollingScoresStore(s => s.scores);
  const breakdown = useRollingScoresStore(s => s.breakdown);
  const isCalibrated = useRollingScoresStore(s => s.isCalibrated);
  const isLoading = useRollingScoresStore(s => s.isLoading);
  const error = useRollingScoresStore(s => s.error);
  const fetchScores = useRollingScoresStore(s => s.fetchScores);

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
