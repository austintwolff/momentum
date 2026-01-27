/**
 * Workout Score Calculation Service
 *
 * Calculates a workout score (1-100) based on:
 * - Progress Score (0-55): PRs (0-40) + closeness to PR (0-25) + near-PR bonus (0-9), capped at 55
 * - Maintenance Bonus (0-19): Rewards high-effort workouts near PR range without actual PRs
 * - Work Score (0-40): Effective volume
 * - Consistency Score (0-5): Workout frequency
 */

import { supabase } from '@/lib/supabase';
import { ExerciseScoreData, BaselineSessionEntry } from '@/types/database';
import { calculateOneRepMax } from '@/lib/points-engine';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkoutScoreInput {
  userId: string;
  workoutId: string;
  completedAt: Date;
  sets: SetData[];
  weightUnit: 'kg' | 'lbs';
}

export interface SetData {
  exerciseId: string;
  exerciseName: string;
  weightKg: number | null;
  reps: number;
  setType: 'warmup' | 'working' | 'dropset' | 'failure';
  isBodyweight: boolean;
  completedAt: Date;
}

export interface WorkoutScoreResult {
  finalScore: number;
  progressScore: number;
  maintenanceBonus: number;
  workScore: number;
  consistencyScore: number;
  effectiveSetCount: number;
  nEPR: number;
  nWPR: number;
  nearPRCount: number;
  closenessAggregateRatio: number;
  topPerformer: { name: string; closenessPercent: number } | null;
  exerciseScores: ExerciseScoreData[];
}

interface ExerciseData {
  exerciseId: string;
  exerciseName: string;
  sets: SetData[];
  priorMaxWeight: number;
  baselineE1RM: number | null;
  todayBestE1RM: number | null;
  didWeightPR: boolean;
  didEPRPR: boolean;
  closenessRatio: number | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// EPR PR thresholds
const EPR_MIN_PERCENT_IMPROVEMENT = 0.01; // 1%
const EPR_MIN_ABSOLUTE_IMPROVEMENT_KG = 1.0; // ~2.2 lbs
const EPR_MIN_ABSOLUTE_IMPROVEMENT_LBS = 2.5;

// Eligible rep range for EPR calculation
const EPR_MIN_REPS = 1; // Include heavy singles/doubles
const EPR_MAX_REPS = 12;

// PR point values
const BASE_EPR_VALUE = 10;
const BASE_WPR_VALUE = 8;

// Diminishing returns multipliers for PR events
const PR_MULTIPLIERS = [1.0, 0.85, 0.70, 0.55, 0.45, 0.35, 0.30, 0.25, 0.22, 0.20];

// Closeness to PR mapping (more generous brackets for maintenance days)
const CLOSENESS_BRACKETS = [
  { min: 1.00, points: 1.00 },
  { min: 0.98, points: 0.85 },
  { min: 0.95, points: 0.65 },
  { min: 0.90, points: 0.45 },
  { min: 0.85, points: 0.30 },
  { min: 0.80, points: 0.15 },
  { min: 0.00, points: 0.00 },
];

// Max closeness score component
const CLOSENESS_MAX = 25;

// Neutral closeness score for exercises without a baseline
const NO_BASELINE_CLOSENESS_POINTS = 0.5;

// Near-PR bonus: reward exercises at 98-99.9% of baseline
const NEAR_PR_BONUS = 3;
const NEAR_PR_MAX = 9;

// Maintenance bonus: rewards high-effort workouts near PR range without actual PRs
// Scales down as PR points increase
const MAINTENANCE_BONUS_TIERS = [
  { minCloseness: 0.95, points: 19 },
  { minCloseness: 0.90, points: 16 },
  { minCloseness: 0.85, points: 12 },
  { minCloseness: 0.80, points: 6 },
];
const MAINTENANCE_PR_DIVISOR = 40; // How quickly maintenance bonus decreases with PRs

// Consistency score mapping
const CONSISTENCY_MAP: Record<number, number> = {
  0: 0,
  1: 1,
  2: 3,
  3: 4,
};

// ============================================================================
// MAIN CALCULATION
// ============================================================================

export async function calculateWorkoutScore(
  input: WorkoutScoreInput
): Promise<WorkoutScoreResult> {
  const { userId, completedAt, sets, weightUnit } = input;

  // Group sets by exercise
  const exerciseMap = new Map<string, SetData[]>();
  for (const set of sets) {
    const existing = exerciseMap.get(set.exerciseId) || [];
    existing.push(set);
    exerciseMap.set(set.exerciseId, existing);
  }

  // Fetch historical data for all exercises
  const exerciseIds = Array.from(exerciseMap.keys());
  console.log('[Score] Fetching data for exercise IDs:', exerciseIds);

  const [priorMaxWeights, baselineData] = await Promise.all([
    fetchPriorMaxWeights(userId, exerciseIds, completedAt),
    fetchBaselineE1RMs(userId, exerciseIds, completedAt),
  ]);

  console.log('[Score] Prior max weights:', Object.fromEntries(priorMaxWeights));
  console.log('[Score] Baseline E1RMs:', Object.fromEntries(baselineData));

  // Calculate per-exercise metrics
  const exercises: ExerciseData[] = [];
  const absoluteThreshold = weightUnit === 'lbs'
    ? EPR_MIN_ABSOLUTE_IMPROVEMENT_LBS
    : EPR_MIN_ABSOLUTE_IMPROVEMENT_KG;

  for (const [exerciseId, exerciseSets] of exerciseMap) {
    const exerciseName = exerciseSets[0].exerciseName;
    const priorMaxWeight = priorMaxWeights.get(exerciseId) || 0;
    const baselineE1RM = baselineData.get(exerciseId) || null;

    // Calculate today's best E1RM from eligible sets (3-12 reps)
    let todayBestE1RM: number | null = null;
    for (const set of exerciseSets) {
      if (set.reps >= EPR_MIN_REPS && set.reps <= EPR_MAX_REPS && set.weightKg !== null) {
        const e1rm = calculateOneRepMax(set.weightKg, set.reps);
        if (todayBestE1RM === null || e1rm > todayBestE1RM) {
          todayBestE1RM = e1rm;
        }
      }
    }

    // Check for Weight PR (any rep count)
    let didWeightPR = false;
    for (const set of exerciseSets) {
      if (set.weightKg !== null && set.weightKg > priorMaxWeight) {
        didWeightPR = true;
        break;
      }
    }

    // Check for EPR PR
    let didEPRPR = false;
    if (baselineE1RM !== null && todayBestE1RM !== null) {
      const percentImprovement = (todayBestE1RM - baselineE1RM) / baselineE1RM;
      const absoluteImprovement = todayBestE1RM - baselineE1RM;

      // Convert absolute threshold to kg if needed for comparison
      const thresholdKg = weightUnit === 'lbs'
        ? absoluteThreshold * 0.453592
        : absoluteThreshold;

      if (percentImprovement >= EPR_MIN_PERCENT_IMPROVEMENT &&
          absoluteImprovement >= thresholdKg) {
        didEPRPR = true;
      }
    }

    // Calculate closeness ratio
    let closenessRatio: number | null = null;
    if (baselineE1RM !== null && todayBestE1RM !== null && baselineE1RM > 0) {
      closenessRatio = Math.min(todayBestE1RM / baselineE1RM, 1.05);
      closenessRatio = Math.max(closenessRatio, 0);
    }

    exercises.push({
      exerciseId,
      exerciseName,
      sets: exerciseSets,
      priorMaxWeight,
      baselineE1RM,
      todayBestE1RM,
      didWeightPR,
      didEPRPR,
      closenessRatio,
    });

    console.log(`[Score] ${exerciseName}: baseline=${baselineE1RM}, today=${todayBestE1RM}, closeness=${closenessRatio}, weightPR=${didWeightPR}, eprPR=${didEPRPR}`);
  }

  // Count PRs
  const nEPR = exercises.filter(e => e.didEPRPR).length;
  const nWPR = exercises.filter(e => e.didWeightPR).length;

  // Count near-PR lifts (98-99.9% of baseline, not a PR)
  const nearPRCount = exercises.filter(e =>
    e.closenessRatio !== null &&
    e.closenessRatio >= 0.98 &&
    e.closenessRatio < 1.00 &&
    !e.didEPRPR
  ).length;

  // Find top performer (exercise with highest closeness ratio)
  let topPerformer: { name: string; closenessPercent: number } | null = null;
  for (const exercise of exercises) {
    if (exercise.closenessRatio !== null) {
      const closenessPercent = Math.round(exercise.closenessRatio * 100);
      if (topPerformer === null || closenessPercent > topPerformer.closenessPercent) {
        topPerformer = {
          name: exercise.exerciseName,
          closenessPercent,
        };
      }
    }
  }

  // Calculate Progress Score (includes near-PR bonus)
  const { progressScore, prPoints } = calculateProgressScore(exercises);

  // Calculate Work Score
  const { workScore, effectiveSetCount } = calculateWorkScore(sets);

  // Calculate Consistency Score
  const consistencyScore = await calculateConsistencyScore(userId, completedAt);

  // Calculate closeness aggregate
  const closenessAggregateRatio = calculateClosenessAggregate(exercises);

  // Calculate Maintenance Bonus (scales down with PRs)
  const maintenanceBonus = calculateMaintenanceBonus(exercises, prPoints);

  // Calculate final score
  const finalScore = Math.max(1, Math.min(100,
    progressScore + maintenanceBonus + workScore + consistencyScore
  ));

  // Build exercise scores for storage
  const exerciseScores: ExerciseScoreData[] = exercises.map(e => ({
    exerciseId: e.exerciseId,
    exerciseName: e.exerciseName,
    didEPRPR: e.didEPRPR,
    didWeightPR: e.didWeightPR,
    bestTodayE1RM: e.todayBestE1RM,
    baselineE1RMUsed: e.baselineE1RM,
    closenessRatio: e.closenessRatio,
  }));

  return {
    finalScore: Math.round(finalScore),
    progressScore: Math.round(progressScore),
    maintenanceBonus: Math.round(maintenanceBonus),
    workScore: Math.round(workScore),
    consistencyScore: Math.round(consistencyScore),
    effectiveSetCount: Math.round(effectiveSetCount * 100) / 100,
    nEPR,
    nWPR,
    nearPRCount,
    closenessAggregateRatio: Math.round(closenessAggregateRatio * 1000) / 1000,
    topPerformer,
    exerciseScores,
  };
}

// ============================================================================
// PROGRESS SCORE (0-55): PRs (0-40) + Closeness (0-25) + Near-PR (0-9), capped at 55
// ============================================================================

function calculateProgressScore(exercises: ExerciseData[]): { progressScore: number; prPoints: number } {
  // PR Component (0-40)
  const prEvents: { type: 'epr' | 'weight'; value: number }[] = [];

  // Add all EPR PR events first
  for (const exercise of exercises) {
    if (exercise.didEPRPR) {
      prEvents.push({ type: 'epr', value: BASE_EPR_VALUE });
    }
  }

  // Add all Weight PR events
  for (const exercise of exercises) {
    if (exercise.didWeightPR) {
      prEvents.push({ type: 'weight', value: BASE_WPR_VALUE });
    }
  }

  // Apply diminishing returns multipliers
  let prPoints = 0;
  for (let i = 0; i < prEvents.length; i++) {
    const multiplier = i < PR_MULTIPLIERS.length
      ? PR_MULTIPLIERS[i]
      : 0.20;
    prPoints += prEvents[i].value * multiplier;
  }

  const prComponent = Math.min(40, Math.round(prPoints));

  // Closeness Score (0-CLOSENESS_MAX)
  const closenessAggregateRatio = calculateClosenessAggregate(exercises);
  const closenessScore = Math.min(CLOSENESS_MAX, Math.round(CLOSENESS_MAX * closenessAggregateRatio));

  // Near-PR Bonus: +3 per exercise at 98-99.9% of baseline (max +9)
  let nearPRBonus = 0;
  for (const exercise of exercises) {
    if (exercise.closenessRatio !== null &&
        exercise.closenessRatio >= 0.98 &&
        exercise.closenessRatio < 1.00 &&
        !exercise.didEPRPR) {
      nearPRBonus += NEAR_PR_BONUS;
    }
  }
  nearPRBonus = Math.min(NEAR_PR_MAX, nearPRBonus);

  // Total Progress Score
  const progressScore = Math.min(55, prComponent + closenessScore + nearPRBonus);

  return { progressScore, prPoints };
}

function calculateClosenessAggregate(exercises: ExerciseData[]): number {
  if (exercises.length === 0) {
    return 0;
  }

  let totalPoints = 0;
  for (const exercise of exercises) {
    // Exercises without baseline get a neutral score instead of being excluded
    if (exercise.baselineE1RM === null || exercise.closenessRatio === null) {
      totalPoints += NO_BASELINE_CLOSENESS_POINTS;
      continue;
    }

    const closeness = exercise.closenessRatio;
    let pointsRatio = 0;

    for (const bracket of CLOSENESS_BRACKETS) {
      if (closeness >= bracket.min) {
        pointsRatio = bracket.points;
        break;
      }
    }

    totalPoints += pointsRatio;
  }

  return totalPoints / exercises.length;
}

// ============================================================================
// MAINTENANCE BONUS (0-19): High-effort workouts near PR range without PRs
// ============================================================================

function calculateMaintenanceBonus(exercises: ExerciseData[], prPoints: number): number {
  // If there are significant PRs, maintenance bonus scales down
  const prScaleFactor = Math.max(0, 1 - (prPoints / MAINTENANCE_PR_DIVISOR));

  if (prScaleFactor <= 0) {
    return 0;
  }

  // Calculate average closeness ratio (only for exercises with baselines)
  const exercisesWithBaseline = exercises.filter(
    e => e.closenessRatio !== null && e.baselineE1RM !== null
  );

  if (exercisesWithBaseline.length === 0) {
    return 0;
  }

  const avgCloseness = exercisesWithBaseline.reduce(
    (sum, e) => sum + (e.closenessRatio || 0),
    0
  ) / exercisesWithBaseline.length;

  // Find applicable tier
  let baseBonus = 0;
  for (const tier of MAINTENANCE_BONUS_TIERS) {
    if (avgCloseness >= tier.minCloseness) {
      baseBonus = tier.points;
      break;
    }
  }

  // Apply PR scale factor
  return Math.round(baseBonus * prScaleFactor);
}

// ============================================================================
// WORK SCORE (0-40)
// ============================================================================

function calculateWorkScore(sets: SetData[]): { workScore: number; effectiveSetCount: number } {
  // Calculate effective set count with warmup weighting
  let effectiveSetCount = 0;
  for (const set of sets) {
    const weight = set.setType === 'warmup' ? 0.25 : 1.0;
    effectiveSetCount += weight;
  }

  // Map effective set count to work score
  let workScore: number;

  if (effectiveSetCount < 6) {
    workScore = (effectiveSetCount / 6) * 10;
  } else if (effectiveSetCount <= 12) {
    workScore = 10 + ((effectiveSetCount - 6) / 6) * 15;
  } else if (effectiveSetCount <= 20) {
    workScore = 25 + ((effectiveSetCount - 12) / 8) * 15;
  } else {
    workScore = 40;
  }

  return {
    workScore: Math.min(40, Math.max(0, Math.round(workScore))),
    effectiveSetCount,
  };
}

// ============================================================================
// CONSISTENCY SCORE (0-5)
// ============================================================================

async function calculateConsistencyScore(
  userId: string,
  completedAt: Date
): Promise<number> {
  // Get workouts completed in the last 7 days including today
  const sevenDaysAgo = new Date(completedAt);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('workout_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .gte('completed_at', sevenDaysAgo.toISOString())
    .lte('completed_at', completedAt.toISOString());

  if (error) {
    console.error('Error fetching workout count for consistency:', error);
    return 1; // Default to 1 for current workout
  }

  const workoutCount = (count || 0) + 1; // +1 for current workout being saved

  // Map to consistency score
  if (workoutCount >= 4) return 5;
  if (workoutCount === 3) return 4;
  if (workoutCount === 2) return 3;
  if (workoutCount === 1) return 1;
  return 0;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetch prior max weight for each exercise (all-time, any reps)
 */
async function fetchPriorMaxWeights(
  userId: string,
  exerciseIds: string[],
  beforeDate: Date
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  if (exerciseIds.length === 0) return result;

  const { data, error } = await (supabase
    .from('workout_sets') as any)
    .select(`
      exercise_id,
      weight_kg,
      workout_session:workout_sessions!inner(user_id, completed_at)
    `)
    .in('exercise_id', exerciseIds)
    .eq('workout_session.user_id', userId)
    .lt('workout_session.completed_at', beforeDate.toISOString())
    .not('weight_kg', 'is', null);

  if (error) {
    console.error('Error fetching prior max weights:', error);
    return result;
  }

  // Find max weight per exercise
  for (const row of (data || [])) {
    const current = result.get(row.exercise_id) || 0;
    if (row.weight_kg > current) {
      result.set(row.exercise_id, row.weight_kg);
    }
  }

  return result;
}

/**
 * Fetch baseline E1RM for EPR calculation
 *
 * Baseline = best eligible e1RM (1-12 reps) from:
 * 1. Last 30 days (prior to this workout)
 * 2. If none, find most recent workout date with this exercise,
 *    then search 30 days ending on that date
 */
async function fetchBaselineE1RMs(
  userId: string,
  exerciseIds: string[],
  beforeDate: Date
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  if (exerciseIds.length === 0) return result;

  // First try: last 30 days
  const thirtyDaysAgo = new Date(beforeDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentSets, error: recentError } = await (supabase
    .from('workout_sets') as any)
    .select(`
      exercise_id,
      weight_kg,
      reps,
      workout_session:workout_sessions!inner(user_id, completed_at)
    `)
    .in('exercise_id', exerciseIds)
    .eq('workout_session.user_id', userId)
    .lt('workout_session.completed_at', beforeDate.toISOString())
    .gte('workout_session.completed_at', thirtyDaysAgo.toISOString())
    .gte('reps', EPR_MIN_REPS)
    .lte('reps', EPR_MAX_REPS)
    .not('weight_kg', 'is', null);

  if (recentError) {
    console.error('Error fetching recent baseline sets:', recentError);
    return result;
  }

  // Calculate best E1RM per exercise from last 30 days
  const exercisesWithRecent = new Set<string>();
  for (const row of (recentSets || [])) {
    exercisesWithRecent.add(row.exercise_id);
    const e1rm = calculateOneRepMax(row.weight_kg, row.reps);
    const current = result.get(row.exercise_id) || 0;
    if (e1rm > current) {
      result.set(row.exercise_id, e1rm);
    }
  }

  // For exercises without recent data, try to find historical baseline
  const exercisesNeedingHistory = exerciseIds.filter(id => !exercisesWithRecent.has(id));

  if (exercisesNeedingHistory.length > 0) {
    // Find most recent workout date for each exercise
    const { data: lastWorkouts, error: lastError } = await (supabase
      .from('workout_sets') as any)
      .select(`
        exercise_id,
        workout_session:workout_sessions!inner(user_id, completed_at)
      `)
      .in('exercise_id', exercisesNeedingHistory)
      .eq('workout_session.user_id', userId)
      .lt('workout_session.completed_at', thirtyDaysAgo.toISOString())
      .order('workout_session.completed_at', { ascending: false });

    if (!lastError && lastWorkouts) {
      // Group by exercise to find most recent date
      const lastDateByExercise = new Map<string, Date>();
      for (const row of lastWorkouts) {
        if (!lastDateByExercise.has(row.exercise_id)) {
          lastDateByExercise.set(row.exercise_id, new Date(row.workout_session.completed_at));
        }
      }

      // For each exercise with a historical date, search 30 days ending on that date
      for (const [exerciseId, lastDate] of lastDateByExercise) {
        const historicalStart = new Date(lastDate);
        historicalStart.setDate(historicalStart.getDate() - 30);

        const { data: historicalSets, error: histError } = await (supabase
          .from('workout_sets') as any)
          .select(`
            exercise_id,
            weight_kg,
            reps,
            workout_session:workout_sessions!inner(user_id, completed_at)
          `)
          .eq('exercise_id', exerciseId)
          .eq('workout_session.user_id', userId)
          .lte('workout_session.completed_at', lastDate.toISOString())
          .gte('workout_session.completed_at', historicalStart.toISOString())
          .gte('reps', EPR_MIN_REPS)
          .lte('reps', EPR_MAX_REPS)
          .not('weight_kg', 'is', null);

        if (!histError && historicalSets) {
          for (const row of historicalSets) {
            const e1rm = calculateOneRepMax(row.weight_kg, row.reps);
            const current = result.get(row.exercise_id) || 0;
            if (e1rm > current) {
              result.set(row.exercise_id, e1rm);
            }
          }
        }
      }
    }
  }

  return result;
}

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * Save workout score to database
 */
export async function saveWorkoutScore(
  workoutId: string,
  score: WorkoutScoreResult
): Promise<void> {
  const { error } = await (supabase
    .from('workout_sessions') as any)
    .update({
      final_score: score.finalScore,
      progress_score: score.progressScore,
      work_score: score.workScore,
      consistency_score: score.consistencyScore,
      effective_set_count: score.effectiveSetCount,
      epr_pr_count: score.nEPR,
      weight_pr_count: score.nWPR,
      closeness_aggregate_ratio: score.closenessAggregateRatio,
      exercise_scores: score.exerciseScores,
    })
    .eq('id', workoutId);

  if (error) {
    console.error('Error saving workout score:', error);
    throw error;
  }
}
