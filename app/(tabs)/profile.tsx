import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { showAlert } from '@/lib/alert';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore, kgToLbs } from '@/stores/settings.store';
import { useProteinStore } from '@/stores/protein.store';
import { useCalorieStore } from '@/stores/calorie.store';
import {
  useMeasurementsStore,
  calculateProteinGoal,
  calculateCalorieGoal,
  formatHeight,
  formatWeight as formatMeasurementWeight,
} from '@/stores/measurements.store';
import { useTotalSets } from '@/hooks/useTotalSets';
import { colors } from '@/constants/Colors';
import Avatar from '@/components/profile/Avatar';
import EditProfileModal from '@/components/profile/EditProfileModal';
import EditMeasurementsModal from '@/components/profile/EditMeasurementsModal';

// Custom SVG Icons
function UserEditIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={colors.textMuted} strokeWidth={2} />
      <Path d="M20 21C20 16.5817 16.4183 13 12 13C7.58172 13 4 16.5817 4 21" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function EditIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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

// Reusable Macro Tracker Component
interface MacroTrackerProps<T extends number> {
  label: string;
  current: number;
  goal: number;
  unit: string;
  increments: readonly T[];
  selectedIncrement: T;
  onAdd: () => void;
  onSubtract: () => void;
  onIncrementChange: (increment: T) => void;
}

function MacroTracker<T extends number>({
  label,
  current,
  goal,
  unit,
  increments,
  selectedIncrement,
  onAdd,
  onSubtract,
  onIncrementChange,
}: MacroTrackerProps<T>) {
  const progress = Math.min(current / goal, 1);
  const goalReached = current >= goal;

  return (
    <View style={styles.trackerCard}>
      <View style={styles.trackerHeader}>
        <Text style={styles.trackerLabel}>{label}</Text>
        <View style={styles.trackerValueRow}>
          {goalReached && <CheckIcon size={14} />}
          <Text style={[styles.trackerValue, goalReached && styles.trackerValueComplete]}>
            {current.toLocaleString()}/{goal.toLocaleString()}{unit}
          </Text>
        </View>
      </View>

      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.trackerControls}>
        <TouchableOpacity
          style={[styles.controlButton, current === 0 && styles.controlButtonDisabled]}
          onPress={onSubtract}
          disabled={current === 0}
          accessibilityLabel={`Subtract ${label.toLowerCase()}`}
        >
          <MinusIcon size={16} />
        </TouchableOpacity>

        {increments.map((amount) => (
          <TouchableOpacity
            key={amount}
            style={[styles.incrementButton, selectedIncrement === amount && styles.incrementButtonActive]}
            onPress={() => onIncrementChange(amount)}
            accessibilityLabel={`Select ${amount} ${unit} increment`}
          >
            <Text style={[styles.incrementText, selectedIncrement === amount && styles.incrementTextActive]}>
              {amount}{unit}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.controlButton}
          onPress={onAdd}
          accessibilityLabel={`Add ${label.toLowerCase()}`}
        >
          <PlusIcon size={16} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, userStats, signOut, updateProfile } = useAuthStore();
  const { weightUnit, setWeightUnit } = useSettingsStore();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isMeasurementsModalVisible, setIsMeasurementsModalVisible] = useState(false);

  // Measurements store
  const { heightCm, weightKg, sex, updateMeasurements } = useMeasurementsStore();

  // Total sets hook
  const { totalSets } = useTotalSets();

  // Protein store
  const {
    currentProtein,
    selectedIncrement: proteinIncrement,
    addProtein,
    subtractProtein,
    setSelectedIncrement: setProteinIncrement,
    setProteinGoal,
    proteinGoal,
    checkAndResetDaily: checkProteinReset,
  } = useProteinStore();

  // Calorie store
  const {
    currentCalories,
    selectedIncrement: calorieIncrement,
    addCalories,
    subtractCalories,
    setSelectedIncrement: setCalorieIncrement,
    setCalorieGoal,
    calorieGoal,
    checkAndResetDaily: checkCalorieReset,
  } = useCalorieStore();

  // Reset daily trackers and update goals based on measurements
  useEffect(() => {
    checkProteinReset();
    checkCalorieReset();
  }, []);

  // Update goals when measurements change
  useEffect(() => {
    if (weightKg) {
      const newProteinGoal = calculateProteinGoal(weightKg, sex);
      const newCalorieGoal = calculateCalorieGoal(weightKg, sex);
      setProteinGoal(newProteinGoal);
      setCalorieGoal(newCalorieGoal);
    }
  }, [weightKg, sex]);

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

  const handleSaveMeasurements = (data: { heightCm: number; weightKg: number; sex: 'male' | 'female' }) => {
    updateMeasurements(data);
  };

  const useMetric = weightUnit === 'kg';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={styles.title}>Profile</Text>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Avatar
          uri={profile?.avatar_url}
          name={profile?.display_name || profile?.username}
          size={56}
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

      {/* Lifetime Statistics */}
      <Text style={styles.sectionTitle}>Lifetime Statistics</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{userStats?.total_workouts || 0}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalSets.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Sets</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatVolume(userStats?.total_volume_kg || 0)}</Text>
          <Text style={styles.statLabel}>Volume ({weightUnit})</Text>
        </View>
      </View>

      {/* Current Measurements */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Current Measurements</Text>
        <TouchableOpacity
          style={styles.sectionEditButton}
          onPress={() => setIsMeasurementsModalVisible(true)}
          accessibilityLabel="Edit measurements"
        >
          <EditIcon size={14} />
        </TouchableOpacity>
      </View>
      <View style={styles.measurementsCard}>
        <View style={styles.measurementItem}>
          <Text style={styles.measurementLabel}>Sex</Text>
          <Text style={styles.measurementValue}>
            {sex === 'male' ? 'Male' : 'Female'}
          </Text>
        </View>
        <View style={styles.measurementDivider} />
        <View style={styles.measurementItem}>
          <Text style={styles.measurementLabel}>Height</Text>
          <Text style={styles.measurementValue}>
            {formatHeight(heightCm, useMetric)}
          </Text>
        </View>
        <View style={styles.measurementDivider} />
        <View style={styles.measurementItem}>
          <Text style={styles.measurementLabel}>Weight</Text>
          <Text style={styles.measurementValue}>
            {formatMeasurementWeight(weightKg, useMetric)}
          </Text>
        </View>
      </View>

      {/* Macro Tracking Section */}
      <Text style={styles.sectionTitle}>Macro Tracking</Text>

      <MacroTracker
        label="Protein"
        current={currentProtein}
        goal={proteinGoal}
        unit="g"
        increments={[5, 10, 25] as const}
        selectedIncrement={proteinIncrement}
        onAdd={addProtein}
        onSubtract={subtractProtein}
        onIncrementChange={setProteinIncrement}
      />

      <MacroTracker
        label="Calories"
        current={currentCalories}
        goal={calorieGoal}
        unit=""
        increments={[50, 100, 250] as const}
        selectedIncrement={calorieIncrement}
        onAdd={addCalories}
        onSubtract={subtractCalories}
        onIncrementChange={setCalorieIncrement}
      />

      {/* Settings */}
      <Text style={styles.sectionTitle}>Settings</Text>
      <TouchableOpacity style={styles.settingRow} onPress={toggleWeightUnit}>
        <ScaleIcon size={18} />
        <Text style={styles.settingLabel}>Weight Unit</Text>
        <View style={styles.unitToggle}>
          <Text style={[styles.unitOption, weightUnit === 'lbs' && styles.unitOptionActive]}>lbs</Text>
          <Text style={[styles.unitOption, weightUnit === 'kg' && styles.unitOptionActive]}>kg</Text>
        </View>
      </TouchableOpacity>

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

      {/* Edit Measurements Modal */}
      <EditMeasurementsModal
        visible={isMeasurementsModalVisible}
        onClose={() => setIsMeasurementsModalVisible(false)}
        onSave={handleSaveMeasurements}
        currentHeightCm={heightCm}
        currentWeightKg={weightKg}
        currentSex={sex}
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  username: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionEditButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },

  // Measurements Card
  measurementsCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  measurementItem: {
    flex: 1,
    alignItems: 'center',
  },
  measurementLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  measurementValue: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  measurementDivider: {
    width: 1,
    backgroundColor: colors.border,
  },

  // Tracker Card (shared by protein & calories)
  trackerCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  trackerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  trackerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackerValue: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  trackerValueComplete: {
    color: colors.accent,
  },
  progressBarBg: {
    height: 5,
    backgroundColor: colors.bgTertiary,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2.5,
  },
  trackerControls: {
    flexDirection: 'row',
    gap: 6,
  },
  controlButton: {
    width: 36,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonDisabled: {
    opacity: 0.4,
  },
  incrementButton: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incrementButtonActive: {
    backgroundColor: colors.accent,
  },
  incrementText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  incrementTextActive: {
    color: colors.textPrimary,
  },

  // Setting Row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 10,
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

  // Sign Out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.error + '15',
    gap: 8,
    marginBottom: 12,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },

  // Version
  version: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
  },
});
