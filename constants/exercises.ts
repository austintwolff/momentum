export interface ExerciseDefinition {
  name: string;
  description: string;
  exerciseType: 'weighted' | 'bodyweight';
  muscleGroup: string;
  equipment: string[];
  isCompound: boolean;
}

export const MUSCLE_GROUPS = [
  'Chest',
  'Upper Back',
  'Lower Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
  'Forearms',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const DEFAULT_EXERCISES: ExerciseDefinition[] = [
  // ============================================================================
  // CHEST
  // ============================================================================
  {
    name: 'Bench Press',
    description: 'Barbell bench press for chest development',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['barbell'],
    isCompound: true,
  },
  {
    name: 'Dumbbell Bench Press',
    description: 'Dumbbell bench press for chest with greater range of motion',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['dumbbell'],
    isCompound: true,
  },
  {
    name: 'Decline Bench Press',
    description: 'Barbell press on decline bench for lower chest',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['barbell'],
    isCompound: true,
  },
  {
    name: 'Incline Bench Press',
    description: 'Incline barbell press targeting upper chest',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['barbell'],
    isCompound: true,
  },
  {
    name: 'Incline Dumbbell Press',
    description: 'Incline dumbbell press for upper chest',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['dumbbell'],
    isCompound: true,
  },
  {
    name: 'Chest Press Machine',
    description: 'Machine press for chest development',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['machine'],
    isCompound: true,
  },
  {
    name: 'Incline Chest Press Machine',
    description: 'Machine incline press for upper chest',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['machine'],
    isCompound: true,
  },
  {
    name: 'Chest Fly Machine',
    description: 'Machine fly for chest isolation',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['machine'],
    isCompound: false,
  },
  {
    name: 'Dumbbell Flyes',
    description: 'Dumbbell fly isolation for chest',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['dumbbell'],
    isCompound: false,
  },
  {
    name: 'Cable Crossover',
    description: 'Cable isolation for chest',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['cable'],
    isCompound: false,
  },
  {
    name: 'Cable Fly',
    description: 'Cable fly for chest',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['cable'],
    isCompound: false,
  },
  {
    name: 'Chest Dip',
    description: 'Dip movement for chest',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['machine'],
    isCompound: true,
  },
  {
    name: 'Hex Press',
    description: 'Dumbbell hex press for inner chest',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['dumbbell'],
    isCompound: true,
  },
  {
    name: 'Landmine Press',
    description: 'Landmine press for chest',
    exerciseType: 'weighted',
    muscleGroup: 'Chest',
    equipment: ['barbell'],
    isCompound: true,
  },
  {
    name: 'Push-ups',
    description: 'Classic bodyweight chest exercise',
    exerciseType: 'bodyweight',
    muscleGroup: 'Chest',
    equipment: [],
    isCompound: true,
  },

  // ============================================================================
  // UPPER BACK
  // ============================================================================
  {
    name: 'Barbell Row',
    description: 'Bent over barbell row for back thickness',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['barbell'],
    isCompound: true,
  },
  {
    name: 'Dumbbell Row',
    description: 'Single arm dumbbell row for back',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['dumbbell'],
    isCompound: true,
  },
  {
    name: 'Landmine Row',
    description: 'Landmine row for back thickness',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['barbell'],
    isCompound: true,
  },
  {
    name: 'T-Bar Row',
    description: 'T-bar row for back thickness',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['machine'],
    isCompound: true,
  },
  {
    name: 'Lat Pulldown',
    description: 'Cable lat pulldown for back width',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['cable'],
    isCompound: true,
  },
  {
    name: 'Lat Pulldown Machine',
    description: 'Machine lat pulldown for back width',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['machine'],
    isCompound: true,
  },
  {
    name: 'Single Arm Lat Pulldown',
    description: 'Single arm lat pulldown',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['cable'],
    isCompound: true,
  },
  {
    name: 'Straight Arm Pulldown',
    description: 'Straight arm lat pulldown for lats',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['cable'],
    isCompound: false,
  },
  {
    name: 'Seated Cable Row',
    description: 'Cable row for back thickness',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['cable'],
    isCompound: true,
  },
  {
    name: 'Seated Row Machine',
    description: 'Machine seated row for back thickness',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['machine'],
    isCompound: true,
  },
  {
    name: 'Pull-ups',
    description: 'Bodyweight vertical pull for back width',
    exerciseType: 'bodyweight',
    muscleGroup: 'Upper Back',
    equipment: [],
    isCompound: true,
  },
  {
    name: 'Chin-ups',
    description: 'Underhand grip pull-up emphasizing biceps',
    exerciseType: 'bodyweight',
    muscleGroup: 'Upper Back',
    equipment: [],
    isCompound: true,
  },
  {
    name: 'Face Pulls',
    description: 'Cable face pull for rear delts and upper back',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['cable'],
    isCompound: false,
  },
  {
    name: 'Barbell Shrug',
    description: 'Barbell shrug for traps',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['barbell'],
    isCompound: false,
  },
  {
    name: 'Dumbbell Shrug',
    description: 'Dumbbell shrug for traps',
    exerciseType: 'weighted',
    muscleGroup: 'Upper Back',
    equipment: ['dumbbell'],
    isCompound: false,
  },

  // ============================================================================
  // LOWER BACK
  // ============================================================================
  {
    name: 'Deadlift',
    description: 'Full body compound lift focusing on posterior chain',
    exerciseType: 'weighted',
    muscleGroup: 'Lower Back',
    equipment: ['barbell'],
    isCompound: true,
  },

  // ============================================================================
  // SHOULDERS
  // ============================================================================
  {
    name: 'Overhead Press',
    description: 'Standing barbell press for shoulders',
    exerciseType: 'weighted',
    muscleGroup: 'Shoulders',
    equipment: ['barbell'],
    isCompound: true,
  },
  {
    name: 'Dumbbell Shoulder Press',
    description: 'Seated or standing dumbbell press',
    exerciseType: 'weighted',
    muscleGroup: 'Shoulders',
    equipment: ['dumbbell'],
    isCompound: true,
  },
  {
    name: 'Shoulder Press Machine',
    description: 'Machine press for shoulders',
    exerciseType: 'weighted',
    muscleGroup: 'Shoulders',
    equipment: ['machine'],
    isCompound: true,
  },
  {
    name: 'Arnold Press',
    description: 'Rotating dumbbell press for full delt activation',
    exerciseType: 'weighted',
    muscleGroup: 'Shoulders',
    equipment: ['dumbbell'],
    isCompound: true,
  },
  {
    name: 'Lateral Raises',
    description: 'Dumbbell lateral raise for side deltoids',
    exerciseType: 'weighted',
    muscleGroup: 'Shoulders',
    equipment: ['dumbbell'],
    isCompound: false,
  },
  {
    name: 'Cable Lateral Raise',
    description: 'Cable lateral raise for side deltoids',
    exerciseType: 'weighted',
    muscleGroup: 'Shoulders',
    equipment: ['cable'],
    isCompound: false,
  },
  {
    name: 'Front Raises',
    description: 'Dumbbell front raise for front deltoids',
    exerciseType: 'weighted',
    muscleGroup: 'Shoulders',
    equipment: ['dumbbell'],
    isCompound: false,
  },
  {
    name: 'Rear Delt Flyes',
    description: 'Isolation for rear deltoids',
    exerciseType: 'weighted',
    muscleGroup: 'Shoulders',
    equipment: ['dumbbell'],
    isCompound: false,
  },
  {
    name: 'Upright Row',
    description: 'Barbell upright row for shoulders and traps',
    exerciseType: 'weighted',
    muscleGroup: 'Shoulders',
    equipment: ['barbell'],
    isCompound: true,
  },

  // ============================================================================
  // BICEPS
  // ============================================================================
  {
    name: 'Barbell Curl',
    description: 'Classic barbell bicep curl',
    exerciseType: 'weighted',
    muscleGroup: 'Biceps',
    equipment: ['barbell'],
    isCompound: false,
  },
  {
    name: 'Dumbbell Curl',
    description: 'Dumbbell bicep curl',
    exerciseType: 'weighted',
    muscleGroup: 'Biceps',
    equipment: ['dumbbell'],
    isCompound: false,
  },
  {
    name: 'Cable Curl',
    description: 'Cable bicep curl',
    exerciseType: 'weighted',
    muscleGroup: 'Biceps',
    equipment: ['cable'],
    isCompound: false,
  },
  {
    name: 'Machine Curl',
    description: 'Machine bicep curl',
    exerciseType: 'weighted',
    muscleGroup: 'Biceps',
    equipment: ['machine'],
    isCompound: false,
  },
  {
    name: 'Hammer Curl',
    description: 'Neutral grip dumbbell curl for brachialis',
    exerciseType: 'weighted',
    muscleGroup: 'Biceps',
    equipment: ['dumbbell'],
    isCompound: false,
  },
  {
    name: 'Concentration Curl',
    description: 'Seated single arm concentration curl',
    exerciseType: 'weighted',
    muscleGroup: 'Biceps',
    equipment: ['dumbbell'],
    isCompound: false,
  },
  {
    name: 'Incline Dumbbell Curl',
    description: 'Incline bench dumbbell curl for long head stretch',
    exerciseType: 'weighted',
    muscleGroup: 'Biceps',
    equipment: ['dumbbell'],
    isCompound: false,
  },
  {
    name: 'Preacher Curl',
    description: 'Preacher curl for bicep isolation',
    exerciseType: 'weighted',
    muscleGroup: 'Biceps',
    equipment: ['barbell'],
    isCompound: false,
  },
  {
    name: 'Preacher Curl Machine',
    description: 'Machine preacher curl for bicep isolation',
    exerciseType: 'weighted',
    muscleGroup: 'Biceps',
    equipment: ['machine'],
    isCompound: false,
  },

  // ============================================================================
  // TRICEPS
  // ============================================================================
  {
    name: 'Close Grip Bench Press',
    description: 'Close grip bench press for triceps',
    exerciseType: 'weighted',
    muscleGroup: 'Triceps',
    equipment: ['barbell'],
    isCompound: true,
  },
  {
    name: 'Triceps Pushdown',
    description: 'Cable tricep pushdown',
    exerciseType: 'weighted',
    muscleGroup: 'Triceps',
    equipment: ['cable'],
    isCompound: false,
  },
  {
    name: 'Overhead Tricep Extension',
    description: 'Overhead cable or dumbbell extension for triceps',
    exerciseType: 'weighted',
    muscleGroup: 'Triceps',
    equipment: ['cable'],
    isCompound: false,
  },
  {
    name: 'Dumbbell Tricep Extension',
    description: 'Dumbbell tricep extension',
    exerciseType: 'weighted',
    muscleGroup: 'Triceps',
    equipment: ['dumbbell'],
    isCompound: false,
  },
  {
    name: 'Tricep Extension Machine',
    description: 'Machine tricep extension',
    exerciseType: 'weighted',
    muscleGroup: 'Triceps',
    equipment: ['machine'],
    isCompound: false,
  },
  {
    name: 'Skull Crushers',
    description: 'Lying barbell tricep extension',
    exerciseType: 'weighted',
    muscleGroup: 'Triceps',
    equipment: ['barbell'],
    isCompound: false,
  },
  {
    name: 'Tricep Dips',
    description: 'Bodyweight tricep exercise',
    exerciseType: 'bodyweight',
    muscleGroup: 'Triceps',
    equipment: [],
    isCompound: true,
  },

  // ============================================================================
  // QUADS
  // ============================================================================
  {
    name: 'Squat',
    description: 'Barbell back squat for legs',
    exerciseType: 'weighted',
    muscleGroup: 'Quads',
    equipment: ['barbell'],
    isCompound: true,
  },
  {
    name: 'Front Squat',
    description: 'Front loaded barbell squat for quad emphasis',
    exerciseType: 'weighted',
    muscleGroup: 'Quads',
    equipment: ['barbell'],
    isCompound: true,
  },
  {
    name: 'Hack Squat',
    description: 'Machine hack squat for quads',
    exerciseType: 'weighted',
    muscleGroup: 'Quads',
    equipment: ['machine'],
    isCompound: true,
  },
  {
    name: 'Leg Press',
    description: 'Machine leg press for legs',
    exerciseType: 'weighted',
    muscleGroup: 'Quads',
    equipment: ['machine'],
    isCompound: true,
  },
  {
    name: 'Leg Extension',
    description: 'Machine leg extension for quad isolation',
    exerciseType: 'weighted',
    muscleGroup: 'Quads',
    equipment: ['machine'],
    isCompound: false,
  },
  {
    name: 'Lunges',
    description: 'Dumbbell lunges for legs',
    exerciseType: 'weighted',
    muscleGroup: 'Quads',
    equipment: ['dumbbell'],
    isCompound: true,
  },
  {
    name: 'Bulgarian Split Squat',
    description: 'Single leg squat with rear foot elevated',
    exerciseType: 'weighted',
    muscleGroup: 'Quads',
    equipment: ['dumbbell'],
    isCompound: true,
  },

  // ============================================================================
  // HAMSTRINGS
  // ============================================================================
  {
    name: 'Romanian Deadlift',
    description: 'Hip hinge for hamstrings and glutes',
    exerciseType: 'weighted',
    muscleGroup: 'Hamstrings',
    equipment: ['barbell'],
    isCompound: true,
  },
  {
    name: 'Dumbbell Romanian Deadlift',
    description: 'Dumbbell Romanian deadlift',
    exerciseType: 'weighted',
    muscleGroup: 'Hamstrings',
    equipment: ['dumbbell'],
    isCompound: true,
  },
  {
    name: 'Leg Curl',
    description: 'Machine leg curl for hamstrings',
    exerciseType: 'weighted',
    muscleGroup: 'Hamstrings',
    equipment: ['machine'],
    isCompound: false,
  },
  {
    name: 'Seated Leg Curl',
    description: 'Seated machine leg curl',
    exerciseType: 'weighted',
    muscleGroup: 'Hamstrings',
    equipment: ['machine'],
    isCompound: false,
  },
  {
    name: 'Good Mornings',
    description: 'Barbell hip hinge for posterior chain',
    exerciseType: 'weighted',
    muscleGroup: 'Hamstrings',
    equipment: ['barbell'],
    isCompound: true,
  },

  // ============================================================================
  // GLUTES
  // ============================================================================
  {
    name: 'Hip Thrust',
    description: 'Primary glute builder',
    exerciseType: 'weighted',
    muscleGroup: 'Glutes',
    equipment: ['barbell'],
    isCompound: true,
  },
  {
    name: 'Glute Bridge',
    description: 'Bodyweight or weighted glute exercise',
    exerciseType: 'bodyweight',
    muscleGroup: 'Glutes',
    equipment: [],
    isCompound: false,
  },
  {
    name: 'Cable Kickback',
    description: 'Cable isolation for glutes',
    exerciseType: 'weighted',
    muscleGroup: 'Glutes',
    equipment: ['cable'],
    isCompound: false,
  },

  // ============================================================================
  // CALVES
  // ============================================================================
  {
    name: 'Standing Calf Raise',
    description: 'Standing calf raise on machine',
    exerciseType: 'weighted',
    muscleGroup: 'Calves',
    equipment: ['machine'],
    isCompound: false,
  },
  {
    name: 'Seated Calf Raise',
    description: 'Seated calf raise for soleus',
    exerciseType: 'weighted',
    muscleGroup: 'Calves',
    equipment: ['machine'],
    isCompound: false,
  },

  // ============================================================================
  // CORE
  // ============================================================================
  {
    name: 'Plank',
    description: 'Isometric core stability exercise',
    exerciseType: 'bodyweight',
    muscleGroup: 'Core',
    equipment: [],
    isCompound: false,
  },
  {
    name: 'Cable Crunch',
    description: 'Weighted ab exercise',
    exerciseType: 'weighted',
    muscleGroup: 'Core',
    equipment: ['cable'],
    isCompound: false,
  },
  {
    name: 'Crunch Machine',
    description: 'Machine crunch for abs',
    exerciseType: 'weighted',
    muscleGroup: 'Core',
    equipment: ['machine'],
    isCompound: false,
  },
  {
    name: 'Hanging Leg Raise',
    description: 'Advanced ab exercise',
    exerciseType: 'bodyweight',
    muscleGroup: 'Core',
    equipment: [],
    isCompound: false,
  },
  {
    name: 'Ab Wheel Rollout',
    description: 'Dynamic core stability exercise',
    exerciseType: 'bodyweight',
    muscleGroup: 'Core',
    equipment: [],
    isCompound: false,
  },
  {
    name: 'Russian Twist',
    description: 'Rotational core exercise',
    exerciseType: 'bodyweight',
    muscleGroup: 'Core',
    equipment: [],
    isCompound: false,
  },

  // ============================================================================
  // FOREARMS
  // ============================================================================
  {
    name: 'Reverse Curl',
    description: 'Overhand grip barbell curl for forearms',
    exerciseType: 'weighted',
    muscleGroup: 'Forearms',
    equipment: ['barbell'],
    isCompound: false,
  },
  {
    name: 'Wrist Curl',
    description: 'Wrist curl for forearm flexors',
    exerciseType: 'weighted',
    muscleGroup: 'Forearms',
    equipment: ['dumbbell'],
    isCompound: false,
  },
];
