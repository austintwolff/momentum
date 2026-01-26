import { useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '@/constants/Colors';
import { useTrainingFrequency, MuscleFrequency } from '@/hooks/useTrainingFrequency';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = 100;
const CARD_GAP = 8;
const HORIZONTAL_PADDING = 16;

// Mini dial component for muscle cards
function MiniDial({ percentage, isComplete, size = 48 }: {
  percentage: number;
  isComplete: boolean;
  size?: number;
}) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // Arc spans 270 degrees (from 135° to 405°)
  const startAngle = 135;
  const endAngle = 405;
  const totalArcDegrees = endAngle - startAngle;

  // Calculate the progress arc end angle
  const progressDegrees = (percentage / 100) * totalArcDegrees;
  const progressEndAngle = startAngle + progressDegrees;

  const polarToCartesian = (angle: number) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(radians),
      y: center + radius * Math.sin(radians),
    };
  };

  const createArc = (start: number, end: number) => {
    const startPoint = polarToCartesian(start);
    const endPoint = polarToCartesian(end);
    const largeArcFlag = end - start > 180 ? 1 : 0;
    return `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`;
  };

  const backgroundArc = createArc(startAngle, endAngle);
  const progressArc = percentage > 0 ? createArc(startAngle, progressEndAngle) : '';

  // Progress arc is always purple (accent) like the protein tracker
  const progressColor = colors.accent;

  return (
    <View style={[styles.dialWrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background arc - always visible */}
        <Path
          d={backgroundArc}
          stroke={colors.textMuted}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          opacity={0.3}
        />
        {/* Progress arc */}
        {percentage > 0 && (
          <Path
            d={progressArc}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
        )}
      </Svg>
    </View>
  );
}

function MuscleCard({ muscle }: { muscle: MuscleFrequency }) {
  return (
    <View style={styles.card}>
      <MiniDial
        percentage={muscle.percentage}
        isComplete={muscle.isComplete}
      />
      <Text style={styles.sessionsText}>
        <Text style={[
          styles.sessionsCount,
          muscle.isComplete && styles.sessionsCountComplete
        ]}>
          {muscle.sessionsCount}
        </Text>
        <Text style={styles.sessionsDivider}>/</Text>
        <Text style={styles.sessionsTarget}>{muscle.targetSessions}</Text>
      </Text>
      <Text style={styles.muscleName} numberOfLines={1}>
        {muscle.displayName}
      </Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>Complete a workout to see your training frequency</Text>
    </View>
  );
}

function LoadingState() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.card, styles.cardLoading]}>
          <View style={styles.loadingDial} />
          <View style={styles.loadingText} />
          <View style={styles.loadingName} />
        </View>
      ))}
    </ScrollView>
  );
}

export function TrainingFrequency() {
  const { muscles, isLoading } = useTrainingFrequency();
  const scrollRef = useRef<ScrollView>(null);

  // Check if all muscles have 0 sessions (no data)
  const hasData = muscles.some(m => m.sessionsCount > 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Training Frequency</Text>
        <Text style={styles.subtitle}>Past 2 weeks</Text>
      </View>

      {isLoading ? (
        <LoadingState />
      ) : !hasData ? (
        <EmptyState />
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          decelerationRate="fast"
          snapToAlignment="start"
        >
          {muscles.map((muscle) => (
            <MuscleCard key={muscle.muscle} muscle={muscle} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.bgTertiary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  cardLoading: {
    opacity: 0.5,
  },
  dialWrapper: {
    position: 'relative',
  },
  sessionsText: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sessionsCount: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  sessionsCountComplete: {
    color: colors.accent,
  },
  sessionsDivider: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textMuted,
  },
  sessionsTarget: {
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: colors.textMuted,
  },
  muscleName: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyState: {
    paddingHorizontal: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loadingDial: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgSecondary,
  },
  loadingText: {
    width: 30,
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.bgSecondary,
  },
  loadingName: {
    width: 60,
    height: 12,
    borderRadius: 4,
    backgroundColor: colors.bgSecondary,
  },
});
