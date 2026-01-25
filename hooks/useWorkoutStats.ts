import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

interface WorkoutStats {
  workoutsThisWeek: number;
  weeklyWorkoutDays: boolean[]; // Mon-Sun, true if worked out that day
  streak: number; // Days without skipping more than one day
  isLoading: boolean;
}

/**
 * Get the start of the current week (Monday at 00:01 AM local time)
 */
function getWeekStartMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 1, 0, 0); // 12:01 AM
  return monday;
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
      // Gap of 0, 1, or 2 days is okay (consecutive, 1 day skipped)
      streak++;
      currentDate = prevWorkout;
    } else {
      // More than 1 day skipped, streak ends
      break;
    }
  }

  return streak;
}

export function useWorkoutStats(): WorkoutStats {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<WorkoutStats>({
    workoutsThisWeek: 0,
    weeklyWorkoutDays: [false, false, false, false, false, false, false],
    streak: 0,
    isLoading: true,
  });

  const fetchStats = useCallback(async () => {
    if (!user) {
      setStats({
        workoutsThisWeek: 0,
        weeklyWorkoutDays: [false, false, false, false, false, false, false],
        streak: 0,
        isLoading: false,
      });
      return;
    }

    try {
      const weekStart = getWeekStartMonday();

      // Fetch workouts this week for the workout counter and day dots
      const { data: weekWorkouts, error: weekError } = await (supabase
        .from('workout_sessions') as any)
        .select('completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', weekStart.toISOString())
        .order('completed_at', { ascending: true });

      if (weekError) {
        console.error('Error fetching weekly workouts:', weekError);
      }

      // Calculate which days of the week had workouts (Mon=0, Sun=6)
      const weeklyWorkoutDays = [false, false, false, false, false, false, false];
      const workoutDatesThisWeek: Date[] = [];

      if (weekWorkouts) {
        weekWorkouts.forEach((workout: { completed_at: string }) => {
          const date = new Date(workout.completed_at);
          workoutDatesThisWeek.push(date);

          let dayIndex = date.getDay() - 1; // Convert: Sun=0 -> Mon=0
          if (dayIndex < 0) dayIndex = 6; // Sunday becomes 6
          weeklyWorkoutDays[dayIndex] = true;
        });
      }

      // Fetch all workout dates for streak calculation (last 60 days should be enough)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const { data: allWorkouts, error: streakError } = await (supabase
        .from('workout_sessions') as any)
        .select('completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', sixtyDaysAgo.toISOString())
        .order('completed_at', { ascending: false });

      if (streakError) {
        console.error('Error fetching workouts for streak:', streakError);
      }

      const allWorkoutDates = allWorkouts
        ? allWorkouts.map((w: { completed_at: string }) => new Date(w.completed_at))
        : [];

      const streak = calculateStreak(allWorkoutDates);

      setStats({
        workoutsThisWeek: workoutDatesThisWeek.length,
        weeklyWorkoutDays,
        streak,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error in useWorkoutStats:', error);
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return stats;
}
