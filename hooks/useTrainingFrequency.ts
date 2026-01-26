import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

const MUSCLE_GROUPS = [
  'chest',
  'upper back',
  'lower back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
] as const;

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface MuscleFrequency {
  muscle: MuscleGroup;
  displayName: string;
  sessionsCount: number;
  targetSessions: number;
  percentage: number; // 0-100
  isComplete: boolean;
}

interface UseTrainingFrequencyResult {
  muscles: MuscleFrequency[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Convert muscle_group from DB to display name
const getDisplayName = (muscle: MuscleGroup): string => {
  const names: Record<MuscleGroup, string> = {
    'chest': 'Chest',
    'upper back': 'Upper Back',
    'lower back': 'Lower Back',
    'shoulders': 'Shoulders',
    'biceps': 'Biceps',
    'triceps': 'Triceps',
    'forearms': 'Forearms',
    'core': 'Core',
    'quads': 'Quads',
    'hamstrings': 'Hamstrings',
    'glutes': 'Glutes',
    'calves': 'Calves',
  };
  return names[muscle] || muscle;
};

const TARGET_SESSIONS = 4; // Goal: 4 sessions per 2 weeks
const ROLLING_DAYS = 14;

/**
 * Hook to fetch training frequency per muscle group over rolling 14-day period.
 * Returns muscles sorted by undertrained first (lowest percentage).
 */
export function useTrainingFrequency(): UseTrainingFrequencyResult {
  const { user } = useAuthStore();
  const [muscles, setMuscles] = useState<MuscleFrequency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFrequency = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      // Calculate date 14 days ago
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - ROLLING_DAYS);

      // Fetch all workout sessions in the rolling window
      const { data: sessions, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select(`
          id,
          completed_at,
          workout_sets (
            exercise_id
          )
        `)
        .eq('user_id', user.id)
        .gte('completed_at', twoWeeksAgo.toISOString())
        .not('completed_at', 'is', null);

      if (sessionsError) {
        console.error('Error fetching sessions for frequency:', sessionsError);
        setError(sessionsError.message);
        setIsLoading(false);
        return;
      }

      // Get all exercise IDs from these sessions
      const exerciseIds = new Set<string>();
      sessions?.forEach((session: any) => {
        session.workout_sets?.forEach((set: any) => {
          if (set.exercise_id) {
            exerciseIds.add(set.exercise_id);
          }
        });
      });

      // Fetch exercise details to get muscle groups
      const { data: exercises, error: exercisesError } = await supabase
        .from('exercises')
        .select('id, muscle_group')
        .in('id', Array.from(exerciseIds));

      if (exercisesError) {
        console.error('Error fetching exercises:', exercisesError);
        setError(exercisesError.message);
        setIsLoading(false);
        return;
      }

      // Create exercise ID to muscle group map
      const exerciseToMuscle = new Map<string, string>();
      exercises?.forEach((ex: any) => {
        exerciseToMuscle.set(ex.id, ex.muscle_group?.toLowerCase());
      });

      // Count unique sessions per muscle group
      // A muscle is "trained" if any exercise targeting it was done in that session
      const muscleSessions = new Map<string, Set<string>>();

      // Initialize all muscle groups
      MUSCLE_GROUPS.forEach(muscle => {
        muscleSessions.set(muscle, new Set());
      });

      sessions?.forEach((session: any) => {
        const sessionId = session.id;
        const musclesInSession = new Set<string>();

        session.workout_sets?.forEach((set: any) => {
          const muscle = exerciseToMuscle.get(set.exercise_id);
          if (muscle) {
            musclesInSession.add(muscle);
          }
        });

        // Add this session to each muscle that was trained
        musclesInSession.forEach(muscle => {
          const sessions = muscleSessions.get(muscle);
          if (sessions) {
            sessions.add(sessionId);
          }
        });
      });

      // Build result array
      const result: MuscleFrequency[] = MUSCLE_GROUPS.map(muscle => {
        const count = muscleSessions.get(muscle)?.size || 0;
        const percentage = Math.min(Math.round((count / TARGET_SESSIONS) * 100), 100);

        return {
          muscle,
          displayName: getDisplayName(muscle),
          sessionsCount: count,
          targetSessions: TARGET_SESSIONS,
          percentage,
          isComplete: count >= TARGET_SESSIONS,
        };
      });

      // Sort by percentage ascending (undertrained first)
      result.sort((a, b) => a.percentage - b.percentage);

      setMuscles(result);
      setIsLoading(false);
    } catch (err) {
      console.error('Error in useTrainingFrequency:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFrequency();
  }, [fetchFrequency]);

  return { muscles, isLoading, error, refetch: fetchFrequency };
}
