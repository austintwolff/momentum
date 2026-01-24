/**
 * Muscle XP System
 *
 * XP earning per set:
 * - Base: 8 XP per set
 * - Split across muscles: 100% (1 tag), 75%/25% (2 tags), 60%/25%/15% (3 tags)
 * - Rolling 7-day diminishing returns: 100% (1-15 sets), 50% (16-25), 20% (26+)
 * - PR bonus: 2x XP for sets that achieve a PR
 *
 * Level XP Requirements (two-phase curve):
 * - Onboarding (Levels 1-5): XP = 120 * 1.12^(L-1)
 *   (0→1: 120, 1→2: 134, 2→3: 150, 3→4: 168, 4→5: 188)
 * - Main curve (Levels 6-25): XP = 300 * 1.10^(L-6)
 *   (5→6: 300, 6→7: 330, ..., 24→25: 1834)
 * - Total to level 25: ~10,541 XP
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const MUSCLE_XP_CONFIG = {
  BASE_XP_PER_SET: 8,
  MAX_LEVEL: 25,
  MIN_LEVEL: 1, // Decay never drops below this

  // XP split percentages by muscle order
  SPLIT: {
    ONE_MUSCLE: [1.0], // 100% to primary
    TWO_MUSCLES: [0.75, 0.25], // 75% primary, 25% secondary
    THREE_MUSCLES: [0.60, 0.25, 0.15], // 60% primary, 25% secondary, 15% tertiary
  },

  // Diminishing returns tiers (sets in rolling 7 days)
  DIMINISHING_RETURNS: {
    FULL_VALUE_SETS: 15, // Sets 1-15: 100%
    REDUCED_VALUE_SETS: 25, // Sets 16-25: 50%
    FULL_MULTIPLIER: 1.0,
    REDUCED_MULTIPLIER: 0.5,
    MINIMAL_MULTIPLIER: 0.2, // Sets 26+: 20%
  },

  PR_BONUS_MULTIPLIER: 2.0,

  // Level curve parameters (two-phase system)
  ONBOARDING: {
    MAX_LEVEL: 4, // Levels 0-4 use onboarding curve
    BASE_XP: 120,
    GROWTH_RATE: 1.12,
  },
  MAIN_CURVE: {
    START_LEVEL: 5, // Levels 5+ use main curve
    BASE_XP: 300,
    GROWTH_RATE: 1.10,
  },

  // Decay parameters
  DECAY: {
    GRACE_PERIOD_DAYS: 7, // No decay within 7 days
    DAYS_PER_LEVEL_LOSS: 7, // Lose 1 level per 7 days after grace period
  },
} as const;

// ============================================================================
// LEVEL CALCULATIONS
// ============================================================================

/**
 * Calculate XP required to reach level L (from level L-1)
 * Two-phase curve:
 * - Onboarding (L 1-5): 120 * 1.12^(L-1)
 * - Main curve (L 6-25): 300 * 1.10^(L-6)
 */
export function xpForMuscleLevel(level: number): number {
  if (level < 1) return 0;
  if (level > MUSCLE_XP_CONFIG.MAX_LEVEL) return Number.MAX_SAFE_INTEGER;

  const { ONBOARDING, MAIN_CURVE } = MUSCLE_XP_CONFIG;

  // Onboarding levels 1-5: uses 120 * 1.12^(L-1)
  if (level <= ONBOARDING.MAX_LEVEL + 1) {
    return Math.floor(ONBOARDING.BASE_XP * Math.pow(ONBOARDING.GROWTH_RATE, level - 1));
  }

  // Main curve levels 6-25: uses 300 * 1.10^(L-6)
  return Math.floor(MAIN_CURVE.BASE_XP * Math.pow(MAIN_CURVE.GROWTH_RATE, level - MAIN_CURVE.START_LEVEL - 1));
}

/**
 * Calculate total cumulative XP required to reach a level from 0
 */
export function totalXpForMuscleLevel(level: number): number {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    total += xpForMuscleLevel(i);
  }
  return total;
}

/**
 * Calculate level and progress from total XP
 */
export function calculateMuscleLevelFromXp(totalXp: number): {
  level: number;
  currentXp: number;
  xpForNext: number;
  progress: number; // 0-1
} {
  let level = 0;
  let remainingXp = totalXp;

  while (level < MUSCLE_XP_CONFIG.MAX_LEVEL) {
    const required = xpForMuscleLevel(level + 1);
    if (remainingXp < required) {
      return {
        level,
        currentXp: remainingXp,
        xpForNext: required,
        progress: required > 0 ? remainingXp / required : 0,
      };
    }
    remainingXp -= required;
    level++;
  }

  // Max level reached
  return {
    level: MUSCLE_XP_CONFIG.MAX_LEVEL,
    currentXp: remainingXp,
    xpForNext: 0,
    progress: 1,
  };
}

// ============================================================================
// XP CALCULATION
// ============================================================================

export interface MuscleTag {
  muscleGroup: string;
  order: number; // 1 = primary, 2 = secondary, 3 = tertiary
}

export interface MuscleXpResult {
  muscleGroup: string;
  baseXp: number;
  splitXp: number;
  diminishingMultiplier: number;
  prMultiplier: number;
  finalXp: number;
}

/**
 * Get the diminishing returns multiplier based on rolling 7-day set count
 */
export function getDiminishingMultiplier(rolling7DaySets: number): number {
  const { DIMINISHING_RETURNS } = MUSCLE_XP_CONFIG;

  if (rolling7DaySets <= DIMINISHING_RETURNS.FULL_VALUE_SETS) {
    return DIMINISHING_RETURNS.FULL_MULTIPLIER;
  }
  if (rolling7DaySets <= DIMINISHING_RETURNS.REDUCED_VALUE_SETS) {
    return DIMINISHING_RETURNS.REDUCED_MULTIPLIER;
  }
  return DIMINISHING_RETURNS.MINIMAL_MULTIPLIER;
}

/**
 * Get XP split percentages based on number of muscles tagged
 */
export function getXpSplitPercentages(muscleCount: number): readonly number[] {
  const { SPLIT } = MUSCLE_XP_CONFIG;

  if (muscleCount === 1) return SPLIT.ONE_MUSCLE;
  if (muscleCount === 2) return SPLIT.TWO_MUSCLES;
  return SPLIT.THREE_MUSCLES;
}

/**
 * Calculate muscle XP for a single logged set
 *
 * @param muscleTags - Array of muscles this exercise works (ordered by primary/secondary/tertiary)
 * @param rolling7DayCounts - Map of muscle -> set count in last 7 days
 * @param isPR - Whether this set achieved a PR
 * @returns Array of XP awards per muscle
 */
export function calculateSetMuscleXp(
  muscleTags: MuscleTag[],
  rolling7DayCounts: Map<string, number>,
  isPR: boolean
): MuscleXpResult[] {
  const baseXp = MUSCLE_XP_CONFIG.BASE_XP_PER_SET;
  const prMultiplier = isPR ? MUSCLE_XP_CONFIG.PR_BONUS_MULTIPLIER : 1.0;

  // Sort by order to ensure primary comes first
  const sortedTags = [...muscleTags].sort((a, b) => a.order - b.order);

  // Limit to 3 muscles max
  const tagsToUse = sortedTags.slice(0, 3);
  const splitPercentages = getXpSplitPercentages(tagsToUse.length);

  const results: MuscleXpResult[] = [];

  for (let i = 0; i < tagsToUse.length; i++) {
    const tag = tagsToUse[i];
    const splitPercent = splitPercentages[i] || 0;

    // Get rolling 7-day count for this muscle
    const rolling7DaySets = rolling7DayCounts.get(tag.muscleGroup.toLowerCase()) || 0;
    const diminishingMultiplier = getDiminishingMultiplier(rolling7DaySets);

    // Calculate XP: base * split * diminishing * PR
    const splitXp = Math.round(baseXp * splitPercent);
    const finalXp = Math.round(splitXp * diminishingMultiplier * prMultiplier);

    results.push({
      muscleGroup: tag.muscleGroup,
      baseXp,
      splitXp,
      diminishingMultiplier,
      prMultiplier,
      finalXp,
    });
  }

  return results;
}

/**
 * Create muscle tags from exercise data
 * Falls back to primary muscle if no mapping exists
 */
export function createMuscleTags(
  exerciseMuscles: { muscleGroup: string; order: number }[],
  primaryMuscle: string
): MuscleTag[] {
  if (exerciseMuscles.length > 0) {
    return exerciseMuscles.map((m) => ({
      muscleGroup: m.muscleGroup,
      order: m.order,
    }));
  }

  // Fallback: use primary muscle only
  return [{ muscleGroup: primaryMuscle, order: 1 }];
}

// ============================================================================
// DECAY CALCULATIONS
// ============================================================================

export type DecayStatus = 'active' | 'resting' | 'decaying';

export interface DecayedMuscleLevel {
  originalLevel: number;
  originalProgress: number;
  effectiveLevel: number;
  effectiveProgress: number;
  decayStatus: DecayStatus;
  levelsLost: number;
  daysSinceTraining: number | null;
}

/**
 * Calculate the number of days since a muscle was last trained
 */
export function getDaysSinceTraining(lastTrainedAt: string | null): number | null {
  if (!lastTrainedAt) return null;

  const lastTrained = new Date(lastTrainedAt);
  const now = new Date();

  // Reset to start of day for accurate day counting
  lastTrained.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffMs = now.getTime() - lastTrained.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate decay for a muscle based on last training date
 *
 * Decay rules:
 * - Grace period: No decay if trained within last 7 days
 * - After 7 days: Reset progress to 0 (keep level)
 * - Every additional 7 days: Drop 1 level (never below level 1)
 */
export function calculateMuscleDecay(
  storedLevel: number,
  storedProgress: number,
  lastTrainedAt: string | null
): DecayedMuscleLevel {
  const { DECAY, MIN_LEVEL } = MUSCLE_XP_CONFIG;
  const daysSinceTraining = getDaysSinceTraining(lastTrainedAt);

  // Never trained or no data - no decay to apply
  if (daysSinceTraining === null) {
    return {
      originalLevel: storedLevel,
      originalProgress: storedProgress,
      effectiveLevel: storedLevel,
      effectiveProgress: storedProgress,
      decayStatus: 'active',
      levelsLost: 0,
      daysSinceTraining: null,
    };
  }

  // Within grace period - no decay
  if (daysSinceTraining <= DECAY.GRACE_PERIOD_DAYS) {
    return {
      originalLevel: storedLevel,
      originalProgress: storedProgress,
      effectiveLevel: storedLevel,
      effectiveProgress: storedProgress,
      decayStatus: 'active',
      levelsLost: 0,
      daysSinceTraining,
    };
  }

  // Past grace period - calculate decay
  const daysOverdue = daysSinceTraining - DECAY.GRACE_PERIOD_DAYS;
  const levelsToLose = Math.floor(daysOverdue / DECAY.DAYS_PER_LEVEL_LOSS);

  // Progress is always reset to 0 once past grace period
  const effectiveLevel = Math.max(MIN_LEVEL, storedLevel - levelsToLose);
  const actualLevelsLost = storedLevel - effectiveLevel;

  // Determine status: 'resting' if just progress reset, 'decaying' if levels lost
  const decayStatus: DecayStatus = levelsToLose > 0 ? 'decaying' : 'resting';

  return {
    originalLevel: storedLevel,
    originalProgress: storedProgress,
    effectiveLevel,
    effectiveProgress: 0,
    decayStatus,
    levelsLost: actualLevelsLost,
    daysSinceTraining,
  };
}

// ============================================================================
// XP ANIMATION HELPERS
// ============================================================================

export interface EstimatedMuscleXpGain {
  muscleGroup: string;
  startLevel: number;
  startProgress: number;
  xpGained: number;
  endLevel: number;
  endProgress: number;
  leveledUp: boolean;
}

/**
 * Estimate XP gains for animation purposes (client-side approximation)
 * Does not include diminishing returns since we don't have rolling counts client-side
 *
 * @param muscles - Array of muscle groups worked (up to 3)
 * @param setCount - Number of sets completed
 * @param prCount - Number of PR sets
 * @param currentLevels - Map of muscle -> { level, progress (0-1) }
 */
export function estimateExerciseXpGains(
  muscles: string[],
  setCount: number,
  prCount: number,
  currentLevels: Map<string, { level: number; progress: number }>
): EstimatedMuscleXpGain[] {
  if (muscles.length === 0 || setCount === 0) return [];

  const muscleCount = Math.min(muscles.length, 3);
  const splitPercentages = getXpSplitPercentages(muscleCount);
  const baseXp = MUSCLE_XP_CONFIG.BASE_XP_PER_SET;

  const results: EstimatedMuscleXpGain[] = [];

  for (let i = 0; i < muscleCount; i++) {
    const muscle = muscles[i];
    const splitPercent = splitPercentages[i] || 0;

    // Calculate XP for this muscle
    // Regular sets + PR bonus for PR sets
    const regularSets = setCount - prCount;
    const regularXp = Math.round(regularSets * baseXp * splitPercent);
    const prXp = Math.round(prCount * baseXp * splitPercent * MUSCLE_XP_CONFIG.PR_BONUS_MULTIPLIER);
    const totalXp = regularXp + prXp;

    // Get current state
    const current = currentLevels.get(muscle.toLowerCase()) || { level: 0, progress: 0 };
    const startLevel = current.level;
    const startProgress = current.progress;

    // Calculate current XP in level and add gained XP
    const xpForCurrentLevel = startLevel >= MUSCLE_XP_CONFIG.MAX_LEVEL
      ? 0
      : xpForMuscleLevel(startLevel + 1);
    const currentXpInLevel = Math.round(startProgress * xpForCurrentLevel);
    const newXpInLevel = currentXpInLevel + totalXp;

    // Check for level up
    let endLevel = startLevel;
    let remainingXp = newXpInLevel;

    while (endLevel < MUSCLE_XP_CONFIG.MAX_LEVEL) {
      const xpNeeded = xpForMuscleLevel(endLevel + 1);
      if (remainingXp >= xpNeeded) {
        remainingXp -= xpNeeded;
        endLevel++;
      } else {
        break;
      }
    }

    // Calculate end progress
    const xpForEndLevel = endLevel >= MUSCLE_XP_CONFIG.MAX_LEVEL
      ? 0
      : xpForMuscleLevel(endLevel + 1);
    const endProgress = xpForEndLevel > 0
      ? Math.min(1, remainingXp / xpForEndLevel)
      : 1;

    results.push({
      muscleGroup: muscle,
      startLevel,
      startProgress,
      xpGained: totalXp,
      endLevel,
      endProgress,
      leveledUp: endLevel > startLevel,
    });
  }

  return results;
}
