import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { colors } from '@/constants/Colors';
import { ScoreDial } from '@/components/home/ScoreDial';
import { WorkoutGoals } from '@/components/home/WorkoutGoals';
import { TrainingFrequency } from '@/components/home/TrainingFrequency';
import { useRollingScores } from '@/hooks/useRollingScores';
import { useRollingScoresStore } from '@/stores/rolling-scores.store';
import ScoreDetailPopup, { ScoreType } from '@/components/home/ScoreDetailPopup';
import TutorialModal from '@/components/home/TutorialModal';
import { fetchTopExercises } from '@/hooks/useTopExercises';
import { fetchWorkoutTypeStats } from '@/hooks/useWorkoutTypeStats';

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

function InfoIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={colors.textMuted} strokeWidth={2} />
      <Path d="M12 16V12" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Circle cx="12" cy="8" r="1" fill={colors.textMuted} />
    </Svg>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const userStats = useAuthStore(s => s.userStats);
  const refreshUserStats = useAuthStore(s => s.refreshUserStats);
  const hasSeenTutorial = useOnboardingStore(s => s.hasSeenTutorial);
  const setHasSeenTutorial = useOnboardingStore(s => s.setHasSeenTutorial);
  const fetchScores = useRollingScoresStore(s => s.fetchScores);

  // Rolling scores from 14-day window
  const { progression, load, consistency, breakdown } = useRollingScores();

  // Score detail popup state
  const [popupVisible, setPopupVisible] = useState(false);
  const [selectedScoreType, setSelectedScoreType] = useState<ScoreType | null>(null);

  // Tutorial modal state
  const [tutorialVisible, setTutorialVisible] = useState(false);

  // Wait for Zustand AsyncStorage hydration before evaluating tutorial flag
  const [hydrated, setHydrated] = useState(
    useOnboardingStore.persist.hasHydrated()
  );

  useEffect(() => {
    const unsub = useOnboardingStore.persist.onFinishHydration(() => setHydrated(true));
    return () => unsub();
  }, []);

  const handleDialPress = (type: ScoreType) => {
    setSelectedScoreType(type);
    setPopupVisible(true);
  };

  const getSelectedScore = (): number | null => {
    switch (selectedScoreType) {
      case 'progression':
        return progression;
      case 'load':
        return load;
      case 'consistency':
        return consistency;
      default:
        return null;
    }
  };

  // Refresh data when home tab gains focus (e.g. after completing a workout)
  // Also prefetch workout setup data so the "Start Workout" screen loads instantly
  useFocusEffect(
    useCallback(() => {
      refreshUserStats();
      if (user?.id) {
        fetchScores(user.id);
        // Prefetch data for workout setup screen
        queryClient.prefetchQuery({
          queryKey: ['topExercises', user.id],
          queryFn: () => fetchTopExercises(user.id),
          staleTime: 60 * 60 * 1000,
        });
        queryClient.prefetchQuery({
          queryKey: ['workoutTypeStats', user.id],
          queryFn: () => fetchWorkoutTypeStats(user.id),
          staleTime: 60 * 60 * 1000,
        });
      }
    }, [user?.id])
  );

  // Show tutorial only for truly new users with no workout data
  // Wait for hydration so hasSeenTutorial reflects the persisted value, not the default
  useEffect(() => {
    if (!hydrated) return;
    if (!hasSeenTutorial && userStats && (userStats.total_workouts || 0) === 0) {
      setTutorialVisible(true);
    }
  }, [hasSeenTutorial, userStats, hydrated]);

  const handleTutorialClose = () => {
    setTutorialVisible(false);
    setHasSeenTutorial(true);
  };

  const handleStartWorkout = () => {
    router.push('/workout/new');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with Logo and Info Icon */}
      <View style={styles.headerRow}>
        <Image
          source={require('@/assets/images/momentum-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity
          style={styles.infoButton}
          onPress={() => setTutorialVisible(true)}
          accessibilityLabel="How to use"
        >
          <InfoIcon size={22} />
        </TouchableOpacity>
      </View>

      {/* Score Dials */}
      <View style={styles.dialsContainer}>
        <ScoreDial
          value={progression}
          label="Progression"
          icon={<ProgressionIcon size={14} />}
          onPress={() => handleDialPress('progression')}
        />
        <ScoreDial
          value={load}
          label="Load"
          icon={<LoadIcon size={14} />}
          onPress={() => handleDialPress('load')}
        />
        <ScoreDial
          value={consistency}
          label="Consistency"
          icon={<ConsistencyIcon size={14} />}
          onPress={() => handleDialPress('consistency')}
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

      {/* Score Detail Popup */}
      <ScoreDetailPopup
        visible={popupVisible}
        scoreType={selectedScoreType}
        score={getSelectedScore()}
        breakdown={breakdown}
        onClose={() => setPopupVisible(false)}
      />

      {/* Tutorial Modal */}
      <TutorialModal visible={tutorialVisible} onClose={handleTutorialClose} />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -8,
  },
  logo: {
    width: '65%',
    height: 90,
  },
  infoButton: {
    position: 'absolute',
    right: 0,
    padding: 8,
  },

  // Score Dials
  dialsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    marginBottom: 32,
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
