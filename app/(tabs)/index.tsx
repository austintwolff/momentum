import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import { useAuthStore } from '@/stores/auth.store';
import { colors } from '@/constants/Colors';
import { ScoreDial } from '@/components/home/ScoreDial';
import { WorkoutGoals } from '@/components/home/WorkoutGoals';
import { TrainingFrequency } from '@/components/home/TrainingFrequency';
import { useRollingScores } from '@/hooks/useRollingScores';

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
      <Path
        d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
        stroke={colors.textSecondary}
        strokeWidth={2}
      />
      <Path
        d="M8 12L11 15L16 9"
        stroke={colors.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshUserStats } = useAuthStore();

  // Rolling scores from 14-day window
  const { progression, load, consistency } = useRollingScores();

  // Refresh user stats when screen loads
  useEffect(() => {
    refreshUserStats();
  }, []);

  const handleStartWorkout = () => {
    router.push('/workout/new');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Logo */}
      <Image
        source={require('@/assets/images/momentum-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Score Dials */}
      <View style={styles.dialsContainer}>
        <ScoreDial
          value={progression}
          label="Progression"
          icon={<ProgressionIcon size={14} />}
        />
        <ScoreDial
          value={load}
          label="Load"
          icon={<LoadIcon size={14} />}
        />
        <ScoreDial
          value={consistency}
          label="Consistency"
          icon={<ConsistencyIcon size={14} />}
        />
      </View>

      {/* Workout Goals */}
      <WorkoutGoals />

      {/* Training Frequency */}
      <TrainingFrequency />

      {/* Spacer to push button down */}
      <View style={styles.spacer} />

      {/* Start Workout Button */}
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  logo: {
    width: '65%',
    height: 90,
    alignSelf: 'center',
    marginBottom: -8,
  },

  // Score Dials
  dialsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    marginBottom: 16,
  },

  // Spacer
  spacer: {
    flex: 1,
  },

  // Start Workout Button
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
