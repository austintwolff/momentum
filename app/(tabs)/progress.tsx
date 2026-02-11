import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/Colors';
import { useProgressCalendar, DayData, CalendarMode } from '@/hooks/useProgressCalendar';
import { useBiWeeklyStats } from '@/hooks/useBiWeeklyStats';
import { useSettingsStore } from '@/stores/settings.store';
import { Exercise } from '@/types/database';
import ProgressHeader from '@/components/progress/ProgressHeader';
import ProgressCalendar from '@/components/progress/ProgressCalendar';
import DayDetailSheet from '@/components/progress/DayDetailSheet';
import ExercisePickerModal from '@/components/progress/ExercisePickerModal';

function DumbbellIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 6.5L17.5 17.5" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 10L10 3" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 21L21 14" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const weightUnit = useSettingsStore(s => s.weightUnit);

  // Calendar data hook
  const {
    monthsData,
    fetchMonth,
    mode,
    setMode,
    selectedExerciseId,
    setSelectedExerciseId,
    refresh: refreshCalendar,
  } = useProgressCalendar();

  // Bi-weekly stats hook
  const {
    streak,
    workoutsCount,
    biWeeklyWorkoutDays,
    avgScore,
    isLoading: statsLoading,
    refresh: refreshStats,
  } = useBiWeeklyStats();

  // Local state
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [daySheetVisible, setDaySheetVisible] = useState(false);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch initial month when mode or exercise changes
  useEffect(() => {
    const now = new Date();
    fetchMonth(now.getFullYear(), now.getMonth() + 1);
  }, [mode, selectedExerciseId]);

  const handleModeChange = useCallback((newMode: CalendarMode) => {
    setMode(newMode);
    if (newMode === 'score') {
      setSelectedExercise(null);
      setSelectedExerciseId(null);
    }
  }, [setMode, setSelectedExerciseId]);

  const handleDayPress = useCallback((dayData: DayData) => {
    setSelectedDay(dayData);
    setDaySheetVisible(true);
  }, []);

  const handleExerciseSelect = useCallback((exercise: Exercise) => {
    setSelectedExercise(exercise);
    setSelectedExerciseId(exercise.id);
  }, [setSelectedExerciseId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshCalendar(), refreshStats()]);
    setRefreshing(false);
  }, [refreshCalendar, refreshStats]);

  const handleStartWorkout = useCallback(() => {
    router.push('/workout/new');
  }, [router]);

  // Check if we have any data
  const hasData = monthsData.size > 0 && Array.from(monthsData.values()).some(m => m.days.size > 0);
  const showEmptyState = !hasData && !statsLoading;

  // Show different empty state based on mode
  const renderEmptyState = () => {
    if (mode === 'pr' && !selectedExerciseId) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <DumbbellIcon />
          </View>
          <Text style={styles.emptyTitle}>Select an exercise</Text>
          <Text style={styles.emptyDescription}>
            Choose an exercise to view your PR history
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setExercisePickerVisible(true)}
          >
            <Text style={styles.emptyButtonText}>Select Exercise</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (mode === 'score' && showEmptyState) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <DumbbellIcon />
          </View>
          <Text style={styles.emptyTitle}>No workouts yet</Text>
          <Text style={styles.emptyDescription}>
            Complete your first workout to track your progress
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleStartWorkout}>
            <Text style={styles.emptyButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  // If in PR mode with no exercise selected, show empty state with scroll
  const showCalendar = mode === 'score' || (mode === 'pr' && selectedExerciseId);

  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <ProgressHeader
        mode={mode}
        onModeChange={handleModeChange}
        selectedExerciseName={selectedExercise?.name ?? null}
        onExercisePickerPress={() => setExercisePickerVisible(true)}
        streak={streak}
        workoutsCount={workoutsCount}
        biWeeklyWorkoutDays={biWeeklyWorkoutDays}
        avgScore={avgScore}
        statsLoading={statsLoading}
      />

      {/* Calendar or Empty State */}
      {showCalendar ? (
        <ProgressCalendar
          monthsData={monthsData}
          fetchMonth={fetchMonth}
          mode={mode}
          weightUnit={weightUnit}
          onDayPress={handleDayPress}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
        >
          {renderEmptyState()}
        </ScrollView>
      )}

      {/* Day Detail Sheet */}
      <DayDetailSheet
        visible={daySheetVisible}
        onClose={() => setDaySheetVisible(false)}
        dayData={selectedDay}
        mode={mode}
        weightUnit={weightUnit}
        exerciseName={selectedExercise?.name}
      />

      {/* Exercise Picker Modal */}
      <ExercisePickerModal
        visible={exercisePickerVisible}
        onClose={() => setExercisePickerVisible(false)}
        onSelectExercise={handleExerciseSelect}
        selectedExerciseId={selectedExerciseId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
