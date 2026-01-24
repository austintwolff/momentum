import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSettingsStore, getWeightIncrement } from '@/stores/settings.store';
import { colors } from '@/constants/Colors';

interface SetLogResult {
  isPR: boolean;
}

interface SetLoggerProps {
  exerciseName: string;
  exerciseType: 'weighted' | 'bodyweight';
  setNumber: number;
  previousWeight?: number;  // From previous set in current workout
  previousReps?: number;    // From previous set in current workout
  historicalWeight?: number; // From best set of last 3 workouts (for first set)
  historicalReps?: number;   // From best set of last 3 workouts (for first set)
  onLogSet: (weight: number | null, reps: number) => SetLogResult | null;
  onStartRest: (seconds: number) => void;
}

export default function SetLogger({
  exerciseName,
  exerciseType,
  setNumber,
  previousWeight,
  previousReps,
  historicalWeight,
  historicalReps,
  onLogSet,
  onStartRest,
}: SetLoggerProps) {
  const { weightUnit } = useSettingsStore();
  const weightIncrement = getWeightIncrement(weightUnit);
  const isBodyweight = exerciseType === 'bodyweight';

  // Determine initial values:
  // - For subsequent sets (setNumber > 1): use previous set's weight and reps
  // - For first set: use historical data (weight same, reps + 1)
  const getInitialWeight = (): string => {
    if (isBodyweight) return '';
    if (setNumber > 1 && previousWeight !== undefined) {
      return Math.round(previousWeight).toString();
    }
    if (setNumber === 1 && historicalWeight !== undefined) {
      return Math.round(historicalWeight).toString();
    }
    return '';
  };

  const getInitialReps = (): string => {
    if (setNumber > 1 && previousReps !== undefined) {
      return previousReps.toString();
    }
    if (setNumber === 1 && historicalReps !== undefined) {
      // Add 1 rep to historical best for progressive overload
      return (historicalReps + 1).toString();
    }
    return '';
  };

  const [weight, setWeight] = useState(getInitialWeight);
  const [reps, setReps] = useState(getInitialReps);

  // Update values when set number changes (after logging a set)
  useEffect(() => {
    setWeight(getInitialWeight());
    setReps(getInitialReps());
  }, [setNumber, previousWeight, previousReps]);

  const handleLogSet = () => {
    const repsNum = parseInt(reps, 10);
    if (isNaN(repsNum) || repsNum <= 0) return;

    const weightNum = isBodyweight ? null : parseFloat(weight) || 0;
    console.log('[SetLogger] Logging set:', { weightNum, repsNum, weightUnit, rawWeight: weight });
    const result = onLogSet(weightNum, repsNum);

    if (result) {
      // Start rest timer (weight/reps will auto-update via useEffect when setNumber changes)
      onStartRest(90);
    }
  };

  const adjustWeight = (delta: number) => {
    const current = parseFloat(weight) || 0;
    const newWeight = Math.max(0, current + delta);
    setWeight(Math.round(newWeight).toString());
  };

  const adjustReps = (delta: number) => {
    const current = parseInt(reps, 10) || 0;
    const newReps = Math.max(0, current + delta);
    setReps(newReps.toString());
  };

  return (
    <View style={styles.container}>
      {/* Set Number */}
      <Text style={styles.setLabel}>
        Set {setNumber}
      </Text>

      {/* Input Row */}
      <View style={styles.inputRow}>
        {/* Weight Input (if not bodyweight) */}
        {!isBodyweight && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Weight ({weightUnit})
            </Text>
            <View style={styles.inputWithButtons}>
              <TouchableOpacity
                style={styles.adjustButton}
                onPress={() => adjustWeight(-weightIncrement)}
              >
                <Text style={styles.adjustButtonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.numberInput}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                style={styles.adjustButton}
                onPress={() => adjustWeight(weightIncrement)}
              >
                <Text style={styles.adjustButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Reps Input */}
        <View style={[styles.inputGroup, isBodyweight && styles.inputGroupFull]}>
          <Text style={styles.inputLabel}>
            Reps
          </Text>
          <View style={styles.inputWithButtons}>
            <TouchableOpacity
              style={styles.adjustButton}
              onPress={() => adjustReps(-1)}
            >
              <Text style={styles.adjustButtonText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.numberInput}
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={styles.adjustButton}
              onPress={() => adjustReps(1)}
            >
              <Text style={styles.adjustButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Quick Reps Buttons */}
      <View style={styles.quickRepsRow}>
        {[5, 8, 10, 12, 15].map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.quickRepButton,
              reps === num.toString() && styles.quickRepButtonActive,
            ]}
            onPress={() => setReps(num.toString())}
          >
            <Text
              style={[
                styles.quickRepText,
                reps === num.toString() && styles.quickRepTextActive,
              ]}
            >
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Log Set Button */}
      <TouchableOpacity
        style={[styles.logButton, !reps && styles.logButtonDisabled]}
        onPress={handleLogSet}
        disabled={!reps}
      >
        <Text style={styles.logButtonIcon}>✓</Text>
        <Text style={styles.logButtonText}>Log Set</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  setLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
    minWidth: 0,
  },
  inputGroupFull: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  inputWithButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adjustButton: {
    width: 36,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgTertiary,
  },
  adjustButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  numberInput: {
    flex: 1,
    height: 48,
    minWidth: 50,
    borderRadius: 10,
    borderWidth: 2,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    backgroundColor: colors.bgSecondary,
    color: colors.textPrimary,
    borderColor: colors.border,
  },
  quickRepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 6,
  },
  quickRepButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.bgTertiary,
  },
  quickRepButtonActive: {
    backgroundColor: colors.accent,
  },
  quickRepText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  quickRepTextActive: {
    color: colors.textPrimary,
  },
  logButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 10,
  },
  logButtonDisabled: {
    opacity: 0.5,
  },
  logButtonIcon: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  logButtonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});
