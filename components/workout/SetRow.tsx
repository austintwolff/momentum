import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { colors } from '@/constants/Colors';

interface SetRowProps {
  setNumber: number;
  weight: string;
  reps: string;
  isWarmup: boolean;
  isBodyweight: boolean;
  weightUnit: 'lbs' | 'kg';
  weightIncrement: number;
  onWeightChange: (value: string) => void;
  onRepsChange: (value: string) => void;
  onWarmupToggle: () => void;
  onDelete?: () => void;
}

export default function SetRow({
  setNumber,
  weight,
  reps,
  isWarmup,
  isBodyweight,
  weightUnit,
  weightIncrement,
  onWeightChange,
  onRepsChange,
  onWarmupToggle,
}: SetRowProps) {
  const adjustWeight = (delta: number) => {
    const current = parseFloat(weight) || 0;
    const newWeight = Math.max(0, current + delta);
    onWeightChange(Math.round(newWeight).toString());
  };

  const adjustReps = (delta: number) => {
    const current = parseInt(reps, 10) || 0;
    const newReps = Math.max(0, current + delta);
    onRepsChange(newReps.toString());
  };

  return (
    <View style={[styles.row, isWarmup && styles.rowWarmup]}>
      {/* Set Number */}
      <View style={styles.setNumberContainer}>
        <Text style={[styles.setNumber, isWarmup && styles.textWarmup]}>
          {setNumber}
        </Text>
      </View>

      {/* Weight Input (if not bodyweight) */}
      {!isBodyweight ? (
        <View style={styles.inputGroup}>
          <TouchableOpacity
            style={styles.adjustButton}
            onPress={() => adjustWeight(-weightIncrement)}
            accessibilityLabel={`Decrease weight by ${weightIncrement}`}
          >
            <Text style={styles.adjustButtonText}>−</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, isWarmup && styles.inputWarmup]}
            value={weight}
            onChangeText={onWeightChange}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={`Weight in ${weightUnit}`}
          />
          <TouchableOpacity
            style={styles.adjustButton}
            onPress={() => adjustWeight(weightIncrement)}
            accessibilityLabel={`Increase weight by ${weightIncrement}`}
          >
            <Text style={styles.adjustButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputGroup}>
          <Text style={styles.bodyweightLabel}>BW</Text>
        </View>
      )}

      {/* Reps Input */}
      <View style={styles.inputGroup}>
        <TouchableOpacity
          style={styles.adjustButton}
          onPress={() => adjustReps(-1)}
          accessibilityLabel="Decrease reps"
        >
          <Text style={styles.adjustButtonText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.input, isWarmup && styles.inputWarmup]}
          value={reps}
          onChangeText={onRepsChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Reps"
        />
        <TouchableOpacity
          style={styles.adjustButton}
          onPress={() => adjustReps(1)}
          accessibilityLabel="Increase reps"
        >
          <Text style={styles.adjustButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Warmup Toggle */}
      <TouchableOpacity
        style={styles.warmupToggle}
        onPress={onWarmupToggle}
        accessibilityLabel={isWarmup ? 'Mark as working set' : 'Mark as warmup set'}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isWarmup }}
      >
        <View style={[styles.warmupCircle, isWarmup && styles.warmupCircleActive]}>
          {isWarmup && <Text style={styles.warmupCheck}>W</Text>}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  rowWarmup: {
    opacity: 0.7,
    backgroundColor: colors.bgTertiary + '40',
  },
  setNumberContainer: {
    width: 28,
    alignItems: 'center',
  },
  setNumber: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
  },
  textWarmup: {
    color: colors.textMuted,
  },
  inputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
  },
  adjustButton: {
    width: 32,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgTertiary,
  },
  adjustButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  input: {
    flex: 1,
    height: 40,
    minWidth: 40,
    borderRadius: 8,
    borderWidth: 2,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    backgroundColor: colors.bgSecondary,
    color: colors.textPrimary,
    borderColor: colors.border,
  },
  inputWarmup: {
    borderColor: colors.textMuted,
  },
  bodyweightLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.textSecondary,
  },
  warmupToggle: {
    width: 36,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warmupCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warmupCircleActive: {
    borderColor: colors.warning,
    backgroundColor: colors.warning + '30',
  },
  warmupCheck: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
  },
});
