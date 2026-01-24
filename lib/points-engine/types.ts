import { BaselineSessionEntry } from '@/types/database';

// ============================================================================
// GOAL BUCKETS
// ============================================================================

export type GoalBucket = 'Strength' | 'Hypertrophy' | 'Endurance';

export const GOAL_REP_RANGES: Record<GoalBucket, { min: number; max: number }> = {
  Strength: { min: 1, max: 6 },
  Hypertrophy: { min: 6, max: 12 },
  Endurance: { min: 12, max: Infinity },
};

// ============================================================================
// CORE INPUT TYPES
// ============================================================================

export interface SetPointsInput {
  exerciseId: string;
  exerciseName: string;
  exerciseType: 'weighted' | 'bodyweight';
  isCompound: boolean;
  primaryMuscle: string;
  weight: number | null;
  reps: number;
  setNumberInWorkout: number;
  setsForMuscleInWorkout: number;
  userBodyweight: number;
}

export interface ExerciseBaselineData {
  isBaselined: boolean;
  workoutCount: number;
  rollingAvgE1rm: number;
  sessionHistory: BaselineSessionEntry[];
  bestE1rm: number;
  bestE1rmStrength: number;
  bestE1rmHypertrophy: number;
  bestE1rmEndurance: number;
}

export interface MuscleGroupContext {
  muscleGroup: string;
  setsThisWorkout: number;
  setsThisWeek: number;
  workoutsThisWeek: number;
  currentLevel: number;
  currentXp: number;
}

export interface UserPointsContext {
  userId: string;
  bodyweight: number;
  currentStreak: number;
  exerciseBaselines: Map<string, ExerciseBaselineData>;
  muscleContexts: Map<string, MuscleGroupContext>;
}

// ============================================================================
// OUTPUT TYPES
// ============================================================================

export type BonusType =
  | 'progressive_overload'
  | 'hypertrophy_rep_range'
  | 'workout_streak'
  | 'weekly_consistency'
  | 'volume_scaling'
  | 'rune_pr_hunter'
  | 'rune_effect'
  | 'charm_pr_bonus'
  | 'charm_first_set'
  | 'charm_compound'
  | 'charm_volume'
  | 'charm_streak'
  | 'charm_effect';

export interface PointBonus {
  type: BonusType;
  multiplier: number;
  description: string;
  flatBonus?: number; // For bonuses that add flat points instead of multipliers
}

export interface MusclePointsBreakdown {
  muscleGroup: string;
  basePoints: number;
  finalPoints: number;
  xpGained: number;
}

export interface PointsResult {
  basePoints: number;
  multiplier: number;
  finalPoints: number;
  bonuses: PointBonus[];
  muscleBreakdown: MusclePointsBreakdown[];
  progressiveOverload: {
    isImprovement: boolean;
    improvementPercent: number;
    tier: 'none' | 'small' | 'moderate' | 'major';
  };
  baselineStatus: {
    isBaselined: boolean;
    workoutsCompleted: number;
    workoutsRequired: number;
  };
}

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

export const POINTS_CONFIG = {
  BASE_DIVISOR: 10,

  REP_MULTIPLIERS: {
    STRENGTH: { min: 1, max: 4, multiplier: 1.0 },
    HYPERTROPHY: { min: 5, max: 8, multiplier: 1.25 },
    HYPERTROPHY_ENDURANCE: { min: 9, max: 12, multiplier: 1.0 },
    ENDURANCE: { min: 13, max: 20, multiplier: 0.9 },
    HIGH_REP: { min: 21, max: Infinity, multiplier: 0.75 },
  },

  OVERLOAD_TIERS: {
    SMALL: { minPercent: 1, maxPercent: 5, bonus: 0.25 },
    MODERATE: { minPercent: 5, maxPercent: 15, bonus: 0.5 },
    MAJOR: { minPercent: 15, maxPercent: Infinity, bonus: 1.0 },
  },

  VOLUME_SCALING: {
    FULL_VALUE_SETS: 10,
    REDUCED_VALUE_SETS: 14,
    REDUCED_MULTIPLIER: 0.75,
    MINIMAL_MULTIPLIER: 0.5,
  },

  CONSISTENCY: {
    ACTIVE: { minWorkouts: 1, minSets: 6, bonus: 0.1 },
    DEDICATED: { minWorkouts: 2, minSets: 10, bonus: 0.25 },
  },

  BASELINE: {
    WORKOUTS_REQUIRED: 3,
    ROLLING_WINDOW: 4,
  },

  LEVELS: {
    MAX_LEVEL: 50,
    BASE_XP: 133, // Increased ~33% from 100
    GROWTH_RATE: 1.15,
  },

  DECAY: {
    WEEK_1: 0.03,
    WEEK_2: 0.05,
    WEEK_3_PLUS: 0.08,
  },

  BODYWEIGHT_FACTOR: 0.65,

  STREAK_TIERS: [
    { minStreak: 28, multiplier: 1.5 },
    { minStreak: 21, multiplier: 1.4 },
    { minStreak: 14, multiplier: 1.3 },
    { minStreak: 7, multiplier: 1.2 },
    { minStreak: 3, multiplier: 1.1 },
  ],
} as const;

// ============================================================================
// WORKOUT COMPLETION
// ============================================================================

export interface WorkoutCompletionInput {
  totalSets: number;
  durationMinutes: number;
  exerciseCount: number;
}

export interface WorkoutCompletionResult {
  bonusPoints: number;
  breakdown: {
    baseCompletion: number;
    durationBonus: number;
    volumeBonus: number;
  };
}

// Legacy types for backwards compatibility
export interface PreviousBest {
  weight: number;
  reps: number;
  oneRepMax: number;
}
