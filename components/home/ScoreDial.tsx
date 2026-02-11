import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/constants/Colors';

interface ScoreDialProps {
  value: number | null; // 0-100, null = uncalibrated (show "—")
  label: string;
  icon: React.ReactNode;
  size?: number;
  onPress?: () => void;
}

export const ScoreDial = React.memo(function ScoreDial({ value, label, icon, size = 72, onPress }: ScoreDialProps) {
  const displayValue = value ?? 0; // Use 0 for arc calculations when null
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // Arc spans 270 degrees (from 135° to 405°, i.e., bottom-left to bottom-right going clockwise through top)
  const startAngle = 135;
  const endAngle = 405;
  const totalArcDegrees = endAngle - startAngle; // 270 degrees

  // Calculate the progress arc end angle
  const progressDegrees = (displayValue / 100) * totalArcDegrees;
  const progressEndAngle = startAngle + progressDegrees;

  // Convert degrees to radians and get path coordinates
  const polarToCartesian = (angle: number) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(radians),
      y: center + radius * Math.sin(radians),
    };
  };

  // Create arc path
  const createArc = (start: number, end: number) => {
    const startPoint = polarToCartesian(start);
    const endPoint = polarToCartesian(end);
    const largeArcFlag = end - start > 180 ? 1 : 0;

    return `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`;
  };

  const backgroundArc = createArc(startAngle, endAngle);
  const progressArc = value !== null && value > 0 ? createArc(startAngle, progressEndAngle) : '';

  const dialContent = (
    <>
      <View style={[styles.dialWrapper, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          {/* Background arc */}
          <Path
            d={backgroundArc}
            stroke={colors.bgTertiary}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          {value !== null && value > 0 && (
            <Path
              d={progressArc}
              stroke={colors.accent}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
            />
          )}
          {/* Inner circle border */}
          <Circle
            cx={center}
            cy={center}
            r={radius - 6}
            stroke={colors.border}
            strokeWidth={1}
            fill="none"
          />
        </Svg>

        {/* Icon positioned at top */}
        <View style={[styles.iconContainer, { top: size * 0.15 }]}>
          {icon}
        </View>

        {/* Value in center */}
        <View style={styles.valueContainer}>
          <Text style={[styles.value, value === null && styles.valueUncalibrated]}>
            {value !== null ? value : '—'}
          </Text>
        </View>
      </View>

      {/* Label below */}
      <Text style={styles.label}>{label}</Text>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`View ${label} details`}
      >
        {dialContent}
      </TouchableOpacity>
    );
  }

  return <View style={styles.container}>{dialContent}</View>;
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  dialWrapper: {
    position: 'relative',
  },
  iconContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  valueContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 6,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  valueUncalibrated: {
    color: colors.textMuted,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 4,
  },
});
