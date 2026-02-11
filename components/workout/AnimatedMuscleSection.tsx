import { View, Text, StyleSheet, Image } from 'react-native';
import { colors } from '@/constants/Colors';
import { EstimatedMuscleXpGain } from '@/lib/muscle-xp';

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
  'quads': 'Quads',
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

export function AnimatedMuscleSection({
  muscles,
  isAnimating,
  animationGains,
  onAnimationComplete,
}: AnimatedMuscleSectionProps) {
  // If animation is triggered, immediately complete it (no visual animation needed)
  if (isAnimating && animationGains && animationGains.length > 0) {
    // Use setTimeout to avoid calling during render
    setTimeout(() => onAnimationComplete(animationGains), 0);
  }

  return (
    <View style={styles.container}>
      {/* Section Title */}
      <Text style={styles.sectionTitle}>
        Muscle Groups Worked
      </Text>

      {/* Simple Muscle List */}
      <View style={styles.muscleList}>
        {muscles.map((muscleData) => {
          const muscle = muscleData.muscle;

          return (
            <View key={muscle} style={styles.muscleChip}>
              <Text style={styles.muscleName}>
                {MUSCLE_DISPLAY_NAMES[muscle] || muscle}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Body Map Image */}
      <View style={styles.bodyMapContainer}>
        <Image
          source={require('@/assets/images/muscle-diagram.png')}
          style={styles.bodyMapImage}
          resizeMode="contain"
        />
      </View>
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
  muscleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  muscleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.bgTertiary,
  },
  muscleName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  bodyMapContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyMapImage: {
    width: '100%',
    height: '100%',
    maxHeight: 220,
  },
});
