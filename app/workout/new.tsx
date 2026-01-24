import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/Colors';

type WorkoutType = 'Push' | 'Pull' | 'Legs' | 'Full Body';
type GoalMode = 'Strength' | 'Hypertrophy' | 'Endurance';

function CloseIcon({ size = 24, color = colors.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M6 6L18 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PushIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 19V5" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M5 12L12 5L19 12" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PullIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M5 12L12 19L19 12" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LegsIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 4V10C8 12 6 14 6 18C6 20 7 21 8 21" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 4V10C16 12 18 14 18 18C18 20 17 21 16 21" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function FullBodyIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2Z" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 8V14" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M8 10L16 10" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M12 14L9 22" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M12 14L15 22" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

const WORKOUT_TYPES: { type: WorkoutType; icon: 'push' | 'pull' | 'legs' | 'full' }[] = [
  { type: 'Push', icon: 'push' },
  { type: 'Pull', icon: 'pull' },
  { type: 'Legs', icon: 'legs' },
  { type: 'Full Body', icon: 'full' },
];

const GOAL_MODES: { mode: GoalMode; reps: string; description: string }[] = [
  { mode: 'Strength', reps: '≤ 6 reps', description: 'Heavy weight, low reps' },
  { mode: 'Hypertrophy', reps: '6–12 reps', description: 'Muscle building' },
  { mode: 'Endurance', reps: '12+ reps', description: 'Lighter weight, high reps' },
];

export default function NewWorkoutScreen() {
  const router = useRouter();

  const [selectedType, setSelectedType] = useState<WorkoutType | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<GoalMode | null>(null);

  const canStart = selectedType !== null && selectedGoal !== null;

  const handleStartWorkout = () => {
    if (!canStart) return;

    const workoutName = selectedType === 'Full Body' ? 'Full Body' : `${selectedType} Day`;
    router.replace(
      `/workout/deck?name=${encodeURIComponent(workoutName)}&goal=${encodeURIComponent(selectedGoal!)}`
    );
  };

  const handleClose = () => {
    router.back();
  };

  const renderTypeIcon = (icon: string) => {
    if (icon === 'push') return <PushIcon />;
    if (icon === 'pull') return <PullIcon />;
    if (icon === 'legs') return <LegsIcon />;
    if (icon === 'full') return <FullBodyIcon />;
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton} accessibilityLabel="Close">
          <CloseIcon />
        </TouchableOpacity>
        <Text style={styles.title}>Workout Setup</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Type</Text>
          <View style={styles.typeGrid}>
            {WORKOUT_TYPES.map(({ type, icon }) => {
              const isSelected = selectedType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeCard, isSelected && styles.typeCardSelected]}
                  onPress={() => setSelectedType(type)}
                  activeOpacity={0.7}
                >
                  {renderTypeIcon(icon)}
                  <Text style={[styles.typeText, isSelected && styles.typeTextSelected]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goal Mode</Text>
          <View style={styles.goalList}>
            {GOAL_MODES.map(({ mode, reps, description }) => {
              const isSelected = selectedGoal === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.goalCard, isSelected && styles.goalCardSelected]}
                  onPress={() => setSelectedGoal(mode)}
                  activeOpacity={0.7}
                >
                  <View style={styles.goalLeft}>
                    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.goalInfo}>
                      <Text style={[styles.goalTitle, isSelected && styles.goalTitleSelected]}>
                        {mode}
                      </Text>
                      <Text style={styles.goalDescription}>{description}</Text>
                    </View>
                  </View>
                  <View style={[styles.repsBadge, isSelected && styles.repsBadgeSelected]}>
                    <Text style={[styles.repsText, isSelected && styles.repsTextSelected]}>
                      {reps}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startButton, !canStart && styles.startButtonDisabled]}
          onPress={handleStartWorkout}
          disabled={!canStart}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>Start Workout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    gap: 32,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    width: '47%',
    aspectRatio: 1.3,
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.bgTertiary,
  },
  typeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeTextSelected: {
    color: colors.textPrimary,
  },
  goalList: {
    gap: 12,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.bgTertiary,
  },
  goalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  goalInfo: {
    gap: 2,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  goalTitleSelected: {
    color: colors.textPrimary,
  },
  goalDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  repsBadge: {
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  repsBadgeSelected: {
    backgroundColor: colors.accent + '20',
  },
  repsText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  repsTextSelected: {
    color: colors.accent,
  },
  footer: {
    padding: 20,
    paddingBottom: 32,
  },
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: colors.bgTertiary,
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
