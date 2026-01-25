import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors } from '@/constants/Colors';
import { useSettingsStore } from '@/stores/settings.store';
import { kgToLbs } from '@/stores/settings.store';

// Custom SVG Icons
function CheckIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17L4 12" stroke={colors.textPrimary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ClockIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={colors.textSecondary} strokeWidth={2} />
      <Path d="M12 6V12L16 14" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function WeightIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 6.5L17.5 17.5" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 10L10 3" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 21L21 14" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function SetsIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6H21" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 12H21" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 18H21" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 6H3.01" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 12H3.01" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 18H3.01" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ExerciseIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="5" r="3" stroke={colors.textSecondary} strokeWidth={2} />
      <Path d="M12 8V14" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 11L16 11" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 14L9 21" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 14L15 21" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

interface ScoreComponents {
  progressScore: number;
  workScore: number;
  consistencyScore: number;
  eprPrCount: number;
  weightPrCount: number;
}

/**
 * Generate a dynamic description based on the score components
 */
function getScoreDescription(components: ScoreComponents): string {
  const { progressScore, workScore, consistencyScore, eprPrCount, weightPrCount } = components;
  const totalPRs = eprPrCount + weightPrCount;

  // Build description from what actually happened
  const parts: string[] = [];

  // Progress component (PRs and closeness)
  if (totalPRs >= 3) {
    parts.push(`${totalPRs} PRs`);
  } else if (totalPRs === 2) {
    parts.push('2 PRs');
  } else if (totalPRs === 1) {
    parts.push('1 PR');
  } else if (progressScore >= 10) {
    parts.push('Near-PR effort');
  }

  // Work component (volume)
  if (workScore >= 35) {
    parts.push('high volume');
  } else if (workScore >= 25) {
    parts.push('solid volume');
  } else if (workScore >= 15) {
    parts.push('moderate volume');
  } else if (workScore >= 5) {
    parts.push('light volume');
  }

  // Consistency component
  if (consistencyScore >= 5) {
    parts.push('great consistency');
  } else if (consistencyScore >= 4) {
    parts.push('staying consistent');
  }

  // Combine parts with proper grammar
  if (parts.length === 0) {
    return 'Every rep counts';
  } else if (parts.length === 1) {
    // Capitalize first letter
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } else if (parts.length === 2) {
    // Capitalize first part
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ' + ' + parts[1];
  } else {
    // Three parts: "X, Y + Z"
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ', ' + parts[1] + ' + ' + parts[2];
  }
}

/**
 * Get the score color based on value
 */
function getScoreColor(score: number): string {
  if (score >= 75) return colors.success;
  if (score >= 50) return colors.accent;
  if (score >= 25) return colors.warning;
  return colors.textSecondary;
}

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const { weightUnit } = useSettingsStore();
  const params = useLocalSearchParams<{
    workoutScore: string;
    progressScore: string;
    workScore: string;
    consistencyScore: string;
    eprPrCount: string;
    weightPrCount: string;
    totalVolume: string;
    totalSets: string;
    duration: string;
    exerciseCount: string;
  }>();

  const workoutScore = parseInt(params.workoutScore || '0', 10);
  const progressScore = parseInt(params.progressScore || '0', 10);
  const workScore = parseInt(params.workScore || '0', 10);
  const consistencyScore = parseInt(params.consistencyScore || '0', 10);
  const eprPrCount = parseInt(params.eprPrCount || '0', 10);
  const weightPrCount = parseInt(params.weightPrCount || '0', 10);
  const totalVolumeKg = parseInt(params.totalVolume || '0', 10);
  const totalSets = parseInt(params.totalSets || '0', 10);
  const duration = parseInt(params.duration || '0', 10);
  const exerciseCount = parseInt(params.exerciseCount || '0', 10);

  // Convert volume to user's preferred unit
  const displayVolume = weightUnit === 'lbs'
    ? Math.round(kgToLbs(totalVolumeKg))
    : totalVolumeKg;
  const volumeUnit = weightUnit === 'lbs' ? 'lbs' : 'kg';

  // Animations
  const checkScale = useSharedValue(0);
  const scoreScale = useSharedValue(0);
  const statsOpacity = useSharedValue(0);

  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 12 });
    scoreScale.value = withDelay(200, withSpring(1, { damping: 10 }));
    statsOpacity.value = withDelay(400, withTiming(1, { duration: 300 }));
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
    opacity: scoreScale.value,
  }));

  const statsStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
  }));

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}k`;
    }
    return volume.toString();
  };

  const handleDone = () => {
    router.dismissAll();
  };

  const scoreColor = getScoreColor(workoutScore);
  const scoreDescription = getScoreDescription({
    progressScore,
    workScore,
    consistencyScore,
    eprPrCount,
    weightPrCount,
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success Check */}
        <Animated.View style={[styles.checkContainer, checkStyle]}>
          <View style={styles.checkCircle}>
            <CheckIcon />
          </View>
        </Animated.View>

        {/* Title */}
        <Text style={styles.title}>Workout Complete!</Text>

        {/* Workout Score - Hero Element */}
        <Animated.View style={[styles.scoreSection, scoreStyle]}>
          <Text style={styles.scoreLabel}>Workout Score</Text>
          <Text style={[styles.scoreValue, { color: scoreColor }]}>{workoutScore}</Text>
          <Text style={styles.scoreDescription}>{scoreDescription}</Text>
        </Animated.View>

        {/* Stats Grid */}
        <Animated.View style={[styles.statsGrid, statsStyle]}>
          <View style={styles.statCard}>
            <WeightIcon />
            <Text style={styles.statValue}>{formatVolume(displayVolume)}</Text>
            <Text style={styles.statLabel}>{volumeUnit} volume</Text>
          </View>

          <View style={styles.statCard}>
            <SetsIcon />
            <Text style={styles.statValue}>{totalSets}</Text>
            <Text style={styles.statLabel}>sets</Text>
          </View>

          <View style={styles.statCard}>
            <ExerciseIcon />
            <Text style={styles.statValue}>{exerciseCount}</Text>
            <Text style={styles.statLabel}>exercises</Text>
          </View>

          <View style={styles.statCard}>
            <ClockIcon />
            <Text style={styles.statValue}>{formatDuration(duration)}</Text>
            <Text style={styles.statLabel}>duration</Text>
          </View>
        </Animated.View>
      </View>

      {/* Done Button */}
      <TouchableOpacity style={styles.doneButton} onPress={handleDone} accessibilityRole="button">
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  checkContainer: {
    marginBottom: 16,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 32,
    color: colors.textPrimary,
  },
  // Score Section - Hero Element
  scoreSection: {
    alignItems: 'center',
    marginBottom: 40,
    paddingVertical: 24,
    paddingHorizontal: 48,
    backgroundColor: colors.bgSecondary,
    borderRadius: 20,
    width: '100%',
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 72,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 80,
  },
  scoreDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
  },
  statCard: {
    width: '47%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgSecondary,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'lowercase',
  },
  doneButton: {
    backgroundColor: colors.accent,
    marginHorizontal: 24,
    marginBottom: 30,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});
