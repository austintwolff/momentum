import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  Keyboard,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Exercise } from '@/types/database';
import { getTopRecentSetsForExercise, RecentTopSet } from '@/services/workout.service';
import { useAuthStore } from '@/stores/auth.store';
import { kgToLbs } from '@/stores/settings.store';
import { colors } from '@/constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DIALOG_WIDTH = Math.min(SCREEN_WIDTH - 48, 340);

// Icons
function MinusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12H19" stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5V19" stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M5 12H19" stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronIcon({ rotated }: { rotated: boolean }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      style={rotated ? { transform: [{ rotate: '180deg' }] } : undefined}
    >
      <Path
        d="M6 9L12 15L18 9"
        stroke={colors.textMuted}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckCircle({ checked, size = 24 }: { checked: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={12}
        r={10}
        stroke={checked ? colors.accent : colors.border}
        strokeWidth={2}
        fill={checked ? colors.accent : 'transparent'}
      />
      {checked && (
        <Path
          d="M8 12L11 15L16 9"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

export interface DetailedSet {
  id: string;
  reps: string;
  weight: string;
  isComplete: boolean;
  isEdited: boolean; // Track if user has edited this set
}

interface ExerciseLogPopupProps {
  visible: boolean;
  exercise: Exercise | null;
  initialSets?: DetailedSet[];
  isEditing?: boolean; // true when exercise is already completed (not just a draft)
  onClose: () => void;
  onDraftSave?: (sets: DetailedSet[]) => void;
  onFinish: (setCount: number, detailedSets?: DetailedSet[]) => void;
  weightUnit: 'lbs' | 'kg';
}

export default function ExerciseLogPopup({
  visible,
  exercise,
  initialSets,
  isEditing,
  onClose,
  onDraftSave,
  onFinish,
  weightUnit,
}: ExerciseLogPopupProps) {
  const user = useAuthStore(s => s.user);
  const [setCount, setSetCount] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [detailedSets, setDetailedSets] = useState<DetailedSet[]>([]);
  const [historicalData, setHistoricalData] = useState<RecentTopSet | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const prevValuesRef = useRef<{ [key: string]: string }>({});

  const isBodyweight = exercise?.exercise_type === 'bodyweight';
  const isDumbbell = exercise?.equipment?.some(e => e.toLowerCase() === 'dumbbell') ?? false;

  // Initialize when popup opens
  useEffect(() => {
    if (visible && exercise) {
      setHistoricalData(null);

      if (initialSets && initialSets.length > 0) {
        // Resume from draft or completed sets — start expanded
        setDetailedSets(initialSets);
        setSetCount(initialSets.length);
        setIsExpanded(true);
      } else {
        // Fresh exercise
        setSetCount(1);
        setIsExpanded(false);
        setDetailedSets([{ id: 'set-0', reps: '', weight: '', isComplete: false, isEdited: false }]);
      }

      // Fetch historical data
      if (user?.id && exercise?.id) {
        getTopRecentSetsForExercise(user.id, exercise.id, 14, 1)
          .then((recentSets) => {
            if (recentSets.length > 0) {
              setHistoricalData(recentSets[0]);
            }
          })
          .catch(console.error);
      }
    }
  }, [visible, exercise?.id, user?.id]);

  // Convert historical weight (stored in kg) to display unit, halved for dumbbells
  const getDisplayWeight = (weightKg: number): string => {
    const inUnit = weightUnit === 'lbs' ? kgToLbs(weightKg) : weightKg;
    const perHand = isDumbbell ? inUnit / 2 : inUnit;
    return Math.round(perHand).toString();
  };

  const handleExpand = () => {
    if (!isExpanded) {
      // Initialize rows with historical data when expanding
      const rows = Array.from({ length: setCount }, (_, i) => ({
        id: `set-${i}`,
        reps: historicalData?.reps.toString() || '',
        weight: isBodyweight ? '' : (historicalData ? getDisplayWeight(historicalData.weight) : ''),
        isComplete: false,
        isEdited: false,
      }));
      setDetailedSets(rows);
    }
    setIsExpanded(!isExpanded);
  };

  const handleDecrementSets = () => {
    if (setCount > 1) setSetCount(setCount - 1);
  };

  const handleIncrementSets = () => {
    if (setCount < 10) setSetCount(setCount + 1);
  };

  const handleAddSet = () => {
    if (detailedSets.length >= 10) return;
    Keyboard.dismiss();

    // Get values from last set to pre-fill
    const lastSet = detailedSets[detailedSets.length - 1];
    const newSet: DetailedSet = {
      id: `set-${detailedSets.length}`,
      reps: lastSet?.reps || historicalData?.reps.toString() || '',
      weight: lastSet?.weight || (isBodyweight ? '' : (historicalData ? getDisplayWeight(historicalData.weight) : '')),
      isComplete: false,
      isEdited: false, // Not edited yet, so shows as placeholder style
    };

    setDetailedSets([...detailedSets, newSet]);
    setSetCount(detailedSets.length + 1);

    // Scroll to bottom after adding
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleUpdateSet = (index: number, field: 'reps' | 'weight', value: string) => {
    const updated = [...detailedSets];
    // Only auto-check when manually typing reps
    const shouldAutoComplete = field === 'reps' && value.length > 0;
    updated[index] = {
      ...updated[index],
      [field]: value,
      isEdited: true,
      isComplete: shouldAutoComplete ? true : updated[index].isComplete,
    };
    setDetailedSets(updated);
  };

  const handleToggleSetComplete = (index: number) => {
    Keyboard.dismiss();
    const updated = [...detailedSets];
    const newComplete = !updated[index].isComplete;
    updated[index] = { ...updated[index], isComplete: newComplete, isEdited: true };
    setDetailedSets(updated);
  };

  const handleInputFocus = (index: number, field: 'weight' | 'reps') => {
    const key = `${index}-${field}`;
    prevValuesRef.current[key] = detailedSets[index][field];
    const updated = [...detailedSets];
    updated[index] = { ...updated[index], [field]: '' };
    setDetailedSets(updated);
  };

  const handleInputBlur = (index: number, field: 'weight' | 'reps') => {
    const key = `${index}-${field}`;
    if (!detailedSets[index][field] && prevValuesRef.current[key]) {
      const updated = [...detailedSets];
      updated[index] = { ...updated[index], [field]: prevValuesRef.current[key] };
      setDetailedSets(updated);
    }
    delete prevValuesRef.current[key];
  };

  // Check if all sets are complete (only matters when expanded)
  const allSetsComplete = !isExpanded || detailedSets.every((s) => s.isComplete);

  const handleFinish = () => {
    if (!allSetsComplete) return;
    Keyboard.dismiss();
    if (isExpanded && detailedSets.some((s) => s.reps || s.weight)) {
      onFinish(setCount, detailedSets);
    } else {
      onFinish(setCount);
    }
  };

  const handleClose = () => {
    // Save draft if user has expanded and entered data
    if (onDraftSave && isExpanded && detailedSets.some(s => s.reps || s.weight)) {
      onDraftSave(detailedSets);
      return; // onDraftSave handles closing
    }
    onClose();
  };

  const handleBackdropPress = () => {
    // Only dismiss keyboard, don't close popup (prevent accidental closes)
    Keyboard.dismiss();
  };

  if (!exercise) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <Pressable style={styles.dialog} onPress={Keyboard.dismiss}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>{exercise.name}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityLabel="Close"
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
                <Path d="M6 6L18 18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Set Counter - Only show when not expanded */}
          {!isExpanded && (
            <>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  onPress={handleDecrementSets}
                  style={[styles.counterButton, setCount <= 1 && styles.counterButtonDisabled]}
                  disabled={setCount <= 1}
                  accessibilityLabel="Decrease sets"
                >
                  <MinusIcon />
                </TouchableOpacity>

                <View style={styles.counterCenter}>
                  <Text style={styles.counterNumber}>{setCount}</Text>
                  <Text style={styles.counterLabel}>Sets</Text>
                </View>

                <TouchableOpacity
                  onPress={handleIncrementSets}
                  style={[styles.counterButton, setCount >= 10 && styles.counterButtonDisabled]}
                  disabled={setCount >= 10}
                  accessibilityLabel="Increase sets"
                >
                  <PlusIcon />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />
            </>
          )}

          {/* Collapsible Workout Log */}
          <TouchableOpacity style={styles.dropdownHeader} onPress={handleExpand}>
            <View>
              <Text style={styles.sectionTitle}>Workout Log</Text>
              {!isExpanded && (
                <Text style={styles.optionalText}>Optional but improves score accuracy</Text>
              )}
            </View>
            <ChevronIcon rotated={isExpanded} />
          </TouchableOpacity>

          {isExpanded && (
            <>
              <ScrollView
                ref={scrollViewRef}
                style={styles.setsScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {detailedSets.map((set, index) => {
                  const isUnsaved = !set.isComplete && !set.isEdited;
                  return (
                    <View key={set.id} style={styles.setRowContainer}>
                      {/* Top row: set number, inputs, check button - all aligned */}
                      <View style={styles.setRow}>
                        <Text style={[
                          styles.setLabel,
                          set.isComplete && styles.textSaved
                        ]}>
                          {index + 1}
                        </Text>

                        {/* Weight first */}
                        {!isBodyweight && (
                          <View style={styles.inputWrapper}>
                            <TextInput
                              style={[
                                styles.input,
                                isUnsaved && styles.inputUnsaved,
                                set.isComplete && styles.inputSaved,
                              ]}
                              placeholder="0"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="numeric"
                              returnKeyType="done"
                              value={set.weight}
                              onChangeText={(v) => handleUpdateSet(index, 'weight', v)}
                              onFocus={() => handleInputFocus(index, 'weight')}
                              onBlur={() => handleInputBlur(index, 'weight')}
                            />
                          </View>
                        )}

                        {/* Reps second */}
                        <View style={styles.inputWrapper}>
                          <TextInput
                            style={[
                              styles.input,
                              isUnsaved && styles.inputUnsaved,
                              set.isComplete && styles.inputSaved,
                            ]}
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            returnKeyType="done"
                            value={set.reps}
                            onChangeText={(v) => handleUpdateSet(index, 'reps', v)}
                            onFocus={() => handleInputFocus(index, 'reps')}
                            onBlur={() => handleInputBlur(index, 'reps')}
                          />
                        </View>

                        <TouchableOpacity
                          onPress={() => handleToggleSetComplete(index)}
                          style={styles.checkButton}
                          accessibilityLabel={set.isComplete ? 'Mark incomplete' : 'Save set'}
                        >
                          <CheckCircle checked={set.isComplete} size={28} />
                        </TouchableOpacity>
                      </View>

                      {/* Labels row below inputs */}
                      <View style={styles.labelsRow}>
                        <View style={styles.setLabelSpacer} />
                        {!isBodyweight && (
                          <View style={styles.inputWrapper}>
                            <Text style={[
                              styles.inputLabel,
                              set.isComplete && styles.textSaved
                            ]}>
                              Weight ({weightUnit}){isDumbbell ? ' x2' : ''}
                            </Text>
                          </View>
                        )}
                        <View style={styles.inputWrapper}>
                          <Text style={[
                            styles.inputLabel,
                            set.isComplete && styles.textSaved
                          ]}>
                            Reps
                          </Text>
                        </View>
                        <View style={styles.checkButtonSpacer} />
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Add Set Button */}
              {detailedSets.length < 10 && (
                <TouchableOpacity style={styles.addSetButton} onPress={handleAddSet}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 5V19" stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" />
                    <Path d="M5 12H19" stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" />
                  </Svg>
                  <Text style={styles.addSetText}>Add Set</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Footer Button */}
          <TouchableOpacity
            style={[styles.finishButton, !allSetsComplete && styles.finishButtonDisabled]}
            onPress={handleFinish}
            disabled={!allSetsComplete}
          >
            <Text style={[styles.finishButtonText, !allSetsComplete && styles.finishButtonTextDisabled]}>
              {isEditing ? 'Update Exercise' : 'Finish Exercise'}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    width: DIALOG_WIDTH,
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    maxHeight: '75%',
  },
  header: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonDisabled: {
    opacity: 0.4,
  },
  counterCenter: {
    alignItems: 'center',
    minWidth: 64,
    marginHorizontal: 12,
  },
  counterNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  counterLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: -2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  optionalText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
  },
  setsScroll: {
    maxHeight: 220,
  },
  setRowContainer: {
    marginBottom: 12,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  setLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    width: 20,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  setLabelSpacer: {
    width: 20,
  },
  inputWrapper: {
    flex: 1,
    marginHorizontal: 6,
  },
  input: {
    height: 40,
    backgroundColor: colors.bgTertiary,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  inputUnsaved: {
    color: colors.textMuted,
  },
  inputSaved: {
    color: colors.textPrimary,
  },
  inputLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  textSaved: {
    color: colors.textSecondary,
  },
  checkButton: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonSpacer: {
    width: 32,
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 8,
  },
  addSetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  finishButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  finishButtonDisabled: {
    backgroundColor: colors.bgTertiary,
  },
  finishButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  finishButtonTextDisabled: {
    color: colors.textMuted,
  },
});
