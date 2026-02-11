import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/Colors';
import { useCustomWorkoutStore } from '@/stores/custom-workout.store';
import { DEFAULT_EXERCISES } from '@/constants/exercises';

const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Core',
  'Quadriceps',
  'Hamstrings',
  'Glutes',
  'Calves',
];

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

export default function CreateCustomWorkoutScreen() {
  const router = useRouter();
  const addCustomWorkout = useCustomWorkoutStore(s => s.addCustomWorkout);

  const [workoutName, setWorkoutName] = useState('');
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);

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

  const canSave = workoutName.trim().length > 0 && selectedMuscles.length > 0;

  const handleToggleMuscle = (muscle: string) => {
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
    if (!canSave) return;
    addCustomWorkout(workoutName.trim(), selectedMuscles, selectedExercises);
    router.back();
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
        <Text style={styles.title}>Create Workout</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Workout Name Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Name</Text>
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
        </View>

        {/* Muscle Groups Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target Muscle Groups</Text>
          <Text style={styles.sectionSubtitle}>
            Select which muscles this workout will target
          </Text>
          <View style={styles.muscleGrid}>
            {MUSCLE_GROUPS.map(muscle => {
              const isSelected = selectedMuscles.includes(muscle);
              return (
                <TouchableOpacity
                  key={muscle}
                  style={[
                    styles.muscleChip,
                    isSelected && styles.muscleChipSelected,
                  ]}
                  onPress={() => handleToggleMuscle(muscle)}
                  activeOpacity={0.7}
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
        {selectedMuscles.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Exercises</Text>
              <Text style={styles.exerciseCount}>{selectedExercises.length} selected</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Tap to add exercises to your workout
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
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>Create Workout</Text>
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
