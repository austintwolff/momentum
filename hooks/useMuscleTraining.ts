import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

export interface MuscleTrainingData {
  [muscle: string]: number; // muscle group -> days trained in past 7 days
}

interface UseMuscleTrainingResult {
  data: MuscleTrainingData;
  isLoading: boolean;
}

async function fetchMuscleTraining(userId: string): Promise<MuscleTrainingData> {
  // Get the start of 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // Fetch user's workout sessions from past 7 days
  const { data: sessions, error: sessionsError } = await (supabase
    .from('workout_sessions') as any)
    .select('id')
    .eq('user_id', userId)
    .gte('completed_at', sevenDaysAgo.toISOString());

  if (sessionsError) {
    console.error('Error fetching workout sessions:', sessionsError);
    return {};
  }

  const sessionIds = sessions?.map((s: { id: string }) => s.id) || [];

  if (sessionIds.length === 0) {
    return {};
  }

  // Fetch sets for these sessions with exercise info
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
    return {};
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

  return trainingData;
}

/**
 * Hook to fetch training data per muscle group for the past 7 days.
 * Returns the number of distinct days each muscle was trained.
 */
export function useMuscleTraining(): UseMuscleTrainingResult {
  const user = useAuthStore(s => s.user);

  const { data = {}, isLoading } = useQuery({
    queryKey: ['muscleTraining', user?.id],
    queryFn: () => fetchMuscleTraining(user!.id),
    enabled: !!user?.id,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

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
