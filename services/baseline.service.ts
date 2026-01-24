import { supabase } from '@/lib/supabase';
import {
  ExerciseBaseline,
  MuscleLevel,
  WeeklyMuscleStats,
  BaselineSessionEntry,
} from '@/types/database';
import {
  calculateOneRepMax,
  updateRollingAverage,
  getWeekStart,
  formatDateAsISO,
  POINTS_CONFIG,
  ExerciseBaselineData,
  GoalBucket,
  isInGoalRepRange,
} from '@/lib/points-engine';
import {
  calculateMuscleLevelFromXp,
  MUSCLE_XP_CONFIG,
  MuscleTag,
} from '@/lib/muscle-xp';

// Type assertion helper for new tables not yet in generated types
const db = supabase as any;

// ============================================================================
// EXERCISE BASELINES
// ============================================================================

/**
 * Get or create exercise baseline for a user
 */
export async function getOrCreateBaseline(
  userId: string,
  exerciseId: string
): Promise<ExerciseBaseline | null> {
  // Try to get existing
  const { data: existing } = await db
    .from('exercise_baselines')
    .select('*')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .single();

  if (existing) return existing;

  // Create new baseline
  const { data: created, error } = await db
    .from('exercise_baselines')
    .insert({
      user_id: userId,
      exercise_id: exerciseId,
      rolling_avg_e1rm: 0,
      session_history: [],
      workout_count: 0,
      is_baselined: false,
      best_e1rm: 0,
      best_e1rm_strength: 0,
      best_e1rm_hypertrophy: 0,
      best_e1rm_endurance: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating baseline:', error);
    return null;
  }

  return created;
}

/**
 * Get all baselines for a user
 */
export async function getUserBaselines(userId: string): Promise<Map<string, ExerciseBaselineData>> {
  const { data, error } = await db
    .from('exercise_baselines')
    .select('*')
    .eq('user_id', userId);

  if (error || !data) {
    console.error('Error fetching baselines:', error);
    return new Map();
  }

  const map = new Map<string, ExerciseBaselineData>();
  for (const baseline of data) {
    map.set(baseline.exercise_id, {
      isBaselined: baseline.is_baselined,
      workoutCount: baseline.workout_count,
      rollingAvgE1rm: baseline.rolling_avg_e1rm,
      sessionHistory: baseline.session_history as BaselineSessionEntry[],
      bestE1rm: baseline.best_e1rm,
      bestE1rmStrength: baseline.best_e1rm_strength || 0,
      bestE1rmHypertrophy: baseline.best_e1rm_hypertrophy || 0,
      bestE1rmEndurance: baseline.best_e1rm_endurance || 0,
    });
  }

  return map;
}

/**
 * Update baseline after completing sets for an exercise in a workout
 */
export async function updateBaselineAfterWorkout(
  userId: string,
  exerciseId: string,
  bestSetWeight: number,
  bestSetReps: number
): Promise<void> {
  const baseline = await getOrCreateBaseline(userId, exerciseId);
  if (!baseline) return;

  const currentE1rm = calculateOneRepMax(bestSetWeight, bestSetReps);
  const now = new Date();

  // Update session history and rolling average
  const { newHistory, newAverage } = updateRollingAverage(
    baseline.session_history as BaselineSessionEntry[],
    {
      e1rm: currentE1rm,
      date: now.toISOString(),
      weight: bestSetWeight,
      reps: bestSetReps,
    }
  );

  const newWorkoutCount = baseline.workout_count + 1;
  const isNowBaselined = newWorkoutCount >= POINTS_CONFIG.BASELINE.WORKOUTS_REQUIRED;

  // Check for new PR
  const newBestE1rm = currentE1rm > baseline.best_e1rm ? currentE1rm : baseline.best_e1rm;
  const newBestDate = currentE1rm > baseline.best_e1rm ? now.toISOString() : baseline.best_e1rm_date;

  const { error } = await db
    .from('exercise_baselines')
    .update({
      rolling_avg_e1rm: newAverage,
      session_history: newHistory,
      workout_count: newWorkoutCount,
      is_baselined: isNowBaselined,
      best_e1rm: newBestE1rm,
      best_e1rm_date: newBestDate,
      updated_at: now.toISOString(),
    })
    .eq('id', baseline.id);

  if (error) {
    console.error('Error updating baseline:', error);
  }
}

/**
 * Update the goal-bucket-specific best e1RM after a PR is set
 */
export async function updateGoalBucketPR(
  userId: string,
  exerciseId: string,
  weight: number,
  reps: number,
  goal: GoalBucket
): Promise<void> {
  // Only update if the set is in the goal's rep range
  if (!isInGoalRepRange(reps, goal)) return;

  const baseline = await getOrCreateBaseline(userId, exerciseId);
  if (!baseline) return;

  const currentE1rm = calculateOneRepMax(weight, reps);

  // Get current best for this goal bucket
  let currentBest: number;
  let fieldName: string;

  switch (goal) {
    case 'Strength':
      currentBest = baseline.best_e1rm_strength || 0;
      fieldName = 'best_e1rm_strength';
      break;
    case 'Hypertrophy':
      currentBest = baseline.best_e1rm_hypertrophy || 0;
      fieldName = 'best_e1rm_hypertrophy';
      break;
    case 'Endurance':
      currentBest = baseline.best_e1rm_endurance || 0;
      fieldName = 'best_e1rm_endurance';
      break;
  }

  // Only update if this is a new PR for this goal bucket
  if (currentE1rm <= currentBest) return;

  const { error } = await db
    .from('exercise_baselines')
    .update({
      [fieldName]: currentE1rm,
      updated_at: new Date().toISOString(),
    })
    .eq('id', baseline.id);

  if (error) {
    console.error('Error updating goal bucket PR:', error);
  }
}

// ============================================================================
// MUSCLE LEVELS
// ============================================================================

/**
 * Get or create muscle level for a user
 */
export async function getOrCreateMuscleLevel(
  userId: string,
  muscleGroup: string
): Promise<MuscleLevel | null> {
  const { data: existing } = await db
    .from('muscle_levels')
    .select('*')
    .eq('user_id', userId)
    .eq('muscle_group', muscleGroup)
    .single();

  if (existing) return existing;

  const { data: created, error } = await db
    .from('muscle_levels')
    .insert({
      user_id: userId,
      muscle_group: muscleGroup,
      current_level: 0,
      current_xp: 0,
      total_xp_earned: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating muscle level:', error);
    return null;
  }

  return created;
}

/**
 * Get all muscle levels for a user
 */
export async function getUserMuscleLevels(userId: string): Promise<MuscleLevel[]> {
  const { data, error } = await db
    .from('muscle_levels')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching muscle levels:', error);
    return [];
  }

  return data || [];
}

/**
 * Add XP to a muscle group (uses new level 1-25 curve)
 */
export async function addMuscleXp(
  userId: string,
  muscleGroup: string,
  xpAmount: number
): Promise<{ newLevel: number; leveledUp: boolean }> {
  const muscleLevel = await getOrCreateMuscleLevel(userId, muscleGroup);
  if (!muscleLevel) {
    return { newLevel: 0, leveledUp: false };
  }

  const newTotalXp = muscleLevel.total_xp_earned + xpAmount;
  const { level: newLevel, currentXp } = calculateMuscleLevelFromXp(newTotalXp);

  // Cap at max level
  const cappedLevel = Math.min(newLevel, MUSCLE_XP_CONFIG.MAX_LEVEL);
  const leveledUp = cappedLevel > muscleLevel.current_level;

  const { error } = await db
    .from('muscle_levels')
    .update({
      current_level: cappedLevel,
      current_xp: currentXp,
      total_xp_earned: newTotalXp,
      last_trained_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', muscleLevel.id);

  if (error) {
    console.error('Error updating muscle XP:', error);
  }

  return { newLevel: cappedLevel, leveledUp };
}

// ============================================================================
// WEEKLY MUSCLE STATS
// ============================================================================

/**
 * Get or create weekly stats for a muscle group
 */
export async function getOrCreateWeeklyStats(
  userId: string,
  muscleGroup: string,
  weekStart?: Date
): Promise<WeeklyMuscleStats | null> {
  const week = formatDateAsISO(weekStart || getWeekStart());

  const { data: existing } = await db
    .from('weekly_muscle_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('muscle_group', muscleGroup)
    .eq('week_start', week)
    .single();

  if (existing) return existing;

  const { data: created, error } = await db
    .from('weekly_muscle_stats')
    .insert({
      user_id: userId,
      muscle_group: muscleGroup,
      week_start: week,
      workout_count: 0,
      total_sets: 0,
      total_points: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating weekly stats:', error);
    return null;
  }

  return created;
}

/**
 * Update weekly stats after a workout
 */
export async function updateWeeklyStats(
  userId: string,
  muscleGroup: string,
  setsAdded: number,
  pointsAdded: number,
  isNewWorkout: boolean
): Promise<void> {
  const stats = await getOrCreateWeeklyStats(userId, muscleGroup);
  if (!stats) return;

  const { error } = await db
    .from('weekly_muscle_stats')
    .update({
      workout_count: isNewWorkout ? stats.workout_count + 1 : stats.workout_count,
      total_sets: stats.total_sets + setsAdded,
      total_points: stats.total_points + pointsAdded,
      updated_at: new Date().toISOString(),
    })
    .eq('id', stats.id);

  if (error) {
    console.error('Error updating weekly stats:', error);
  }
}

/**
 * Get weekly stats for all muscles for current week
 */
export async function getCurrentWeekStats(userId: string): Promise<WeeklyMuscleStats[]> {
  const weekStart = formatDateAsISO(getWeekStart());

  const { data, error } = await db
    .from('weekly_muscle_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart);

  if (error) {
    console.error('Error fetching weekly stats:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// COMPOUND EXERCISE MUSCLE MAPPING
// ============================================================================

/**
 * Get all muscle groups an exercise works
 */
export async function getExerciseMuscles(exerciseName: string): Promise<string[]> {
  const { data, error } = await db
    .from('exercise_muscle_map')
    .select('muscle_group')
    .eq('exercise_name', exerciseName);

  if (error || !data || data.length === 0) {
    // If not found in map, return empty (caller should use primary muscle)
    return [];
  }

  return data.map((row: any) => row.muscle_group);
}

/**
 * Get muscle groups for multiple exercises at once
 */
export async function getExerciseMusclesBatch(
  exerciseNames: string[]
): Promise<Map<string, string[]>> {
  const { data, error } = await db
    .from('exercise_muscle_map')
    .select('exercise_name, muscle_group')
    .in('exercise_name', exerciseNames);

  const map = new Map<string, string[]>();

  if (error || !data) {
    return map;
  }

  for (const row of data) {
    const existing = map.get(row.exercise_name) || [];
    existing.push(row.muscle_group);
    map.set(row.exercise_name, existing);
  }

  return map;
}

// ============================================================================
// BASELINE STATUS
// ============================================================================

/**
 * Get baseline status for dashboard display
 */
export async function getBaselineStatus(userId: string): Promise<{
  total: number;
  completed: number;
  inProgress: number;
}> {
  const { data: baselines } = await db
    .from('exercise_baselines')
    .select('exercise_id, is_baselined, workout_count')
    .eq('user_id', userId);

  if (!baselines || baselines.length === 0) {
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
    };
  }

  const completed = baselines.filter((b: any) => b.is_baselined).length;
  const inProgress = baselines.filter((b: any) => !b.is_baselined).length;

  return {
    total: baselines.length,
    completed,
    inProgress,
  };
}

// ============================================================================
// MUSCLE XP SYSTEM
// ============================================================================

/**
 * Get muscle groups with order for an exercise (for XP split calculation)
 * Returns muscles sorted by order (1=primary, 2=secondary, 3=tertiary)
 */
export async function getExerciseMusclesWithOrder(
  exerciseName: string
): Promise<MuscleTag[]> {
  const { data, error } = await db
    .from('exercise_muscle_map')
    .select('muscle_group, muscle_order')
    .eq('exercise_name', exerciseName)
    .order('muscle_order', { ascending: true });

  if (error || !data || data.length === 0) {
    return [];
  }

  return data.map((row: any) => ({
    muscleGroup: row.muscle_group,
    order: row.muscle_order || 1,
  }));
}

/**
 * Get rolling 7-day set counts per muscle for a user
 * Used for diminishing returns calculation
 */
export async function getRolling7DayMuscleSets(
  userId: string
): Promise<Map<string, number>> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Query workout sets from last 7 days, join with sessions to filter by user
  const { data: sets, error } = await db
    .from('workout_sets')
    .select(`
      exercise_id,
      workout_session:workout_sessions!inner(user_id)
    `)
    .eq('workout_session.user_id', userId)
    .gte('completed_at', sevenDaysAgo.toISOString());

  if (error || !sets) {
    console.error('Error fetching rolling 7-day sets:', error);
    return new Map();
  }

  // Get exercise IDs to look up their muscles
  const exerciseIds = [...new Set(sets.map((s: any) => s.exercise_id))];

  if (exerciseIds.length === 0) {
    return new Map();
  }

  // Get exercise details to map exercise -> primary muscle
  const { data: exercises } = await db
    .from('exercises')
    .select('id, name, muscle_group')
    .in('id', exerciseIds);

  if (!exercises) {
    return new Map();
  }

  // Create exercise ID -> name map
  const exerciseNameMap = new Map<string, string>();
  const exercisePrimaryMuscleMap = new Map<string, string>();
  for (const ex of exercises) {
    exerciseNameMap.set(ex.id, ex.name);
    exercisePrimaryMuscleMap.set(ex.id, ex.muscle_group);
  }

  // Get muscle mappings for all exercise names
  const exerciseNames = [...new Set(exercises.map((e: any) => e.name))];
  const { data: muscleMappings } = await db
    .from('exercise_muscle_map')
    .select('exercise_name, muscle_group')
    .in('exercise_name', exerciseNames);

  // Build exercise name -> muscles map
  const exerciseMusclesMap = new Map<string, string[]>();
  if (muscleMappings) {
    for (const mapping of muscleMappings) {
      const existing = exerciseMusclesMap.get(mapping.exercise_name) || [];
      existing.push(mapping.muscle_group.toLowerCase());
      exerciseMusclesMap.set(mapping.exercise_name, existing);
    }
  }

  // Count sets per muscle
  const muscleCounts = new Map<string, number>();

  for (const set of sets) {
    const exerciseName = exerciseNameMap.get(set.exercise_id);
    const primaryMuscle = exercisePrimaryMuscleMap.get(set.exercise_id);

    // Get muscles this exercise works
    let muscles: string[] = [];
    if (exerciseName) {
      muscles = exerciseMusclesMap.get(exerciseName) || [];
    }

    // Fallback to primary muscle if no mapping
    if (muscles.length === 0 && primaryMuscle) {
      muscles = [primaryMuscle.toLowerCase()];
    }

    // Increment count for each muscle
    for (const muscle of muscles) {
      const current = muscleCounts.get(muscle) || 0;
      muscleCounts.set(muscle, current + 1);
    }
  }

  return muscleCounts;
}

/**
 * Award muscle XP for a completed set
 * Handles the full flow: get muscles, calculate XP with diminishing returns, award XP
 */
export async function awardSetMuscleXp(
  userId: string,
  exerciseName: string,
  primaryMuscle: string,
  isPR: boolean,
  rolling7DayCounts?: Map<string, number>
): Promise<{ muscleGroup: string; xpAwarded: number; newLevel: number; leveledUp: boolean }[]> {
  // Import the calculation function
  const { calculateSetMuscleXp, createMuscleTags } = await import('@/lib/muscle-xp');

  // Get muscles for this exercise with order
  const exerciseMuscles = await getExerciseMusclesWithOrder(exerciseName);

  // Create muscle tags (falls back to primary if no mapping)
  const muscleTags = createMuscleTags(
    exerciseMuscles.map(m => ({ muscleGroup: m.muscleGroup, order: m.order })),
    primaryMuscle
  );

  // Get rolling 7-day counts if not provided
  const counts = rolling7DayCounts || await getRolling7DayMuscleSets(userId);

  // Calculate XP for each muscle
  const xpResults = calculateSetMuscleXp(muscleTags, counts, isPR);

  // Award XP to each muscle
  const results: { muscleGroup: string; xpAwarded: number; newLevel: number; leveledUp: boolean }[] = [];

  for (const result of xpResults) {
    if (result.finalXp > 0) {
      const { newLevel, leveledUp } = await addMuscleXp(userId, result.muscleGroup, result.finalXp);
      results.push({
        muscleGroup: result.muscleGroup,
        xpAwarded: result.finalXp,
        newLevel,
        leveledUp,
      });
    }
  }

  return results;
}

// ============================================================================
// BATCHED MUSCLE XP AWARDS (OPTIMIZED)
// ============================================================================

interface SetXpInput {
  exerciseName: string;
  primaryMuscle: string;
  isPR: boolean;
}

/**
 * Award muscle XP for multiple sets at once, minimizing DB calls.
 * This is much faster than calling awardSetMuscleXp for each set individually.
 *
 * @param userId - User to award XP to
 * @param sets - Array of sets with exercise info and PR status
 * @param rolling7DayCounts - Pre-fetched rolling counts (will be mutated to track diminishing returns)
 */
export async function awardBatchMuscleXp(
  userId: string,
  sets: SetXpInput[],
  rolling7DayCounts: Map<string, number>
): Promise<void> {
  if (sets.length === 0) return;

  const { calculateSetMuscleXp, createMuscleTags } = await import('@/lib/muscle-xp');

  // 1. Get unique exercise names and fetch all muscle mappings at once
  const uniqueExercises = [...new Set(sets.map(s => s.exerciseName))];

  const { data: muscleMapData } = await db
    .from('exercise_muscle_map')
    .select('exercise_name, muscle_group, muscle_order')
    .in('exercise_name', uniqueExercises)
    .order('muscle_order', { ascending: true });

  // Build exercise -> muscles map
  const exerciseMuscleMap = new Map<string, MuscleTag[]>();
  if (muscleMapData) {
    for (const row of muscleMapData) {
      const muscles = exerciseMuscleMap.get(row.exercise_name) || [];
      muscles.push({ muscleGroup: row.muscle_group, order: row.muscle_order || 1 });
      exerciseMuscleMap.set(row.exercise_name, muscles);
    }
  }

  // 2. Calculate all XP changes per muscle
  const xpByMuscle = new Map<string, number>();
  const countsCopy = new Map(rolling7DayCounts);

  for (const set of sets) {
    const exerciseMuscles = exerciseMuscleMap.get(set.exerciseName) || [];
    const muscleTags = createMuscleTags(
      exerciseMuscles.map(m => ({ muscleGroup: m.muscleGroup, order: m.order })),
      set.primaryMuscle
    );

    const xpResults = calculateSetMuscleXp(muscleTags, countsCopy, set.isPR);

    for (const result of xpResults) {
      if (result.finalXp > 0) {
        const current = xpByMuscle.get(result.muscleGroup) || 0;
        xpByMuscle.set(result.muscleGroup, current + result.finalXp);
      }
    }

    // Update counts for diminishing returns
    const muscleKey = set.primaryMuscle.toLowerCase();
    const currentCount = countsCopy.get(muscleKey) || 0;
    countsCopy.set(muscleKey, currentCount + 1);
  }

  // 3. Pre-fetch all muscle levels for this user
  const musclesToUpdate = [...xpByMuscle.keys()];
  if (musclesToUpdate.length === 0) return;

  const { data: existingLevels } = await db
    .from('muscle_levels')
    .select('*')
    .eq('user_id', userId)
    .in('muscle_group', musclesToUpdate);

  const levelMap = new Map<string, MuscleLevel>();
  if (existingLevels) {
    for (const level of existingLevels) {
      levelMap.set(level.muscle_group.toLowerCase(), level);
    }
  }

  // 4. Create any missing muscle level records
  const missingMuscles = musclesToUpdate.filter(m => !levelMap.has(m.toLowerCase()));
  if (missingMuscles.length > 0) {
    const newRecords = missingMuscles.map(muscleGroup => ({
      user_id: userId,
      muscle_group: muscleGroup.toLowerCase(),
      current_level: 0,
      current_xp: 0,
      total_xp_earned: 0,
    }));

    const { data: created } = await db
      .from('muscle_levels')
      .insert(newRecords)
      .select();

    if (created) {
      for (const level of created) {
        levelMap.set(level.muscle_group.toLowerCase(), level);
      }
    }
  }

  // 5. Calculate new levels and batch update
  const now = new Date().toISOString();
  const updatePromises: Promise<any>[] = [];

  for (const [muscleGroup, xpGained] of xpByMuscle) {
    const muscleLevel = levelMap.get(muscleGroup.toLowerCase());
    if (!muscleLevel) continue;

    const newTotalXp = muscleLevel.total_xp_earned + xpGained;
    const { level: newLevel, currentXp } = calculateMuscleLevelFromXp(newTotalXp);
    const cappedLevel = Math.min(newLevel, MUSCLE_XP_CONFIG.MAX_LEVEL);

    updatePromises.push(
      db
        .from('muscle_levels')
        .update({
          current_level: cappedLevel,
          current_xp: currentXp,
          total_xp_earned: newTotalXp,
          last_trained_at: now,
          updated_at: now,
        })
        .eq('id', muscleLevel.id)
    );
  }

  // Run all updates in parallel (use allSettled to not fail on partial errors)
  const results = await Promise.allSettled(updatePromises);
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    console.error(`[Baseline] ${failures.length} muscle level updates failed`);
  }

  // Update the original counts map
  for (const [key, value] of countsCopy) {
    rolling7DayCounts.set(key, value);
  }
}
