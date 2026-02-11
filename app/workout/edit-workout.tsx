import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/Colors';
import { useCustomWorkoutStore } from '@/stores/custom-workout.store';
import { useWorkoutPreferencesStore } from '@/stores/workout-preferences.store';
import { DEFAULT_EXERCISES } from '@/constants/exercises';
import { DEFAULT_WORKOUT_EXERCISES, getDefaultExerciseNames } from '@/constants/default-workouts';

const MUSCLE_GROUPS = [
  'Chest',
  'Upper Back',
  'Lower Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Core',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
];

// Default workout muscle mappings
const DEFAULT_WORKOUT_MUSCLES: Record<string, string[]> = {
  'Push': ['Chest', 'Shoulders', 'Triceps'],
  'Pull': ['Upper Back', 'Biceps', 'Forearms'],
  'Legs': ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  'Full Body': ['Chest', 'Upper Back', 'Lower Back', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Quads', 'Hamstrings', 'Glutes', 'Calves'],
};

function CloseIcon({ size = 24, color = colors.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M6 6L18 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CheckIcon({ size = 18, color = colors.textPrimary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17L4 12"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrashIcon({ size = 20, color = colors.error }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6H5H21" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusIcon({ size = 16, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M5 12H19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function MinusIcon({ size = 16, color = colors.error }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12H19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

// Get unique exercise names from DEFAULT_EXERCISES
function getUniqueExerciseNames(): string[] {
  const names = new Set<string>();
  DEFAULT_EXERCISES.forEach(ex => names.add(ex.name));
  return Array.from(names).sort();
}

// Group exercises by muscle group
function getExercisesByMuscle(): Record<string, string[]> {
  const grouped: Record<string, Set<string>> = {};
  DEFAULT_EXERCISES.forEach(ex => {
    if (!grouped[ex.muscleGroup]) {
      grouped[ex.muscleGroup] = new Set();
    }
    grouped[ex.muscleGroup].add(ex.name);
  });
  const result: Record<string, string[]> = {};
  for (const [muscle, names] of Object.entries(grouped)) {
    result[muscle] = Array.from(names).sort();
  }
  return result;
}

function ResetIcon({ size = 18, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 4V10H7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3.51 15C4.15839 16.8404 5.38734 18.4202 7.01166 19.5014C8.63598 20.5826 10.5677 21.1066 12.5157 20.9945C14.4637 20.8824 16.3226 20.1402 17.8121 18.8798C19.3017 17.6193 20.3413 15.909 20.7742 14.0064C21.2072 12.1037 21.0101 10.112 20.2126 8.33111C19.4152 6.55025 18.0605 5.07688 16.3528 4.13277C14.6451 3.18866 12.6769 2.82527 10.7447 3.09712C8.81245 3.36897 7.02091 4.26142 5.64 5.64L1 10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function EditWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; type?: string; isCustom?: string }>();

  const customWorkouts = useCustomWorkoutStore(s => s.customWorkouts);
  const removeCustomWorkout = useCustomWorkoutStore(s => s.removeCustomWorkout);
  const updateCustomWorkout = useCustomWorkoutStore(s => s.updateCustomWorkout);
  const getExercisesForWorkout = useWorkoutPreferencesStore(s => s.getExercisesForWorkout);
  const setExercisesForWorkout = useWorkoutPreferencesStore(s => s.setExercisesForWorkout);
  const resetWorkoutToDefaults = useWorkoutPreferencesStore(s => s.resetWorkoutToDefaults);
  const isWorkoutCustomized = useWorkoutPreferencesStore(s => s.isWorkoutCustomized);

  const isCustom = params.isCustom === 'true';
  const workoutId = params.id;
  const workoutType = params.type || '';

  // Find the custom workout if editing one
  const customWorkout = isCustom && workoutId
    ? customWorkouts.find(w => w.id === workoutId)
    : null;

  // Get exercises for this workout type (user preferences or defaults)
  const initialExercises = isCustom
    ? (customWorkout?.exercises || [])
    : getExercisesForWorkout(workoutType);

  const [workoutName, setWorkoutName] = useState(customWorkout?.name || workoutType || '');
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>(
    customWorkout?.muscleGroups || DEFAULT_WORKOUT_MUSCLES[workoutType] || []
  );
  const [selectedExercises, setSelectedExercises] = useState<string[]>(initialExercises);

  // Check if default workout has been customized
  const isDefaultCustomized = !isCustom && isWorkoutCustomized(workoutType);

  // Get exercises grouped by muscle
  const exercisesByMuscle = useMemo(() => getExercisesByMuscle(), []);

  // Filter exercises by selected muscles
  const availableExercises = useMemo(() => {
    const exercises: string[] = [];
    selectedMuscles.forEach(muscle => {
      const muscleExercises = exercisesByMuscle[muscle] || [];
      muscleExercises.forEach(ex => {
        if (!exercises.includes(ex)) {
          exercises.push(ex);
        }
      });
    });
    return exercises.sort();
  }, [selectedMuscles, exercisesByMuscle]);

  // For custom workouts: can save if name and muscles are set
  const canSaveCustom = isCustom && workoutName.trim().length > 0 && selectedMuscles.length > 0;

  // Check for changes
  const hasCustomChanges = isCustom && customWorkout && (
    workoutName.trim() !== customWorkout.name ||
    JSON.stringify(selectedMuscles.sort()) !== JSON.stringify([...customWorkout.muscleGroups].sort()) ||
    JSON.stringify(selectedExercises.sort()) !== JSON.stringify([...(customWorkout.exercises || [])].sort())
  );

  const hasDefaultChanges = !isCustom && (
    JSON.stringify(selectedExercises.sort()) !== JSON.stringify([...initialExercises].sort())
  );

  const hasChanges = isCustom ? hasCustomChanges : hasDefaultChanges;

  const handleToggleMuscle = (muscle: string) => {
    if (!isCustom) return;
    setSelectedMuscles(prev =>
      prev.includes(muscle)
        ? prev.filter(m => m !== muscle)
        : [...prev, muscle]
    );
  };

  const handleToggleExercise = (exercise: string) => {
    setSelectedExercises(prev =>
      prev.includes(exercise)
        ? prev.filter(e => e !== exercise)
        : [...prev, exercise]
    );
  };

  const handleSave = () => {
    if (isCustom) {
      // Save custom workout
      if (!canSaveCustom || !workoutId) return;
      updateCustomWorkout(workoutId, workoutName.trim(), selectedMuscles, selectedExercises);
    } else {
      // Save default workout preferences
      setExercisesForWorkout(workoutType, selectedExercises);
    }
    router.back();
  };

  const handleResetToDefaults = () => {
    if (isCustom) return;
    Alert.alert(
      'Reset to Defaults',
      `Reset ${workoutType} exercises to the default list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            resetWorkoutToDefaults(workoutType);
            setSelectedExercises(getDefaultExerciseNames(workoutType));
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!isCustom || !workoutId) return;

    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${workoutName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeCustomWorkout(workoutId);
            router.back();
          },
        },
      ]
    );
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton} accessibilityLabel="Close">
          <CloseIcon />
        </TouchableOpacity>
        <Text style={styles.title}>{isCustom ? 'Edit Workout' : 'Workout Details'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Workout Name Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Name</Text>
          {isCustom ? (
            <TextInput
              style={styles.nameInput}
              placeholder="e.g., Upper Body, Arms Day..."
              placeholderTextColor={colors.textMuted}
              value={workoutName}
              onChangeText={setWorkoutName}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={30}
            />
          ) : (
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{workoutName}</Text>
            </View>
          )}
        </View>

        {/* Muscle Groups Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target Muscle Groups</Text>
          {!isCustom && (
            <Text style={styles.sectionSubtitle}>
              Muscle groups are fixed for default workouts
            </Text>
          )}
          <View style={styles.muscleGrid}>
            {MUSCLE_GROUPS.map(muscle => {
              const isSelected = selectedMuscles.includes(muscle);
              return (
                <TouchableOpacity
                  key={muscle}
                  style={[
                    styles.muscleChip,
                    isSelected && styles.muscleChipSelected,
                    !isCustom && styles.muscleChipDisabled,
                  ]}
                  onPress={() => handleToggleMuscle(muscle)}
                  activeOpacity={isCustom ? 0.7 : 1}
                  disabled={!isCustom}
                >
                  {isSelected && (
                    <CheckIcon size={14} />
                  )}
                  <Text
                    style={[
                      styles.muscleChipText,
                      isSelected && styles.muscleChipTextSelected,
                    ]}
                  >
                    {muscle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Exercises Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Exercises</Text>
            <Text style={styles.exerciseCount}>{selectedExercises.length} selected</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Tap to add or remove exercises
          </Text>
          <View style={styles.exerciseList}>
            {availableExercises.map(exercise => {
              const isSelected = selectedExercises.includes(exercise);
              return (
                <TouchableOpacity
                  key={exercise}
                  style={[
                    styles.exerciseItem,
                    isSelected && styles.exerciseItemSelected,
                  ]}
                  onPress={() => handleToggleExercise(exercise)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.exerciseItemText,
                      isSelected && styles.exerciseItemTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {exercise}
                  </Text>
                  <View style={[
                    styles.exerciseToggle,
                    isSelected ? styles.exerciseToggleRemove : styles.exerciseToggleAdd,
                  ]}>
                    {isSelected ? (
                      <MinusIcon size={14} color={colors.error} />
                    ) : (
                      <PlusIcon size={14} color={colors.accent} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
            {availableExercises.length === 0 && (
              <Text style={styles.noExercisesText}>
                Select muscle groups to see available exercises
              </Text>
            )}
          </View>
        </View>

        {/* Reset to Defaults Button (Default workouts only, when customized) */}
        {!isCustom && isDefaultCustomized && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetToDefaults}
              activeOpacity={0.7}
            >
              <ResetIcon />
              <Text style={styles.resetButtonText}>Reset to Defaults</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delete Button (Custom workouts only) */}
        {isCustom && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <TrashIcon />
              <Text style={styles.deleteButtonText}>Delete Workout</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Footer - Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            (isCustom ? (!canSaveCustom || !hasChanges) : !hasChanges) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isCustom ? (!canSaveCustom || !hasChanges) : !hasChanges}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    gap: 28,
    paddingBottom: 40,
  },
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: -8,
  },
  exerciseCount: {
    fontSize: 13,
    color: colors.textMuted,
  },
  nameInput: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readOnlyField: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readOnlyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  muscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  muscleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muscleChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  muscleChipDisabled: {
    opacity: 0.7,
  },
  muscleChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  muscleChipTextSelected: {
    color: colors.textPrimary,
  },
  exerciseList: {
    gap: 8,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseItemSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.bgTertiary,
  },
  exerciseItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    flex: 1,
    marginRight: 12,
  },
  exerciseItemTextSelected: {
    color: colors.textPrimary,
  },
  exerciseToggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseToggleAdd: {
    backgroundColor: colors.bgTertiary,
  },
  exerciseToggleRemove: {
    backgroundColor: colors.bgSecondary,
  },
  noExercisesText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
  footer: {
    padding: 20,
    paddingBottom: 32,
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.bgTertiary,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
