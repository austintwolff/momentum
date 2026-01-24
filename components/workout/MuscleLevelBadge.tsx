import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/Colors';

interface MuscleLevelBadgeProps {
  level: number;
  isMax?: boolean;
  isResting?: boolean;
  isLevelUp?: boolean;
}

export function MuscleLevelBadge({ level, isMax, isResting, isLevelUp }: MuscleLevelBadgeProps) {
  return (
    <View style={[
      styles.badge,
      isMax && styles.badgeMax,
      isResting && styles.badgeResting,
      isLevelUp && styles.badgeLevelUp,
    ]}>
      <Text style={styles.text}>{isMax ? 'MAX' : `Lv.${level}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeMax: {
    backgroundColor: colors.warning,
  },
  badgeResting: {
    backgroundColor: colors.textMuted,
  },
  badgeLevelUp: {
    backgroundColor: colors.accent,
  },
  text: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
