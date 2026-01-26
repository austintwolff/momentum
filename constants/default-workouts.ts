// Default exercises for each workout type
// Exercise names must match those in exercises.ts

export interface DefaultWorkoutExercise {
  name: string;
  equipment?: string; // To disambiguate exercises with same name
}

export const DEFAULT_WORKOUT_EXERCISES: Record<string, DefaultWorkoutExercise[]> = {
  'Push': [
    { name: 'Bench Press (Barbell)' },
    { name: 'Incline Bench Press (Dumbbell)' },
    { name: 'Landmine Pushes' },
    { name: 'Triceps Pushdown (Cable - Straight Bar)' },
    { name: 'Triceps Extension (Machine)' },
    { name: 'Incline Bench Press (Barbell)' },
    { name: 'Chest Fly' },
  ],
  'Pull': [
    { name: 'Lat Pulldown (Cable)' },
    { name: 'T Bar Row' },
    { name: 'Lat Pushdown' },
    { name: 'Bicep Curl (Barbell)' },
    { name: 'Low Row (Plate Loaded)' },
    { name: 'Seated Row (Cable)' },
    { name: 'Pull Up' },
  ],
  'Legs': [
    { name: 'Squat (Barbell)' },
    { name: 'Leg Extension (Machine)' },
    { name: 'Seated Leg Curl (Machine)' },
    { name: 'Front Squat (Barbell)' },
  ],
  'Full Body': [
    { name: 'Bench Press (Barbell)' },
    { name: 'Lat Pulldown (Cable)' },
    { name: 'Bicep Curl (Barbell)' },
    { name: 'Shoulder Press (Plate Loaded)' },
    { name: 'One Arm Row (Cable)' },
    { name: 'Incline Bench Press (Dumbbell)' },
    { name: 'Squat (Barbell)' },
  ],
};

// Get exercise names for a workout type
export function getDefaultExerciseNames(workoutType: string): string[] {
  const exercises = DEFAULT_WORKOUT_EXERCISES[workoutType];
  if (!exercises) return [];
  return exercises.map(e => e.name);
}
