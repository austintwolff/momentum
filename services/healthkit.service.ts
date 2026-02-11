import { Platform } from 'react-native';

/**
 * Thin wrapper around @kingstinct/react-native-healthkit.
 * All calls are no-ops on non-iOS platforms.
 * Errors are caught and logged — HealthKit must never block the app flow.
 */

async function getHealthKit() {
  if (Platform.OS !== 'ios') return null;
  try {
    return await import('@kingstinct/react-native-healthkit');
  } catch {
    return null;
  }
}

export async function requestHealthKitAuthorization(): Promise<void> {
  try {
    const hk = await getHealthKit();
    if (!hk) return;

    if (!hk.isHealthDataAvailable()) return;

    await hk.requestAuthorization({
      toShare: ['HKWorkoutTypeIdentifier'],
      toRead: [],
    });
  } catch (e) {
    console.warn('[HealthKit] Authorization request failed:', e);
  }
}

export async function saveWorkoutToHealthKit(params: {
  startedAt: Date;
  completedAt: Date;
  durationSeconds: number;
  workoutName: string;
  exerciseCount: number;
  totalSets: number;
  totalVolumeKg: number;
}): Promise<void> {
  try {
    const hk = await getHealthKit();
    if (!hk) return;

    if (!hk.isHealthDataAvailable()) return;

    await hk.saveWorkoutSample(
      hk.WorkoutActivityType.traditionalStrengthTraining,
      [], // no quantity samples — we skip calories to avoid inaccurate estimates
      params.startedAt,
      params.completedAt,
      undefined, // no totals
      {
        HKMetadataKeyWorkoutBrandName: 'Momentum',
        WorkoutName: params.workoutName,
        ExerciseCount: String(params.exerciseCount),
        TotalSets: String(params.totalSets),
        TotalVolumeKg: String(Math.round(params.totalVolumeKg)),
      },
    );
  } catch (e) {
    console.warn('[HealthKit] Failed to save workout:', e);
  }
}
