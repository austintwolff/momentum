import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '@/constants/Colors';
import { useCustomWorkoutStore } from '@/stores/custom-workout.store';
import { useWorkoutTypeStats } from '@/hooks/useWorkoutTypeStats';
import { useTopExercises } from '@/hooks/useTopExercises';
import { useSettingsStore } from '@/stores/settings.store';
import { kgToLbs } from '@/stores/settings.store';

type GoalMode = 'Strength' | 'Hypertrophy' | 'Endurance';

interface WorkoutTypeCard {
  id: string;
  type: string;
  icon: 'push' | 'pull' | 'legs' | 'full' | 'custom';
  muscleGroups?: string[];
  isCustom?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 80;
const CARD_GAP = 16;

function CloseIcon({ size = 24, color = colors.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M6 6L18 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PlusIcon({ size = 20, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M5 12H19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function CheckboxIcon({ checked, size = 20 }: { checked: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        stroke={checked ? colors.accent : colors.textMuted}
        strokeWidth={2}
        fill={checked ? colors.accent : 'transparent'}
      />
      {checked && (
        <Path
          d="M7 12L10.5 15.5L17 9"
          stroke={colors.textPrimary}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

function PushIcon({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 19V5" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M5 12L12 5L19 12" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PullIcon({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M5 12L12 19L19 12" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LegsIcon({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 4V10C8 12 6 14 6 18C6 20 7 21 8 21" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 4V10C16 12 18 14 18 18C18 20 17 21 16 21" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function FullBodyIcon({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2Z" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 8V14" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M8 10L16 10" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M12 14L9 22" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M12 14L15 22" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function CustomIcon({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function EditIcon({ size = 16, color = colors.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const DEFAULT_WORKOUT_TYPES: WorkoutTypeCard[] = [
  { id: 'push', type: 'Push', icon: 'push' },
  { id: 'pull', type: 'Pull', icon: 'pull' },
  { id: 'legs', type: 'Legs', icon: 'legs' },
  { id: 'full', type: 'Full Body', icon: 'full' },
];

const GOAL_MODES: { mode: GoalMode; reps: string }[] = [
  { mode: 'Strength', reps: '≤6' },
  { mode: 'Hypertrophy', reps: '6–12' },
  { mode: 'Endurance', reps: '12+' },
];

export default function NewWorkoutScreen() {
  const router = useRouter();
  const { customWorkouts } = useCustomWorkoutStore();
  const { stats, getRecommendedType } = useWorkoutTypeStats();
  const { exercisesByType } = useTopExercises();
  const { weightUnit } = useSettingsStore();

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<GoalMode | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [addCore, setAddCore] = useState(false);
  const [addCardio, setAddCardio] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Combine default and custom workout types
  const allWorkoutTypes = useMemo((): WorkoutTypeCard[] => {
    const customCards: WorkoutTypeCard[] = customWorkouts.map(w => ({
      id: w.id,
      type: w.name,
      icon: 'custom' as const,
      muscleGroups: w.muscleGroups,
      isCustom: true,
    }));
    return [...DEFAULT_WORKOUT_TYPES, ...customCards];
  }, [customWorkouts]);

  // Reorder so recommended is first
  const orderedWorkoutTypes = useMemo(() => {
    const recommended = getRecommendedType();
    if (!recommended) return allWorkoutTypes;

    const recommendedIndex = allWorkoutTypes.findIndex(w => w.type === recommended);
    if (recommendedIndex <= 0) return allWorkoutTypes;

    // Move recommended to front
    const reordered = [...allWorkoutTypes];
    const [item] = reordered.splice(recommendedIndex, 1);
    reordered.unshift(item);
    return reordered;
  }, [allWorkoutTypes, getRecommendedType]);

  // Auto-select the recommended (first) type on mount
  useEffect(() => {
    if (orderedWorkoutTypes.length > 0 && !selectedType) {
      setSelectedType(orderedWorkoutTypes[0].type);
    }
  }, [orderedWorkoutTypes, selectedType]);

  const canStart = selectedType !== null && selectedGoal !== null;

  const handleStartWorkout = () => {
    if (!canStart) return;

    const workoutCard = allWorkoutTypes.find(w => w.type === selectedType);
    const workoutName = selectedType === 'Full Body' ? 'Full Body' :
                        workoutCard?.isCustom ? selectedType :
                        `${selectedType} Day`;

    // Build query params
    const params = new URLSearchParams({
      name: workoutName,
      goal: selectedGoal!,
    });
    if (addCore) params.append('addCore', 'true');
    if (addCardio) params.append('addCardio', 'true');

    router.replace(`/workout/deck?${params.toString()}`);
  };

  const handleClose = () => {
    router.back();
  };

  const handleAddCustom = () => {
    router.push('/workout/create-custom');
  };

  const handleEditWorkout = useCallback((item: WorkoutTypeCard) => {
    router.push({
      pathname: '/workout/edit-workout',
      params: {
        id: item.id,
        type: item.type,
        isCustom: item.isCustom ? 'true' : 'false',
      },
    });
  }, [router]);

  const renderTypeIcon = (icon: string, size = 36) => {
    if (icon === 'push') return <PushIcon size={size} />;
    if (icon === 'pull') return <PullIcon size={size} />;
    if (icon === 'legs') return <LegsIcon size={size} />;
    if (icon === 'full') return <FullBodyIcon size={size} />;
    if (icon === 'custom') return <CustomIcon size={size} />;
    return null;
  };

  // Handle card selection from swipe
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index || 0;
      setCurrentIndex(index);
      const centeredCard = orderedWorkoutTypes[index];
      if (centeredCard) {
        setSelectedType(centeredCard.type);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Format weight for display
  const formatWeight = useCallback((weightKg: number | null, isBodyweight: boolean): string => {
    if (isBodyweight || weightKg === null) return 'BW';
    const weight = weightUnit === 'lbs' ? Math.round(kgToLbs(weightKg)) : Math.round(weightKg);
    return `${weight}`;
  }, [weightUnit]);

  // Render workout type card
  const renderWorkoutCard = useCallback(({ item, index }: { item: WorkoutTypeCard; index: number }) => {
    const isSelected = selectedType === item.type;
    const isFirst = index === 0;
    const typeStats = stats[item.type];
    const timesCompleted = typeStats?.timesCompleted || 0;
    const lastScore = typeStats?.lastScore;
    const topExercises = exercisesByType[item.type] || [];

    return (
      <TouchableOpacity
        style={[
          styles.workoutCard,
          isSelected && styles.workoutCardSelected,
        ]}
        onPress={() => {
          setSelectedType(item.type);
          flatListRef.current?.scrollToIndex({ index, animated: true });
        }}
        activeOpacity={0.9}
      >
        {/* Edit Button - Top Left */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditWorkout(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={`Edit ${item.type} workout`}
        >
          <EditIcon size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Recommended Badge */}
        {isFirst && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>Recommended</Text>
          </View>
        )}

        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardIconContainer}>
              {renderTypeIcon(item.icon, 28)}
            </View>
            <Text style={styles.cardTypeName}>{item.type}</Text>
          </View>

          {/* Stats Row */}
          <View style={styles.cardStatsRow}>
            <View style={styles.cardStatItem}>
              <Text style={styles.cardStatValue}>{timesCompleted}</Text>
              <Text style={styles.cardStatLabel}>Done</Text>
            </View>
            <View style={styles.cardStatDivider} />
            <View style={styles.cardStatItem}>
              <Text style={styles.cardStatValue}>{lastScore ?? '—'}</Text>
              <Text style={styles.cardStatLabel}>Score</Text>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.cardDivider} />

        {/* Top Exercises List */}
        <View style={styles.exercisesList}>
          <Text style={styles.exercisesTitle}>Top Exercises</Text>
          {topExercises.length > 0 ? (
            topExercises.map((exercise, idx) => (
              <View key={exercise.exerciseId} style={styles.exerciseRow}>
                <Text style={styles.exerciseName} numberOfLines={1}>
                  {exercise.exerciseName}
                </Text>
                <View style={styles.exerciseStats}>
                  <View style={styles.statBoxContainer}>
                    {idx === 0 && <Text style={styles.statBoxLabel}>{weightUnit}</Text>}
                    <View style={styles.statBox}>
                      <Text style={styles.statBoxText}>
                        {formatWeight(exercise.bestWeight, exercise.isBodyweight)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.statMultiplier}>×</Text>
                  <View style={styles.statBoxContainer}>
                    {idx === 0 && <Text style={styles.statBoxLabel}>reps</Text>}
                    <View style={styles.statBox}>
                      <Text style={styles.statBoxText}>{exercise.bestReps}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noExercisesText}>No exercises yet</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [selectedType, stats, handleEditWorkout, exercisesByType, formatWeight]);

  // Circular scroll - when reaching end, jump to beginning
  const handleScrollEnd = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const cardSize = CARD_WIDTH + CARD_GAP;
    const totalCards = orderedWorkoutTypes.length;
    const index = Math.round(offsetX / cardSize);

    if (index >= totalCards) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      setCurrentIndex(0);
      setSelectedType(orderedWorkoutTypes[0]?.type || null);
    } else if (index < 0) {
      const lastOffset = (totalCards - 1) * cardSize;
      flatListRef.current?.scrollToOffset({ offset: lastOffset, animated: false });
      setCurrentIndex(totalCards - 1);
      setSelectedType(orderedWorkoutTypes[totalCards - 1]?.type || null);
    }
  }, [orderedWorkoutTypes]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeButton}
          accessibilityLabel="Close"
        >
          <CloseIcon />
        </TouchableOpacity>
        <Text style={styles.title}>Workout Setup</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Workout Type Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Workout Type</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddCustom}
              accessibilityLabel="Add custom workout"
            >
              <PlusIcon size={20} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {/* Swipeable Card Deck */}
          <View style={styles.deckContainer}>
            <FlatList
              ref={flatListRef}
              data={orderedWorkoutTypes}
              renderItem={renderWorkoutCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={styles.deckContent}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              onMomentumScrollEnd={handleScrollEnd}
              getItemLayout={(_, index) => ({
                length: CARD_WIDTH + CARD_GAP,
                offset: (CARD_WIDTH + CARD_GAP) * index,
                index,
              })}
            />
          </View>

          {/* Page Indicator */}
          <View style={styles.pageIndicator}>
            {orderedWorkoutTypes.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.pageDot,
                  index === currentIndex && styles.pageDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Target Rep Range Section */}
        <View style={styles.repRangeSection}>
          <Text style={styles.repRangeTitle}>Target Rep Range</Text>
          <View style={styles.repRangeRow}>
            {GOAL_MODES.map(({ mode, reps }) => {
              const isSelected = selectedGoal === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.repRangeCard, isSelected && styles.repRangeCardSelected]}
                  onPress={() => setSelectedGoal(mode)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.repRangeMode, isSelected && styles.repRangeModeSelected]}>
                    {mode}
                  </Text>
                  <Text style={[styles.repRangeValue, isSelected && styles.repRangeValueSelected]}>
                    {reps}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Add-on Options */}
        <View style={styles.addOnRow}>
          <TouchableOpacity
            style={styles.addOnOption}
            onPress={() => setAddCore(!addCore)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: addCore }}
          >
            <CheckboxIcon checked={addCore} />
            <Text style={styles.addOnText}>Add Core</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addOnOption}
            onPress={() => setAddCardio(!addCardio)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: addCardio }}
          >
            <CheckboxIcon checked={addCardio} />
            <Text style={styles.addOnText}>Add Cardio</Text>
          </TouchableOpacity>
        </View>

        {/* Start Button */}
        <TouchableOpacity
          style={[styles.startButton, !canStart && styles.startButtonDisabled]}
          onPress={handleStartWorkout}
          disabled={!canStart}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>Start Workout</Text>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },

  // Content
  content: {
    flex: 1,
  },
  section: {
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  addButton: {
    padding: 8,
  },

  // Deck
  deckContainer: {
    height: 380,
  },
  deckContent: {
    paddingHorizontal: 40,
  },

  // Workout Card
  workoutCard: {
    width: CARD_WIDTH,
    height: 360,
    marginRight: CARD_GAP,
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 14,
    paddingTop: 46,
  },
  workoutCardSelected: {
    borderColor: colors.accent,
  },
  editButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.bgTertiary,
    zIndex: 1,
  },
  recommendedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  recommendedText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconContainer: {},
  cardTypeName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardStatItem: {
    alignItems: 'center',
  },
  cardStatValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  cardStatLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  cardStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 16,
    marginBottom: 12,
  },
  exercisesList: {
    flex: 1,
  },
  exercisesTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  exerciseStats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  statBoxContainer: {
    alignItems: 'center',
  },
  statBoxLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 2,
    textTransform: 'lowercase',
  },
  statBox: {
    backgroundColor: colors.bgTertiary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  statBoxText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statMultiplier: {
    fontSize: 11,
    color: colors.textMuted,
  },
  noExercisesText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 60,
  },

  // Page Indicator
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    paddingBottom: 0,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgTertiary,
  },
  pageDotActive: {
    backgroundColor: colors.accent,
    width: 16,
  },

  // Spacer
  spacer: {
    height: 28,
  },

  // Rep Range Section
  repRangeSection: {
    paddingHorizontal: 20,
    gap: 8,
  },
  repRangeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  repRangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  repRangeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  repRangeCardSelected: {
    borderColor: colors.accent,
  },
  repRangeMode: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  repRangeModeSelected: {
    color: colors.textPrimary,
  },
  repRangeValue: {
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
    marginTop: 2,
  },
  repRangeValueSelected: {
    color: colors.accent,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 20,
  },
  addOnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  addOnOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addOnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: colors.bgTertiary,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
