import { useQuery } from '@tanstack/react-query';
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

async function fetchTrainingFrequency(userId: string): Promise<MuscleFrequency[]> {
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
    .eq('user_id', userId)
    .gte('completed_at', twoWeeksAgo.toISOString())
    .not('completed_at', 'is', null);

  if (sessionsError) {
    throw new Error(sessionsError.message);
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
    throw new Error(exercisesError.message);
  }

  // Create exercise ID to muscle group map
  const exerciseToMuscle = new Map<string, string>();
  exercises?.forEach((ex: any) => {
    exerciseToMuscle.set(ex.id, ex.muscle_group?.toLowerCase());
  });

  // Count unique sessions per muscle group
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

  // Sort by percentage descending (most trained first)
  result.sort((a, b) => b.percentage - a.percentage);

  return result;
}

/**
 * Hook to fetch training frequency per muscle group over rolling 14-day period.
 * Returns muscles sorted by most trained first (highest percentage).
 */
export function useTrainingFrequency(): UseTrainingFrequencyResult {
  const user = useAuthStore(s => s.user);

  const { data: muscles = [], isLoading, error, refetch } = useQuery({
    queryKey: ['trainingFrequency', user?.id],
    queryFn: () => fetchTrainingFrequency(user!.id),
    enabled: !!user?.id,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  return {
    muscles,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Unknown error') : null,
    refetch,
  };
}
