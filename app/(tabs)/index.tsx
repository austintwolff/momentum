import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Polyline, Rect } from 'react-native-svg';
import { useAuthStore } from '@/stores/auth.store';
import { useProteinStore } from '@/stores/protein.store';
import { colors } from '@/constants/Colors';
import { ScoreDial } from '@/components/home/ScoreDial';

// Custom SVG Icons for Dials
function ProgressionIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="14" width="4" height="6" rx="1" fill={colors.textSecondary} />
      <Rect x="10" y="10" width="4" height="10" rx="1" fill={colors.textSecondary} />
      <Rect x="16" y="4" width="4" height="16" rx="1" fill={colors.textSecondary} />
    </Svg>
  );
}

function LoadIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4H8V6H16V4H18V6H19C19.5523 6 20 6.44772 20 7V9H4V7C4 6.44772 4.44772 6 5 6H6V4Z"
        fill={colors.textSecondary}
      />
      <Path
        d="M4 10H20V17C20 18.1046 19.1046 19 18 19H6C4.89543 19 4 18.1046 4 17V10Z"
        fill={colors.textSecondary}
      />
    </Svg>
  );
}

function ConsistencyIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={colors.textSecondary} strokeWidth={2} />
      <Polyline
        points="8 12 11 15 16 9"
        stroke={colors.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
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

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshUserStats } = useAuthStore();

  // Score dials - these will be calculated dynamically
  // TODO: Connect to actual score calculation logic
  const progressionScore = 80;
  const loadScore = 72;
  const consistencyScore = 64;

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

  const proteinProgress = Math.min(currentProtein / proteinGoal, 1);
  const goalReached = currentProtein >= proteinGoal;

  return (
    <View style={[styles.container, { paddingTop: insets.top - 8 }]}>
      {/* Logo */}
      <Image
        source={require('@/assets/images/momentum-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Score Dials */}
      <View style={styles.dialsContainer}>
        <ScoreDial
          value={progressionScore}
          label="Progression"
          icon={<ProgressionIcon size={14} />}
        />
        <ScoreDial
          value={loadScore}
          label="Load"
          icon={<LoadIcon size={14} />}
        />
        <ScoreDial
          value={consistencyScore}
          label="Consistency"
          icon={<ConsistencyIcon size={14} />}
        />
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
            <View style={styles.legendLight} />
            <View style={styles.legendMid} />
            <View style={styles.legendDark} />
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
    paddingBottom: 8,
  },
  logo: {
    width: '90%',
    height: 128,
    alignSelf: 'center',
    marginBottom: -16,
  },

  // Score Dials
  dialsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    marginBottom: 4,
  },

  // Muscle Diagram
  muscleContainer: {
    flex: 1,
    minHeight: 120,
    marginBottom: 10,
  },
  muscleImage: {
    width: '100%',
    height: '100%',
  },

  // Body Map Legend
  bodyMapSection: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  bodyMapTitle: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 6,
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
  legendLight: {
    flex: 1,
    backgroundColor: colors.textPrimary,
  },
  legendMid: {
    flex: 1,
    backgroundColor: colors.accentLight,
  },
  legendDark: {
    flex: 1,
    backgroundColor: colors.accentDark,
  },

  // Protein Tracker
  proteinSection: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  proteinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    marginBottom: 8,
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
    width: 40,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proteinIncrementButton: {
    flex: 1,
    paddingVertical: 6,
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
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
