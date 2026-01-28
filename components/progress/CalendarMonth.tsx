import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '@/constants/Colors';
import { CalendarMode, MonthData, DayData } from '@/hooks/useProgressCalendar';
import CalendarDayCell from './CalendarDayCell';

interface CalendarMonthProps {
  year: number;
  month: number; // 1-12
  data: MonthData | undefined;
  mode: CalendarMode;
  onDayPress: (dayData: DayData) => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Get the day of week (0-6, Sunday = 0) for the first day of the month
 */
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/**
 * Get the number of days in a month
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function CalendarMonth({
  year,
  month,
  data,
  mode,
  onDayPress,
}: CalendarMonthProps) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDate = isCurrentMonth ? today.getDate() : -1;

  const firstDayOfWeek = getFirstDayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const isLoading = data?.isLoading ?? true;

  // Build calendar grid
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];

  // Add empty cells before first day
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(null);
  }

  // Add day cells
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Fill remaining cells in last week
  while (currentWeek.length > 0 && currentWeek.length < 7) {
    currentWeek.push(null);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const getDayData = (day: number): DayData | undefined => {
    return data?.days.get(day);
  };

  const handleDayPress = (day: number) => {
    const dayData = getDayData(day);
    if (dayData) {
      onDayPress(dayData);
    }
  };

  return (
    <View style={styles.container}>
      {/* Month Header */}
      <View style={styles.monthHeader}>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        {isLoading && (
          <ActivityIndicator size="small" color={colors.accent} style={styles.loadingIndicator} />
        )}
      </View>

      {/* Weekday Labels */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <View key={index} style={styles.weekdayCell}>
            <Text style={styles.weekdayLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {week.map((day, dayIndex) => {
              const dayData = day ? getDayData(day) : undefined;
              return (
                <CalendarDayCell
                  key={dayIndex}
                  day={day}
                  value={dayData?.value ?? null}
                  isToday={day === todayDate}
                  mode={mode}
                  onPress={() => day && handleDayPress(day)}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  weekdayCell: {
    width: 48,
    alignItems: 'center',
  },
  weekdayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  grid: {
    alignItems: 'center',
  },
  weekRow: {
    flexDirection: 'row',
  },
});
