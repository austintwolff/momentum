import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/Colors';

interface BiWeeklyStatsBarProps {
  streak: number;
  workoutsCount: number;
  biWeeklyWorkoutDays: boolean[];
  avgScore: number;
}

function FlameIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C8.5 5.5 8 8.5 9 11C7 10 6 7.5 6 7.5C3.5 11 4 15 6 18C4.5 17 3 15.5 3 15.5C3.5 19 7.5 22 12 22Z"
        fill={colors.accent}
      />
      <Path
        d="M12 22C14.5 22 16 20 16 17.5C16 15 14 13 12 11C10 13 8 15 8 17.5C8 20 9.5 22 12 22Z"
        fill={colors.accentLight}
      />
    </Svg>
  );
}

function DayDot({ active }: { active: boolean }) {
  return (
    <View
      style={[
        styles.dayDot,
        active ? styles.dayDotActive : styles.dayDotInactive,
      ]}
    />
  );
}

export default function BiWeeklyStatsBar({
  streak,
  workoutsCount,
  biWeeklyWorkoutDays,
  avgScore,
}: BiWeeklyStatsBarProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Last 14 Days</Text>

      <View style={styles.statsRow}>
        {/* Streak */}
        <View style={styles.statSection}>
          <View style={styles.statHeader}>
            <FlameIcon size={14} />
            <Text style={styles.statHeaderText}>Streak</Text>
          </View>
          <Text style={styles.statValue}>
            {streak} {streak === 1 ? 'Day' : 'Days'}
          </Text>
        </View>

        <View style={styles.statDivider} />

        {/* Workouts */}
        <View style={styles.statSection}>
          <Text style={styles.statHeaderText}>Workouts</Text>
          <View style={styles.workoutsRow}>
            <Text style={styles.statValueLarge}>{workoutsCount}</Text>
            <View style={styles.dotsContainer}>
              {biWeeklyWorkoutDays.map((active, index) => (
                <DayDot key={index} active={active} />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.statDivider} />

        {/* Avg Score */}
        <View style={styles.statSection}>
          <Text style={styles.statHeaderText}>Avg Score</Text>
          <Text style={styles.statValueLarge}>{avgScore || '--'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statSection: {
    flex: 1,
    alignItems: 'center',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statHeaderText: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    marginTop: 2,
  },
  statValueLarge: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  workoutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 2,
    flexWrap: 'wrap',
    maxWidth: 60,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dayDotActive: {
    backgroundColor: colors.accent,
  },
  dayDotInactive: {
    backgroundColor: colors.bgTertiary,
  },
});
