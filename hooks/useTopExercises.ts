import { useState, useEffect, useCallback } from 'react';
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

// Dummy data for testing
const DUMMY_DATA: Record<string, TopExercise[]> = {
  'Push': [
    { exerciseId: 'dummy-1', exerciseName: 'Bench Press', frequency: 12, bestWeight: 100, bestReps: 8, isBodyweight: false },
    { exerciseId: 'dummy-2', exerciseName: 'Overhead Press', frequency: 10, bestWeight: 60, bestReps: 6, isBodyweight: false },
    { exerciseId: 'dummy-3', exerciseName: 'Incline Dumbbell Press', frequency: 8, bestWeight: 36, bestReps: 10, isBodyweight: false },
    { exerciseId: 'dummy-4', exerciseName: 'Tricep Pushdown', frequency: 7, bestWeight: 30, bestReps: 12, isBodyweight: false },
    { exerciseId: 'dummy-5', exerciseName: 'Push-ups', frequency: 5, bestWeight: null, bestReps: 20, isBodyweight: true },
  ],
};

/**
 * Fetch top 5 exercises per workout type with their best set
 */
export function useTopExercises(): UseTopExercisesResult {
  const { user } = useAuthStore();
  const [exercisesByType, setExercisesByType] = useState<Record<string, TopExercise[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchTopExercises = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch workout sessions with their sets and exercises
      const { data: sessions, error: sessionsError } = await (supabase
        .from('workout_sessions') as any)
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
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(200);

      if (sessionsError) {
        console.error('Error fetching sessions for top exercises:', sessionsError);
        setIsLoading(false);
        return;
      }

      // Fetch all exercises to get names
      const { data: exercises, error: exercisesError } = await (supabase
        .from('exercises') as any)
        .select('id, name');

      if (exercisesError) {
        console.error('Error fetching exercises:', exercisesError);
        setIsLoading(false);
        return;
      }

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
          .slice(0, 5);

        result[type] = sorted;
      }

      // Merge with dummy data for testing (use dummy if no real data)
      for (const [type, dummyExercises] of Object.entries(DUMMY_DATA)) {
        if (!result[type] || result[type].length === 0) {
          result[type] = dummyExercises;
        }
      }

      setExercisesByType(result);
      setIsLoading(false);
    } catch (error) {
      console.error('Error in useTopExercises:', error);
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTopExercises();
  }, [fetchTopExercises]);

  return { exercisesByType, isLoading };
}
