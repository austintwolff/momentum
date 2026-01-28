import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/Colors';
import { CalendarMode } from '@/hooks/useProgressCalendar';
import BiWeeklyStatsBar from './BiWeeklyStatsBar';

interface ProgressHeaderProps {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  selectedExerciseName: string | null;
  onExercisePickerPress: () => void;
  streak: number;
  workoutsCount: number;
  biWeeklyWorkoutDays: boolean[];
  avgScore: number;
  statsLoading?: boolean;
}

function ChevronDownIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9L12 15L18 9"
        stroke={colors.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ProgressHeader({
  mode,
  onModeChange,
  selectedExerciseName,
  onExercisePickerPress,
  streak,
  workoutsCount,
  biWeeklyWorkoutDays,
  avgScore,
  statsLoading,
}: ProgressHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Title */}
      <Text style={styles.title}>Progress</Text>

      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            mode === 'score' && styles.modeButtonActive,
          ]}
          onPress={() => onModeChange('score')}
        >
          <Text
            style={[
              styles.modeButtonText,
              mode === 'score' && styles.modeButtonTextActive,
            ]}
          >
            Workout Score
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeButton,
            mode === 'pr' && styles.modeButtonActive,
          ]}
          onPress={() => onModeChange('pr')}
        >
          <Text
            style={[
              styles.modeButtonText,
              mode === 'pr' && styles.modeButtonTextActive,
            ]}
          >
            Exercise PR
          </Text>
        </TouchableOpacity>
      </View>

      {/* Exercise Picker (PR mode only) */}
      {mode === 'pr' && (
        <TouchableOpacity
          style={styles.exercisePicker}
          onPress={onExercisePickerPress}
        >
          <Text
            style={[
              styles.exercisePickerText,
              !selectedExerciseName && styles.exercisePickerPlaceholder,
            ]}
            numberOfLines={1}
          >
            {selectedExerciseName || 'Select an exercise'}
          </Text>
          <ChevronDownIcon />
        </TouchableOpacity>
      )}

      {/* Bi-Weekly Stats Bar */}
      {!statsLoading && (
        <View style={styles.statsBarWrapper}>
          <BiWeeklyStatsBar
            streak={streak}
            workoutsCount={workoutsCount}
            biWeeklyWorkoutDays={biWeeklyWorkoutDays}
            avgScore={avgScore}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgSecondary,
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.bgTertiary,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  modeButtonTextActive: {
    color: colors.accent,
  },
  exercisePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSecondary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  exercisePickerText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  exercisePickerPlaceholder: {
    color: colors.textMuted,
  },
  statsBarWrapper: {
    marginTop: 4,
  },
});
