import { supabase } from '@/lib/supabase';
import { WorkoutSet, WorkoutExercise } from '@/stores/workout.store';
import { Database } from '@/types/database';
import { WeightUnit, lbsToKg } from '@/stores/settings.store';
import { GoalBucket, POINTS_CONFIG } from '@/lib/points-engine';
import { updateGoalBucketPR, awardBatchMuscleXp, getRolling7DayMuscleSets } from './baseline.service';
import { calculateWorkoutScore, saveWorkoutScore, SetData } from './workout-score.service';
import { useRollingScoresStore } from '@/stores/rolling-scores.store';
import { recalculatePRRecordsAfterDeletion } from './rolling-scores.service';

type WorkoutSessionInsert = Database['public']['Tables']['workout_sessions']['Insert'];
type WorkoutSetInsert = Database['public']['Tables']['workout_sets']['Insert'];
type UserStatsRow = Database['public']['Tables']['user_stats']['Row'];
type UserStatsUpdate = Database['public']['Tables']['user_stats']['Update'];

interface SaveWorkoutParams {
  userId: string;
  workoutId: string;
  name: string;
  goal: GoalBucket;
  startedAt: Date;
  completedAt: Date;
  durationSeconds: number;
  exercises: WorkoutExercise[];
  totalVolume: number;
  weightUnit: WeightUnit;
}

interface SaveWorkoutResult {
  success: boolean;
  sessionId?: string;
  workoutScore?: number;
  progressScore?: number;
  maintenanceBonus?: number;
  workScore?: number;
  consistencyScore?: number;
  eprPrCount?: number;
  weightPrCount?: number;
  nearPRCount?: number;
  closenessRatio?: number;
  topPerformerName?: string;
  topPerformerPercent?: number;
  error?: string;
}

export async function saveWorkoutToDatabase(
  params: SaveWorkoutParams
): Promise<SaveWorkoutResult> {
  const {
    userId,
    workoutId,
    name,
    goal,
    startedAt,
    completedAt,
    durationSeconds,
    exercises,
    totalVolume,
    weightUnit,
  } = params;

  // Helper to convert weight to kg for database storage
  const toKg = (weight: number | null): number | null => {
    if (weight === null) return null;
    return weightUnit === 'lbs' ? lbsToKg(weight) : weight;
  };

  try {
    // 1. Create the workout session
    const volumeInKg = weightUnit === 'lbs' ? lbsToKg(totalVolume) : totalVolume;

    const sessionInsert: WorkoutSessionInsert = {
      id: workoutId,
      user_id: userId,
      name,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      duration_seconds: durationSeconds,
      total_volume_kg: volumeInKg,
      total_points: 0, // No longer tracking points
    };

    const { data: session, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert(sessionInsert as any)
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating workout session:', sessionError);
      return { success: false, error: sessionError.message };
    }

    // 2. Create all workout sets
    const sessionId = (session as any).id;
    const allSets: WorkoutSetInsert[] = exercises
      .filter((exercise) => !exercise.exercise.id.startsWith('fallback-')) // Only skip fallback exercises (offline mode)
      .flatMap((exercise) =>
        exercise.sets.map((set) => ({
          workout_session_id: sessionId,
          exercise_id: exercise.exercise.id,
          set_number: set.setNumber,
          set_type: set.setType,
          weight_kg: toKg(set.weight),
          reps: set.reps,
          is_bodyweight: set.isBodyweight,
          points_earned: 0,
          is_pr: set.isPR,
          completed_at: set.completedAt.toISOString(),
        }))
      );

    if (allSets.length > 0) {
      const { error: setsError } = await supabase
        .from('workout_sets')
        .insert(allSets as any);

      if (setsError) {
        console.error('Error creating workout sets:', setsError);
      }
    }

    // 3. Update goal-bucket PRs for any sets that achieved a PR
    const prUpdatePromises: Promise<void>[] = [];
    for (const exercise of exercises) {
      if (exercise.exercise.id.startsWith('fallback-')) continue; // Skip fallback exercises (offline mode)

      for (const set of exercise.sets) {
        if (set.isPR && set.weight !== null) {
          const weightKg = toKg(set.weight) || 0;
          const effectiveWeight = set.isBodyweight
            ? weightKg * POINTS_CONFIG.BODYWEIGHT_FACTOR
            : weightKg;

          prUpdatePromises.push(
            updateGoalBucketPR(userId, exercise.exercise.id, effectiveWeight, set.reps, goal)
          );
        }
      }
    }

    if (prUpdatePromises.length > 0) {
      const results = await Promise.allSettled(prUpdatePromises);
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.error(`[Workout] ${failures.length} PR updates failed`);
      }
    }

    // 4. Award muscle XP for all sets
    const rolling7DayCounts = await getRolling7DayMuscleSets(userId);

    const setsForXp = exercises.flatMap(exercise =>
      exercise.sets.map(set => ({
        exerciseName: exercise.exercise.name,
        primaryMuscle: exercise.exercise.muscle_group,
        isPR: set.isPR,
      }))
    );

    if (setsForXp.length > 0) {
      await awardBatchMuscleXp(userId, setsForXp, rolling7DayCounts);
    }

    // 5. Update user stats
    const { data: currentStatsData, error: statsError } = await supabase
      .from('user_stats')
      .select('total_workouts, total_volume_kg, current_workout_streak, longest_workout_streak, last_workout_at')
      .eq('user_id', userId)
      .single();

    if (!statsError && currentStatsData) {
      const currentStats = currentStatsData as UserStatsRow;

      // Calculate new streak
      const lastWorkoutAt = currentStats.last_workout_at
        ? new Date(currentStats.last_workout_at)
        : null;
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let newStreak = currentStats.current_workout_streak || 0;

      if (lastWorkoutAt) {
        const lastWorkoutDate = lastWorkoutAt.toDateString();
        const todayDate = today.toDateString();
        const yesterdayDate = yesterday.toDateString();

        if (lastWorkoutDate === todayDate) {
          // Already worked out today, keep streak
        } else if (lastWorkoutDate === yesterdayDate) {
          // Worked out yesterday, increment streak
          newStreak += 1;
        } else {
          // Streak broken, start fresh
          newStreak = 1;
        }
      } else {
        // First workout ever
        newStreak = 1;
      }

      const statsUpdate: UserStatsUpdate = {
        total_workouts: (currentStats.total_workouts || 0) + 1,
        total_volume_kg: (currentStats.total_volume_kg || 0) + volumeInKg,
        current_workout_streak: newStreak,
        longest_workout_streak: Math.max(
          currentStats.longest_workout_streak || 0,
          newStreak
        ),
        last_workout_at: completedAt.toISOString(),
      };

      const { error: updateError } = await (supabase
        .from('user_stats') as any)
        .update(statsUpdate)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating user stats:', updateError);
      }
    }

    // 6. Calculate and save workout score
    let scoreData: {
      workoutScore?: number;
      progressScore?: number;
      maintenanceBonus?: number;
      workScore?: number;
      consistencyScore?: number;
      eprPrCount?: number;
      weightPrCount?: number;
      nearPRCount?: number;
      closenessRatio?: number;
      topPerformerName?: string;
      topPerformerPercent?: number;
    } = {};

    try {
      // Debug: Log exercise IDs
      const fallbackExerciseCount = exercises.filter(e => e.exercise.id.startsWith('fallback-')).length;
      console.log('[Workout] Total exercises:', exercises.length, 'Fallback (offline):', fallbackExerciseCount);

      // Include ALL exercises for scoring (local exercises will get neutral closeness scores)
      // Local exercises won't have database baselines but can still contribute to work score
      const scoreSetData: SetData[] = exercises.flatMap((exercise) =>
        exercise.sets.map((set) => ({
          exerciseId: exercise.exercise.id,
          exerciseName: exercise.exercise.name,
          weightKg: toKg(set.weight),
          reps: set.reps,
          setType: set.setType,
          isBodyweight: set.isBodyweight,
          completedAt: set.completedAt,
        }))
      );

      console.log('[Workout] Score set data length:', scoreSetData.length);

      if (scoreSetData.length > 0) {
        console.log('[Workout] Calculating score for sets:', scoreSetData.map(s => `${s.exerciseName}: ${s.weightKg}kg x ${s.reps}`));

        const scoreResult = await calculateWorkoutScore({
          userId,
          workoutId: sessionId,
          completedAt,
          sets: scoreSetData,
          weightUnit,
        });

        console.log('[Workout] Score result:', JSON.stringify({
          finalScore: scoreResult.finalScore,
          progressScore: scoreResult.progressScore,
          workScore: scoreResult.workScore,
          closenessRatio: scoreResult.closenessAggregateRatio,
          nEPR: scoreResult.nEPR,
          nWPR: scoreResult.nWPR,
        }));

        await saveWorkoutScore(sessionId, scoreResult);
        scoreData = {
          workoutScore: scoreResult.finalScore,
          progressScore: scoreResult.progressScore,
          maintenanceBonus: scoreResult.maintenanceBonus,
          workScore: scoreResult.workScore,
          consistencyScore: scoreResult.consistencyScore,
          eprPrCount: scoreResult.nEPR,
          weightPrCount: scoreResult.nWPR,
          nearPRCount: scoreResult.nearPRCount,
          closenessRatio: scoreResult.closenessAggregateRatio,
          topPerformerName: scoreResult.topPerformer?.name,
          topPerformerPercent: scoreResult.topPerformer?.closenessPercent,
        };
        console.log('[Workout] Score calculated:', scoreResult.finalScore);
      } else {
        console.log('[Workout] No sets found for scoring');
      }
    } catch (scoreError) {
      // Don't fail the whole save if scoring fails
      console.error('Error calculating workout score:', scoreError);
    }

    // Invalidate rolling scores cache so they're recalculated on next view
    useRollingScoresStore.getState().invalidate();

    return { success: true, sessionId, ...scoreData };
  } catch (error) {
    console.error('Error saving workout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getWorkoutHistory(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ data: any[]; hasMore: boolean; totalCount: number }> {
  const { data, error, count } = await supabase
    .from('workout_sessions')
    .select(`
      *,
      workout_sets (
        *,
        exercise:exercises (name, muscle_group)
      )
    `, { count: 'exact' })
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching workout history:', error);
    return { data: [], hasMore: false, totalCount: 0 };
  }

  return {
    data: data || [],
    hasMore: (data?.length || 0) === limit,
    totalCount: count || 0,
  };
}

export async function getExerciseHistory(
  userId: string,
  exerciseId: string,
  limit: number = 10
): Promise<any[]> {
  const { data, error } = await supabase
    .from('workout_sets')
    .select(`
      *,
      workout_session:workout_sessions!inner (user_id)
    `)
    .eq('exercise_id', exerciseId)
    .eq('workout_session.user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching exercise history:', error);
    return [];
  }

  return data || [];
}

export async function getPreviousBest(
  userId: string,
  exerciseId: string
): Promise<{ weight: number; reps: number; oneRepMax: number } | null> {
  const history = await getExerciseHistory(userId, exerciseId, 50);

  if (history.length === 0) return null;

  let bestSet = null;
  let bestOneRepMax = 0;

  for (const set of history) {
    const weight = set.weight_kg || 0;
    const reps = set.reps || 0;

    if (weight > 0 && reps > 0) {
      const oneRepMax = weight * (1 + reps / 30);

      if (oneRepMax > bestOneRepMax) {
        bestOneRepMax = oneRepMax;
        bestSet = { weight, reps, oneRepMax };
      }
    }
  }

  return bestSet;
}

export async function getWorkoutDetail(workoutId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(`
      *,
      workout_sets (
        *,
        exercise:exercises (id, name, muscle_group, exercise_type)
      )
    `)
    .eq('id', workoutId)
    .single();

  if (error) {
    console.error('Error fetching workout detail:', error);
    return null;
  }

  return data;
}

export async function fetchExercisesFromDatabase(): Promise<any[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, description, exercise_type, muscle_group, equipment, is_compound, is_public')
    .eq('is_public', true)
    .order('name');

  if (error) {
    console.error('Error fetching exercises:', error);
    return [];
  }

  return data || [];
}

export interface BestSetResult {
  weight: number;
  reps: number;
}

export async function getBestSetFromRecentWorkouts(
  userId: string,
  exerciseId: string,
  workoutLimit: number = 3
): Promise<BestSetResult | null> {
  try {
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(workoutLimit);

    if (sessionsError || !recentSessions || recentSessions.length === 0) {
      return null;
    }

    const sessionIds = recentSessions.map(s => s.id);

    const { data: sets, error: setsError } = await supabase
      .from('workout_sets')
      .select('weight_kg, reps')
      .eq('exercise_id', exerciseId)
      .in('workout_session_id', sessionIds)
      .gte('reps', 4)
      .not('weight_kg', 'is', null)
      .order('weight_kg', { ascending: false })
      .limit(1);

    if (setsError || !sets || sets.length === 0) {
      return null;
    }

    const bestSet = sets[0];
    return {
      weight: bestSet.weight_kg || 0,
      reps: bestSet.reps || 0,
    };
  } catch (error) {
    console.error('Error fetching best set from recent workouts:', error);
    return null;
  }
}

// Calculate estimated 1 rep max using Brzycki formula
export function calculateE1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  // Brzycki formula: weight × (36 / (37 - reps))
  // Cap at 12 reps for accuracy
  const effectiveReps = Math.min(reps, 12);
  return weight * (36 / (37 - effectiveReps));
}

export interface RecentTopSet {
  weight: number;
  reps: number;
  e1rm: number;
  date: string; // ISO date string
}

export async function getTopRecentSetsForExercise(
  userId: string,
  exerciseId: string,
  days: number = 14,
  limit: number = 5
): Promise<RecentTopSet[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: sessions, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select('id, completed_at')
      .eq('user_id', userId)
      .gte('completed_at', cutoffDate.toISOString())
      .order('completed_at', { ascending: false }) as { data: { id: string; completed_at: string }[] | null; error: any };

    if (sessionsError || !sessions || sessions.length === 0) {
      return [];
    }

    const sessionIds = sessions.map(s => s.id);
    const sessionDateMap = new Map(sessions.map(s => [s.id, s.completed_at]));

    const { data: sets, error: setsError } = await supabase
      .from('workout_sets')
      .select('weight_kg, reps, workout_session_id')
      .eq('exercise_id', exerciseId)
      .in('workout_session_id', sessionIds)
      .gte('reps', 1)
      .not('weight_kg', 'is', null) as { data: { weight_kg: number; reps: number; workout_session_id: string }[] | null; error: any };

    if (setsError || !sets || sets.length === 0) {
      return [];
    }

    // Calculate e1RM for each set and sort by e1RM descending
    const setsWithE1RM = sets.map(set => ({
      weight: set.weight_kg || 0,
      reps: set.reps || 0,
      e1rm: calculateE1RM(set.weight_kg || 0, set.reps || 0),
      date: sessionDateMap.get(set.workout_session_id) || '',
    }));

    // Sort by e1RM descending and take top N
    setsWithE1RM.sort((a, b) => b.e1rm - a.e1rm);
    return setsWithE1RM.slice(0, limit);
  } catch (error) {
    console.error('Error fetching top recent sets:', error);
    return [];
  }
}

export async function deleteWorkout(workoutId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: workout, error: fetchError } = await supabase
      .from('workout_sessions')
      .select('id, user_id, total_volume_kg')
      .eq('id', workoutId)
      .eq('user_id', userId)
      .single() as { data: any; error: any };

    if (fetchError || !workout) {
      return { success: false, error: 'Workout not found' };
    }

    // Get the sets before deleting them (to track PR exercises for recalculation)
    const { data: deletedSets } = await supabase
      .from('workout_sets')
      .select('exercise_id, is_pr')
      .eq('workout_session_id', workoutId) as { data: any[] | null };

    // Delete workout sets
    await supabase
      .from('workout_sets')
      .delete()
      .eq('workout_session_id', workoutId);

    // Delete the workout session
    const { error: deleteError } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('id', workoutId);

    if (deleteError) {
      console.error('Error deleting workout:', deleteError);
      return { success: false, error: deleteError.message };
    }

    // Update user stats
    const { data: currentStats } = await supabase
      .from('user_stats')
      .select('total_workouts, total_volume_kg')
      .eq('user_id', userId)
      .single() as { data: any };

    if (currentStats) {
      const statsUpdate: UserStatsUpdate = {
        total_workouts: Math.max(0, (currentStats.total_workouts || 0) - 1),
        total_volume_kg: Math.max(0, (currentStats.total_volume_kg || 0) - (workout.total_volume_kg || 0)),
      };

      await (supabase.from('user_stats') as any)
        .update(statsUpdate)
        .eq('user_id', userId);
    }

    // Invalidate rolling scores cache
    useRollingScoresStore.getState().invalidate();

    // Recalculate PR records for exercises that had PRs deleted
    if (deletedSets && deletedSets.length > 0) {
      const setsForRecalculation = deletedSets.map((s: any) => ({
        exerciseId: s.exercise_id,
        isPR: s.is_pr,
      }));
      await recalculatePRRecordsAfterDeletion(userId, setsForRecalculation);
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting workout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export interface UserExerciseStats {
  exerciseId: string;
  exerciseName: string;
  totalSets: number;
  lastUsedAt: string;
}

/**
 * Get user's top exercises by usage count and most recent exercises
 * @param userId - The user ID
 * @param muscleGroups - Filter by these muscle groups (empty = all)
 * @param topLimit - Number of top exercises by count
 * @param recentLimit - Number of most recent exercises
 */
export async function getUserTopAndRecentExercises(
  userId: string,
  muscleGroups: string[] = [],
  topLimit: number = 10,
  recentLimit: number = 5
): Promise<{ topExerciseIds: string[]; recentExerciseIds: string[] }> {
  try {
    // Get all user's sets with exercise info
    const { data: sets, error } = await supabase
      .from('workout_sets')
      .select(`
        exercise_id,
        completed_at,
        exercises!inner (
          id,
          name,
          muscle_group
        )
      `)
      .eq('exercises.is_public', true)
      .order('completed_at', { ascending: false }) as { data: any[] | null; error: any };

    if (error || !sets) {
      console.error('Error fetching user exercise stats:', error);
      return { topExerciseIds: [], recentExerciseIds: [] };
    }

    // Filter by user's sessions
    const { data: userSessions, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId) as { data: { id: string }[] | null; error: any };

    if (sessionsError || !userSessions) {
      return { topExerciseIds: [], recentExerciseIds: [] };
    }

    const userSessionIds = new Set(userSessions.map(s => s.id));

    // Get sets that belong to user and filter by muscle groups
    const { data: userSets, error: userSetsError } = await supabase
      .from('workout_sets')
      .select(`
        exercise_id,
        completed_at,
        workout_session_id,
        exercises!inner (
          id,
          name,
          muscle_group
        )
      `)
      .in('workout_session_id', Array.from(userSessionIds))
      .order('completed_at', { ascending: false }) as { data: any[] | null; error: any };

    if (userSetsError || !userSets || userSets.length === 0) {
      return { topExerciseIds: [], recentExerciseIds: [] };
    }

    // Filter by muscle groups if specified
    const muscleGroupsLower = muscleGroups.map(m => m.toLowerCase());
    const filteredSets = muscleGroupsLower.length > 0
      ? userSets.filter(s => muscleGroupsLower.includes(s.exercises.muscle_group.toLowerCase()))
      : userSets;

    // Count sets per exercise
    const exerciseCounts = new Map<string, number>();
    const exerciseLastUsed = new Map<string, string>();

    for (const set of filteredSets) {
      const exerciseId = set.exercise_id;
      exerciseCounts.set(exerciseId, (exerciseCounts.get(exerciseId) || 0) + 1);

      // Track most recent use
      if (!exerciseLastUsed.has(exerciseId)) {
        exerciseLastUsed.set(exerciseId, set.completed_at);
      }
    }

    // Get top exercises by count
    const sortedByCount = Array.from(exerciseCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topLimit)
      .map(([id]) => id);

    // Get most recent exercises (excluding those already in top)
    const topSet = new Set(sortedByCount);
    const recentExercises: string[] = [];
    const seenRecent = new Set<string>();

    for (const set of filteredSets) {
      const exerciseId = set.exercise_id;
      if (!topSet.has(exerciseId) && !seenRecent.has(exerciseId)) {
        recentExercises.push(exerciseId);
        seenRecent.add(exerciseId);
        if (recentExercises.length >= recentLimit) break;
      }
    }

    return {
      topExerciseIds: sortedByCount,
      recentExerciseIds: recentExercises,
    };
  } catch (error) {
    console.error('Error in getUserTopAndRecentExercises:', error);
    return { topExerciseIds: [], recentExerciseIds: [] };
  }
}

export async function getWorkoutsThisWeek(userId: string): Promise<number> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('workout_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('completed_at', monday.toISOString());

  if (error) {
    console.error('Error fetching workouts this week:', error);
    return 0;
  }

  return count || 0;
}
