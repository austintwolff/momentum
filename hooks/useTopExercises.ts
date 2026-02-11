import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

export interface TopExercise {
  exerciseId: string;
  exerciseName: string;
  frequency: number;
  bestWeight: number | null;
  bestReps: number;
  isBodyweight: boolean;
}

interface UseTopExercisesResult {
  exercisesByType: Record<string, TopExercise[]>;
  isLoading: boolean;
}

// Map workout type names to filter patterns (order matters - more specific first)
const WORKOUT_TYPE_PATTERNS: [string, string[]][] = [
  ['Push', ['push']],
  ['Pull', ['pull']],
  ['Legs', ['leg']],
  ['Full Body', ['full', 'afternoon', 'midday', 'morning', 'evening']],
];

export async function fetchTopExercises(userId: string): Promise<Record<string, TopExercise[]>> {
  // Fetch sessions and exercises in parallel
  const [sessionsResult, exercisesResult] = await Promise.all([
    (supabase.from('workout_sessions') as any)
      .select(`
        id,
        name,
        workout_sets (
          exercise_id,
          weight_kg,
          reps,
          is_bodyweight
        )
      `)
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(50),
    (supabase.from('exercises') as any)
      .select('id, name'),
  ]);

  if (sessionsResult.error) {
    console.error('Error fetching sessions for top exercises:', sessionsResult.error);
    return {};
  }

  if (exercisesResult.error) {
    console.error('Error fetching exercises:', exercisesResult.error);
    return {};
  }

  const sessions = sessionsResult.data;
  const exercises = exercisesResult.data;

  const exerciseMap = new Map<string, string>();
  exercises?.forEach((ex: { id: string; name: string }) => {
    exerciseMap.set(ex.id, ex.name);
  });

  // Process sessions by workout type
  const typeData: Record<string, Map<string, {
    frequency: number;
    bestWeight: number | null;
    bestReps: number;
    isBodyweight: boolean;
  }>> = {};

  // Initialize for each type
  WORKOUT_TYPE_PATTERNS.forEach(([type]) => {
    typeData[type] = new Map();
  });

  sessions?.forEach((session: any) => {
    const sessionName = session.name?.toLowerCase() || '';

    // Determine workout type from session name (order matters - more specific first)
    let workoutType: string | null = null;
    for (const [type, patterns] of WORKOUT_TYPE_PATTERNS) {
      if (patterns.some(pattern => sessionName.includes(pattern))) {
        workoutType = type;
        break;
      }
    }

    if (!workoutType || !session.workout_sets) return;

    // Process each set
    session.workout_sets.forEach((set: any) => {
      const exerciseId = set.exercise_id;
      const exerciseName = exerciseMap.get(exerciseId);
      if (!exerciseName) return;

      const existing = typeData[workoutType!].get(exerciseId);
      const volume = (set.weight_kg || 0) * set.reps;
      const existingVolume = existing ? (existing.bestWeight || 0) * existing.bestReps : 0;

      if (!existing) {
        typeData[workoutType!].set(exerciseId, {
          frequency: 1,
          bestWeight: set.is_bodyweight ? null : set.weight_kg,
          bestReps: set.reps,
          isBodyweight: set.is_bodyweight,
        });
      } else {
        existing.frequency++;
        // Update best set if this one has higher volume
        if (volume > existingVolume) {
          existing.bestWeight = set.is_bodyweight ? null : set.weight_kg;
          existing.bestReps = set.reps;
          existing.isBodyweight = set.is_bodyweight;
        }
      }
    });
  });

  // Convert to sorted arrays (top 5 by frequency)
  const result: Record<string, TopExercise[]> = {};

  for (const [type, exerciseData] of Object.entries(typeData)) {
    const sorted = Array.from(exerciseData.entries())
      .map(([exerciseId, data]) => ({
        exerciseId,
        exerciseName: exerciseMap.get(exerciseId) || 'Unknown',
        ...data,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 15);

    result[type] = sorted;
  }

  return result;
}

/**
 * Fetch top 5 exercises per workout type with their best set
 */
export function useTopExercises(): UseTopExercisesResult {
  const user = useAuthStore(s => s.user);

  const { data: exercisesByType = {}, isLoading } = useQuery({
    queryKey: ['topExercises', user?.id],
    queryFn: () => fetchTopExercises(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  return { exercisesByType, isLoading };
}
