// Default exercises for each workout type
// Exercise names must match those in the exercises database

export interface DefaultWorkoutExercise {
  name: string;
}

export const DEFAULT_WORKOUT_EXERCISES: Record<string, DefaultWorkoutExercise[]> = {
  'Push': [
    { name: 'Bench Press' },
    { name: 'Incline Bench Press' },
    { name: 'Shoulder Press' },
    { name: 'Chest Fly' },
    { name: 'Triceps Pushdown' },
    { name: 'Triceps Extension' },
    { name: 'Lateral Raises' },
  ],
  'Pull': [
    { name: 'Lat Pulldown' },
    { name: 'Seated Cable Row' },
    { name: 'Dumbbell Row' },
    { name: 'Barbell Row' },
    { name: 'Face Pulls' },
    { name: 'Barbell Curl' },
    { name: 'Hammer Curl' },
  ],
  'Legs': [
    { name: 'Squat' },
    { name: 'Leg Press' },
    { name: 'Leg Extension' },
    { name: 'Leg Curl' },
    { name: 'Romanian Deadlift' },
    { name: 'Hip Thrust' },
  ],
  'Full Body': [
    { name: 'Bench Press' },
    { name: 'Lat Pulldown' },
    { name: 'Squat' },
    { name: 'Overhead Press' },
    { name: 'Barbell Row' },
    { name: 'Barbell Curl' },
  ],
};

// Get exercise names for a workout type
export function getDefaultExerciseNames(workoutType: string): string[] {
  const exercises = DEFAULT_WORKOUT_EXERCISES[workoutType];
  if (!exercises) return [];
  return exercises.map(e => e.name);
}
