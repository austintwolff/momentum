import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

interface BiWeeklyStats {
  workoutsCount: number;
  biWeeklyWorkoutDays: boolean[]; // 14 days, index 0 = 14 days ago, index 13 = today
  streak: number;
  avgScore: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Get the start of the 14-day window (14 days ago at 00:01 AM local time)
 */
function getBiWeeklyStart(): Date {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 13); // 14 days including today
  start.setHours(0, 1, 0, 0);
  return start;
}

/**
 * Calculate streak: days in a row without skipping more than one day
 */
function calculateStreak(workoutDates: Date[]): number {
  if (workoutDates.length === 0) return 0;

  // Sort dates descending (most recent first)
  const sortedDates = [...workoutDates].sort((a, b) => b.getTime() - a.getTime());

  // Get unique dates (just the date part, no time)
  const uniqueDateStrings = new Set<string>();
  sortedDates.forEach(date => {
    uniqueDateStrings.add(date.toDateString());
  });
  const uniqueDates = Array.from(uniqueDateStrings)
    .map(str => new Date(str))
    .sort((a, b) => b.getTime() - a.getTime());

  if (uniqueDates.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mostRecentWorkout = uniqueDates[0];
  mostRecentWorkout.setHours(0, 0, 0, 0);

  // If the most recent workout was more than 1 day ago, streak is 0
  const daysSinceLast = Math.floor((today.getTime() - mostRecentWorkout.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceLast > 1) return 0;

  // Count streak: go back through dates, allowing max 1 day gap
  let streak = 1;
  let currentDate = mostRecentWorkout;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevWorkout = uniqueDates[i];
    prevWorkout.setHours(0, 0, 0, 0);

    const daysBetween = Math.floor((currentDate.getTime() - prevWorkout.getTime()) / (1000 * 60 * 60 * 24));

    if (daysBetween <= 2) {
      streak++;
      currentDate = prevWorkout;
    } else {
      break;
    }
  }

  return streak;
}

interface BiWeeklyStatsData {
  workoutsCount: number;
  biWeeklyWorkoutDays: boolean[];
  streak: number;
  avgScore: number;
}

async function fetchBiWeeklyStats(userId: string): Promise<BiWeeklyStatsData> {
  const biWeeklyStart = getBiWeeklyStart();

  // Fetch workouts from last 14 days
  const { data: recentWorkouts, error: recentError } = await (supabase
    .from('workout_sessions') as any)
    .select('completed_at, final_score')
    .eq('user_id', userId)
    .gte('completed_at', biWeeklyStart.toISOString())
    .order('completed_at', { ascending: true });

  if (recentError) {
    console.error('Error fetching bi-weekly workouts:', recentError);
  }

  // Calculate which days had workouts (14 days, index 0 = 14 days ago)
  const biWeeklyWorkoutDays = Array(14).fill(false);
  const workoutDates: Date[] = [];
  const scores: number[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (recentWorkouts) {
    recentWorkouts.forEach((workout: { completed_at: string; final_score: number | null }) => {
      const date = new Date(workout.completed_at);
      workoutDates.push(date);

      // Calculate day index (0 = 14 days ago, 13 = today)
      const workoutDate = new Date(date);
      workoutDate.setHours(0, 0, 0, 0);
      const daysAgo = Math.floor((today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));
      const dayIndex = 13 - daysAgo;
      if (dayIndex >= 0 && dayIndex < 14) {
        biWeeklyWorkoutDays[dayIndex] = true;
      }

      if (workout.final_score != null) {
        scores.push(workout.final_score);
      }
    });
  }

  // Calculate average score
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : 0;

  // Fetch all workout dates for streak calculation (last 60 days)
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const { data: allWorkouts, error: streakError } = await (supabase
    .from('workout_sessions') as any)
    .select('completed_at')
    .eq('user_id', userId)
    .gte('completed_at', sixtyDaysAgo.toISOString())
    .order('completed_at', { ascending: false });

  if (streakError) {
    console.error('Error fetching workouts for streak:', streakError);
  }

  const allWorkoutDates = allWorkouts
    ? allWorkouts.map((w: { completed_at: string }) => new Date(w.completed_at))
    : [];

  const streak = calculateStreak(allWorkoutDates);

  return {
    workoutsCount: workoutDates.length,
    biWeeklyWorkoutDays,
    streak,
    avgScore,
  };
}

const DEFAULT_STATS: BiWeeklyStatsData = {
  workoutsCount: 0,
  biWeeklyWorkoutDays: Array(14).fill(false),
  streak: 0,
  avgScore: 0,
};

export function useBiWeeklyStats(): BiWeeklyStats {
  const user = useAuthStore(s => s.user);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['biWeeklyStats', user?.id],
    queryFn: () => fetchBiWeeklyStats(user!.id),
    enabled: !!user?.id,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  return {
    ...(data ?? DEFAULT_STATS),
    isLoading,
    refresh: async () => { await refetch(); },
  };
}
