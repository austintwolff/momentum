import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

interface WorkoutTypeStats {
  workoutType: string;
  timesCompleted: number;
  lastScore: number | null;
  lastCompletedAt: string | null;
}

interface UseWorkoutTypeStatsResult {
  stats: Record<string, WorkoutTypeStats>;
  isLoading: boolean;
  getRecommendedType: () => string | null;
}

export async function fetchWorkoutTypeStats(userId: string): Promise<Record<string, WorkoutTypeStats>> {
  // Fetch all workout sessions for this user
  const { data: workouts, error } = await (supabase
    .from('workout_sessions') as any)
    .select('name, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });

  if (error) {
    console.error('Error fetching workout type stats:', error);
    return {};
  }

  // Group by workout type and calculate stats
  const statsMap: Record<string, WorkoutTypeStats> = {};

  if (workouts) {
    workouts.forEach((workout: { name: string; completed_at: string }) => {
      // Normalize workout name to type (e.g., "Push Day" -> "Push")
      const workoutType = normalizeWorkoutType(workout.name);

      if (!statsMap[workoutType]) {
        statsMap[workoutType] = {
          workoutType,
          timesCompleted: 0,
          lastScore: null,
          lastCompletedAt: null,
        };
      }

      statsMap[workoutType].timesCompleted++;

      // First occurrence is the most recent due to ordering
      if (statsMap[workoutType].lastCompletedAt === null) {
        statsMap[workoutType].lastCompletedAt = workout.completed_at;
      }
    });
  }

  return statsMap;
}

/**
 * Get statistics for each workout type: times completed and last score
 */
export function useWorkoutTypeStats(): UseWorkoutTypeStatsResult {
  const user = useAuthStore(s => s.user);

  const { data: stats = {}, isLoading } = useQuery({
    queryKey: ['workoutTypeStats', user?.id],
    queryFn: () => fetchWorkoutTypeStats(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  // Get the recommended workout type based on least recently completed
  const getRecommendedType = useCallback((): string | null => {
    const defaultTypes = ['Push', 'Pull', 'Legs', 'Full Body'];

    // Find types that have never been completed
    const neverCompleted = defaultTypes.filter(type => !stats[type]);
    if (neverCompleted.length > 0) {
      return neverCompleted[0];
    }

    // Find the type that was completed longest ago
    let oldestType: string | null = null;
    let oldestDate: Date | null = null;

    for (const type of defaultTypes) {
      const stat = stats[type];
      if (stat?.lastCompletedAt) {
        const date = new Date(stat.lastCompletedAt);
        if (!oldestDate || date < oldestDate) {
          oldestDate = date;
          oldestType = type;
        }
      }
    }

    return oldestType || defaultTypes[0];
  }, [stats]);

  return { stats, isLoading, getRecommendedType };
}

/**
 * Normalize workout name to workout type
 */
function normalizeWorkoutType(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('push')) return 'Push';
  if (lowerName.includes('pull')) return 'Pull';
  if (lowerName.includes('leg')) return 'Legs';
  if (lowerName.includes('full')) return 'Full Body';
  // For custom workouts, return the name as-is
  return name;
}
