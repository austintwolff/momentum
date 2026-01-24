import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuthStore } from '@/stores/auth.store';
import { colors } from '@/constants/Colors';

// Custom SVG Icons
function FlameIcon({ size = 20 }: { size?: number }) {
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

function CalendarIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z"
        stroke={colors.accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M16 2V6" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 2V6" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 10H21" stroke={colors.accent} strokeWidth={2} />
    </Svg>
  );
}

function DumbbellIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 6.5L17.5 17.5" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 10L10 3" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 21L21 14" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 6L6 3" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M18 21L21 18" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ClockIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={colors.textMuted} strokeWidth={2} />
      <Path d="M12 6V12L16 14" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PlusIcon({ size = 24, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M5 12H19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, userStats, refreshUserStats } = useAuthStore();

  // Refresh user stats when screen loads
  useEffect(() => {
    refreshUserStats();
  }, []);

  const handleStartWorkout = () => {
    router.push('/workout/new');
  };

  const formatLastWorkout = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
    >
      {/* Welcome Section */}
      <View style={styles.welcome}>
        <Text style={styles.greeting}>
          Welcome back,
        </Text>
        <Text style={styles.username}>
          {profile?.display_name || profile?.username || 'Athlete'}
        </Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <FlameIcon />
          </View>
          <Text style={styles.statValue}>
            {userStats?.current_workout_streak || 0}
          </Text>
          <Text style={styles.statLabel}>
            Day Streak
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <CalendarIcon />
          </View>
          <Text style={styles.statValue}>
            {userStats?.total_workouts || 0}
          </Text>
          <Text style={styles.statLabel}>
            Workouts
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <DumbbellIcon />
          </View>
          <Text style={styles.statValue}>
            {userStats?.longest_workout_streak || 0}
          </Text>
          <Text style={styles.statLabel}>
            Best Streak
          </Text>
        </View>
      </View>

      {/* Start Workout Button */}
      <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout}>
        <PlusIcon />
        <Text style={styles.startButtonText}>Start Workout</Text>
      </TouchableOpacity>

      {/* Last Workout */}
      {userStats?.last_workout_at && (
        <View style={styles.lastWorkoutCard}>
          <ClockIcon />
          <View style={styles.lastWorkoutText}>
            <Text style={styles.lastWorkoutLabel}>
              Last Workout
            </Text>
            <Text style={styles.lastWorkoutValue}>
              {formatLastWorkout(userStats.last_workout_at as string)}
            </Text>
          </View>
        </View>
      )}

      {/* Streak Info */}
      {(userStats?.current_workout_streak ?? 0) > 0 && (
        <View style={styles.streakCard}>
          <FlameIcon size={24} />
          <View style={styles.streakText}>
            <Text style={styles.streakTitle}>
              {userStats?.current_workout_streak} Day Streak!
            </Text>
            <Text style={styles.streakDescription}>
              Keep it up! Consistency is key to progress.
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  welcome: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  username: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
    color: colors.textPrimary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    color: colors.textSecondary,
  },
  startButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
  },
  startButtonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.accent + '33',
  },
  streakText: {
    flex: 1,
  },
  streakTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
  },
  streakDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  lastWorkoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    gap: 12,
    backgroundColor: colors.bgSecondary,
  },
  lastWorkoutText: {
    flex: 1,
  },
  lastWorkoutLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  lastWorkoutValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
    color: colors.textPrimary,
  },
});
