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
  ScrollView,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MUSCLE_GROUPS } from '@/constants/exercises';
import { Exercise } from '@/types/database';
import { syncAndFetchExercises, createCustomExercise } from '@/services/exercise-sync.service';
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

const EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'None'] as const;

// Map workout types to relevant muscle groups
const WORKOUT_MUSCLE_MAP: Record<string, string[]> = {
  'Push Day': ['Chest', 'Shoulders', 'Triceps'],
  'Pull Day': ['Upper Back', 'Biceps', 'Forearms'],
  'Leg Day': ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  'Upper Body': ['Chest', 'Upper Back', 'Shoulders', 'Biceps', 'Triceps'],
  'Lower Body': ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
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
  excludeExerciseIds?: string[];
}

export default function ExercisePicker({
  visible,
  onClose,
  onSelectExercise,
  workoutName,
  excludeExerciseIds,
}: ExercisePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  // 'workout' = workout-specific filter, null = all, string = specific muscle group
  const [selectedFilter, setSelectedFilter] = useState<'workout' | null | string>('workout');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);

  // Custom exercise creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscleGroup, setNewMuscleGroup] = useState<string>('');
  const [newExerciseType, setNewExerciseType] = useState<'weighted' | 'bodyweight'>('weighted');
  const [newEquipment, setNewEquipment] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

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

  // Reset filter and create form when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedFilter(workoutMuscles.length > 0 ? 'workout' : null);
      setSearchQuery('');
      setShowCreateForm(false);
      setNewName('');
    }
  }, [visible, workoutMuscles.length]);

  // Sync and fetch exercises when modal opens
  // syncAndFetchExercises has internal caching, so redundant calls return immediately
  useEffect(() => {
    if (visible && exercises.length === 0) {
      loadExercises();
    }
  }, [visible]);

  const loadExercises = async () => {
    setIsLoadingExercises(true);
    try {
      // syncAndFetchExercises handles caching internally
      const syncedExercises = await syncAndFetchExercises();
      setExercises(syncedExercises);
    } catch (error) {
      console.error('Failed to sync/fetch exercises:', error);
    } finally {
      setIsLoadingExercises(false);
    }
  };

  const excludeIds = useMemo(
    () => new Set(excludeExerciseIds || []),
    [excludeExerciseIds]
  );

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

    return exercises.filter((exercise) => {
      if (excludeIds.has(exercise.id)) return false;
      const matchesSearch = exercise.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesMuscle = matchesMuscleFilter(exercise.muscle_group);
      return matchesSearch && matchesMuscle;
    });
  }, [searchQuery, selectedFilter, workoutMuscles, exercises, excludeIds]);

  const handleSelectExercise = (exercise: Exercise) => {
    onSelectExercise(exercise);
    onClose();
    setSearchQuery('');
  };

  const handleOpenCreateForm = () => {
    setNewName(searchQuery);
    setNewMuscleGroup(workoutMuscles.length > 0 ? workoutMuscles[0] : MUSCLE_GROUPS[0]);
    setNewExerciseType('weighted');
    setNewEquipment('Barbell');
    setShowCreateForm(true);
  };

  const handleCreateExercise = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter a name for the exercise.');
      return;
    }
    if (!newMuscleGroup) {
      Alert.alert('Muscle Group Required', 'Please select a muscle group.');
      return;
    }

    setIsCreating(true);
    try {
      const created = await createCustomExercise({
        name: trimmedName,
        muscleGroup: newMuscleGroup,
        exerciseType: newExerciseType,
        equipment: newEquipment === 'None' ? [] : [newEquipment.toLowerCase()],
      });

      if (created) {
        // Add to local exercises list so it appears immediately
        setExercises(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        // Close create form first, then let it dismiss before closing the picker
        setShowCreateForm(false);
        setTimeout(() => {
          handleSelectExercise(created);
        }, 300);
      } else {
        Alert.alert('Error', 'Failed to create exercise. Please try again.');
      }
    } catch (error) {
      console.error('Failed to create custom exercise:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsCreating(false);
    }
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

  const renderFooter = () => {
    const isEmpty = filteredExercises.length === 0;

    return (
      <View style={isEmpty ? styles.emptyFooterWrapper : undefined}>
        {isEmpty && !isLoadingExercises && (
          <Text style={styles.emptyHint}>No exercises found</Text>
        )}
        <TouchableOpacity
          style={styles.createFooterButton}
          onPress={handleOpenCreateForm}
          activeOpacity={0.7}
        >
          <PlusCircleIcon size={20} />
          <Text style={styles.createFooterText}>Create Custom Exercise</Text>
        </TouchableOpacity>
      </View>
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

        {/* Exercise List */}
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExercise}
          contentContainerStyle={styles.exerciseList}
          keyboardShouldPersistTaps="handled"
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
          ListFooterComponent={renderFooter}
        />
      </SafeAreaView>

      {/* Create Custom Exercise Modal */}
      <Modal
        visible={showCreateForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateForm(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCreateForm(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <Text style={styles.createFormTitle}>Create Custom Exercise</Text>

            <View style={styles.createFieldGroup}>
              <Text style={styles.createFormLabel}>Name</Text>
              <TextInput
                style={styles.createFormInput}
                placeholder="e.g. Cable Fly"
                placeholderTextColor={colors.textMuted}
                value={newName}
                onChangeText={setNewName}
              />
            </View>

            <View style={styles.createFieldGroup}>
              <Text style={styles.createFormLabel}>Muscle Group</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.createChipRow}
              >
                {MUSCLE_GROUPS.map((muscle) => {
                  const isSelected = newMuscleGroup === muscle;
                  return (
                    <TouchableOpacity
                      key={muscle}
                      style={[
                        styles.createChip,
                        isSelected && styles.createChipActive,
                      ]}
                      onPress={() => setNewMuscleGroup(muscle)}
                    >
                      <Text
                        style={[
                          styles.createChipText,
                          isSelected && styles.createChipTextActive,
                        ]}
                      >
                        {muscle}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.createFieldGroup}>
              <Text style={styles.createFormLabel}>Type</Text>
              <View style={styles.typeToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.typeToggleButton,
                    newExerciseType === 'weighted' && styles.typeToggleActive,
                  ]}
                  onPress={() => {
                    setNewExerciseType('weighted');
                    if (newEquipment === 'None') setNewEquipment('Barbell');
                  }}
                >
                  <Text
                    style={[
                      styles.typeToggleText,
                      newExerciseType === 'weighted' && styles.typeToggleTextActive,
                    ]}
                  >
                    Weighted
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeToggleButton,
                    newExerciseType === 'bodyweight' && styles.typeToggleActive,
                  ]}
                  onPress={() => {
                    setNewExerciseType('bodyweight');
                    setNewEquipment('None');
                  }}
                >
                  <Text
                    style={[
                      styles.typeToggleText,
                      newExerciseType === 'bodyweight' && styles.typeToggleTextActive,
                    ]}
                  >
                    Bodyweight
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {newExerciseType === 'weighted' && (
              <View style={styles.createFieldGroup}>
                <Text style={styles.createFormLabel}>Equipment</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.createChipRow}
                >
                  {EQUIPMENT_OPTIONS.filter(e => e !== 'None').map((equip) => {
                    const isSelected = newEquipment === equip;
                    return (
                      <TouchableOpacity
                        key={equip}
                        style={[
                          styles.createChip,
                          isSelected && styles.createChipActive,
                        ]}
                        onPress={() => setNewEquipment(equip)}
                      >
                        <Text
                          style={[
                            styles.createChipText,
                            isSelected && styles.createChipTextActive,
                          ]}
                        >
                          {equip}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.createFormActions}>
              <TouchableOpacity
                style={styles.createCancelButton}
                onPress={() => setShowCreateForm(false)}
              >
                <Text style={styles.createCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createSubmitButton, isCreating && styles.createSubmitDisabled]}
                onPress={handleCreateExercise}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Text style={styles.createSubmitText}>Create & Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    paddingBottom: 40,
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

  // Empty state hint (inside footer when list is empty)
  emptyFooterWrapper: {
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyHint: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 20,
  },

  // "Create Custom Exercise" trigger button
  createFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.bgSecondary,
  },
  createFooterText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },

  // Create form modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createFormTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  createFieldGroup: {
    marginBottom: 16,
  },
  createFormInput: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: colors.bgTertiary,
    color: colors.textPrimary,
  },
  createFormLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  createChipRow: {
    gap: 8,
  },
  createChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.bgTertiary,
  },
  createChipActive: {
    backgroundColor: colors.accent,
  },
  createChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  createChipTextActive: {
    color: colors.textPrimary,
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeToggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.bgTertiary,
  },
  typeToggleActive: {
    backgroundColor: colors.accent,
  },
  typeToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeToggleTextActive: {
    color: colors.textPrimary,
  },
  createFormActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  createCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.bgTertiary,
  },
  createCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  createSubmitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  createSubmitDisabled: {
    opacity: 0.5,
  },
  createSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
});
