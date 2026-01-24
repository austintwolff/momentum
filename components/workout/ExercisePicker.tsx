import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DEFAULT_EXERCISES, MUSCLE_GROUPS, ExerciseDefinition } from '@/constants/exercises';
import { Exercise } from '@/types/database';
import { fetchExercisesFromDatabase } from '@/services/workout.service';
import { colors } from '@/constants/Colors';

// Custom SVG Icons
function CloseIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M6 6L18 18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PlusCircleIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 8V16M8 12H16M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Module-level cache to persist exercises across modal opens
let cachedExercises: Exercise[] | null = null;
let isFetching = false;

// Map workout types to relevant muscle groups
const WORKOUT_MUSCLE_MAP: Record<string, string[]> = {
  'Push Day': ['Chest', 'Shoulders', 'Triceps'],
  'Pull Day': ['Back', 'Biceps', 'Forearms'],
  'Leg Day': ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'],
  'Upper Body': ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
  'Lower Body': ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'],
  'Full Body': [], // Empty means all
};

// Get short label for workout type filter
const getWorkoutFilterLabel = (workoutName: string): string => {
  if (workoutName.includes('Push')) return 'Push';
  if (workoutName.includes('Pull')) return 'Pull';
  if (workoutName.includes('Leg')) return 'Legs';
  if (workoutName.includes('Upper')) return 'Upper';
  if (workoutName.includes('Lower')) return 'Lower';
  if (workoutName.includes('Full')) return 'Full Body';
  return workoutName;
};

interface ExercisePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
  workoutName?: string;
}

export default function ExercisePicker({
  visible,
  onClose,
  onSelectExercise,
  workoutName,
}: ExercisePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  // 'workout' = workout-specific filter, null = all, string = specific muscle group
  const [selectedFilter, setSelectedFilter] = useState<'workout' | null | string>('workout');
  const [databaseExercises, setDatabaseExercises] = useState<Exercise[]>(cachedExercises || []);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);

  // Get muscles for the current workout type
  const workoutMuscles = useMemo(() => {
    if (!workoutName) return [];
    // Find matching workout type
    for (const [key, muscles] of Object.entries(WORKOUT_MUSCLE_MAP)) {
      if (workoutName.toLowerCase().includes(key.toLowerCase().split(' ')[0])) {
        return muscles;
      }
    }
    return [];
  }, [workoutName]);

  // Reset filter when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedFilter(workoutMuscles.length > 0 ? 'workout' : null);
      setSearchQuery('');
    }
  }, [visible, workoutMuscles.length]);

  // Fetch exercises from database when modal opens (only if not cached)
  useEffect(() => {
    if (visible && !cachedExercises && !isFetching) {
      loadExercisesFromDatabase();
    }
  }, [visible]);

  const loadExercisesFromDatabase = async () => {
    isFetching = true;
    setIsLoadingExercises(true);
    try {
      const exercises = await fetchExercisesFromDatabase();
      if (exercises.length > 0) {
        cachedExercises = exercises;
        setDatabaseExercises(exercises);
      }
    } catch (error) {
      console.error('Failed to fetch exercises from database:', error);
    } finally {
      isFetching = false;
      setIsLoadingExercises(false);
    }
  };

  // Combine database exercises with local exercises, removing duplicates
  const allExercises = useMemo(() => {
    // Convert local exercises to Exercise format
    const localAsExercises: Exercise[] = DEFAULT_EXERCISES.map((def) => {
      // Include equipment in ID to make exercises with same name unique
      const equipmentSuffix = def.equipment.length > 0 ? `-${def.equipment[0]}` : '-bodyweight';
      return {
        id: `local-${def.name.toLowerCase().replace(/\s+/g, '-')}${equipmentSuffix}`,
        name: def.name,
        description: def.description,
        exercise_type: def.exerciseType,
        muscle_group: def.muscleGroup,
        equipment: def.equipment,
        is_compound: def.isCompound,
        created_by: null,
        is_public: true,
        created_at: new Date().toISOString(),
      };
    });

    // If we have database exercises, merge with local (database takes precedence for duplicates)
    let combined: Exercise[];
    if (databaseExercises.length > 0) {
      const dbNames = new Set(databaseExercises.map(e => e.name.toLowerCase()));
      const uniqueLocal = localAsExercises.filter(e => !dbNames.has(e.name.toLowerCase()));
      combined = [...databaseExercises, ...uniqueLocal];
    } else {
      combined = localAsExercises;
    }

    // Sort alphabetically by name
    return combined.sort((a, b) => a.name.localeCompare(b.name));
  }, [databaseExercises]);

  const filteredExercises = useMemo(() => {
    const matchesMuscleFilter = (muscleGroup: string): boolean => {
      if (selectedFilter === null) return true; // All
      if (selectedFilter === 'workout') {
        // Match any muscle in the workout type
        return workoutMuscles.length === 0 || workoutMuscles.includes(muscleGroup);
      }
      // Specific muscle group
      return muscleGroup === selectedFilter;
    };

    return allExercises.filter((exercise) => {
      const matchesSearch = exercise.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesMuscle = matchesMuscleFilter(exercise.muscle_group);
      return matchesSearch && matchesMuscle;
    });
  }, [searchQuery, selectedFilter, workoutMuscles, allExercises]);

  const handleSelectExercise = (exercise: Exercise) => {
    onSelectExercise(exercise);
    onClose();
    setSearchQuery('');
  };

  const renderExercise = ({ item }: { item: Exercise }) => {
    // Format equipment for display
    const equipmentLabel = item.equipment && item.equipment.length > 0
      ? item.equipment.map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(', ')
      : 'Bodyweight';

    return (
      <TouchableOpacity
        style={styles.exerciseItem}
        onPress={() => handleSelectExercise(item)}
      >
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>
            {item.name}
          </Text>
          <View style={styles.exerciseMeta}>
            <Text style={styles.muscleGroup}>
              {item.muscle_group}
            </Text>
            <Text style={styles.equipmentLabel}>
              {equipmentLabel}
            </Text>
          </View>
        </View>
        <PlusCircleIcon />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
            <CloseIcon />
          </TouchableOpacity>
          <Text style={styles.title}>
            Add Exercise
          </Text>
          <View style={styles.placeholder} />
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={styles.searchIconWrapper}>
            <SearchIcon />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Muscle Group Filter */}
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[
              ...(workoutMuscles.length > 0 ? ['workout'] : []),
              'All',
              ...MUSCLE_GROUPS,
            ]}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isActive =
                (item === 'workout' && selectedFilter === 'workout') ||
                (item === 'All' && selectedFilter === null) ||
                (item !== 'workout' && item !== 'All' && selectedFilter === item);

              const label = item === 'workout'
                ? getWorkoutFilterLabel(workoutName || '')
                : item;

              return (
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    isActive && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    if (item === 'workout') setSelectedFilter('workout');
                    else if (item === 'All') setSelectedFilter(null);
                    else setSelectedFilter(item);
                  }}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isActive && styles.filterChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.filterList}
          />
        </View>

        {/* Exercise List - show exercises immediately, loading indicator is subtle */}
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExercise}
          contentContainerStyle={styles.exerciseList}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            isLoadingExercises ? (
              <View style={styles.loadingBanner}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.loadingBannerText}>
                  Loading more exercises...
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>
                No exercises found
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchIconWrapper: {
    position: 'absolute',
    left: 36,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingLeft: 44,
    paddingRight: 16,
    fontSize: 16,
    backgroundColor: colors.bgSecondary,
    color: colors.textPrimary,
  },
  filterContainer: {
    paddingBottom: 12,
  },
  filterList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: colors.bgSecondary,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textPrimary,
  },
  exerciseList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: colors.textPrimary,
  },
  exerciseMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  muscleGroup: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.accent,
  },
  equipmentLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    color: colors.textSecondary,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingBannerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
