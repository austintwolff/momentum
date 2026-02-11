import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/Colors';
import { CalendarMode } from '@/hooks/useProgressCalendar';

interface CalendarDayCellProps {
  day: number | null; // null for empty cells
  value: number | null; // score (0-100) or E1RM in kg
  isToday: boolean;
  mode: CalendarMode;
  weightUnit: 'kg' | 'lbs';
  onPress?: () => void;
}

const KG_TO_LBS = 2.20462;

/**
 * Get background opacity based on score (0-100)
 * Returns opacity value from 0.1 to 0.6
 */
function getScoreOpacity(score: number): number {
  if (score <= 0) return 0;
  // Map score 0-100 to opacity 0.15-0.5
  return 0.15 + (score / 100) * 0.35;
}

/**
 * Get background opacity based on E1RM value
 * Assumes typical E1RM range of 20-200kg
 */
function getPROpacity(e1rm: number): number {
  if (e1rm <= 0) return 0;
  // Map E1RM 20-200 to opacity 0.15-0.5
  const normalized = Math.min(Math.max((e1rm - 20) / 180, 0), 1);
  return 0.15 + normalized * 0.35;
}

function CalendarDayCell({
  day,
  value,
  isToday,
  mode,
  weightUnit,
  onPress,
}: CalendarDayCellProps) {
  // Empty cell
  if (day === null) {
    return <View style={styles.cell} />;
  }

  const hasData = value !== null && value > 0;
  const opacity = hasData
    ? mode === 'score'
      ? getScoreOpacity(value)
      : getPROpacity(value)
    : 0;

  const backgroundColor = hasData
    ? `rgba(124, 58, 237, ${opacity})` // accent color with opacity
    : 'transparent';

  // Format value for display (convert E1RM from kg to lbs if needed)
  const displayValue = hasData
    ? mode === 'score'
      ? Math.round(value).toString()
      : `${Math.round(weightUnit === 'lbs' ? value * KG_TO_LBS : value)}`
    : null;

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        { backgroundColor },
        isToday && styles.todayCell,
      ]}
      onPress={hasData ? onPress : undefined}
      disabled={!hasData}
      activeOpacity={hasData ? 0.7 : 1}
    >
      <Text style={[
        styles.dayNumber,
        hasData && styles.dayNumberWithData,
        isToday && styles.todayDayNumber,
      ]}>
        {day}
      </Text>
      {displayValue && (
        <Text style={styles.valueText}>
          {displayValue}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default React.memo(CalendarDayCell);

const CELL_SIZE = 44;

const styles = StyleSheet.create({
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  dayNumberWithData: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  todayDayNumber: {
    color: colors.accent,
    fontWeight: '700',
  },
  valueText: {
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
    marginTop: 1,
  },
});
