import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View, StyleSheet, ViewToken, RefreshControl } from 'react-native';
import { colors } from '@/constants/Colors';
import { CalendarMode, MonthData, DayData } from '@/hooks/useProgressCalendar';
import CalendarMonth from './CalendarMonth';

interface MonthItem {
  year: number;
  month: number; // 1-12
  key: string;
}

interface ProgressCalendarProps {
  monthsData: Map<string, MonthData>;
  fetchMonth: (year: number, month: number) => Promise<void>;
  mode: CalendarMode;
  onDayPress: (dayData: DayData) => void;
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
}

/**
 * Generate array of month items going backwards from current month
 */
function generateMonths(count: number): MonthItem[] {
  const months: MonthItem[] = [];
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-12

  for (let i = 0; i < count; i++) {
    months.push({
      year,
      month,
      key: `${year}-${month}`,
    });

    // Go to previous month
    month--;
    if (month === 0) {
      month = 12;
      year--;
    }
  }

  return months;
}

export default function ProgressCalendar({
  monthsData,
  fetchMonth,
  mode,
  onDayPress,
  onRefresh,
  refreshing = false,
}: ProgressCalendarProps) {
  const [months, setMonths] = useState<MonthItem[]>(() => generateMonths(12));
  const flatListRef = useRef<FlatList>(null);
  const viewableItemsRef = useRef<Set<string>>(new Set());

  // Fetch months that become visible
  const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const newViewable = new Set<string>();

    viewableItems.forEach(item => {
      if (item.item && item.isViewable) {
        const monthItem = item.item as MonthItem;
        newViewable.add(monthItem.key);

        // Fetch if not already loaded
        const existingData = monthsData.get(monthItem.key);
        if (!existingData || existingData.isLoading) {
          fetchMonth(monthItem.year, monthItem.month);
        }
      }
    });

    viewableItemsRef.current = newViewable;
  }, [monthsData, fetchMonth]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 10,
    minimumViewTime: 100,
  });

  // Fetch initial months
  useEffect(() => {
    const now = new Date();
    fetchMonth(now.getFullYear(), now.getMonth() + 1);
  }, []);

  // Load more months when reaching the end
  const handleEndReached = useCallback(() => {
    setMonths(prev => {
      const lastMonth = prev[prev.length - 1];
      let year = lastMonth.year;
      let month = lastMonth.month - 1;

      if (month === 0) {
        month = 12;
        year--;
      }

      const newMonths: MonthItem[] = [];
      for (let i = 0; i < 6; i++) {
        newMonths.push({
          year,
          month,
          key: `${year}-${month}`,
        });

        month--;
        if (month === 0) {
          month = 12;
          year--;
        }
      }

      return [...prev, ...newMonths];
    });
  }, []);

  const renderMonth = useCallback(({ item }: { item: MonthItem }) => {
    const data = monthsData.get(item.key);

    return (
      <CalendarMonth
        year={item.year}
        month={item.month}
        data={data}
        mode={mode}
        onDayPress={onDayPress}
      />
    );
  }, [monthsData, mode, onDayPress]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: 340, // Approximate height of a month
    offset: 340 * index,
    index,
  }), []);

  return (
    <FlatList
      ref={flatListRef}
      data={months}
      renderItem={renderMonth}
      keyExtractor={item => item.key}
      style={styles.container}
      contentContainerStyle={styles.content}
      windowSize={3}
      maxToRenderPerBatch={2}
      initialNumToRender={2}
      removeClippedSubviews={true}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      onViewableItemsChanged={handleViewableItemsChanged}
      viewabilityConfig={viewabilityConfig.current}
      showsVerticalScrollIndicator={false}
      getItemLayout={getItemLayout}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  content: {
    paddingBottom: 40,
  },
});
