import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
} from 'react-native';
import { PointsResult } from '@/lib/points-engine/types';
import { colors } from '@/constants/Colors';

interface PointsAnimationProps {
  visible: boolean;
  pointsResult: PointsResult | null;
  setInfo: {
    weight: number | null;
    reps: number;
    isBodyweight: boolean;
    weightUnit?: 'kg' | 'lbs';
  };
  onComplete: () => void;
}

// Map bonus types to display info
const BONUS_INFO: Record<string, { label: string; description: string; color: string }> = {
  progressive_overload: {
    label: 'OVERLOAD',
    description: 'Beat your baseline!',
    color: colors.warning,
  },
  hypertrophy_rep_range: {
    label: 'HYPERTROPHY',
    description: '5-8 rep sweet spot',
    color: colors.accentLight,
  },
  workout_streak: {
    label: 'STREAK',
    description: 'Consecutive workouts',
    color: colors.error,
  },
  weekly_consistency: {
    label: 'CONSISTENCY',
    description: 'Weekly volume target',
    color: colors.info,
  },
  volume_scaling: {
    label: 'VOLUME',
    description: 'Set volume bonus',
    color: colors.textMuted,
  },
};

// Format number to max 1 decimal place
const formatPoints = (value: number): string => {
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 0.01) {
    return Math.round(value).toString();
  }
  return value.toFixed(1);
};

export default function PointsAnimation({
  visible,
  pointsResult,
  setInfo,
  onComplete,
}: PointsAnimationProps) {
  const [phase, setPhase] = useState<string>('idle');
  const [displayedTotal, setDisplayedTotal] = useState(0);
  const [displayedMultiplier, setDisplayedMultiplier] = useState(1);
  const [currentBonusIndex, setCurrentBonusIndex] = useState(-1);
  const [showBaseCalc, setShowBaseCalc] = useState(false);
  const [showBase, setShowBase] = useState(false);
  const [showMultiplier, setShowMultiplier] = useState(false);

  // Track current values for animation (to avoid stale state)
  const currentTotal = useRef(0);
  const currentMultiplier = useRef(1);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.9)).current;
  const baseCalcOpacity = useRef(new Animated.Value(0)).current;
  const baseOpacity = useRef(new Animated.Value(0)).current;
  const baseScale = useRef(new Animated.Value(0.8)).current;
  const multiplierOpacity = useRef(new Animated.Value(0)).current;
  const multiplierScale = useRef(new Animated.Value(1)).current;
  const totalScale = useRef(new Animated.Value(1)).current;
  const bonusAnimations = useRef<Animated.Value[]>([]).current;

  // Filter positive bonuses
  const positiveBonuses = pointsResult?.bonuses.filter(b => b.multiplier > 0) || [];

  useEffect(() => {
    if (visible && pointsResult) {
      runAnimation();
    } else {
      resetAnimation();
    }
  }, [visible, pointsResult]);

  const resetAnimation = () => {
    setPhase('idle');
    setDisplayedTotal(0);
    setDisplayedMultiplier(1);
    setCurrentBonusIndex(-1);
    setShowBaseCalc(false);
    setShowBase(false);
    setShowMultiplier(false);
    currentTotal.current = 0;
    currentMultiplier.current = 1;
    overlayOpacity.setValue(0);
    contentScale.setValue(0.9);
    baseCalcOpacity.setValue(0);
    baseOpacity.setValue(0);
    baseScale.setValue(0.8);
    multiplierOpacity.setValue(0);
    multiplierScale.setValue(1);
    totalScale.setValue(1);
    bonusAnimations.length = 0;
  };

  const runAnimation = async () => {
    if (!pointsResult) return;

    // Initialize bonus animations
    positiveBonuses.forEach(() => {
      bonusAnimations.push(new Animated.Value(0));
    });

    // === PHASE 1: Fade in overlay ===
    setPhase('intro');
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 375,
        useNativeDriver: true,
      }),
      Animated.spring(contentScale, {
        toValue: 1,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    await delay(625);

    // === PHASE 2: Show base calculation formula ===
    setPhase('base-calc');
    setShowBaseCalc(true);

    Animated.timing(baseCalcOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    await delay(1250);

    // === PHASE 3: Show base points result ===
    setPhase('base');
    setShowBase(true);

    Animated.parallel([
      Animated.timing(baseOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(baseScale, {
        toValue: 1,
        friction: 6,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();

    await delay(750);

    // Count up total to base value
    currentTotal.current = 0;
    await countUp(
      (val) => {
        currentTotal.current = val;
        setDisplayedTotal(val);
      },
      0,
      pointsResult.basePoints,
      1000
    );

    // Pulse total
    pulseAnimation(totalScale);

    await delay(1000);

    // === PHASE 4: Show multiplier and bonuses ===
    if (positiveBonuses.length > 0) {
      setPhase('multiplier');
      setShowMultiplier(true);
      currentMultiplier.current = 1;
      setDisplayedMultiplier(1);

      // Fade out base section smoothly while fading in multiplier
      Animated.parallel([
        Animated.timing(baseCalcOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(baseOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(multiplierOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hide base sections after fade completes
        setShowBaseCalc(false);
        setShowBase(false);
      });

      await delay(750);

      // === PHASE 5: Each bonus flies in and applies ===
      for (let i = 0; i < positiveBonuses.length; i++) {
        const bonus = positiveBonuses[i];
        setPhase(`bonus-${i}`);
        setCurrentBonusIndex(i);

        // Bonus flies in
        Animated.spring(bonusAnimations[i], {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }).start();

        await delay(1250);

        // Update multiplier
        const prevMultiplier = currentMultiplier.current;
        const newMultiplier = prevMultiplier + bonus.multiplier;

        await countUp(
          (val) => {
            currentMultiplier.current = val;
            setDisplayedMultiplier(val);
          },
          prevMultiplier,
          newMultiplier,
          750
        );

        // Pulse multiplier
        pulseAnimation(multiplierScale);

        await delay(625);

        // Calculate and animate new total
        const prevTotal = currentTotal.current;
        const newTotal = Math.round(pointsResult.basePoints * newMultiplier);

        await countUp(
          (val) => {
            currentTotal.current = val;
            setDisplayedTotal(val);
          },
          prevTotal,
          newTotal,
          875
        );

        // Pulse total
        pulseAnimation(totalScale);

        await delay(875);
      }
    }

    // === PHASE 6: Final emphasis ===
    setPhase('final');

    // Ensure we're at final points
    if (Math.round(currentTotal.current) !== pointsResult.finalPoints) {
      await countUp(
        (val) => {
          currentTotal.current = val;
          setDisplayedTotal(val);
        },
        currentTotal.current,
        pointsResult.finalPoints,
        500
      );
    }

    // Big final pulse
    Animated.sequence([
      Animated.timing(totalScale, {
        toValue: 1.3,
        duration: 310,
        useNativeDriver: true,
      }),
      Animated.spring(totalScale, {
        toValue: 1,
        friction: 3,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    await delay(1875);

    // === PHASE 7: Fade out ===
    setPhase('done');
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      onComplete();
    });
  };

  const pulseAnimation = (animValue: Animated.Value) => {
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: 1.25,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.timing(animValue, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const countUp = (
    setter: (value: number) => void,
    from: number,
    to: number,
    duration: number
  ): Promise<void> => {
    return new Promise(resolve => {
      const startTime = Date.now();
      const diff = to - from;

      const tick = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = from + diff * eased;

        setter(current);

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          setter(to);
          resolve();
        }
      };

      tick();
    });
  };

  const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  if (!visible || !pointsResult) return null;

  const formatSetInfo = () => {
    if (setInfo.isBodyweight) {
      return `${setInfo.reps} reps (bodyweight)`;
    }
    const unit = setInfo.weightUnit || 'kg';
    const weight = setInfo.weight ? formatPoints(setInfo.weight) : '0';
    return `${weight}${unit} × ${setInfo.reps} reps`;
  };

  // Build base calculation string (volume = weight × reps)
  // Weight is already in display units (what the user entered)
  const getBaseCalcString = () => {
    if (setInfo.isBodyweight) {
      return `bodyweight × ${setInfo.reps}`;
    }
    const weight = setInfo.weight ? formatPoints(setInfo.weight) : '0';
    return `${weight} × ${setInfo.reps}`;
  };

  const isFinal = phase === 'final' || phase === 'done';

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Animated.View
          style={[
            styles.content,
            { transform: [{ scale: contentScale }] },
          ]}
        >
          {/* Set Info Header */}
          <Text style={styles.setInfo}>{formatSetInfo()}</Text>

          {/* Base Calculation Formula */}
          {showBaseCalc && (
            <Animated.View style={[styles.baseCalcSection, { opacity: baseCalcOpacity }]}>
              <Text style={styles.baseCalcFormula}>{getBaseCalcString()}</Text>
            </Animated.View>
          )}

          {/* Base Points Result */}
          {showBase && (
            <Animated.View
              style={[
                styles.baseSection,
                {
                  opacity: baseOpacity,
                  transform: [{ scale: baseScale }],
                },
              ]}
            >
              <Text style={styles.baseEquals}>=</Text>
              <Text style={styles.baseValue}>{formatPoints(pointsResult.basePoints)}</Text>
              <Text style={styles.baseLabel}>base pts</Text>
            </Animated.View>
          )}

          {/* Multiplier Section */}
          {showMultiplier && (
            <Animated.View
              style={[
                styles.multiplierSection,
                { opacity: multiplierOpacity },
              ]}
            >
              <Animated.View style={[styles.multiplierInner, { transform: [{ scale: multiplierScale }] }]}>
                <Text style={styles.multiplierX}>×</Text>
                <Text style={styles.multiplierValue}>{formatPoints(displayedMultiplier)}</Text>
              </Animated.View>
              <Text style={styles.multiplierLabel}>multiplier</Text>
            </Animated.View>
          )}

          {/* Bonuses List */}
          {positiveBonuses.length > 0 && showMultiplier && (
            <View style={styles.bonusesList}>
              {positiveBonuses.map((bonus, index) => {
                if (index > currentBonusIndex) return null;

                const info = BONUS_INFO[bonus.type] || {
                  label: bonus.type.toUpperCase(),
                  description: bonus.description,
                  color: colors.accent,
                };
                const anim = bonusAnimations[index];

                return (
                  <Animated.View
                    key={`${bonus.type}-${index}`}
                    style={[
                      styles.bonusItem,
                      {
                        opacity: anim,
                        transform: [
                          {
                            translateY: anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-20, 0],
                            }),
                          },
                          { scale: anim },
                        ],
                      },
                    ]}
                  >
                    <View style={[styles.bonusTag, { backgroundColor: info.color }]}>
                      <Text style={styles.bonusTagText}>{info.label}</Text>
                    </View>
                    <View style={styles.bonusDetails}>
                      <Text style={[styles.bonusPercent, { color: info.color }]}>
                        +{Math.round(bonus.multiplier * 100)}%
                      </Text>
                      <Text style={styles.bonusDescription}>{info.description}</Text>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Total - Always Visible */}
          <Animated.View
            style={[
              styles.totalSection,
              { transform: [{ scale: totalScale }] },
            ]}
          >
            <Text style={[styles.totalLabel, isFinal && styles.totalLabelFinal]}>
              {isFinal ? 'TOTAL' : 'TOTAL'}
            </Text>
            <Text style={[styles.totalValue, isFinal && styles.totalValueFinal]}>
              {formatPoints(displayedTotal)}
            </Text>
            <Text style={[styles.totalPts, isFinal && styles.totalPtsFinal]}>pts</Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    minWidth: 300,
  },
  setInfo: {
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 24,
  },
  baseCalcSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  baseCalcFormula: {
    fontSize: 28,
    color: colors.textSecondary,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  baseSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  baseEquals: {
    fontSize: 32,
    color: colors.textMuted,
    fontWeight: '300',
    marginBottom: 4,
  },
  baseValue: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  baseLabel: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 4,
  },
  multiplierSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  multiplierInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  multiplierX: {
    fontSize: 36,
    fontWeight: '300',
    color: colors.warning,
    marginRight: 8,
  },
  multiplierValue: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.warning,
    fontVariant: ['tabular-nums'],
  },
  multiplierLabel: {
    fontSize: 14,
    color: colors.warning,
    fontWeight: '600',
    marginTop: 4,
    opacity: 0.8,
  },
  bonusesList: {
    width: '100%',
    gap: 14,
    marginBottom: 20,
  },
  bonusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bonusTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 110,
  },
  bonusTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  bonusDetails: {
    flex: 1,
  },
  bonusPercent: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bonusDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 80,
    height: 3,
    backgroundColor: colors.border,
    marginVertical: 24,
    borderRadius: 2,
  },
  totalSection: {
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '700',
    marginBottom: 8,
  },
  totalLabelFinal: {
    color: colors.accent,
    fontSize: 18,
  },
  totalValue: {
    fontSize: 72,
    fontWeight: '900',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  totalValueFinal: {
    fontSize: 88,
  },
  totalPts: {
    fontSize: 20,
    color: colors.accent,
    fontWeight: '600',
    marginTop: -4,
  },
  totalPtsFinal: {
    fontSize: 28,
  },
});
