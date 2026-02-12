import { Platform } from 'react-native';

/**
 * Thin wrapper around @kayzmann/expo-healthkit.
 * All calls are no-ops on non-iOS platforms.
 * Every function is wrapped so HealthKit errors NEVER crash the app.
 */

function getHealthKit() {
  if (Platform.OS !== 'ios') return null;
  try {
    // Static require so Expo modules resolve at bundle time (no dynamic import needed)
    return require('@kayzmann/expo-healthkit');
  } catch {
    return null;
  }
}

export function requestHealthKitAuthorization(): void {
  // Fire-and-forget — runs async but caller doesn't await
  setTimeout(async () => {
    try {
      const hk = getHealthKit();
      if (!hk) return;

      if (!hk.isAvailable()) return;

      await hk.requestAuthorization([], ['Workout']);
    } catch (e) {
      console.warn('[HealthKit] Authorization request failed:', e);
    }
  }, 0);
}

export function saveWorkoutToHealthKit(params: {
  startedAt: Date;
  completedAt: Date;
  durationSeconds: number;
  workoutName: string;
  exerciseCount: number;
  totalSets: number;
  totalVolumeKg: number;
}): void {
  // Fire-and-forget — deferred off the call stack entirely
  setTimeout(async () => {
    try {
      const hk = getHealthKit();
      if (!hk) return;

      if (!hk.isAvailable()) return;

      await hk.saveWorkout({
        startDate: Math.floor(params.startedAt.getTime() / 1000),
        endDate: Math.floor(params.completedAt.getTime() / 1000),
        duration: params.durationSeconds,
        distance: 0,
        calories: 0,
        activityType: 'traditionalStrengthTraining',
        metadata: {
          WorkoutName: params.workoutName,
          ExerciseCount: params.exerciseCount,
          TotalSets: params.totalSets,
          TotalVolumeKg: Math.round(params.totalVolumeKg),
        },
      });
    } catch (e) {
      console.warn('[HealthKit] Failed to save workout:', e);
    }
  }, 0);
}
