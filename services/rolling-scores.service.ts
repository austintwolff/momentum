/**
 * Rolling Scores Service
 *
 * Calculates three "Oura-style" rolling scores from workouts in a 14-day window:
 * - Progression: Measures PR events and near-PR performance
 * - Load: Measures training volume relative to baseline
 * - Consistency: Measures workout frequency, gaps, and muscle coverage
 *
 * All scores are 0-100. Returns null for users with fewer than 4 total workouts.
 */

import { supabase } from '@/lib/supabase';
import { calculateOneRepMax } from '@/lib/points-engine';

// ============================================================================
// CONSTANTS
// ============================================================================

export const ROLLING_SCORES_CONFIG = {
  WINDOW_DAYS: 14,
  CALIBRATION_WORKOUTS: 4,
  ELIGIBLE_MAX_REPS: 12,
  TOP_SETS_PER_EXERCISE: 2,
  BASELINE_LOOKBACK_DAYS: 30,
  TIMEZONE: 'America/Chicago',

  // All 12 muscle groups for consistency tracking
  MUSCLE_GROUPS: [
    'chest',
    'upper back',
    'lower back',
    'shoulders',
    'biceps',
    'triceps',
    'forearms',
    'core',
    'quads',
    'hamstrings',
    'glutes',
    'calves',
  ] as const,

  // Progression score weights
  PROGRESSION: {
    PR_WEIGHT: 0.65,
    NEAR_PR_WEIGHT: 0.35,
    PR_SATURATION_DIVISOR: 6,
    NEAR_PR_THRESHOLD: 0.90,
  },

  // Load score parameters
  LOAD: {
    ESU_WORKING: 1.0,
    ESU_WARMUP: 0.5,
    DEFAULT_BASELINE_LOAD: 60,
    MIN_RATIO: 0.50,
    MAX_RATIO: 1.25,
  },

  // Consistency score weights
  CONSISTENCY: {
    FREQ_WEIGHT: 0.45,
    GAP_WEIGHT: 0.20,
    COVERAGE_WEIGHT: 0.35,
    TARGET_WORKOUTS: 10,
    MIN_GAP_DAYS: 3,
    MAX_GAP_DAYS: 10,
    TARGET_MUSCLE_DAYS: 4,
  },
} as const;

const db = supabase as any;

// ============================================================================
// TYPES
// ============================================================================

export interface ProgressionBreakdown {
  prCount: number;
  nearPrCount: number;
  avgClosenessPercent: number;
}

export interface LoadBreakdown {
  workingSets: number;
  loadVsBaselinePercent: number;
  exercisesCompleted: number;
}

export interface ConsistencyBreakdown {
  workoutsCount: number;
  longestGapDays: number;
  muscleGroupsHit: number;
  coveragePercent: number;
}

export interface ScoresBreakdown {
  progression: ProgressionBreakdown;
  load: LoadBreakdown;
  consistency: ConsistencyBreakdown;
}

export interface RollingScoresResult {
  progression: number | null;
  load: number | null;
  consistency: number | null;
  isCalibrated: boolean;
  breakdown: ScoresBreakdown | null;
}

interface WorkoutWithSets {
  id: string;
  completed_at: string;
  sets: SetData[];
}

interface SetData {
  id: string;
  exercise_id: string;
  exercise_name: string;
  exercise_type: 'weighted' | 'bodyweight';
  muscle_group: string;
  set_type: 'warmup' | 'working' | 'dropset' | 'failure';
  weight_kg: number | null;
  reps: number;
  is_bodyweight: boolean;
  is_pr: boolean;
  completed_at: string;
}

interface ExerciseBaseline {
  exerciseId: string;
  bestE1rm: number;
  bestReps: number;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function calculateRollingScores(
  userId: string
): Promise<RollingScoresResult> {
  try {
    const totalWorkouts = await getTotalWorkouts(userId);
    const isCalibrated = totalWorkouts >= ROLLING_SCORES_CONFIG.CALIBRATION_WORKOUTS;

    if (!isCalibrated) {
      return {
        progression: null,
        load: null,
        consistency: null,
        isCalibrated: false,
        breakdown: null,
      };
    }

    const { windowStart, windowEnd } = getWindowBoundaries();
    const workouts = await fetchWorkoutsWithSets(userId, windowStart, windowEnd);

    const [progressionResult, loadResult, consistencyResult] = await Promise.all([
      calculateProgressionScoreWithBreakdown(userId, workouts, windowStart),
      calculateLoadScoreWithBreakdown(userId, workouts, windowStart),
      calculateConsistencyScoreWithBreakdown(workouts),
    ]);

    return {
      progression: progressionResult.score,
      load: loadResult.score,
      consistency: consistencyResult.score,
      isCalibrated: true,
      breakdown: {
        progression: progressionResult.breakdown,
        load: loadResult.breakdown,
        consistency: consistencyResult.breakdown,
      },
    };
  } catch (error) {
    console.error('[RollingScores] Error calculating scores:', error);
    return {
      progression: null,
      load: null,
      consistency: null,
      isCalibrated: false,
      breakdown: null,
    };
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getTotalWorkouts(userId: string): Promise<number> {
  const { data, error } = await db
    .from('user_stats')
    .select('total_workouts')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return 0;
  }

  return data.total_workouts || 0;
}

function getWindowBoundaries(): { windowStart: Date; windowEnd: Date } {
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setHours(23, 59, 59, 999);

  const windowStart = new Date(windowEnd);
  windowStart.setDate(windowStart.getDate() - ROLLING_SCORES_CONFIG.WINDOW_DAYS + 1);
  windowStart.setHours(0, 0, 0, 0);

  return { windowStart, windowEnd };
}

async function fetchWorkoutsWithSets(
  userId: string,
  windowStart: Date,
  windowEnd: Date
): Promise<WorkoutWithSets[]> {
  const { data: workouts, error: workoutsError } = await db
    .from('workout_sessions')
    .select('id, completed_at')
    .eq('user_id', userId)
    .gte('completed_at', windowStart.toISOString())
    .lte('completed_at', windowEnd.toISOString())
    .order('completed_at', { ascending: true });

  if (workoutsError || !workouts || workouts.length === 0) {
    return [];
  }

  const workoutIds = workouts.map((w: any) => w.id);

  const { data: sets, error: setsError } = await db
    .from('workout_sets')
    .select(`
      id,
      workout_session_id,
      exercise_id,
      set_type,
      weight_kg,
      reps,
      is_bodyweight,
      is_pr,
      completed_at,
      exercise:exercises (
        name,
        exercise_type,
        muscle_group
      )
    `)
    .in('workout_session_id', workoutIds);

  if (setsError || !sets) {
    return workouts.map((w: any) => ({
      id: w.id,
      completed_at: w.completed_at,
      sets: [],
    }));
  }

  const setsByWorkout = new Map<string, SetData[]>();

  for (const set of sets) {
    const setData: SetData = {
      id: set.id,
      exercise_id: set.exercise_id,
      exercise_name: set.exercise?.name || 'Unknown',
      exercise_type: set.exercise?.exercise_type || 'weighted',
      muscle_group: (set.exercise?.muscle_group || 'other').toLowerCase(),
      set_type: set.set_type,
      weight_kg: set.weight_kg,
      reps: set.reps,
      is_bodyweight: set.is_bodyweight,
      is_pr: set.is_pr,
      completed_at: set.completed_at,
    };

    const workoutSets = setsByWorkout.get(set.workout_session_id) || [];
    workoutSets.push(setData);
    setsByWorkout.set(set.workout_session_id, workoutSets);
  }

  return workouts.map((w: any) => ({
    id: w.id,
    completed_at: w.completed_at,
    sets: setsByWorkout.get(w.id) || [],
  }));
}

async function fetchExerciseBaselines(
  userId: string,
  exerciseIds: string[],
  beforeDate: Date
): Promise<Map<string, ExerciseBaseline>> {
  if (exerciseIds.length === 0) {
    return new Map();
  }

  const baselines = new Map<string, ExerciseBaseline>();
  const lookbackStart = new Date(beforeDate);
  lookbackStart.setDate(lookbackStart.getDate() - ROLLING_SCORES_CONFIG.BASELINE_LOOKBACK_DAYS);

  const { data: historicalSets, error } = await db
    .from('workout_sets')
    .select(`
      exercise_id,
      weight_kg,
      reps,
      set_type,
      is_bodyweight,
      workout_session:workout_sessions!inner (
        user_id,
        completed_at
      )
    `)
    .in('exercise_id', exerciseIds)
    .eq('workout_session.user_id', userId)
    .lt('workout_session.completed_at', beforeDate.toISOString())
    .gte('workout_session.completed_at', lookbackStart.toISOString())
    .neq('set_type', 'warmup');

  if (error || !historicalSets) {
    return baselines;
  }

  const exerciseData = new Map<string, { bestE1rm: number; bestReps: number }>();

  for (const set of historicalSets) {
    if (set.reps > ROLLING_SCORES_CONFIG.ELIGIBLE_MAX_REPS) continue;

    const current = exerciseData.get(set.exercise_id) || { bestE1rm: 0, bestReps: 0 };

    if (set.is_bodyweight) {
      if (set.reps > current.bestReps) {
        current.bestReps = set.reps;
      }
    } else if (set.weight_kg) {
      const e1rm = calculateOneRepMax(set.weight_kg, set.reps);
      if (e1rm > current.bestE1rm) {
        current.bestE1rm = e1rm;
      }
    }

    exerciseData.set(set.exercise_id, current);
  }

  for (const [exerciseId, data] of exerciseData) {
    baselines.set(exerciseId, {
      exerciseId,
      bestE1rm: data.bestE1rm,
      bestReps: data.bestReps,
    });
  }

  return baselines;
}

async function fetchAllTimeMaxWeight(
  userId: string,
  exerciseIds: string[]
): Promise<Map<string, number>> {
  if (exerciseIds.length === 0) {
    return new Map();
  }

  const maxWeights = new Map<string, number>();

  const { data, error } = await db
    .from('workout_sets')
    .select(`
      exercise_id,
      weight_kg,
      workout_session:workout_sessions!inner (user_id)
    `)
    .in('exercise_id', exerciseIds)
    .eq('workout_session.user_id', userId)
    .neq('set_type', 'warmup')
    .not('weight_kg', 'is', null);

  if (error || !data) {
    return maxWeights;
  }

  for (const set of data) {
    const current = maxWeights.get(set.exercise_id) || 0;
    if (set.weight_kg > current) {
      maxWeights.set(set.exercise_id, set.weight_kg);
    }
  }

  return maxWeights;
}

async function fetchAllTimeMaxReps(
  userId: string,
  exerciseIds: string[]
): Promise<Map<string, number>> {
  if (exerciseIds.length === 0) {
    return new Map();
  }

  const maxReps = new Map<string, number>();

  const { data, error } = await db
    .from('workout_sets')
    .select(`
      exercise_id,
      reps,
      workout_session:workout_sessions!inner (user_id)
    `)
    .in('exercise_id', exerciseIds)
    .eq('workout_session.user_id', userId)
    .neq('set_type', 'warmup');

  if (error || !data) {
    return maxReps;
  }

  for (const set of data) {
    const current = maxReps.get(set.exercise_id) || 0;
    if (set.reps > current) {
      maxReps.set(set.exercise_id, set.reps);
    }
  }

  return maxReps;
}

// ============================================================================
// PROGRESSION SCORE
// ============================================================================

interface ProgressionScoreResult {
  score: number;
  breakdown: ProgressionBreakdown;
}

async function calculateProgressionScoreWithBreakdown(
  userId: string,
  workouts: WorkoutWithSets[],
  windowStart: Date
): Promise<ProgressionScoreResult> {
  if (workouts.length === 0) {
    return {
      score: 0,
      breakdown: { prCount: 0, nearPrCount: 0, avgClosenessPercent: 0 },
    };
  }

  const setsByExercise = new Map<string, SetData[]>();
  const bodyweightExerciseIds = new Set<string>();
  const weightedExerciseIds = new Set<string>();

  for (const workout of workouts) {
    for (const set of workout.sets) {
      if (set.set_type === 'warmup') continue;
      if (set.reps > ROLLING_SCORES_CONFIG.ELIGIBLE_MAX_REPS) continue;

      const sets = setsByExercise.get(set.exercise_id) || [];
      sets.push(set);
      setsByExercise.set(set.exercise_id, sets);

      if (set.exercise_type === 'bodyweight' || set.is_bodyweight) {
        bodyweightExerciseIds.add(set.exercise_id);
      } else {
        weightedExerciseIds.add(set.exercise_id);
      }
    }
  }

  const allExerciseIds = [...setsByExercise.keys()];
  if (allExerciseIds.length === 0) {
    return {
      score: 0,
      breakdown: { prCount: 0, nearPrCount: 0, avgClosenessPercent: 0 },
    };
  }

  const [baselines, allTimeMaxWeights, allTimeMaxReps] = await Promise.all([
    fetchExerciseBaselines(userId, allExerciseIds, windowStart),
    fetchAllTimeMaxWeight(userId, [...weightedExerciseIds]),
    fetchAllTimeMaxReps(userId, [...bodyweightExerciseIds]),
  ]);

  let prCount = 0;
  const nearPrRatios: number[] = [];
  const allClosenessRatios: number[] = [];

  for (const [exerciseId, sets] of setsByExercise) {
    const baseline = baselines.get(exerciseId);
    const isBodyweight = bodyweightExerciseIds.has(exerciseId);

    const sortedSets = [...sets].sort((a, b) => {
      if (isBodyweight) {
        return b.reps - a.reps;
      }
      const e1rmA = a.weight_kg ? calculateOneRepMax(a.weight_kg, a.reps) : 0;
      const e1rmB = b.weight_kg ? calculateOneRepMax(b.weight_kg, b.reps) : 0;
      return e1rmB - e1rmA;
    });

    const topSets = sortedSets.slice(0, ROLLING_SCORES_CONFIG.TOP_SETS_PER_EXERCISE);

    for (const set of topSets) {
      if (isBodyweight) {
        const allTimeMax = allTimeMaxReps.get(exerciseId) || 0;
        if (set.reps > allTimeMax && allTimeMax > 0) {
          prCount++;
        }

        if (baseline && baseline.bestReps > 0) {
          const ratio = set.reps / baseline.bestReps;
          allClosenessRatios.push(Math.min(ratio, 1.0));
          if (ratio >= ROLLING_SCORES_CONFIG.PROGRESSION.NEAR_PR_THRESHOLD) {
            nearPrRatios.push(Math.min(ratio, 1.0));
          }
        }
      } else {
        const e1rm = set.weight_kg ? calculateOneRepMax(set.weight_kg, set.reps) : 0;

        if (baseline && baseline.bestE1rm > 0 && e1rm > baseline.bestE1rm) {
          prCount++;
        }

        const allTimeMaxWeight = allTimeMaxWeights.get(exerciseId) || 0;
        if (set.weight_kg && set.weight_kg > allTimeMaxWeight && allTimeMaxWeight > 0) {
          prCount++;
        }

        if (baseline && baseline.bestE1rm > 0) {
          const ratio = e1rm / baseline.bestE1rm;
          allClosenessRatios.push(Math.min(ratio, 1.0));
          if (ratio >= ROLLING_SCORES_CONFIG.PROGRESSION.NEAR_PR_THRESHOLD) {
            nearPrRatios.push(Math.min(ratio, 1.0));
          }
        }
      }
    }
  }

  const prComponent = 1 - Math.exp(
    -prCount / ROLLING_SCORES_CONFIG.PROGRESSION.PR_SATURATION_DIVISOR
  );

  let nearPrComponent = 0;
  if (nearPrRatios.length > 0) {
    const threshold = ROLLING_SCORES_CONFIG.PROGRESSION.NEAR_PR_THRESHOLD;
    const normalizedRatios = nearPrRatios.map((ratio) => {
      return Math.max(0, Math.min(1, (ratio - threshold) / (1 - threshold)));
    });
    nearPrComponent = normalizedRatios.reduce((a, b) => a + b, 0) / normalizedRatios.length;
  }

  const score =
    ROLLING_SCORES_CONFIG.PROGRESSION.PR_WEIGHT * prComponent +
    ROLLING_SCORES_CONFIG.PROGRESSION.NEAR_PR_WEIGHT * nearPrComponent;

  // Calculate average closeness percentage
  const avgClosenessPercent = allClosenessRatios.length > 0
    ? Math.round((allClosenessRatios.reduce((a, b) => a + b, 0) / allClosenessRatios.length) * 100)
    : 0;

  return {
    score: Math.round(score * 100),
    breakdown: {
      prCount,
      nearPrCount: nearPrRatios.length,
      avgClosenessPercent,
    },
  };
}

// ============================================================================
// LOAD SCORE
// ============================================================================

interface LoadScoreResult {
  score: number;
  breakdown: LoadBreakdown;
}

async function calculateLoadScoreWithBreakdown(
  userId: string,
  workouts: WorkoutWithSets[],
  windowStart: Date
): Promise<LoadScoreResult> {
  let currentLoadUnits = 0;
  let workingSetsCount = 0;

  const exerciseIds = new Set<string>();
  for (const workout of workouts) {
    for (const set of workout.sets) {
      if (set.set_type !== 'warmup' && set.reps <= ROLLING_SCORES_CONFIG.ELIGIBLE_MAX_REPS) {
        exerciseIds.add(set.exercise_id);
      }
    }
  }

  const baselines = await fetchExerciseBaselines(userId, [...exerciseIds], windowStart);

  for (const workout of workouts) {
    for (const set of workout.sets) {
      const esu = set.set_type === 'warmup'
        ? ROLLING_SCORES_CONFIG.LOAD.ESU_WARMUP
        : ROLLING_SCORES_CONFIG.LOAD.ESU_WORKING;

      // Count working sets (non-warmup)
      if (set.set_type !== 'warmup') {
        workingSetsCount++;
      }

      let intensityMult = 1.0;

      if (
        set.set_type !== 'warmup' &&
        set.reps <= ROLLING_SCORES_CONFIG.ELIGIBLE_MAX_REPS &&
        set.weight_kg
      ) {
        const baseline = baselines.get(set.exercise_id);
        if (baseline && baseline.bestE1rm > 0) {
          const e1rm = calculateOneRepMax(set.weight_kg, set.reps);
          intensityMult = Math.min(e1rm / baseline.bestE1rm, 2.0);
        }
      }

      currentLoadUnits += esu * intensityMult;
    }
  }

  const baselineStart = new Date(windowStart);
  baselineStart.setDate(baselineStart.getDate() - ROLLING_SCORES_CONFIG.WINDOW_DAYS);

  const baselineLoadUnits = await calculateBaselineLoad(userId, baselineStart, windowStart);

  const effectiveBaseline = baselineLoadUnits > 0
    ? baselineLoadUnits
    : ROLLING_SCORES_CONFIG.LOAD.DEFAULT_BASELINE_LOAD;

  const ratio = currentLoadUnits / effectiveBaseline;

  const { MIN_RATIO, MAX_RATIO } = ROLLING_SCORES_CONFIG.LOAD;
  const normalizedScore = (ratio - MIN_RATIO) / (MAX_RATIO - MIN_RATIO);
  const score = Math.max(0, Math.min(1, normalizedScore));

  return {
    score: Math.round(score * 100),
    breakdown: {
      workingSets: workingSetsCount,
      loadVsBaselinePercent: Math.round(ratio * 100),
      exercisesCompleted: exerciseIds.size,
    },
  };
}

async function calculateBaselineLoad(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const { data: sets, error } = await db
    .from('workout_sets')
    .select(`
      set_type,
      workout_session:workout_sessions!inner (
        user_id,
        completed_at
      )
    `)
    .eq('workout_session.user_id', userId)
    .gte('workout_session.completed_at', startDate.toISOString())
    .lt('workout_session.completed_at', endDate.toISOString());

  if (error || !sets) {
    return 0;
  }

  let loadUnits = 0;
  for (const set of sets) {
    const esu = set.set_type === 'warmup'
      ? ROLLING_SCORES_CONFIG.LOAD.ESU_WARMUP
      : ROLLING_SCORES_CONFIG.LOAD.ESU_WORKING;
    loadUnits += esu;
  }

  return loadUnits;
}

// ============================================================================
// CONSISTENCY SCORE
// ============================================================================

interface ConsistencyScoreResult {
  score: number;
  breakdown: ConsistencyBreakdown;
}

async function calculateConsistencyScoreWithBreakdown(
  workouts: WorkoutWithSets[]
): Promise<ConsistencyScoreResult> {
  const freqScore = Math.min(
    workouts.length / ROLLING_SCORES_CONFIG.CONSISTENCY.TARGET_WORKOUTS,
    1.0
  );

  let maxGap = 0;

  if (workouts.length >= 2) {
    for (let i = 1; i < workouts.length; i++) {
      const prevDate = new Date(workouts[i - 1].completed_at);
      const currDate = new Date(workouts[i].completed_at);
      const gapDays = Math.floor(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      maxGap = Math.max(maxGap, gapDays);
    }
  } else if (workouts.length === 1) {
    const { windowStart } = getWindowBoundaries();
    const workoutDate = new Date(workouts[0].completed_at);
    maxGap = Math.floor(
      (workoutDate.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)
    );
  } else {
    maxGap = ROLLING_SCORES_CONFIG.WINDOW_DAYS;
  }

  const { MIN_GAP_DAYS, MAX_GAP_DAYS } = ROLLING_SCORES_CONFIG.CONSISTENCY;
  const gapPenalty = Math.max(0, maxGap - MIN_GAP_DAYS) / (MAX_GAP_DAYS - MIN_GAP_DAYS);
  const gapScore = Math.max(0, Math.min(1, 1 - gapPenalty));

  const muscleDays = new Map<string, Set<string>>();

  for (const muscle of ROLLING_SCORES_CONFIG.MUSCLE_GROUPS) {
    muscleDays.set(muscle, new Set());
  }

  for (const workout of workouts) {
    const workoutDate = new Date(workout.completed_at).toDateString();

    for (const set of workout.sets) {
      if (set.set_type === 'warmup') continue;

      const muscle = set.muscle_group.toLowerCase();
      const days = muscleDays.get(muscle);
      if (days) {
        days.add(workoutDate);
      }
    }
  }

  let coverageSum = 0;
  let muscleGroupsHit = 0;
  for (const days of muscleDays.values()) {
    if (days.size > 0) {
      muscleGroupsHit++;
    }
    const muscleScore = Math.min(
      days.size / ROLLING_SCORES_CONFIG.CONSISTENCY.TARGET_MUSCLE_DAYS,
      1.0
    );
    coverageSum += muscleScore;
  }
  const coverageScore = coverageSum / ROLLING_SCORES_CONFIG.MUSCLE_GROUPS.length;

  const { FREQ_WEIGHT, GAP_WEIGHT, COVERAGE_WEIGHT } = ROLLING_SCORES_CONFIG.CONSISTENCY;
  const score = FREQ_WEIGHT * freqScore + GAP_WEIGHT * gapScore + COVERAGE_WEIGHT * coverageScore;

  return {
    score: Math.round(score * 100),
    breakdown: {
      workoutsCount: workouts.length,
      longestGapDays: maxGap,
      muscleGroupsHit,
      coveragePercent: Math.round(coverageScore * 100),
    },
  };
}

// ============================================================================
// PR RECALCULATION (for deletions)
// ============================================================================

export async function recalculatePRRecordsAfterDeletion(
  userId: string,
  deletedSets: { exerciseId: string; isPR: boolean }[]
): Promise<void> {
  const exercisesToRecalculate = [...new Set(
    deletedSets.filter((s) => s.isPR).map((s) => s.exerciseId)
  )];

  if (exercisesToRecalculate.length === 0) {
    return;
  }

  for (const exerciseId of exercisesToRecalculate) {
    try {
      const { data: sets, error: setsError } = await db
        .from('workout_sets')
        .select(`
          weight_kg,
          reps,
          workout_session:workout_sessions!inner (user_id)
        `)
        .eq('exercise_id', exerciseId)
        .eq('workout_session.user_id', userId)
        .neq('set_type', 'warmup');

      if (setsError || !sets) {
        continue;
      }

      let bestE1rm = 0;
      for (const set of sets) {
        if (set.weight_kg && set.reps <= 12) {
          const e1rm = calculateOneRepMax(set.weight_kg, set.reps);
          bestE1rm = Math.max(bestE1rm, e1rm);
        }
      }

      await db
        .from('exercise_baselines')
        .update({
          best_e1rm: bestE1rm,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId);
    } catch (error) {
      console.error(`[RollingScores] Error recalculating PR for exercise ${exerciseId}:`, error);
    }
  }
}
