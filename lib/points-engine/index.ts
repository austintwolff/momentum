import {
  SetPointsInput,
  PointBonus,
  PointsResult,
  ExerciseBaselineData,
  WorkoutCompletionInput,
  WorkoutCompletionResult,
  MusclePointsBreakdown,
  POINTS_CONFIG,
  GoalBucket,
  GOAL_REP_RANGES,
} from './types';

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

/**
 * Calculate estimated one-rep max using Epley formula
 */
export function calculateOneRepMax(weight: number, reps: number): number {
  if (reps === 0 || weight === 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// ============================================================================
// PR DETECTION
// ============================================================================

/**
 * Check if reps fall within a goal bucket's rep range
 */
export function isInGoalRepRange(reps: number, goal: GoalBucket): boolean {
  const range = GOAL_REP_RANGES[goal];
  return reps >= range.min && reps <= range.max;
}

/**
 * Get the best e1RM for a specific goal bucket from baseline data
 */
export function getBestE1rmForGoal(
  baseline: ExerciseBaselineData | null,
  goal: GoalBucket
): number {
  if (!baseline) return 0;

  switch (goal) {
    case 'Strength':
      return baseline.bestE1rmStrength;
    case 'Hypertrophy':
      return baseline.bestE1rmHypertrophy;
    case 'Endurance':
      return baseline.bestE1rmEndurance;
    default:
      return 0;
  }
}

export interface PRCheckResult {
  isPR: boolean;
  currentE1rm: number;
  previousBestE1rm: number;
  improvementPercent: number;
}

/**
 * Check if a set is a PR within the workout's goal bucket.
 * A PR is achieved when the set's e1RM beats the previous best e1RM
 * recorded within that goal's rep range.
 */
export function checkForPR(
  weight: number,
  reps: number,
  goal: GoalBucket,
  baseline: ExerciseBaselineData | null
): PRCheckResult {
  const currentE1rm = calculateOneRepMax(weight, reps);
  const previousBestE1rm = getBestE1rmForGoal(baseline, goal);

  // Must be within the goal's rep range to count as a PR for that goal
  const inRange = isInGoalRepRange(reps, goal);

  // PR if: in range AND beats previous best (or no previous best exists and we have a valid set)
  const isPR = inRange && currentE1rm > previousBestE1rm && currentE1rm > 0;

  const improvementPercent = previousBestE1rm > 0
    ? ((currentE1rm - previousBestE1rm) / previousBestE1rm) * 100
    : 0;

  return {
    isPR,
    currentE1rm,
    previousBestE1rm,
    improvementPercent,
  };
}

/**
 * Get rep range multiplier based on rep count
 * 5-8 reps (hypertrophy sweet spot) gets 1.25x
 */
export function getRepRangeMultiplier(reps: number): number {
  const { REP_MULTIPLIERS } = POINTS_CONFIG;

  if (reps >= REP_MULTIPLIERS.HYPERTROPHY.min && reps <= REP_MULTIPLIERS.HYPERTROPHY.max) {
    return REP_MULTIPLIERS.HYPERTROPHY.multiplier;
  }
  if (reps >= REP_MULTIPLIERS.STRENGTH.min && reps <= REP_MULTIPLIERS.STRENGTH.max) {
    return REP_MULTIPLIERS.STRENGTH.multiplier;
  }
  if (reps >= REP_MULTIPLIERS.HYPERTROPHY_ENDURANCE.min && reps <= REP_MULTIPLIERS.HYPERTROPHY_ENDURANCE.max) {
    return REP_MULTIPLIERS.HYPERTROPHY_ENDURANCE.multiplier;
  }
  if (reps >= REP_MULTIPLIERS.ENDURANCE.min && reps <= REP_MULTIPLIERS.ENDURANCE.max) {
    return REP_MULTIPLIERS.ENDURANCE.multiplier;
  }
  return REP_MULTIPLIERS.HIGH_REP.multiplier;
}

/**
 * Get volume scaling multiplier based on set number for a muscle group
 * Sets 1-6: 100%, Sets 7-10: 75%, Sets 11+: 50%
 */
export function getVolumeScalingMultiplier(setsForMuscle: number): number {
  const { VOLUME_SCALING } = POINTS_CONFIG;

  if (setsForMuscle <= VOLUME_SCALING.FULL_VALUE_SETS) {
    return 1.0;
  }
  if (setsForMuscle <= VOLUME_SCALING.REDUCED_VALUE_SETS) {
    return VOLUME_SCALING.REDUCED_MULTIPLIER;
  }
  return VOLUME_SCALING.MINIMAL_MULTIPLIER;
}

/**
 * Calculate base points for a set
 * Formula: weight × reps (simple volume)
 */
export function calculateBasePoints(input: SetPointsInput): number {
  const { exerciseType, weight, reps, userBodyweight } = input;

  let effectiveWeight: number;
  if (exerciseType === 'weighted') {
    effectiveWeight = weight ?? 0;
  } else {
    // For bodyweight exercises, use 60% of bodyweight as effective weight
    effectiveWeight = userBodyweight * POINTS_CONFIG.BODYWEIGHT_FACTOR;
  }

  // Base points = volume (weight × reps)
  const basePoints = effectiveWeight * reps;
  console.log('[PointsEngine] calculateBasePoints:', { exerciseType, weight, reps, effectiveWeight, basePoints });

  return Math.max(Math.round(basePoints), 1);
}

// ============================================================================
// PROGRESSIVE OVERLOAD
// ============================================================================

/**
 * Calculate progressive overload bonus based on rolling average comparison
 */
export function calculateOverloadBonus(
  currentE1rm: number,
  baseline: ExerciseBaselineData | null
): { bonus: PointBonus | null; improvementPercent: number; tier: 'none' | 'small' | 'moderate' | 'major' } {
  if (!baseline || !baseline.isBaselined || baseline.rollingAvgE1rm === 0) {
    return { bonus: null, improvementPercent: 0, tier: 'none' };
  }

  const improvementPercent = ((currentE1rm - baseline.rollingAvgE1rm) / baseline.rollingAvgE1rm) * 100;

  if (improvementPercent < POINTS_CONFIG.OVERLOAD_TIERS.SMALL.minPercent) {
    return { bonus: null, improvementPercent, tier: 'none' };
  }

  const { OVERLOAD_TIERS } = POINTS_CONFIG;

  if (improvementPercent >= OVERLOAD_TIERS.MAJOR.minPercent) {
    return {
      bonus: {
        type: 'progressive_overload',
        multiplier: OVERLOAD_TIERS.MAJOR.bonus, // Just the bonus portion (e.g., 1.0 for +100%)
        description: `Major PR! +${OVERLOAD_TIERS.MAJOR.bonus * 100}%`,
      },
      improvementPercent,
      tier: 'major',
    };
  }

  if (improvementPercent >= OVERLOAD_TIERS.MODERATE.minPercent) {
    return {
      bonus: {
        type: 'progressive_overload',
        multiplier: OVERLOAD_TIERS.MODERATE.bonus, // Just the bonus portion (e.g., 0.5 for +50%)
        description: `Great progress! +${OVERLOAD_TIERS.MODERATE.bonus * 100}%`,
      },
      improvementPercent,
      tier: 'moderate',
    };
  }

  return {
    bonus: {
      type: 'progressive_overload',
      multiplier: OVERLOAD_TIERS.SMALL.bonus, // Just the bonus portion (e.g., 0.25 for +25%)
      description: `Improvement! +${OVERLOAD_TIERS.SMALL.bonus * 100}%`,
    },
    improvementPercent,
    tier: 'small',
  };
}

// ============================================================================
// STREAK BONUSES
// ============================================================================

/**
 * Get workout streak multiplier
 */
export function getStreakMultiplier(currentStreak: number): number {
  for (const tier of POINTS_CONFIG.STREAK_TIERS) {
    if (currentStreak >= tier.minStreak) {
      return tier.multiplier;
    }
  }
  return 1.0;
}

/**
 * Calculate workout streak bonus
 */
export function calculateStreakBonus(currentStreak: number): PointBonus | null {
  const multiplier = getStreakMultiplier(currentStreak);
  if (multiplier === 1.0) return null;

  const bonusPortion = multiplier - 1; // Convert 1.1 to 0.1 (10% bonus)
  return {
    type: 'workout_streak',
    multiplier: bonusPortion,
    description: `${currentStreak} workout streak! +${Math.round(bonusPortion * 100)}%`,
  };
}

// ============================================================================
// MUSCLE LEVELS
// ============================================================================

/**
 * Calculate XP required for a specific level
 */
export function xpForLevel(level: number): number {
  const { BASE_XP, GROWTH_RATE } = POINTS_CONFIG.LEVELS;
  return Math.floor(BASE_XP * Math.pow(GROWTH_RATE, level));
}

/**
 * Calculate total XP required to reach a level from 0
 */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

/**
 * Calculate level and remaining XP from total XP
 */
export function calculateLevelFromXp(totalXp: number): { level: number; currentXp: number; xpForNext: number } {
  let level = 0;
  let remainingXp = totalXp;

  while (level < POINTS_CONFIG.LEVELS.MAX_LEVEL) {
    const required = xpForLevel(level);
    if (remainingXp < required) {
      return { level, currentXp: remainingXp, xpForNext: required };
    }
    remainingXp -= required;
    level++;
  }

  return { level: POINTS_CONFIG.LEVELS.MAX_LEVEL, currentXp: remainingXp, xpForNext: 0 };
}

// ============================================================================
// MAIN CALCULATION
// ============================================================================

/**
 * Calculate total points for a completed set with all bonuses
 */
export function calculateSetPoints(
  input: SetPointsInput,
  baseline: ExerciseBaselineData | null,
  currentStreak: number = 0
): PointsResult {
  const bonuses: PointBonus[] = [];

  // Calculate base points
  const basePoints = calculateBasePoints(input);

  // Calculate current e1RM
  const effectiveWeight = input.exerciseType === 'weighted'
    ? (input.weight ?? 0)
    : input.userBodyweight * POINTS_CONFIG.BODYWEIGHT_FACTOR;
  const currentE1rm = calculateOneRepMax(effectiveWeight, input.reps);

  // Progressive overload bonus
  const overloadResult = calculateOverloadBonus(currentE1rm, baseline);
  if (overloadResult.bonus) {
    bonuses.push(overloadResult.bonus);
  }

  // Rep range bonus - hypertrophy range (5-8 reps) gets bonus
  const repMultiplier = getRepRangeMultiplier(input.reps);
  if (repMultiplier !== 1.0) {
    const bonusPercent = Math.round((repMultiplier - 1) * 100);
    bonuses.push({
      type: 'hypertrophy_rep_range',
      multiplier: repMultiplier - 1, // The bonus portion (e.g., 0.25 for 25%)
      description: bonusPercent > 0
        ? `Hypertrophy range (${input.reps} reps)`
        : `High rep endurance (${input.reps} reps)`,
    });
  }

  // Volume scaling (diminishing returns)
  const volumeMultiplier = getVolumeScalingMultiplier(input.setsForMuscleInWorkout);
  if (volumeMultiplier < 1.0) {
    bonuses.push({
      type: 'volume_scaling',
      multiplier: volumeMultiplier,
      description: `Set ${input.setsForMuscleInWorkout} for ${input.primaryMuscle} (${volumeMultiplier * 100}%)`,
    });
  }

  // Workout streak bonus
  const streakBonus = calculateStreakBonus(currentStreak);
  if (streakBonus) {
    bonuses.push(streakBonus);
  }

  // Combine all multipliers
  // Bonuses are additive (e.g., +25% hypertrophy + 10% streak = ×1.35)
  let totalBonusMultiplier = 0;
  let volumeScaling = 1.0;

  for (const bonus of bonuses) {
    if (bonus.type === 'volume_scaling') {
      // Volume scaling is multiplicative (reduces points for high set counts)
      volumeScaling = bonus.multiplier;
    } else {
      // Other bonuses are additive
      totalBonusMultiplier += bonus.multiplier;
    }
  }

  const combinedMultiplier = (1 + totalBonusMultiplier) * volumeScaling;

  const finalPoints = Math.max(Math.floor(basePoints * combinedMultiplier), 1);

  // Create muscle breakdown (for compound exercises, points go to all muscles)
  const muscleBreakdown: MusclePointsBreakdown[] = [{
    muscleGroup: input.primaryMuscle,
    basePoints,
    finalPoints,
    xpGained: finalPoints,
  }];

  return {
    basePoints,
    multiplier: combinedMultiplier,
    finalPoints,
    bonuses,
    muscleBreakdown,
    progressiveOverload: {
      isImprovement: overloadResult.tier !== 'none',
      improvementPercent: overloadResult.improvementPercent,
      tier: overloadResult.tier,
    },
    baselineStatus: {
      isBaselined: baseline?.isBaselined ?? false,
      workoutsCompleted: baseline?.workoutCount ?? 0,
      workoutsRequired: POINTS_CONFIG.BASELINE.WORKOUTS_REQUIRED,
    },
  };
}

// ============================================================================
// WORKOUT COMPLETION
// ============================================================================

/**
 * Calculate bonus points for completing a workout
 */
export function calculateWorkoutCompletionBonus(input: WorkoutCompletionInput): WorkoutCompletionResult {
  let baseCompletion = 50;
  let durationBonus = 0;
  let volumeBonus = 0;

  // Duration bonus
  if (input.durationMinutes >= 60) {
    durationBonus = 50;
  } else if (input.durationMinutes >= 30) {
    durationBonus = 25;
  }

  // Volume bonus
  if (input.totalSets >= 20) {
    volumeBonus = 50;
  } else if (input.totalSets >= 10) {
    volumeBonus = 25;
  }

  return {
    bonusPoints: baseCompletion + durationBonus + volumeBonus,
    breakdown: {
      baseCompletion,
      durationBonus,
      volumeBonus,
    },
  };
}

// ============================================================================
// BASELINE UTILITIES
// ============================================================================

/**
 * Update rolling average with new session data
 */
export function updateRollingAverage(
  sessionHistory: { e1rm: number; date: string; weight: number; reps: number }[],
  newSession: { e1rm: number; date: string; weight: number; reps: number }
): { newHistory: typeof sessionHistory; newAverage: number } {
  const maxSessions = POINTS_CONFIG.BASELINE.ROLLING_WINDOW;

  // Add new session and trim to window size
  const newHistory = [...sessionHistory, newSession].slice(-maxSessions);

  // Calculate new average
  const sum = newHistory.reduce((acc, s) => acc + s.e1rm, 0);
  const newAverage = newHistory.length > 0 ? sum / newHistory.length : 0;

  return { newHistory, newAverage };
}

// ============================================================================
// WEEK UTILITIES
// ============================================================================

/**
 * Get Monday of the current week
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateAsISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

export * from './types';
