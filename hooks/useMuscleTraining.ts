import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

export interface MuscleTrainingData {
  [muscle: string]: number; // muscle group -> days trained in past 7 days
}

interface UseMuscleTrainingResult {
  data: MuscleTrainingData;
  isLoading: boolean;
}

/**
 * Hook to fetch training data per muscle group for the past 7 days.
 * Returns the number of distinct days each muscle was trained.
 */
export function useMuscleTraining(): UseMuscleTrainingResult {
  const { user } = useAuthStore();
  const [data, setData] = useState<MuscleTrainingData>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchMuscleTraining = useCallback(async () => {
    if (!user) {
      setData({});
      setIsLoading(false);
      return;
    }

    try {
      // Get the start of 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      // Fetch workout sets with their exercises from the past 7 days
      const { data: sets, error } = await (supabase
        .from('workout_sets') as any)
        .select(`
          completed_at,
          exercise:exercises!inner (
            muscle_group
          )
        `)
        .gte('completed_at', sevenDaysAgo.toISOString());

      if (error) {
        console.error('Error fetching muscle training data:', error);
        setIsLoading(false);
        return;
      }

      // We need to filter by user_id through the workout_session
      // Since we can't easily do that in one query, let's fetch workout sessions first
      const { data: sessions, error: sessionsError } = await (supabase
        .from('workout_sessions') as any)
        .select('id')
        .eq('user_id', user.id)
        .gte('completed_at', sevenDaysAgo.toISOString());

      if (sessionsError) {
        console.error('Error fetching workout sessions:', sessionsError);
        setIsLoading(false);
        return;
      }

      const sessionIds = sessions?.map((s: { id: string }) => s.id) || [];

      if (sessionIds.length === 0) {
        setData({});
        setIsLoading(false);
        return;
      }

      // Now fetch sets for these sessions
      const { data: userSets, error: setsError } = await (supabase
        .from('workout_sets') as any)
        .select(`
          completed_at,
          exercise:exercises (
            muscle_group
          )
        `)
        .in('workout_session_id', sessionIds);

      if (setsError) {
        console.error('Error fetching workout sets:', setsError);
        setIsLoading(false);
        return;
      }

      // Count distinct days per muscle group
      const muscleTrainingDays: Record<string, Set<string>> = {};

      for (const set of userSets || []) {
        const muscleGroup = set.exercise?.muscle_group;
        if (!muscleGroup) continue;

        const dateStr = new Date(set.completed_at).toDateString();

        if (!muscleTrainingDays[muscleGroup]) {
          muscleTrainingDays[muscleGroup] = new Set();
        }
        muscleTrainingDays[muscleGroup].add(dateStr);
      }

      // Convert sets to counts
      const trainingData: MuscleTrainingData = {};
      for (const [muscle, dates] of Object.entries(muscleTrainingDays)) {
        trainingData[muscle] = dates.size;
      }

      setData(trainingData);
      setIsLoading(false);
    } catch (error) {
      console.error('Error in useMuscleTraining:', error);
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMuscleTraining();
  }, [fetchMuscleTraining]);

  return { data, isLoading };
}

/**
 * Get the status color for a muscle based on days trained.
 * - 0 days: Red (untrained)
 * - 1 day: Yellow (partial)
 * - 2+ days: Green (fully trained)
 */
export function getTrainingStatusColor(daysTrained: number | undefined): 'red' | 'yellow' | 'green' {
  if (!daysTrained || daysTrained === 0) return 'red';
  if (daysTrained === 1) return 'yellow';
  return 'green';
}
