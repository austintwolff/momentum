import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { useAuthStore } from '@/stores/auth.store';
import { useProteinStore } from '@/stores/protein.store';
import { colors } from '@/constants/Colors';

// Custom SVG Icons
function FlameIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C8.5 5.5 8 8.5 9 11C7 10 6 7.5 6 7.5C3.5 11 4 15 6 18C4.5 17 3 15.5 3 15.5C3.5 19 7.5 22 12 22Z"
        fill={colors.accent}
      />
      <Path
        d="M12 22C14.5 22 16 20 16 17.5C16 15 14 13 12 11C10 13 8 15 8 17.5C8 20 9.5 22 12 22Z"
        fill={colors.accentLight}
      />
    </Svg>
  );
}

function ProteinIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={colors.textSecondary} strokeWidth={2} />
      <Path
        d="M12 7V12L15 14"
        stroke={colors.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="20 6 9 17 4 12"
        stroke={colors.accent}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MinusIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12H19"
        stroke={colors.textPrimary}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M5 12H19" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

// Workout day indicator dot
function DayDot({ active }: { active: boolean }) {
  return (
    <View
      style={[
        styles.dayDot,
        active ? styles.dayDotActive : styles.dayDotInactive,
      ]}
    />
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userStats, refreshUserStats } = useAuthStore();

  // Protein tracker state from store
  const {
    currentProtein,
    proteinGoal,
    selectedIncrement,
    addProtein,
    subtractProtein,
    setSelectedIncrement,
    checkAndResetDaily,
  } = useProteinStore();

  // Refresh user stats and check for daily protein reset when screen loads
  useEffect(() => {
    refreshUserStats();
    checkAndResetDaily();
  }, []);

  const handleStartWorkout = () => {
    router.push('/workout/new');
  };

  // Mock data for 7-day workout indicators (would come from real data)
  const last7DaysWorkouts = [false, true, true, false, true, true, false];
  const workoutsThisWeek = last7DaysWorkouts.filter(Boolean).length;

  // Placeholder workout score
  const avgWorkoutScore = 82;

  const proteinProgress = Math.min(currentProtein / proteinGoal, 1);
  const goalReached = currentProtein >= proteinGoal;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Logo */}
      <Text style={styles.logo}>Momentum</Text>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsBarTitle}>Statistics (Past 7 Days)</Text>

        <View style={styles.statsRow}>
          {/* Progress Streak */}
          <View style={styles.statSection}>
            <View style={styles.statHeader}>
              <FlameIcon size={14} />
              <Text style={styles.statHeaderText}>Streak</Text>
            </View>
            <Text style={styles.statValue}>
              {userStats?.current_workout_streak || 0} Days
            </Text>
          </View>

          <View style={styles.statDivider} />

          {/* Workouts */}
          <View style={styles.statSection}>
            <Text style={styles.statHeaderText}>Workouts</Text>
            <View style={styles.workoutsRow}>
              <Text style={styles.statValueLarge}>{workoutsThisWeek}</Text>
              <View style={styles.dotsContainer}>
                {last7DaysWorkouts.map((active, index) => (
                  <DayDot key={index} active={active} />
                ))}
              </View>
            </View>
          </View>

          <View style={styles.statDivider} />

          {/* Avg Workout Score */}
          <View style={styles.statSection}>
            <Text style={styles.statHeaderText}>Avg Score</Text>
            <Text style={styles.statValueLarge}>{avgWorkoutScore}</Text>
          </View>
        </View>
      </View>

      {/* Muscle Diagram - Flexible height */}
      <View style={styles.muscleContainer}>
        <Image
          source={require('@/assets/images/muscle-diagram.png')}
          style={styles.muscleImage}
          resizeMode="contain"
        />
      </View>

      {/* Body Map Legend */}
      <View style={styles.bodyMapSection}>
        <Text style={styles.bodyMapTitle}>Body Map (Past 7 Days)</Text>
        <View style={styles.legendContainer}>
          <Text style={styles.legendLabel}>Untrained</Text>
          <View style={styles.legendBar}>
            <View style={styles.legendRed} />
            <View style={styles.legendYellow} />
            <View style={styles.legendGreen} />
          </View>
          <Text style={styles.legendLabel}>Fully Trained</Text>
        </View>
      </View>

      {/* Protein Tracker */}
      <View style={styles.proteinSection}>
        <View style={styles.proteinHeader}>
          <View style={styles.proteinTitleRow}>
            <ProteinIcon size={16} />
            <Text style={styles.proteinTitle}>Protein Tracker</Text>
          </View>
          <View style={styles.proteinValueRow}>
            {goalReached && <CheckIcon size={16} />}
            <Text style={[styles.proteinValue, goalReached && styles.proteinValueComplete]}>
              {currentProtein} / {proteinGoal}g
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${proteinProgress * 100}%` },
                goalReached && styles.progressBarFillComplete,
              ]}
            />
          </View>
          <View style={[styles.progressBarKnob, goalReached && styles.progressBarKnobComplete]} />
        </View>

        {/* Increment Controls */}
        <View style={styles.proteinButtons}>
          {/* Minus Button */}
          <TouchableOpacity
            style={[styles.proteinActionButton, currentProtein === 0 && styles.proteinButtonDisabled]}
            onPress={subtractProtein}
            disabled={currentProtein === 0}
            accessibilityLabel="Subtract protein"
          >
            <MinusIcon size={18} />
          </TouchableOpacity>

          {/* Increment Selection Buttons */}
          {([5, 10, 25] as const).map((amount) => (
            <TouchableOpacity
              key={amount}
              style={[
                styles.proteinIncrementButton,
                selectedIncrement === amount && styles.proteinIncrementButtonSelected,
              ]}
              onPress={() => setSelectedIncrement(amount)}
              accessibilityLabel={`Select ${amount} gram increment`}
            >
              <Text
                style={[
                  styles.proteinButtonText,
                  selectedIncrement === amount && styles.proteinButtonTextSelected,
                ]}
              >
                {amount}g
              </Text>
            </TouchableOpacity>
          ))}

          {/* Plus Button */}
          <TouchableOpacity
            style={styles.proteinActionButton}
            onPress={addProtein}
            accessibilityLabel="Add protein"
          >
            <PlusIcon size={18} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Start Workout Button - Fixed at bottom */}
      <TouchableOpacity
        style={styles.startButton}
        onPress={handleStartWorkout}
        accessibilityLabel="Start a new workout"
      >
        <Text style={styles.startButtonText}>Start Workout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 12,
  },

  // Stats Bar
  statsBar: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  statsBarTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statSection: {
    flex: 1,
    alignItems: 'center',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statHeaderText: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    marginTop: 2,
  },
  statValueLarge: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 6,
  },
  workoutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dayDotActive: {
    backgroundColor: colors.accent,
  },
  dayDotInactive: {
    backgroundColor: colors.bgTertiary,
  },

  // Muscle Diagram
  muscleContainer: {
    flex: 1,
    minHeight: 100,
  },
  muscleImage: {
    width: '100%',
    height: '100%',
  },

  // Body Map Legend
  bodyMapSection: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  bodyMapTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 10,
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  legendBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  legendRed: {
    flex: 1,
    backgroundColor: colors.error,
  },
  legendYellow: {
    flex: 1,
    backgroundColor: colors.warning,
  },
  legendGreen: {
    flex: 1,
    backgroundColor: colors.success,
  },

  // Protein Tracker
  proteinSection: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  proteinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  proteinTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proteinTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  proteinValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proteinValue: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  proteinValueComplete: {
    color: colors.accent,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: colors.bgTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  progressBarFillComplete: {
    backgroundColor: colors.accent,
  },
  progressBarKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    marginLeft: -7,
    borderWidth: 2,
    borderColor: colors.bgSecondary,
  },
  progressBarKnobComplete: {
    backgroundColor: colors.accent,
  },
  proteinButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  proteinActionButton: {
    width: 44,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proteinIncrementButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  proteinIncrementButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  proteinButtonDisabled: {
    opacity: 0.4,
  },
  proteinButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  proteinButtonTextSelected: {
    color: colors.textPrimary,
  },

  // Start Workout Button
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
