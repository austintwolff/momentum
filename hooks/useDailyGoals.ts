import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { calculateOneRepMax } from '@/lib/points-engine';

// Goal targets
const TARGET_WORKING_SETS = 15;
const TARGET_VOLUME_KG = 5000;
const TARGET_EXERCISE_VARIETY = 5;
const TARGET_MUSCLE_GROUPS = 3;
const NEAR_PR_THRESHOLD = 0.95; // 95% of PR

interface DailyGoal {
  id: string;
  progress: number; // 0-1
  isComplete: boolean;
  description: string;
}

interface DailyGoalsResult {
  progressionGoal: DailyGoal;
  loadGoal: DailyGoal;
  consistencyGoal: DailyGoal;
  isLoading: boolean;
}

interface TodayMetrics {
  // Progression metrics
  hasPR: boolean;
  hasNearPR: boolean;
  nearPRPercent: number; // Best closeness to PR (0-100)
  hasRepPR: boolean;

  // Load metrics
  workingSets: number;
  totalVolumeKg: number;
  uniqueExercises: number;

  // Consistency metrics
  hasWorkout: boolean;
  workedOutYesterday: boolean;
  muscleGroupsHit: number;
}

// Goal definitions for each category
const PROGRESSION_GOALS = [
  {
    id: 'pr',
    getGoal: (m: TodayMetrics): DailyGoal => ({
      id: 'pr',
      progress: m.hasPR ? 1 : 0,
      isComplete: m.hasPR,
      description: m.hasPR ? 'PR achieved!' : 'Beat a personal record',
    }),
  },
  {
    id: 'near-pr',
    getGoal: (m: TodayMetrics): DailyGoal => ({
      id: 'near-pr',
      progress: Math.min(m.nearPRPercent / 95, 1),
      isComplete: m.hasNearPR,
      description: m.hasNearPR ? 'Near-PR achieved!' : 'Get within 95% of a PR',
    }),
  },
  {
    id: 'rep-pr',
    getGoal: (m: TodayMetrics): DailyGoal => ({
      id: 'rep-pr',
      progress: m.hasRepPR ? 1 : 0,
      isComplete: m.hasRepPR,
      description: m.hasRepPR ? 'Rep PR achieved!' : 'Beat your reps at the same weight',
    }),
  },
];

const LOAD_GOALS = [
  {
    id: 'sets',
    getGoal: (m: TodayMetrics): DailyGoal => ({
      id: 'sets',
      progress: Math.min(m.workingSets / TARGET_WORKING_SETS, 1),
      isComplete: m.workingSets >= TARGET_WORKING_SETS,
      description: m.workingSets >= TARGET_WORKING_SETS
        ? 'Sets goal complete!'
        : `Complete ${TARGET_WORKING_SETS} working sets`,
    }),
  },
  {
    id: 'volume',
    getGoal: (m: TodayMetrics): DailyGoal => ({
      id: 'volume',
      progress: Math.min(m.totalVolumeKg / TARGET_VOLUME_KG, 1),
      isComplete: m.totalVolumeKg >= TARGET_VOLUME_KG,
      description: m.totalVolumeKg >= TARGET_VOLUME_KG
        ? 'Volume goal complete!'
        : `Lift ${formatVolume(TARGET_VOLUME_KG)} total volume`,
    }),
  },
  {
    id: 'variety',
    getGoal: (m: TodayMetrics): DailyGoal => ({
      id: 'variety',
      progress: Math.min(m.uniqueExercises / TARGET_EXERCISE_VARIETY, 1),
      isComplete: m.uniqueExercises >= TARGET_EXERCISE_VARIETY,
      description: m.uniqueExercises >= TARGET_EXERCISE_VARIETY
        ? 'Variety goal complete!'
        : `Complete ${TARGET_EXERCISE_VARIETY} different exercises`,
    }),
  },
];

const CONSISTENCY_GOALS = [
  {
    id: 'workout',
    getGoal: (m: TodayMetrics): DailyGoal => ({
      id: 'workout',
      progress: m.hasWorkout ? 1 : 0,
      isComplete: m.hasWorkout,
      description: m.hasWorkout ? 'Workout complete!' : 'Complete a workout today',
    }),
  },
  {
    id: 'streak',
    getGoal: (m: TodayMetrics): DailyGoal => ({
      id: 'streak',
      progress: m.workedOutYesterday && m.hasWorkout ? 1 : m.workedOutYesterday ? 0.5 : 0,
      isComplete: m.workedOutYesterday && m.hasWorkout,
      description: m.workedOutYesterday && m.hasWorkout
        ? 'Streak continued!'
        : m.workedOutYesterday
          ? 'Keep the streak alive!'
          : 'Work out 2 days in a row',
    }),
  },
  {
    id: 'balanced',
    getGoal: (m: TodayMetrics): DailyGoal => ({
      id: 'balanced',
      progress: Math.min(m.muscleGroupsHit / TARGET_MUSCLE_GROUPS, 1),
      isComplete: m.muscleGroupsHit >= TARGET_MUSCLE_GROUPS,
      description: m.muscleGroupsHit >= TARGET_MUSCLE_GROUPS
        ? 'Balanced training complete!'
        : `Train ${TARGET_MUSCLE_GROUPS}+ muscle groups`,
    }),
  },
];

function formatVolume(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1)}k kg`;
  }
  return `${Math.round(kg)} kg`;
}

/**
 * Select a goal based on smart logic:
 * 1. If user worked out yesterday but not today, prioritize "streak" goal
 * 2. Prioritize goals that are in-progress (0 < progress < 1)
 * 3. Otherwise, use seeded random based on today's date
 */
function selectGoal<T extends { id: string; getGoal: (m: TodayMetrics) => DailyGoal }>(
  goals: T[],
  metrics: TodayMetrics,
  category: string
): DailyGoal {
  const evaluatedGoals = goals.map((g) => ({
    def: g,
    goal: g.getGoal(metrics),
  }));

  // Special case: prioritize streak goal if user worked out yesterday
  if (category === 'consistency' && metrics.workedOutYesterday && !metrics.hasWorkout) {
    const streakGoal = evaluatedGoals.find((g) => g.def.id === 'streak');
    if (streakGoal) return streakGoal.goal;
  }

  // Find goals that are in-progress (started but not complete)
  const inProgress = evaluatedGoals.filter(
    (g) => g.goal.progress > 0 && !g.goal.isComplete
  );
  if (inProgress.length > 0) {
    // Return the one with highest progress
    inProgress.sort((a, b) => b.goal.progress - a.goal.progress);
    return inProgress[0].goal;
  }

  // Use seeded random based on today's date and category
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const categoryOffset = category === 'progression' ? 0 : category === 'load' ? 1 : 2;
  const index = (seed + categoryOffset) % goals.length;

  return evaluatedGoals[index].goal;
}

/**
 * Hook to track today's progress for daily workout goals.
 * Shows one rotating goal per category based on smart selection logic.
 */
export function useDailyGoals(): DailyGoalsResult {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<TodayMetrics>({
    hasPR: false,
    hasNearPR: false,
    nearPRPercent: 0,
    hasRepPR: false,
    workingSets: 0,
    totalVolumeKg: 0,
    uniqueExercises: 0,
    hasWorkout: false,
    workedOutYesterday: false,
    muscleGroupsHit: 0,
  });

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    fetchTodayData(user.id);
  }, [user?.id]);

  async function fetchTodayData(userId: string) {
    setIsLoading(true);

    try {
      const now = new Date();

      // Today's boundaries
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      // Yesterday's boundaries
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayStart);
      yesterdayEnd.setMilliseconds(-1);

      // Fetch today's and yesterday's workouts in parallel
      const [todayWorkoutsRes, yesterdayWorkoutsRes] = await Promise.all([
        (supabase as any)
          .from('workout_sessions')
          .select('id, completed_at')
          .eq('user_id', userId)
          .gte('completed_at', todayStart.toISOString())
          .lte('completed_at', todayEnd.toISOString()),
        (supabase as any)
          .from('workout_sessions')
          .select('id')
          .eq('user_id', userId)
          .gte('completed_at', yesterdayStart.toISOString())
          .lte('completed_at', yesterdayEnd.toISOString())
          .limit(1),
      ]);

      if (todayWorkoutsRes.error) {
        console.error('[useDailyGoals] Error fetching today workouts:', todayWorkoutsRes.error);
        setIsLoading(false);
        return;
      }

      const todayWorkouts = todayWorkoutsRes.data as Array<{ id: string; completed_at: string }> | null;
      const yesterdayWorkouts = yesterdayWorkoutsRes.data as Array<{ id: string }> | null;

      const hasWorkout = (todayWorkouts?.length ?? 0) > 0;
      const workedOutYesterday = (yesterdayWorkouts?.length ?? 0) > 0;

      if (!hasWorkout || !todayWorkouts?.length) {
        setMetrics({
          hasPR: false,
          hasNearPR: false,
          nearPRPercent: 0,
          hasRepPR: false,
          workingSets: 0,
          totalVolumeKg: 0,
          uniqueExercises: 0,
          hasWorkout: false,
          workedOutYesterday,
          muscleGroupsHit: 0,
        });
        setIsLoading(false);
        return;
      }

      const workoutIds = todayWorkouts.map((w) => w.id);

      // Fetch sets with exercise info
      const { data: sets, error: setsError } = await (supabase as any)
        .from('workout_sets')
        .select(`
          id,
          exercise_id,
          set_type,
          weight_kg,
          reps,
          is_pr,
          exercise:exercises (
            muscle_group
          )
        `)
        .in('workout_session_id', workoutIds);

      if (setsError) {
        console.error('[useDailyGoals] Error fetching sets:', setsError);
        setIsLoading(false);
        return;
      }

      const setList = sets as Array<{
        id: string;
        exercise_id: string;
        set_type: string;
        weight_kg: number | null;
        reps: number;
        is_pr: boolean;
        exercise: { muscle_group: string } | null;
      }> | null;

      // Calculate metrics
      const workingSets = setList?.filter((s) => s.set_type !== 'warmup').length ?? 0;
      const hasPR = setList?.some((s) => s.is_pr) ?? false;

      // Calculate volume
      const totalVolumeKg = setList?.reduce((sum, s) => {
        if (s.set_type === 'warmup' || !s.weight_kg) return sum;
        return sum + (s.weight_kg * s.reps);
      }, 0) ?? 0;

      // Count unique exercises
      const exerciseIds = new Set(setList?.map((s) => s.exercise_id) ?? []);
      const uniqueExercises = exerciseIds.size;

      // Count muscle groups
      const muscleGroups = new Set(
        setList
          ?.filter((s) => s.set_type !== 'warmup' && s.exercise?.muscle_group)
          .map((s) => s.exercise!.muscle_group.toLowerCase()) ?? []
      );
      const muscleGroupsHit = muscleGroups.size;

      // Check for near-PR and rep-PR (need to compare against baselines)
      const { hasNearPR, nearPRPercent, hasRepPR } = await checkPRMetrics(
        userId,
        setList ?? [],
        exerciseIds
      );

      setMetrics({
        hasPR,
        hasNearPR,
        nearPRPercent,
        hasRepPR,
        workingSets,
        totalVolumeKg,
        uniqueExercises,
        hasWorkout: true,
        workedOutYesterday,
        muscleGroupsHit,
      });
    } catch (error) {
      console.error('[useDailyGoals] Error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Select goals using smart logic
  const progressionGoal = selectGoal(PROGRESSION_GOALS, metrics, 'progression');
  const loadGoal = selectGoal(LOAD_GOALS, metrics, 'load');
  const consistencyGoal = selectGoal(CONSISTENCY_GOALS, metrics, 'consistency');

  return {
    progressionGoal,
    loadGoal,
    consistencyGoal,
    isLoading,
  };
}

/**
 * Check for near-PR and rep-PR by comparing today's sets against historical bests
 */
async function checkPRMetrics(
  userId: string,
  todaySets: Array<{
    exercise_id: string;
    set_type: string;
    weight_kg: number | null;
    reps: number;
  }>,
  exerciseIds: Set<string>
): Promise<{ hasNearPR: boolean; nearPRPercent: number; hasRepPR: boolean }> {
  if (exerciseIds.size === 0) {
    return { hasNearPR: false, nearPRPercent: 0, hasRepPR: false };
  }

  try {
    // Fetch historical bests for these exercises
    const { data: historicalSets, error } = await (supabase as any)
      .from('workout_sets')
      .select(`
        exercise_id,
        weight_kg,
        reps,
        set_type,
        workout_session:workout_sessions!inner (user_id)
      `)
      .in('exercise_id', [...exerciseIds])
      .eq('workout_session.user_id', userId)
      .neq('set_type', 'warmup');

    if (error || !historicalSets) {
      return { hasNearPR: false, nearPRPercent: 0, hasRepPR: false };
    }

    // Build maps of best e1RM and best reps at each weight per exercise
    const bestE1rmByExercise = new Map<string, number>();
    const bestRepsByWeightByExercise = new Map<string, Map<number, number>>();

    for (const set of historicalSets) {
      if (!set.weight_kg || set.reps > 12) continue;

      const e1rm = calculateOneRepMax(set.weight_kg, set.reps);
      const currentBest = bestE1rmByExercise.get(set.exercise_id) || 0;
      if (e1rm > currentBest) {
        bestE1rmByExercise.set(set.exercise_id, e1rm);
      }

      // Track best reps at each weight
      if (!bestRepsByWeightByExercise.has(set.exercise_id)) {
        bestRepsByWeightByExercise.set(set.exercise_id, new Map());
      }
      const weightMap = bestRepsByWeightByExercise.get(set.exercise_id)!;
      const currentBestReps = weightMap.get(set.weight_kg) || 0;
      if (set.reps > currentBestReps) {
        weightMap.set(set.weight_kg, set.reps);
      }
    }

    // Check today's sets
    let bestCloseness = 0;
    let hasRepPR = false;

    for (const set of todaySets) {
      if (set.set_type === 'warmup' || !set.weight_kg || set.reps > 12) continue;

      const bestE1rm = bestE1rmByExercise.get(set.exercise_id);
      if (bestE1rm && bestE1rm > 0) {
        const todayE1rm = calculateOneRepMax(set.weight_kg, set.reps);
        const closeness = (todayE1rm / bestE1rm) * 100;
        if (closeness > bestCloseness) {
          bestCloseness = closeness;
        }
      }

      // Check for rep PR at same weight
      const weightMap = bestRepsByWeightByExercise.get(set.exercise_id);
      if (weightMap) {
        const previousBestReps = weightMap.get(set.weight_kg) || 0;
        // Rep PR = more reps than historical best at same weight (excluding today's contribution)
        // Since historical includes today, we check if today's reps exceed what was previously recorded
        if (set.reps > previousBestReps) {
          hasRepPR = true;
        }
      }
    }

    return {
      hasNearPR: bestCloseness >= NEAR_PR_THRESHOLD * 100,
      nearPRPercent: Math.round(bestCloseness),
      hasRepPR,
    };
  } catch (error) {
    console.error('[useDailyGoals] Error checking PR metrics:', error);
    return { hasNearPR: false, nearPRPercent: 0, hasRepPR: false };
  }
}
