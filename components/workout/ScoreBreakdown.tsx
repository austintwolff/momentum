import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/Colors';

interface ScoreBreakdownProps {
  totalPRs: number;
  nearPRLifts: number;
  avgIntensity: number | null; // 0-100, null if no baseline data
  workingSets: number;
  exercisesHit: number;
  workoutsThisWeek: number;
}

interface BreakdownRowProps {
  label: string;
  value: string;
  progress: number; // 0-1
  hint: string;
}

function BreakdownRow({ label, value, progress, hint }: BreakdownRowProps) {
  const barColor = colors.accent;

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: barColor },
            ]}
          />
        </View>
      </View>
      <Text style={styles.rowHint}>{hint}</Text>
    </View>
  );
}

function getPRHint(prs: number): string {
  if (prs === 0) return 'Push a little harder next time';
  if (prs === 1) return 'Nice! Keep the momentum going';
  if (prs === 2) return 'Great session!';
  return 'Incredible performance!';
}

function getNearPRHint(nearPRs: number): string {
  if (nearPRs === 0) return 'No lifts in the near-PR zone';
  if (nearPRs === 1) return 'So close! One more push next time';
  if (nearPRs === 2) return 'Two lifts almost there!';
  return 'Multiple lifts on the edge of PRs!';
}

function getIntensityHint(percent: number): string {
  if (percent >= 95) return 'Pushing at your peak';
  if (percent >= 90) return 'Very close to your best';
  if (percent >= 85) return 'Strong maintenance day';
  if (percent >= 80) return 'Solid effort';
  return 'Room to push harder';
}

function getSetsHint(sets: number): string {
  if (sets >= 20) return 'High volume session';
  if (sets >= 15) return 'Solid volume';
  if (sets >= 10) return 'Moderate session';
  if (sets >= 6) return 'Quick workout';
  return 'Light session';
}

function getExercisesHint(exercises: number): string {
  if (exercises >= 6) return 'Full session coverage';
  if (exercises >= 4) return 'Good variety';
  if (exercises >= 2) return 'Focused session';
  return 'Single focus';
}

function getConsistencyHint(workouts: number): string {
  if (workouts >= 4) return 'Crushing it this week!';
  if (workouts === 3) return 'Great consistency';
  if (workouts === 2) return 'Building momentum';
  return 'First one this week';
}

export function ScoreBreakdown({
  totalPRs,
  nearPRLifts,
  avgIntensity,
  workingSets,
  exercisesHit,
  workoutsThisWeek,
}: ScoreBreakdownProps) {
  const prProgress = Math.min(totalPRs / 3, 1);
  const nearPRProgress = Math.min(nearPRLifts / 3, 1);
  const intensityProgress = avgIntensity !== null ? avgIntensity / 100 : 0;
  const setsProgress = Math.min(workingSets / 20, 1);
  const exercisesProgress = Math.min(exercisesHit / 6, 1);
  const consistencyProgress = Math.min(workoutsThisWeek / 4, 1);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Score Breakdown</Text>

      <View style={styles.breakdown}>
        <BreakdownRow
          label="Personal Records (PR)"
          value={totalPRs === 0 ? 'None' : `${totalPRs} PR${totalPRs > 1 ? 's' : ''}`}
          progress={prProgress}
          hint={getPRHint(totalPRs)}
        />

        <View style={styles.divider} />

        <BreakdownRow
          label="Near-PR Lifts"
          value={nearPRLifts === 0 ? 'None' : `${nearPRLifts} lift${nearPRLifts > 1 ? 's' : ''}`}
          progress={nearPRProgress}
          hint={getNearPRHint(nearPRLifts)}
        />

        <View style={styles.divider} />

        <BreakdownRow
          label="Average Intensity"
          value={avgIntensity !== null ? `${Math.round(avgIntensity)}%` : '--'}
          progress={intensityProgress}
          hint={avgIntensity !== null ? getIntensityHint(avgIntensity) : 'No baseline data yet'}
        />

        <View style={styles.divider} />

        <BreakdownRow
          label="Working Sets"
          value={`${workingSets} sets`}
          progress={setsProgress}
          hint={getSetsHint(workingSets)}
        />

        <View style={styles.divider} />

        <BreakdownRow
          label="Exercises Hit"
          value={`${exercisesHit} exercises`}
          progress={exercisesProgress}
          hint={getExercisesHint(exercisesHit)}
        />

        <View style={styles.divider} />

        <BreakdownRow
          label="Weekly Streak"
          value={workoutsThisWeek === 1 ? '1st this week' : `${workoutsThisWeek} this week`}
          progress={consistencyProgress}
          hint={getConsistencyHint(workoutsThisWeek)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  breakdown: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  row: {
    paddingVertical: 14,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  progressContainer: {
    marginBottom: 6,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgTertiary,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  rowHint: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
