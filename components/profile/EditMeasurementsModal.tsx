import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/Colors';
import { Sex, feetInchesToCm, cmToFeetInches } from '@/stores/measurements.store';
import { useSettingsStore, kgToLbs, lbsToKg } from '@/stores/settings.store';

interface EditMeasurementsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { heightCm: number; weightKg: number; sex: Sex }) => void;
  currentHeightCm: number | null;
  currentWeightKg: number | null;
  currentSex: Sex;
}

function CloseIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M6 6L18 18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function EditMeasurementsModal({
  visible,
  onClose,
  onSave,
  currentHeightCm,
  currentWeightKg,
  currentSex,
}: EditMeasurementsModalProps) {
  const insets = useSafeAreaInsets();
  const { weightUnit } = useSettingsStore();

  // Height in feet/inches for imperial
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  // Weight in user's preferred unit
  const [weight, setWeight] = useState('');
  // Sex selection
  const [sex, setSex] = useState<Sex>(currentSex);

  // Initialize values when modal opens
  useEffect(() => {
    if (visible) {
      setSex(currentSex);

      if (currentHeightCm) {
        const { feet: f, inches: i } = cmToFeetInches(currentHeightCm);
        setFeet(f.toString());
        setInches(i.toString());
      } else {
        setFeet('');
        setInches('');
      }

      if (currentWeightKg) {
        const displayWeight = weightUnit === 'lbs'
          ? Math.round(kgToLbs(currentWeightKg))
          : Math.round(currentWeightKg);
        setWeight(displayWeight.toString());
      } else {
        setWeight('');
      }
    }
  }, [visible, currentHeightCm, currentWeightKg, currentSex, weightUnit]);

  const handleSave = () => {
    const feetNum = parseInt(feet) || 0;
    const inchesNum = parseInt(inches) || 0;
    const heightCm = feetInchesToCm(feetNum, inchesNum);

    const weightNum = parseFloat(weight) || 0;
    const weightKg = weightUnit === 'lbs' ? lbsToKg(weightNum) : weightNum;

    onSave({ heightCm, weightKg, sex });
    onClose();
  };

  const isValid = feet && weight && parseFloat(weight) > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
            <CloseIcon />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Measurements</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isValid}
            style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}
          >
            <Text style={[styles.saveText, !isValid && styles.saveTextDisabled]}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Sex Selection */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Sex</Text>
            <View style={styles.sexToggle}>
              <TouchableOpacity
                style={[styles.sexOption, sex === 'male' && styles.sexOptionActive]}
                onPress={() => setSex('male')}
              >
                <Text style={[styles.sexOptionText, sex === 'male' && styles.sexOptionTextActive]}>
                  Male
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sexOption, sex === 'female' && styles.sexOptionActive]}
                onPress={() => setSex('female')}
              >
                <Text style={[styles.sexOptionText, sex === 'female' && styles.sexOptionTextActive]}>
                  Female
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Height */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Height</Text>
            <View style={styles.heightRow}>
              <View style={styles.heightInputGroup}>
                <TextInput
                  style={styles.input}
                  value={feet}
                  onChangeText={setFeet}
                  keyboardType="number-pad"
                  placeholder="5"
                  placeholderTextColor={colors.textMuted}
                  maxLength={1}
                />
                <Text style={styles.unitLabel}>ft</Text>
              </View>
              <View style={styles.heightInputGroup}>
                <TextInput
                  style={styles.input}
                  value={inches}
                  onChangeText={setInches}
                  keyboardType="number-pad"
                  placeholder="10"
                  placeholderTextColor={colors.textMuted}
                  maxLength={2}
                />
                <Text style={styles.unitLabel}>in</Text>
              </View>
            </View>
          </View>

          {/* Weight */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Weight</Text>
            <View style={styles.weightRow}>
              <TextInput
                style={[styles.input, styles.weightInput]}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder={weightUnit === 'lbs' ? '170' : '77'}
                placeholderTextColor={colors.textMuted}
                maxLength={4}
              />
              <Text style={styles.unitLabel}>{weightUnit}</Text>
            </View>
          </View>

          {/* Info */}
          <Text style={styles.infoText}>
            Your measurements are used to calculate recommended daily protein and calorie goals.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  saveButtonDisabled: {
    backgroundColor: colors.bgTertiary,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  saveTextDisabled: {
    color: colors.textMuted,
  },
  content: {
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sexToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgSecondary,
    borderRadius: 10,
    padding: 4,
  },
  sexOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sexOptionActive: {
    backgroundColor: colors.accent,
  },
  sexOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  sexOptionTextActive: {
    color: colors.textPrimary,
  },
  heightRow: {
    flexDirection: 'row',
    gap: 16,
  },
  heightInputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: colors.bgSecondary,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
    textAlign: 'center',
  },
  unitLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    minWidth: 24,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weightInput: {
    flex: 0,
    width: 120,
  },
  infoText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 8,
  },
});
