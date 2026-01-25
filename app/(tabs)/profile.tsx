import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { showAlert } from '@/lib/alert';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore, kgToLbs, WeightUnit } from '@/stores/settings.store';
import { useWorkoutStats } from '@/hooks/useWorkoutStats';
import { colors } from '@/constants/Colors';
import Avatar from '@/components/profile/Avatar';
import EditProfileModal from '@/components/profile/EditProfileModal';

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

// Workout day indicator dot
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

function UserEditIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={colors.textMuted} strokeWidth={2} />
      <Path d="M20 21C20 16.5817 16.4183 13 12 13C7.58172 13 4 16.5817 4 21" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function BellIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ScaleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3V21" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M5 6L12 3L19 6" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 6L5 8C5 9 6 11 8.5 11C11 11 12 9 12 8" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19 6L19 8C19 9 18 11 15.5 11C13 11 12 9 12 8" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LogoutIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke={colors.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 17L21 12L16 7" stroke={colors.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 12H9" stroke={colors.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18L15 12L9 6" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, userStats, signOut, updateProfile } = useAuthStore();
  const { weightUnit, setWeightUnit } = useSettingsStore();
  const { workoutsThisWeek, weeklyWorkoutDays, streak, avgScore } = useWorkoutStats();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const handleSignOut = () => {
    showAlert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  };

  const toggleWeightUnit = () => {
    setWeightUnit(weightUnit === 'lbs' ? 'kg' : 'lbs');
  };

  const formatVolume = (volumeKg: number) => {
    const volume = weightUnit === 'lbs' ? kgToLbs(volumeKg) : volumeKg;
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}k ${weightUnit}`;
    }
    return `${Math.round(volume)} ${weightUnit}`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
    >
      {/* Profile Header */}
      <View style={styles.header}>
        <Avatar
          uri={profile?.avatar_url}
          name={profile?.display_name || profile?.username}
          size={80}
          style={styles.avatar}
        />
        <Text style={styles.name}>
          {profile?.display_name || profile?.username || 'User'}
        </Text>
        <Text style={styles.username}>
          @{profile?.username || 'user'}
        </Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {userStats?.total_workouts || 0}
          </Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {formatVolume(userStats?.total_volume_kg || 0)}
          </Text>
          <Text style={styles.statLabel}>Total Volume</Text>
        </View>
      </View>

      {/* Statistics Bar (This Week) */}
      <View style={styles.statsBar}>
        <Text style={styles.statsBarTitle}>Statistics (This Week)</Text>

        <View style={styles.statsRow}>
          {/* Progress Streak */}
          <View style={styles.statSection}>
            <View style={styles.statHeader}>
              <FlameIcon size={14} />
              <Text style={styles.statHeaderText}>Streak</Text>
            </View>
            <Text style={styles.statBarValue}>
              {streak} Days
            </Text>
          </View>

          <View style={styles.statDivider} />

          {/* Workouts */}
          <View style={styles.statSection}>
            <Text style={styles.statHeaderText}>Workouts</Text>
            <View style={styles.workoutsRow}>
              <Text style={styles.statValueLarge}>{workoutsThisWeek}</Text>
              <View style={styles.dotsContainer}>
                {weeklyWorkoutDays.map((active, index) => (
                  <DayDot key={index} active={active} />
                ))}
              </View>
            </View>
          </View>

          <View style={styles.statDivider} />

          {/* Avg Workout Score */}
          <View style={styles.statSection}>
            <Text style={styles.statHeaderText}>Avg Score</Text>
            <Text style={styles.statValueLarge}>{avgScore}</Text>
          </View>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Settings
        </Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => setIsEditModalVisible(true)}>
          <UserEditIcon />
          <Text style={styles.menuText}>
            Edit Profile
          </Text>
          <ChevronIcon />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <BellIcon />
          <Text style={styles.menuText}>
            Notifications
          </Text>
          <ChevronIcon />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={toggleWeightUnit}
        >
          <ScaleIcon />
          <Text style={styles.menuText}>
            Weight Unit
          </Text>
          <View style={styles.unitToggle}>
            <Text style={[
              styles.unitOption,
              weightUnit === 'lbs' && styles.unitOptionActive,
            ]}>
              lbs
            </Text>
            <Text style={[
              styles.unitOption,
              weightUnit === 'kg' && styles.unitOptionActive,
            ]}>
              kg
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <LogoutIcon />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={styles.version}>Momentum v1.0.0</Text>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        onSave={updateProfile}
        currentName={profile?.display_name}
        currentAvatarUrl={profile?.avatar_url}
      />
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    marginBottom: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  username: {
    fontSize: 16,
    marginTop: 4,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    color: colors.textSecondary,
  },
  // Stats Bar
  statsBar: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 10,
    marginBottom: 24,
  },
  statsBarTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
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
  statBarValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    marginTop: 2,
  },
  statValueLarge: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 6,
  },
  workoutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dayDotActive: {
    backgroundColor: colors.accent,
  },
  dayDotInactive: {
    backgroundColor: colors.bgTertiary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    backgroundColor: colors.bgSecondary,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgTertiary,
    borderRadius: 8,
    overflow: 'hidden',
  },
  unitOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  unitOptionActive: {
    backgroundColor: colors.accent,
    color: colors.textPrimary,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.error + '1A',
    gap: 8,
    marginBottom: 24,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
  },
});
