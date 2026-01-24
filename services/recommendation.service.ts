import { supabase } from '@/lib/supabase';
import { Exercise } from '@/types/database';

// Equipment type categories
export type EquipmentType = 'Barbell' | 'Dumbbell' | 'Machine' | 'Bodyweight' | 'Cable';

// Derive equipment type from exercise equipment array
export function getEquipmentType(equipment: string[] | null, exerciseType: string): EquipmentType {
  if (exerciseType === 'bodyweight' || !equipment || equipment.length === 0) {
    return 'Bodyweight';
  }

  const equipmentStr = equipment.join(' ').toLowerCase();

  if (equipmentStr.includes('barbell') || equipmentStr.includes('bar')) {
    return 'Barbell';
  }
  if (equipmentStr.includes('dumbbell') || equipmentStr.includes('db')) {
    return 'Dumbbell';
  }
  if (equipmentStr.includes('cable')) {
    return 'Cable';
  }
  if (
    equipmentStr.includes('machine') ||
    equipmentStr.includes('smith') ||
    equipmentStr.includes('press machine') ||
    equipmentStr.includes('leg press') ||
    equipmentStr.includes('hack') ||
    equipmentStr.includes('lat pulldown') ||
    equipmentStr.includes('pec deck') ||
    equipmentStr.includes('seated') ||
    equipmentStr.includes('assisted')
  ) {
    return 'Machine';
  }

  // Default based on common patterns
  if (equipmentStr.includes('pull-up') || equipmentStr.includes('dip')) {
    return 'Bodyweight';
  }

  return 'Machine'; // Default for unknown equipment
}

// Get muscle tags for an exercise (for determining compound vs isolation)
export function getMuscleTags(exercise: Exercise): string[] {
  const muscles: string[] = [exercise.muscle_group];

  // Add secondary muscles for compound exercises
  if (exercise.is_compound) {
    const name = exercise.name.toLowerCase();

    if (name.includes('bench') || name.includes('push-up') || name.includes('pushup')) {
      if (!muscles.includes('Triceps')) muscles.push('Triceps');
      if (!muscles.includes('Shoulders')) muscles.push('Shoulders');
    } else if (name.includes('row') || name.includes('pull-up') || name.includes('pullup') || name.includes('lat pull')) {
      if (!muscles.includes('Biceps')) muscles.push('Biceps');
    } else if (name.includes('squat') || name.includes('leg press') || name.includes('lunge')) {
      if (!muscles.includes('Glutes')) muscles.push('Glutes');
      if (!muscles.includes('Hamstrings')) muscles.push('Hamstrings');
    } else if (name.includes('deadlift')) {
      if (!muscles.includes('Hamstrings')) muscles.push('Hamstrings');
      if (!muscles.includes('Glutes')) muscles.push('Glutes');
    } else if (name.includes('shoulder press') || name.includes('overhead') || name.includes('military')) {
      if (!muscles.includes('Triceps')) muscles.push('Triceps');
    } else if (name.includes('dip')) {
      if (!muscles.includes('Triceps')) muscles.push('Triceps');
      if (!muscles.includes('Chest')) muscles.push('Chest');
    }
  }

  return muscles.slice(0, 3); // Max 3 muscles
}

// Check if exercise is compound (2+ muscle tags)
export function isCompound(exercise: Exercise): boolean {
  return getMuscleTags(exercise).length >= 2;
}

// Get sets logged per muscle in the last 7 days
export interface MuscleWorkload {
  muscle: string;
  sets: number;
}

export async function get7DayMuscleWorkload(userId: string): Promise<Map<string, number>> {
  const workloadMap = new Map<string, number>();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    // Get all workout sessions from last 7 days
    const { data: sessions, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .gte('completed_at', sevenDaysAgo.toISOString());

    if (sessionsError || !sessions || sessions.length === 0) {
      return workloadMap;
    }

    const sessionIds = (sessions as any[]).map(s => s.id);

    // Get all sets from those sessions with exercise info
    const { data: sets, error: setsError } = await supabase
      .from('workout_sets')
      .select(`
        id,
        exercise:exercises (
          id,
          name,
          muscle_group,
          is_compound
        )
      `)
      .in('workout_session_id', sessionIds);

    if (setsError || !sets) {
      return workloadMap;
    }

    // Count sets per muscle, attributing to all muscles the exercise works
    for (const set of sets) {
      const exercise = (set as any).exercise;
      if (!exercise) continue;

      const muscles = getMuscleTags(exercise as Exercise);

      for (const muscle of muscles) {
        const current = workloadMap.get(muscle) || 0;
        workloadMap.set(muscle, current + 1);
      }
    }
  } catch (error) {
    console.error('Error fetching 7-day muscle workload:', error);
  }

  return workloadMap;
}

// Get exercise usage counts (total sets logged ever)
export async function getExerciseUsageCounts(userId: string): Promise<Map<string, number>> {
  const usageMap = new Map<string, number>();

  try {
    // Get all workout sessions for this user
    const { data: sessions, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId);

    if (sessionsError || !sessions || sessions.length === 0) {
      return usageMap;
    }

    const sessionIds = (sessions as any[]).map(s => s.id);

    // Count sets per exercise
    const { data: sets, error: setsError } = await supabase
      .from('workout_sets')
      .select('exercise_id')
      .in('workout_session_id', sessionIds);

    if (setsError || !sets) {
      return usageMap;
    }

    for (const set of sets) {
      const exerciseId = (set as any).exercise_id;
      const current = usageMap.get(exerciseId) || 0;
      usageMap.set(exerciseId, current + 1);
    }
  } catch (error) {
    console.error('Error fetching exercise usage counts:', error);
  }

  return usageMap;
}

// Recommendation scoring
interface ScoredExercise {
  exercise: Exercise;
  score: number;
  muscleNeedScore: number;
  usageScore: number;
  equipmentScore: number;
  compoundScore: number;
  alreadyDoneScore: number;
}

export interface RecommendationContext {
  muscleWorkload: Map<string, number>;
  exerciseUsage: Map<string, number>;
  completedExerciseIds: Set<string>;
  workoutMuscleGroups: string[];
}

export function scoreExercises(
  exercises: Exercise[],
  context: RecommendationContext
): Exercise[] {
  const { muscleWorkload, exerciseUsage, completedExerciseIds, workoutMuscleGroups } = context;

  // Find max workload for normalization
  const maxWorkload = Math.max(1, ...Array.from(muscleWorkload.values()));
  const maxUsage = Math.max(1, ...Array.from(exerciseUsage.values()));

  const scored: ScoredExercise[] = exercises.map(exercise => {
    const muscles = getMuscleTags(exercise);
    const equipmentType = getEquipmentType(exercise.equipment, exercise.exercise_type);
    const exerciseIsCompound = isCompound(exercise);
    const isAlreadyDone = completedExerciseIds.has(exercise.id);

    // Priority 1: Muscle need score (higher = more undertrained = better)
    // Calculate average workload of muscles this exercise targets
    let totalMuscleWorkload = 0;
    for (const muscle of muscles) {
      totalMuscleWorkload += muscleWorkload.get(muscle) || 0;
    }
    const avgMuscleWorkload = muscles.length > 0 ? totalMuscleWorkload / muscles.length : 0;
    // Invert: lower recent workload = higher score
    const muscleNeedScore = 100 - (avgMuscleWorkload / maxWorkload) * 100;

    // Priority 2: Usage score (higher usage = user prefers this exercise)
    const usage = exerciseUsage.get(exercise.id) || 0;
    const usageScore = (usage / maxUsage) * 50; // Scale to 0-50

    // Priority 3: Equipment preference (barbell/dumbbell > cable > machine)
    let equipmentScore = 0;
    switch (equipmentType) {
      case 'Barbell':
        equipmentScore = 15;
        break;
      case 'Dumbbell':
        equipmentScore = 15;
        break;
      case 'Bodyweight':
        equipmentScore = 12;
        break;
      case 'Cable':
        equipmentScore = 8;
        break;
      case 'Machine':
        equipmentScore = 5;
        break;
    }

    // Tie-breaker: Compound exercises score higher
    const compoundScore = exerciseIsCompound ? 10 : 0;

    // Tie-breaker: Already completed exercises score lower
    const alreadyDoneScore = isAlreadyDone ? -50 : 0;

    // Total score
    const score = muscleNeedScore + usageScore + equipmentScore + compoundScore + alreadyDoneScore;

    return {
      exercise,
      score,
      muscleNeedScore,
      usageScore,
      equipmentScore,
      compoundScore,
      alreadyDoneScore,
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map(s => s.exercise);
}

// Main recommendation function
export async function getRecommendedExercises(
  userId: string,
  allExercises: Exercise[],
  workoutMuscleGroups: string[],
  completedExerciseIds: string[] = [],
  limit: number = 15
): Promise<Exercise[]> {
  // Filter exercises to workout type
  let filtered: Exercise[];
  if (workoutMuscleGroups.length === 0) {
    // Full Body - include all
    filtered = allExercises;
  } else {
    filtered = allExercises.filter(ex =>
      workoutMuscleGroups.some(muscle =>
        ex.muscle_group.toLowerCase() === muscle.toLowerCase()
      )
    );
  }

  // Get recommendation context
  const [muscleWorkload, exerciseUsage] = await Promise.all([
    get7DayMuscleWorkload(userId),
    getExerciseUsageCounts(userId),
  ]);

  const context: RecommendationContext = {
    muscleWorkload,
    exerciseUsage,
    completedExerciseIds: new Set(completedExerciseIds),
    workoutMuscleGroups,
  };

  // Score and sort exercises
  const recommended = scoreExercises(filtered, context);

  // Return top N
  return recommended.slice(0, limit);
}
