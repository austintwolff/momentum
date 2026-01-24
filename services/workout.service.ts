import { supabase } from '@/lib/supabase';
import { WorkoutSet, WorkoutExercise } from '@/stores/workout.store';
import { Database } from '@/types/database';
import { WeightUnit, lbsToKg } from '@/stores/settings.store';
import { GoalBucket, POINTS_CONFIG } from '@/lib/points-engine';
import { updateGoalBucketPR, awardBatchMuscleXp, getRolling7DayMuscleSets } from './baseline.service';

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
      .filter((exercise) => !exercise.exercise.id.startsWith('local-'))
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
      if (exercise.exercise.id.startsWith('local-')) continue;

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
      .select('*')
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

    return { success: true, sessionId };
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
  limit: number = 20
): Promise<any[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(`
      *,
      workout_sets (
        *,
        exercise:exercises (name, muscle_group)
      )
    `)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching workout history:', error);
    return [];
  }

  return data || [];
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
    .select('*')
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

export async function deleteWorkout(workoutId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: workout, error: fetchError } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('id', workoutId)
      .eq('user_id', userId)
      .single() as { data: any; error: any };

    if (fetchError || !workout) {
      return { success: false, error: 'Workout not found' };
    }

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
      .select('*')
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

    return { success: true };
  } catch (error) {
    console.error('Error deleting workout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
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
