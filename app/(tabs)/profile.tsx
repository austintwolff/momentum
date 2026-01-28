import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { showAlert } from '@/lib/alert';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore, kgToLbs } from '@/stores/settings.store';
import { useProteinStore } from '@/stores/protein.store';
import { colors } from '@/constants/Colors';
import Avatar from '@/components/profile/Avatar';
import EditProfileModal from '@/components/profile/EditProfileModal';

// Custom SVG Icons
function UserEditIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={colors.textMuted} strokeWidth={2} />
      <Path d="M20 21C20 16.5817 16.4183 13 12 13C7.58172 13 4 16.5817 4 21" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
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

function ProteinIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={colors.textSecondary} strokeWidth={2} />
      <Path d="M12 7V12L15 14" stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="20 6 9 17 4 12" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MinusIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12H19" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M5 12H19" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, userStats, signOut, updateProfile } = useAuthStore();
  const { weightUnit, setWeightUnit } = useSettingsStore();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const {
    currentProtein,
    proteinGoal,
    selectedIncrement,
    addProtein,
    subtractProtein,
    setSelectedIncrement,
    checkAndResetDaily,
  } = useProteinStore();

  useEffect(() => {
    checkAndResetDaily();
  }, []);

  const proteinProgress = Math.min(currentProtein / proteinGoal, 1);
  const goalReached = currentProtein >= proteinGoal;

  const handleSignOut = () => {
    showAlert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  const toggleWeightUnit = () => {
    setWeightUnit(weightUnit === 'lbs' ? 'kg' : 'lbs');
  };

  const formatVolume = (volumeKg: number) => {
    const volume = weightUnit === 'lbs' ? kgToLbs(volumeKg) : volumeKg;
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}k`;
    }
    return Math.round(volume).toString();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <Text style={styles.title}>Profile</Text>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Avatar
          uri={profile?.avatar_url}
          name={profile?.display_name || profile?.username}
          size={64}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {profile?.display_name || profile?.username || 'User'}
          </Text>
          <Text style={styles.username}>@{profile?.username || 'user'}</Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setIsEditModalVisible(true)}
          accessibilityLabel="Edit profile"
        >
          <UserEditIcon size={18} />
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{userStats?.total_workouts || 0}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatVolume(userStats?.total_volume_kg || 0)}</Text>
          <Text style={styles.statLabel}>Volume ({weightUnit})</Text>
        </View>
      </View>

      {/* Protein Tracker */}
      <View style={styles.proteinCard}>
        <View style={styles.proteinHeader}>
          <View style={styles.proteinTitleRow}>
            <ProteinIcon size={16} />
            <Text style={styles.proteinTitle}>Protein</Text>
          </View>
          <View style={styles.proteinValueRow}>
            {goalReached && <CheckIcon size={14} />}
            <Text style={[styles.proteinValue, goalReached && styles.proteinValueComplete]}>
              {currentProtein}/{proteinGoal}g
            </Text>
          </View>
        </View>

        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${proteinProgress * 100}%` }]} />
        </View>

        <View style={styles.proteinControls}>
          <TouchableOpacity
            style={[styles.controlButton, currentProtein === 0 && styles.controlButtonDisabled]}
            onPress={subtractProtein}
            disabled={currentProtein === 0}
            accessibilityLabel="Subtract protein"
          >
            <MinusIcon size={16} />
          </TouchableOpacity>

          {([5, 10, 25] as const).map((amount) => (
            <TouchableOpacity
              key={amount}
              style={[styles.incrementButton, selectedIncrement === amount && styles.incrementButtonActive]}
              onPress={() => setSelectedIncrement(amount)}
              accessibilityLabel={`Select ${amount} gram increment`}
            >
              <Text style={[styles.incrementText, selectedIncrement === amount && styles.incrementTextActive]}>
                {amount}g
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.controlButton}
            onPress={addProtein}
            accessibilityLabel="Add protein"
          >
            <PlusIcon size={16} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings */}
      <View style={styles.settingsSection}>
        <TouchableOpacity style={styles.settingRow} onPress={toggleWeightUnit}>
          <ScaleIcon size={18} />
          <Text style={styles.settingLabel}>Weight Unit</Text>
          <View style={styles.unitToggle}>
            <Text style={[styles.unitOption, weightUnit === 'lbs' && styles.unitOptionActive]}>lbs</Text>
            <Text style={[styles.unitOption, weightUnit === 'kg' && styles.unitOptionActive]}>kg</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <LogoutIcon size={18} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 20,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  username: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },

  // Protein Card
  proteinCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  proteinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  proteinTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proteinTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  proteinValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  proteinValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  proteinValueComplete: {
    color: colors.accent,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.bgTertiary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  proteinControls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonDisabled: {
    opacity: 0.4,
  },
  incrementButton: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incrementButtonActive: {
    backgroundColor: colors.accent,
  },
  incrementText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  incrementTextActive: {
    color: colors.textPrimary,
  },

  // Settings
  settingsSection: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgTertiary,
    borderRadius: 6,
    overflow: 'hidden',
  },
  unitOption: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  unitOptionActive: {
    backgroundColor: colors.accent,
    color: colors.textPrimary,
  },

  // Spacer
  spacer: {
    flex: 1,
  },

  // Sign Out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.error + '15',
    gap: 8,
    marginBottom: 12,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },

  // Version
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
  },
});
