import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors } from '@/constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DIALOG_WIDTH = Math.min(SCREEN_WIDTH - 48, 340);

export type ScoreType = 'progression' | 'load' | 'consistency';

interface ScoreDetailPopupProps {
  visible: boolean;
  scoreType: ScoreType | null;
  score: number | null;
  onClose: () => void;
}

// Icons for each score type
function ProgressionIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="14" width="4" height="6" rx="1" fill={colors.accent} />
      <Rect x="10" y="10" width="4" height="10" rx="1" fill={colors.accent} />
      <Rect x="16" y="4" width="4" height="16" rx="1" fill={colors.accent} />
    </Svg>
  );
}

function LoadIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4H8V6H16V4H18V6H19C19.5523 6 20 6.44772 20 7V9H4V7C4 6.44772 4.44772 6 5 6H6V4Z"
        fill={colors.accent}
      />
      <Path
        d="M4 10H20V17C20 18.1046 19.1046 19 18 19H6C4.89543 19 4 18.1046 4 17V10Z"
        fill={colors.accent}
      />
    </Svg>
  );
}

function ConsistencyIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={colors.accent} strokeWidth={2} />
      <Path
        d="M8 12L11 15L16 9"
        stroke={colors.accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface BreakdownRowProps {
  label: string;
  value: string;
  progress: number; // 0-1
  hint: string;
}

function BreakdownRow({ label, value, progress, hint }: BreakdownRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(progress * 100, 100)}%` },
            ]}
          />
        </View>
      </View>
      <Text style={styles.rowHint}>{hint}</Text>
    </View>
  );
}

// Generate breakdown data based on score type and value
function getProgressionBreakdown(score: number) {
  // Estimate values based on score
  // Score is: 65% * PR component + 35% * Near-PR component
  const prCount = score >= 80 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : score >= 20 ? 1 : 0;
  const nearPRCount = score >= 70 ? 5 : score >= 50 ? 3 : score >= 30 ? 2 : score >= 15 ? 1 : 0;
  const avgCloseness = Math.min(90 + (score / 10), 100);

  return [
    {
      label: 'Personal Records',
      value: prCount === 0 ? 'None' : `${prCount} PR${prCount > 1 ? 's' : ''}`,
      progress: Math.min(prCount / 4, 1),
      hint: prCount >= 3 ? 'Incredible progress!' : prCount >= 1 ? 'Keep pushing your limits' : 'Focus on beating past performances',
    },
    {
      label: 'Near-PR Lifts',
      value: nearPRCount === 0 ? 'None' : `${nearPRCount} lift${nearPRCount > 1 ? 's' : ''}`,
      progress: Math.min(nearPRCount / 5, 1),
      hint: nearPRCount >= 3 ? 'Close to breaking through!' : nearPRCount >= 1 ? 'Almost there on several lifts' : 'Train closer to your max',
    },
    {
      label: 'Avg. Closeness to PR',
      value: score > 0 ? `${Math.round(avgCloseness)}%` : '--',
      progress: avgCloseness / 100,
      hint: avgCloseness >= 95 ? 'Training at peak intensity' : avgCloseness >= 90 ? 'Strong effort' : 'Room to push harder',
    },
    {
      label: 'Progress Trend',
      value: score >= 60 ? 'Improving' : score >= 30 ? 'Maintaining' : 'Building',
      progress: score / 100,
      hint: score >= 60 ? 'Consistent improvements' : score >= 30 ? 'Steady baseline work' : 'Foundation phase',
    },
  ];
}

function getLoadBreakdown(score: number) {
  // Estimate values based on score
  // Score is normalized ratio of current vs baseline load
  const workingSets = Math.round(10 + (score / 100) * 15);
  const loadRatio = 50 + (score / 100) * 75; // 50% to 125% of baseline
  const exerciseCount = Math.round(3 + (score / 100) * 5);

  return [
    {
      label: 'Working Sets',
      value: `${workingSets} sets`,
      progress: Math.min(workingSets / 25, 1),
      hint: workingSets >= 20 ? 'High volume session' : workingSets >= 15 ? 'Solid volume' : workingSets >= 10 ? 'Moderate volume' : 'Light session',
    },
    {
      label: 'Load vs Baseline',
      value: `${Math.round(loadRatio)}%`,
      progress: Math.min(loadRatio / 125, 1),
      hint: loadRatio >= 100 ? 'Exceeding your baseline!' : loadRatio >= 85 ? 'Maintaining well' : 'Room to increase load',
    },
    {
      label: 'Exercises Completed',
      value: `${exerciseCount} exercises`,
      progress: Math.min(exerciseCount / 8, 1),
      hint: exerciseCount >= 6 ? 'Great coverage' : exerciseCount >= 4 ? 'Good variety' : 'Focused session',
    },
    {
      label: 'Training Intensity',
      value: score >= 75 ? 'High' : score >= 50 ? 'Moderate' : score >= 25 ? 'Light' : 'Recovery',
      progress: score / 100,
      hint: score >= 75 ? 'Pushing your limits' : score >= 50 ? 'Balanced training' : 'Active recovery phase',
    },
  ];
}

function getConsistencyBreakdown(score: number) {
  // Estimate values based on score
  // Score is: 45% frequency + 20% gap + 35% coverage
  const workouts = Math.round(1 + (score / 100) * 9);
  const maxGap = Math.max(1, Math.round(10 - (score / 100) * 7));
  const muscleGroups = Math.round(3 + (score / 100) * 9);
  const coveragePercent = Math.round(25 + (score / 100) * 75);

  return [
    {
      label: 'Workouts (14 days)',
      value: `${workouts} of 10`,
      progress: workouts / 10,
      hint: workouts >= 8 ? 'Crushing it!' : workouts >= 5 ? 'Good rhythm' : workouts >= 3 ? 'Building habit' : 'Get back at it',
    },
    {
      label: 'Longest Gap',
      value: `${maxGap} day${maxGap > 1 ? 's' : ''}`,
      progress: Math.max(0, 1 - (maxGap - 1) / 9),
      hint: maxGap <= 2 ? 'No long breaks' : maxGap <= 4 ? 'Minor gaps' : 'Try for shorter breaks',
    },
    {
      label: 'Muscle Groups Hit',
      value: `${muscleGroups} of 12`,
      progress: muscleGroups / 12,
      hint: muscleGroups >= 10 ? 'Full body coverage' : muscleGroups >= 6 ? 'Good variety' : 'Hit more groups',
    },
    {
      label: 'Coverage Score',
      value: `${coveragePercent}%`,
      progress: coveragePercent / 100,
      hint: coveragePercent >= 80 ? 'Balanced training' : coveragePercent >= 50 ? 'Decent spread' : 'Focus on weak areas',
    },
  ];
}

function getScoreTitle(type: ScoreType): string {
  switch (type) {
    case 'progression':
      return 'Progression';
    case 'load':
      return 'Load';
    case 'consistency':
      return 'Consistency';
  }
}

function getScoreIcon(type: ScoreType) {
  switch (type) {
    case 'progression':
      return <ProgressionIcon />;
    case 'load':
      return <LoadIcon />;
    case 'consistency':
      return <ConsistencyIcon />;
  }
}

function getScoreDescription(type: ScoreType): string {
  switch (type) {
    case 'progression':
      return 'Measures PRs and near-PR performance over the past 14 days';
    case 'load':
      return 'Tracks training volume compared to your baseline';
    case 'consistency':
      return 'Evaluates workout frequency and muscle coverage';
  }
}

function getBreakdownData(type: ScoreType, score: number) {
  switch (type) {
    case 'progression':
      return getProgressionBreakdown(score);
    case 'load':
      return getLoadBreakdown(score);
    case 'consistency':
      return getConsistencyBreakdown(score);
  }
}


export default function ScoreDetailPopup({
  visible,
  scoreType,
  score,
  onClose,
}: ScoreDetailPopupProps) {
  if (!scoreType || score === null) return null;

  const breakdownData = getBreakdownData(scoreType, score);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrapper}>
              {getScoreIcon(scoreType)}
            </View>
            <Text style={styles.title}>{getScoreTitle(scoreType)}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close"
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
                <Path d="M6 6L18 18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Score display */}
          <View style={styles.scoreSection}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreMax}>/ 100</Text>
          </View>

          <Text style={styles.description}>{getScoreDescription(scoreType)}</Text>

          {/* Breakdown rows */}
          <View style={styles.breakdown}>
            {breakdownData.map((item, index) => (
              <View key={item.label}>
                <BreakdownRow {...item} />
                {index < breakdownData.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrapper: {
    marginRight: 10,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: colors.accent,
  },
  scoreMax: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textMuted,
    marginLeft: 4,
  },
  description: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  breakdown: {
    backgroundColor: colors.bgTertiary,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  row: {
    paddingVertical: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  progressContainer: {
    marginBottom: 4,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgSecondary,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  rowHint: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
