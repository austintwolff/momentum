import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { PointsResult, PointBonus } from '@/lib/points-engine/types';
import { colors } from '@/constants/Colors';

// Multiplier colors
const MULTIPLIER_COLORS = {
  hypertrophy_rep_range: colors.accentLight, // Purple - rep range
  progressive_overload: colors.error,        // Red
  workout_streak: colors.info,               // Blue
  volume_scaling: colors.accentLight,        // Purple (same as rep range)
  weekly_consistency: colors.info,           // Blue
  rune_pr_hunter: '#EAB308',                 // Gold - rune bonus
  rune_effect: '#EAB308',                    // Gold - generic rune bonus
  charm_pr_bonus: '#10B981',                 // Green - charm PR bonus
  charm_first_set: '#10B981',                // Green - charm first set
  charm_compound: '#10B981',                 // Green - charm compound
  charm_volume: '#10B981',                   // Green - charm volume
  charm_streak: '#10B981',                   // Green - charm streak
  charm_effect: '#10B981',                   // Green - generic charm bonus
} as const;

interface AnimatedSetRowProps {
  setNumber: number;
  weight: number | null;
  reps: number;
  isBodyweight: boolean;
  weightUnit: 'kg' | 'lbs';
  pointsResult: PointsResult;
  onAnimationComplete?: () => void;
}

export default function AnimatedSetRow({
  setNumber,
  weight,
  reps,
  isBodyweight,
  weightUnit,
  pointsResult,
  onAnimationComplete,
}: AnimatedSetRowProps) {
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const [currentBonusIndex, setCurrentBonusIndex] = useState(-1); // -1 = base phase, 0+ = bonus phases
  const [animationPhase, setAnimationPhase] = useState<'base' | 'bonus' | 'done'>('base');

  // Animation values
  const detailsScale = useSharedValue(1);
  const detailsFlash = useSharedValue(0);
  const bonusScale = useSharedValue(0);
  const bonusOpacity = useSharedValue(0);

  const pointsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get display-worthy bonuses (exclude volume_scaling penalty)
  const displayBonuses = pointsResult.bonuses.filter(
    b => b.type !== 'volume_scaling' && (b.multiplier > 0 || (b.flatBonus && b.flatBonus > 0))
  );

  // Calculate points at each phase
  const getPointsAtPhase = (phaseIndex: number): number => {
    if (phaseIndex < 0) return pointsResult.basePoints;

    let multiplier = 1;
    let flatBonus = 0;

    for (let i = 0; i <= phaseIndex && i < displayBonuses.length; i++) {
      const bonus = displayBonuses[i];
      if (bonus.flatBonus) {
        flatBonus += bonus.flatBonus;
      } else {
        multiplier += bonus.multiplier;
      }
    }

    // Apply volume scaling if present
    const volumeBonus = pointsResult.bonuses.find(b => b.type === 'volume_scaling');
    if (volumeBonus) {
      multiplier *= volumeBonus.multiplier;
    }

    return Math.floor(pointsResult.basePoints * multiplier) + flatBonus;
  };

  // Count up points animation
  const countUpPoints = (from: number, to: number, duration: number, onComplete?: () => void) => {
    if (pointsIntervalRef.current) {
      clearInterval(pointsIntervalRef.current);
    }

    if (from >= to) {
      setDisplayedPoints(to);
      onComplete?.();
      return;
    }

    const steps = Math.min(to - from, 15);
    const stepDuration = duration / steps;
    const increment = Math.ceil((to - from) / steps);
    let current = from;

    pointsIntervalRef.current = setInterval(() => {
      current += increment;
      if (current >= to) {
        setDisplayedPoints(to);
        if (pointsIntervalRef.current) clearInterval(pointsIntervalRef.current);
        onComplete?.();
      } else {
        setDisplayedPoints(current);
      }
    }, stepDuration);
  };

  // Start animation sequence
  useEffect(() => {
    // Phase 1: Pulse weight × reps and count to base points
    detailsScale.value = withSequence(
      withTiming(1.06, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 120, easing: Easing.in(Easing.quad) })
    );
    detailsFlash.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 250 })
    );

    countUpPoints(0, pointsResult.basePoints, 350, () => {
      // After base phase, start bonus phases
      if (displayBonuses.length > 0) {
        setTimeout(() => {
          setCurrentBonusIndex(0);
          setAnimationPhase('bonus');
        }, 150);
      } else {
        finishAnimation();
      }
    });

    return () => {
      if (pointsIntervalRef.current) clearInterval(pointsIntervalRef.current);
    };
  }, []);

  // Handle bonus phase animations
  useEffect(() => {
    if (currentBonusIndex < 0 || currentBonusIndex >= displayBonuses.length) return;

    const prevPoints = currentBonusIndex === 0
      ? pointsResult.basePoints
      : getPointsAtPhase(currentBonusIndex - 1);
    const targetPoints = getPointsAtPhase(currentBonusIndex);

    // Reset and animate bonus appearing (50% longer display time)
    bonusScale.value = 0;
    bonusOpacity.value = 0;

    bonusScale.value = withSequence(
      withTiming(1.12, { duration: 180, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 180, easing: Easing.in(Easing.quad) }),
      withDelay(800, withTiming(0.8, { duration: 200 })),
      withTiming(0, { duration: 150 })
    );
    bonusOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(1000, withTiming(0, { duration: 200 }))
    );

    // Count up points for this bonus
    setTimeout(() => {
      countUpPoints(prevPoints, targetPoints, 500, () => {
        // Move to next bonus or finish
        setTimeout(() => {
          if (currentBonusIndex < displayBonuses.length - 1) {
            setCurrentBonusIndex(prev => prev + 1);
          } else {
            finishAnimation();
          }
        }, 700);
      });
    }, 180);
  }, [currentBonusIndex]);

  const finishAnimation = () => {
    setDisplayedPoints(pointsResult.finalPoints);
    setAnimationPhase('done');
    setCurrentBonusIndex(-1);
    onAnimationComplete?.();
  };

  // Animated styles
  const detailsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: detailsScale.value }],
  }));

  const detailsTextAnimatedStyle = useAnimatedStyle(() => {
    const normalColor = colors.textPrimary;
    const flashColor = colors.accent;
    return {
      color: interpolateColor(detailsFlash.value, [0, 1], [normalColor, flashColor]),
    };
  });

  const bonusAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bonusScale.value }],
    opacity: bonusOpacity.value,
  }));

  const currentBonus = currentBonusIndex >= 0 && currentBonusIndex < displayBonuses.length
    ? displayBonuses[currentBonusIndex]
    : null;
  const bonusColor = currentBonus
    ? MULTIPLIER_COLORS[currentBonus.type as keyof typeof MULTIPLIER_COLORS] || colors.accentLight
    : colors.accentLight;

  const formatMultiplier = (bonus: PointBonus): string => {
    if (bonus.flatBonus) {
      return `+${bonus.flatBonus}`;
    }
    const multiplierValue = 1 + bonus.multiplier;
    return `×${multiplierValue.toFixed(2)}`;
  };

  const getBonusLabel = (bonus: PointBonus): string => {
    switch (bonus.type) {
      case 'hypertrophy_rep_range':
        return 'Rep Range';
      case 'progressive_overload':
        return 'PR!';
      case 'workout_streak':
        return 'Streak';
      case 'rune_pr_hunter':
        return 'Rune';
      case 'rune_effect':
        return 'Rune';
      case 'charm_pr_bonus':
        return 'Charm';
      case 'charm_first_set':
        return 'First Rep';
      case 'charm_compound':
        return 'Compound';
      case 'charm_volume':
        return 'Volume';
      case 'charm_streak':
        return 'Streak';
      case 'charm_effect':
        return 'Charm';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.setNumber}>
        {setNumber}
      </Text>

      <Animated.View style={[styles.detailsContainer, detailsAnimatedStyle]}>
        <Animated.Text style={[styles.setDetails, detailsTextAnimatedStyle]}>
          {isBodyweight
            ? `${reps} reps`
            : `${weight}${weightUnit} × ${reps}`}
        </Animated.Text>
      </Animated.View>

      <Text style={styles.pointsText}>{displayedPoints}</Text>

      {/* Bonus badge - absolutely positioned so it doesn't shift the layout */}
      {currentBonus && animationPhase === 'bonus' && (
        <Animated.View
          style={[
            styles.bonusBadge,
            { backgroundColor: bonusColor },
            bonusAnimatedStyle,
          ]}
        >
          <Text style={styles.bonusText}>
            {formatMultiplier(currentBonus)} {getBonusLabel(currentBonus)}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
    position: 'relative',
    backgroundColor: colors.bgSecondary,
  },
  setNumber: {
    width: 24,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
  },
  detailsContainer: {
    flex: 1,
  },
  setDetails: {
    fontSize: 16,
    fontWeight: '500',
  },
  bonusBadge: {
    position: 'absolute',
    right: 70,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bonusText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
  },
});
