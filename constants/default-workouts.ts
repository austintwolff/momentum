// Default exercises for each workout type
// Exercise names must match those in exercises.ts

export interface DefaultWorkoutExercise {
  name: string;
  equipment?: string; // To disambiguate exercises with same name
}

export const DEFAULT_WORKOUT_EXERCISES: Record<string, DefaultWorkoutExercise[]> = {
  'Push': [
    { name: 'Bench Press', equipment: 'barbell' },
    { name: 'Incline Bench Press', equipment: 'dumbbell' },
    { name: 'Overhead Press', equipment: 'dumbbell' },
    { name: 'Chest Fly' },
    { name: 'Lateral Raise' },
    { name: 'Triceps Pushdown' },
    { name: 'Overhead Tricep Extension' },
  ],
  'Pull': [
    { name: 'Lat Pulldown', equipment: 'cable' },
    { name: 'Seated Row', equipment: 'cable' },
    { name: 'Bent-Over Row' },
    { name: 'Face Pull' },
    { name: 'Bicep Curl', equipment: 'barbell' },
    { name: 'Hammer Curl' },
    { name: 'Reverse Curl' },
  ],
  'Legs': [
    { name: 'Squat', equipment: 'barbell' },
    { name: 'Leg Press' },
    { name: 'Leg Extension' },
    { name: 'Leg Curl' },
    { name: 'Calf Raise' },
  ],
  'Full Body': [
    { name: 'Squat', equipment: 'barbell' },
    { name: 'Bench Press', equipment: 'barbell' },
    { name: 'Bent-Over Row' },
    { name: 'Overhead Press', equipment: 'dumbbell' },
    { name: 'Lat Pulldown', equipment: 'cable' },
    { name: 'Leg Press' },
    { name: 'Bicep Curl', equipment: 'dumbbell' },
    { name: 'Triceps Pushdown' },
  ],
};

// Get exercise names for a workout type
export function getDefaultExerciseNames(workoutType: string): string[] {
  const exercises = DEFAULT_WORKOUT_EXERCISES[workoutType];
  if (!exercises) return [];
  return exercises.map(e => e.name);
}
