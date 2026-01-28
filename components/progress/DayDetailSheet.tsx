import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '@/constants/Colors';
import { CalendarMode, DayData, WorkoutSummary, SetData } from '@/hooks/useProgressCalendar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SHEET_WIDTH = Math.min(SCREEN_WIDTH - 40, 360);

interface DayDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  dayData: DayData | null;
  mode: CalendarMode;
  exerciseName?: string;
}

function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M6 6L18 18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function StarIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill={colors.accent}
      />
    </Svg>
  );
}

function ClockIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={colors.textSecondary} strokeWidth={2} />
      <Path d="M12 6V12L16 14" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronRightIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18L15 12L9 6" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0m';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function WorkoutRow({ workout, onPress }: { workout: WorkoutSummary; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.workoutRow} onPress={onPress}>
      <View style={styles.workoutInfo}>
        <Text style={styles.workoutName} numberOfLines={1}>{workout.name}</Text>
        <View style={styles.workoutMeta}>
          {workout.final_score != null && (
            <View style={styles.metaItem}>
              <StarIcon />
              <Text style={styles.metaText}>{Math.round(workout.final_score)}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <ClockIcon />
            <Text style={styles.metaText}>{formatDuration(workout.duration_seconds)}</Text>
          </View>
        </View>
      </View>
      <ChevronRightIcon />
    </TouchableOpacity>
  );
}

export default function DayDetailSheet({
  visible,
  onClose,
  dayData,
  mode,
  exerciseName,
}: DayDetailSheetProps) {
  const router = useRouter();

  if (!dayData) return null;

  const handleWorkoutPress = (workoutId: string) => {
    onClose();
    router.push(`/workout/${workoutId}` as any);
  };

  // Sort workouts by score (highest first)
  const sortedWorkouts = dayData.workouts
    ? [...dayData.workouts].sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0))
    : [];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.dateTitle}>{formatDate(dayData.date)}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <CloseIcon />
            </TouchableOpacity>
          </View>

          {mode === 'score' ? (
            /* Score Mode Content */
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {sortedWorkouts.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>
                    {sortedWorkouts.length} Workout{sortedWorkouts.length !== 1 ? 's' : ''}
                  </Text>
                  <View style={styles.workoutsList}>
                    {sortedWorkouts.map((workout, index) => (
                      <View key={workout.id}>
                        <WorkoutRow
                          workout={workout}
                          onPress={() => handleWorkoutPress(workout.id)}
                        />
                        {index < sortedWorkouts.length - 1 && <View style={styles.divider} />}
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>No workouts found</Text>
              )}
            </ScrollView>
          ) : (
            /* PR Mode Content */
            <View style={styles.content}>
              {dayData.bestSet ? (
                <>
                  {exerciseName && (
                    <Text style={styles.exerciseTitle}>{exerciseName}</Text>
                  )}

                  {/* Best E1RM */}
                  <View style={styles.prSection}>
                    <Text style={styles.prLabel}>Best E1RM</Text>
                    <Text style={styles.prValue}>{Math.round(dayData.bestSet.e1rm)} kg</Text>
                  </View>

                  {/* Set Details */}
                  <View style={styles.setDetails}>
                    <Text style={styles.setDetailsText}>
                      {dayData.bestSet.weight_kg} kg × {dayData.bestSet.reps} reps
                    </Text>
                  </View>

                  {/* View Workout Button */}
                  <TouchableOpacity
                    style={styles.viewWorkoutButton}
                    onPress={() => handleWorkoutPress(dayData.bestSet!.workout_id)}
                  >
                    <Text style={styles.viewWorkoutText}>View Workout</Text>
                    <ChevronRightIcon />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.emptyText}>No PR data found</Text>
              )}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: SHEET_WIDTH,
    maxHeight: '70%',
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  workoutsList: {
    backgroundColor: colors.bgTertiary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  workoutMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  // PR Mode Styles
  exerciseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  prSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  prLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 4,
  },
  prValue: {
    fontSize: 48,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: colors.accent,
  },
  setDetails: {
    alignItems: 'center',
    marginBottom: 24,
  },
  setDetailsText: {
    fontSize: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  viewWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgTertiary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  viewWorkoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
