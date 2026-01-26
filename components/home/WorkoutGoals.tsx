import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { colors } from '@/constants/Colors';

// Icons matching the dial icons for visual connection
function ProgressionGoalIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 20V14M12 20V10M19 20V4"
        stroke={colors.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function LoadGoalIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8" stroke={colors.textSecondary} strokeWidth={2} />
      <Path
        d="M12 8V12L14 14"
        stroke={colors.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ConsistencyGoalIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z"
        stroke={colors.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="20 6 9 17 4 12"
        stroke={colors.textPrimary}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface GoalItemProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  progress: number; // 0-1
  isComplete: boolean;
  boostLabel: string;
}

function GoalItem({ icon, label, description, progress, isComplete, boostLabel }: GoalItemProps) {
  return (
    <View style={styles.goalItem}>
      <View style={styles.goalRow}>
        <View style={[styles.checkbox, isComplete && styles.checkboxComplete]}>
          {isComplete && <CheckIcon size={10} />}
        </View>
        <View style={styles.goalContent}>
          <View style={styles.goalHeader}>
            {icon}
            <Text style={styles.goalLabel}>{label}</Text>
          </View>
          <Text style={styles.goalDescription} numberOfLines={1}>
            {description}
          </Text>
        </View>
        <View style={[styles.boostBadge, isComplete && styles.boostBadgeComplete]}>
          <Text style={[styles.boostText, isComplete && styles.boostTextComplete]}>
            {boostLabel}
          </Text>
        </View>
      </View>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(progress, 1) * 100}%` },
            isComplete && styles.progressFillComplete
          ]}
        />
      </View>
    </View>
  );
}

interface WorkoutGoalsProps {
  // For now, using static boilerplate data
  // Later these will be calculated from actual workout data
}

export function WorkoutGoals({}: WorkoutGoalsProps) {
  // Boilerplate goals - these will be dynamic later
  const goals = [
    {
      icon: <ProgressionGoalIcon />,
      label: 'Progression',
      description: 'Beat 3 personal records this week',
      progress: 0.33,
      isComplete: false,
      boostLabel: '+5',
    },
    {
      icon: <LoadGoalIcon />,
      label: 'Load',
      description: 'Complete 20 working sets today',
      progress: 0.65,
      isComplete: false,
      boostLabel: '+5',
    },
    {
      icon: <ConsistencyGoalIcon />,
      label: 'Consistency',
      description: 'Train 4 days this week',
      progress: 1,
      isComplete: true,
      boostLabel: '+5',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workout Goals</Text>
        <Text style={styles.subtitle}>Complete to boost scores</Text>
      </View>
      <View style={styles.goalsList}>
        {goals.map((goal, index) => (
          <GoalItem key={index} {...goal} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  goalsList: {
    gap: 10,
  },
  goalItem: {
    gap: 6,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxComplete: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  goalContent: {
    flex: 1,
    gap: 2,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  goalDescription: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  boostBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.bgTertiary,
  },
  boostBadgeComplete: {
    backgroundColor: colors.accent,
  },
  boostText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
  },
  boostTextComplete: {
    color: colors.textPrimary,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.bgTertiary,
    borderRadius: 2,
    marginLeft: 26, // Align with content after checkbox
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.textMuted,
    borderRadius: 2,
  },
  progressFillComplete: {
    backgroundColor: colors.accent,
  },
});
