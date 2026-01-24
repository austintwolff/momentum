import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { MUSCLE_XP_CONFIG } from '@/lib/muscle-xp';
import { MuscleLevelBadge } from './MuscleLevelBadge';
import { EstimatedMuscleXpGain } from '@/lib/muscle-xp';
import { colors } from '@/constants/Colors';

// Display names for muscle groups
const MUSCLE_DISPLAY_NAMES: Record<string, string> = {
  'chest': 'Chest',
  'upper back': 'Upper Back',
  'lower back': 'Lower Back',
  'shoulders': 'Shoulders',
  'biceps': 'Biceps',
  'triceps': 'Triceps',
  'forearms': 'Forearms',
  'core': 'Core',
  'quads': 'Quadriceps',
  'hamstrings': 'Hamstrings',
  'glutes': 'Glutes',
  'calves': 'Calves',
};


interface MuscleData {
  muscle: string;
  level: number;
  progress: number; // 0-1
  isDecaying: boolean;
}

interface AnimatedMuscleSectionProps {
  muscles: MuscleData[];
  isAnimating: boolean;
  animationGains: EstimatedMuscleXpGain[] | null;
  onAnimationComplete: (gains: EstimatedMuscleXpGain[]) => void;
  isDark?: boolean; // No longer used but kept for backwards compatibility
}

const ANIMATION_DURATION = 500;
const LEVEL_UP_DURATION = 600;

export function AnimatedMuscleSection({
  muscles,
  isAnimating,
  animationGains,
  onAnimationComplete,
}: AnimatedMuscleSectionProps) {
  const [currentMuscleIndex, setCurrentMuscleIndex] = useState(-1);
  const [displayLevels, setDisplayLevels] = useState<Record<string, number>>({});
  const [activeLevelUp, setActiveLevelUp] = useState<{ muscle: string; level: number } | null>(null);
  const completedRef = useRef(false);
  const hasStartedRef = useRef(false);

  // Animation values for each muscle (up to 3)
  const progress1 = useSharedValue(muscles[0]?.progress || 0);
  const progress2 = useSharedValue(muscles[1]?.progress || 0);
  const progress3 = useSharedValue(muscles[2]?.progress || 0);
  const progressValues = [progress1, progress2, progress3];

  const levelUpOpacity = useSharedValue(0);
  const levelUpScale = useSharedValue(0.8);

  // Initialize progress values when not animating
  useEffect(() => {
    if (!isAnimating) {
      muscles.forEach((m, i) => {
        if (progressValues[i]) {
          progressValues[i].value = m.progress;
        }
      });
      // Reset display levels
      const levels: Record<string, number> = {};
      muscles.forEach(m => {
        levels[m.muscle.toLowerCase()] = m.level;
      });
      setDisplayLevels(levels);
      // Reset refs for next animation
      completedRef.current = false;
      hasStartedRef.current = false;
      setCurrentMuscleIndex(-1);
    }
  }, [isAnimating, muscles]);

  // Start animation when isAnimating becomes true
  useEffect(() => {
    if (isAnimating && animationGains && animationGains.length > 0 && !hasStartedRef.current) {
      hasStartedRef.current = true;
      // Initialize display levels to start levels
      const levels: Record<string, number> = {};
      animationGains.forEach(g => {
        levels[g.muscleGroup.toLowerCase()] = g.startLevel;
      });
      setDisplayLevels(levels);
      // Set progress bars to start positions
      animationGains.forEach((g, i) => {
        if (progressValues[i]) {
          progressValues[i].value = g.startProgress;
        }
      });
      // Start animating first muscle after a brief delay
      setTimeout(() => setCurrentMuscleIndex(0), 100);
    }
  }, [isAnimating, animationGains]);

  // Animate muscles one at a time
  useEffect(() => {
    if (!isAnimating || !animationGains || completedRef.current) return;
    if (currentMuscleIndex < 0) return;

    if (currentMuscleIndex >= animationGains.length) {
      // All muscles animated, complete
      completedRef.current = true;
      onAnimationComplete(animationGains);
      return;
    }

    const gain = animationGains[currentMuscleIndex];
    const progressValue = progressValues[currentMuscleIndex];

    // Animate this muscle's progress bar
    progressValue.value = withTiming(gain.endProgress, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
    });

    // If this muscle leveled up, show the flash
    if (gain.leveledUp) {
      const levelUpDelay = ANIMATION_DURATION - 100;
      setTimeout(() => {
        // Update display level
        setDisplayLevels(prev => ({
          ...prev,
          [gain.muscleGroup.toLowerCase()]: gain.endLevel,
        }));
        setActiveLevelUp({
          muscle: MUSCLE_DISPLAY_NAMES[gain.muscleGroup] || gain.muscleGroup,
          level: gain.endLevel,
        });
        levelUpOpacity.value = withSequence(
          withTiming(1, { duration: 150 }),
          withDelay(300, withTiming(0, { duration: 150 }))
        );
        levelUpScale.value = withSequence(
          withTiming(1.1, { duration: 150, easing: Easing.out(Easing.back(2)) }),
          withTiming(1, { duration: 100 }),
          withDelay(250, withTiming(0.8, { duration: 100 }))
        );
      }, levelUpDelay);

      // Move to next muscle after level-up animation
      setTimeout(() => {
        setActiveLevelUp(null);
        setCurrentMuscleIndex(prev => prev + 1);
      }, ANIMATION_DURATION + LEVEL_UP_DURATION);
    } else {
      // Update display level (even if no level up, in case it changed)
      setTimeout(() => {
        setDisplayLevels(prev => ({
          ...prev,
          [gain.muscleGroup.toLowerCase()]: gain.endLevel,
        }));
      }, ANIMATION_DURATION - 50);

      // No level up, move to next muscle after progress animation
      setTimeout(() => {
        setCurrentMuscleIndex(prev => prev + 1);
      }, ANIMATION_DURATION + 100);
    }
  }, [currentMuscleIndex, isAnimating, animationGains]);

  const animatedProgress1 = useAnimatedStyle(() => ({
    width: `${Math.min(100, progress1.value * 100)}%`,
  }));

  const animatedProgress2 = useAnimatedStyle(() => ({
    width: `${Math.min(100, progress2.value * 100)}%`,
  }));

  const animatedProgress3 = useAnimatedStyle(() => ({
    width: `${Math.min(100, progress3.value * 100)}%`,
  }));

  const levelUpStyle = useAnimatedStyle(() => ({
    opacity: levelUpOpacity.value,
    transform: [{ scale: levelUpScale.value }],
  }));

  const progressStyles = [animatedProgress1, animatedProgress2, animatedProgress3];

  return (
    <View style={styles.container}>
      {/* Section Title */}
      <Text style={styles.sectionTitle}>
        Muscle Groups Worked
      </Text>

      {/* Muscle Progress Cards */}
      <View style={styles.muscleCards}>
        {muscles.map((muscleData, index) => {
          const muscle = muscleData.muscle;
          const displayLevel = displayLevels[muscle.toLowerCase()] ?? muscleData.level;
          const isMaxLevel = displayLevel >= MUSCLE_XP_CONFIG.MAX_LEVEL;
          const isCurrentlyAnimating = isAnimating && index === currentMuscleIndex;
          const gain = animationGains?.find(g => g.muscleGroup.toLowerCase() === muscle.toLowerCase());
          const hasLeveledUp = gain?.leveledUp && currentMuscleIndex > index;

          return (
            <View
              key={muscle}
              style={styles.muscleCard}
            >
              <View style={styles.muscleHeader}>
                <View style={styles.muscleInfo}>
                  <Text style={[
                    styles.muscleName,
                    isCurrentlyAnimating && styles.muscleNameAnimating,
                  ]}>
                    {MUSCLE_DISPLAY_NAMES[muscle] || muscle}
                  </Text>
                </View>
                <MuscleLevelBadge
                  level={displayLevel}
                  isMax={isMaxLevel}
                  isResting={muscleData.isDecaying && !isMaxLevel && !hasLeveledUp}
                  isLevelUp={hasLeveledUp}
                />
              </View>
              <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      progressStyles[index],
                      isMaxLevel && styles.progressFillMax,
                      muscleData.isDecaying && !isMaxLevel && !hasLeveledUp && styles.progressFillResting,
                      hasLeveledUp && styles.progressFillLevelUp,
                    ]}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Level-up notification overlay */}
      {activeLevelUp && (
        <Animated.View style={[styles.levelUpContainer, levelUpStyle]}>
          <Text style={styles.levelUpText}>
            {activeLevelUp.muscle} → Level {activeLevelUp.level}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 10,
    color: colors.textMuted,
  },
  muscleCards: {
    gap: 8,
  },
  muscleCard: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.bgTertiary,
  },
  muscleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  muscleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  muscleName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  muscleNameAnimating: {
    fontWeight: '700',
  },
  progressContainer: {
    gap: 4,
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  progressFillMax: {
    backgroundColor: colors.warning,
  },
  progressFillResting: {
    backgroundColor: colors.textMuted,
  },
  progressFillLevelUp: {
    backgroundColor: colors.accent,
  },
  levelUpContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
  },
  levelUpText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
