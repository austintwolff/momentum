import { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';
import { colors } from '@/constants/Colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DIALOG_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
const DIALOG_HEIGHT = SCREEN_HEIGHT * 0.75;
const PAGE_WIDTH = DIALOG_WIDTH - 40; // Account for dialog padding

interface TutorialModalProps {
  visible: boolean;
  onClose: () => void;
}

// Define styles first so they can be used in components below
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
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  scrollViewWrapper: {
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    // No padding - wrapper handles margins
  },
  pageWrapper: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: colors.bgSecondary,
  },
  page: {
    alignItems: 'center',
    gap: 16,
  },
  logoIllustration: {
    marginVertical: 16,
  },
  illustration: {
    marginVertical: 12,
    alignItems: 'center',
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accent,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  dialList: {
    width: '100%',
    gap: 10,
  },
  dialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.bgTertiary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dialIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialTextContainer: {
    flex: 1,
  },
  dialLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  dialDesc: {
    fontSize: 13,
    color: colors.textMuted,
  },
  // Goal card styles
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgTertiary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  goalCardComplete: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
  },
  goalContent: {
    flex: 1,
  },
  goalText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  goalTextMuted: {
    color: colors.textSecondary,
  },
  goalBadge: {
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  goalBadgeComplete: {
    backgroundColor: colors.accent,
  },
  goalBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  goalBadgeTextComplete: {
    color: colors.textPrimary,
  },
  steps: {
    width: '100%',
    gap: 10,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.bgTertiary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  stepIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 13,
    color: colors.textMuted,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
    opacity: 0.3,
  },
  dotActive: {
    backgroundColor: colors.accent,
    opacity: 1,
  },
  nextButton: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

// Close icon
function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      <Path d="M6 6L18 18" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Dial card icons
function ProgressionCardIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="14" width="4" height="6" rx="1" fill={colors.accent} />
      <Rect x="10" y="10" width="4" height="10" rx="1" fill={colors.accent} />
      <Rect x="16" y="4" width="4" height="16" rx="1" fill={colors.accent} />
    </Svg>
  );
}

function LoadCardIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="10" width="18" height="4" rx="2" fill={colors.accent} />
      <Rect x="6" y="7" width="3" height="10" rx="1.5" fill={colors.accent} />
      <Rect x="15" y="7" width="3" height="10" rx="1.5" fill={colors.accent} />
    </Svg>
  );
}

function ConsistencyCardIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={colors.accent} strokeWidth={2} fill="none" />
      <Path d="M8 12L11 15L16 9" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Goal icons for Page 3
function TargetIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={colors.accent} strokeWidth={2} fill="none" />
      <Circle cx="12" cy="12" r="5" stroke={colors.accent} strokeWidth={2} fill="none" />
      <Circle cx="12" cy="12" r="1.5" fill={colors.accent} />
    </Svg>
  );
}

function CheckCircleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" fill={colors.accent} />
      <Path d="M8 12L11 15L16 9" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Step icons for Page 4
function SearchIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={colors.accent} strokeWidth={2} fill="none" />
      <Path d="M16 16L20 20" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function EditIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20H21" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
      <Path d="M16.5 3.5C16.8978 3.10217 17.4374 2.87868 18 2.87868C18.2786 2.87868 18.5544 2.93355 18.8118 3.04016C19.0692 3.14676 19.303 3.30301 19.5 3.5C19.697 3.69698 19.8532 3.93083 19.9598 4.18821C20.0665 4.44558 20.1213 4.72142 20.1213 5C20.1213 5.27857 20.0665 5.55442 19.9598 5.81179C19.8532 6.06916 19.697 6.30301 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TrendingUpIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M23 6L13.5 15.5L8.5 10.5L1 18" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17 6H23V12" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Logo illustration for Page 1
function LogoIllustration() {
  return (
    <View style={styles.logoIllustration}>
      <Svg width={80} height={80} viewBox="0 0 80 80">
        <Circle cx="40" cy="40" r="36" fill={colors.accent} opacity={0.15} />
        <Circle cx="40" cy="40" r="24" fill={colors.accent} opacity={0.3} />
        <G transform="translate(40, 40)">
          {/* Stylized M */}
          <Path
            d="M-16 8 L-16 -8 L-8 2 L0 -8 L8 2 L16 -8 L16 8"
            stroke={colors.accent}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      </Svg>
    </View>
  );
}

interface TutorialPageProps {
  children: React.ReactNode;
}

function TutorialPage({ children }: TutorialPageProps) {
  return <View style={styles.page}>{children}</View>;
}

// Page 1: Welcome
function WelcomePage() {
  return (
    <TutorialPage>
      <LogoIllustration />
      <Text style={styles.tagline}>Track your lifting progress</Text>
      <Text style={styles.body}>
        Momentum helps you build strength consistently by tracking what matters: your progression, training load, and consistency.
      </Text>
    </TutorialPage>
  );
}

// Page 2: Score Dials
function DialsPage() {
  return (
    <TutorialPage>
      <Text style={styles.body}>
        Three scores show your training health at a glance.
      </Text>
      <View style={styles.dialList}>
        <View style={styles.dialCard}>
          <View style={styles.dialIconWrapper}>
            <ProgressionCardIcon />
          </View>
          <View style={styles.dialTextContainer}>
            <Text style={styles.dialLabel}>Progression</Text>
            <Text style={styles.dialDesc}>PRs and near-PR performance</Text>
          </View>
        </View>
        <View style={styles.dialCard}>
          <View style={styles.dialIconWrapper}>
            <LoadCardIcon />
          </View>
          <View style={styles.dialTextContainer}>
            <Text style={styles.dialLabel}>Load</Text>
            <Text style={styles.dialDesc}>Training volume vs baseline</Text>
          </View>
        </View>
        <View style={styles.dialCard}>
          <View style={styles.dialIconWrapper}>
            <ConsistencyCardIcon />
          </View>
          <View style={styles.dialTextContainer}>
            <Text style={styles.dialLabel}>Consistency</Text>
            <Text style={styles.dialDesc}>Workout frequency & coverage</Text>
          </View>
        </View>
      </View>
      <Text style={styles.hint}>Tap any dial on the home screen for details</Text>
    </TutorialPage>
  );
}

// Page 3: Daily Goals
function GoalsPage() {
  return (
    <TutorialPage>
      <Text style={styles.body}>
        Complete daily goals during your workout to boost your scores.
      </Text>
      <View style={styles.dialList}>
        {/* Completed goal example */}
        <View style={[styles.goalCard, styles.goalCardComplete]}>
          <CheckCircleIcon />
          <View style={styles.goalContent}>
            <Text style={styles.goalText}>Beat your bench press PR</Text>
          </View>
          <View style={[styles.goalBadge, styles.goalBadgeComplete]}>
            <Text style={[styles.goalBadgeText, styles.goalBadgeTextComplete]}>+5</Text>
          </View>
        </View>
        {/* Pending goal examples */}
        <View style={styles.goalCard}>
          <TargetIcon />
          <View style={styles.goalContent}>
            <Text style={[styles.goalText, styles.goalTextMuted]}>Complete 12 working sets</Text>
          </View>
          <View style={styles.goalBadge}>
            <Text style={styles.goalBadgeText}>+5</Text>
          </View>
        </View>
        <View style={styles.goalCard}>
          <TargetIcon />
          <View style={styles.goalContent}>
            <Text style={[styles.goalText, styles.goalTextMuted]}>Train legs today</Text>
          </View>
          <View style={styles.goalBadge}>
            <Text style={styles.goalBadgeText}>+5</Text>
          </View>
        </View>
      </View>
      <Text style={styles.hint}>Goals refresh daily based on your training</Text>
    </TutorialPage>
  );
}

// Page 4: Start Training
function StartPage() {
  return (
    <TutorialPage>
      <Text style={styles.body}>
        Tap the Start Workout button on the home screen to begin.
      </Text>
      <View style={styles.steps}>
        <View style={styles.stepCard}>
          <View style={styles.stepIconWrapper}>
            <SearchIcon />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Select exercises</Text>
            <Text style={styles.stepDesc}>Choose from 100+ exercises</Text>
          </View>
        </View>
        <View style={styles.stepCard}>
          <View style={styles.stepIconWrapper}>
            <EditIcon />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Log your sets</Text>
            <Text style={styles.stepDesc}>Record weight and reps</Text>
          </View>
        </View>
        <View style={styles.stepCard}>
          <View style={styles.stepIconWrapper}>
            <TrendingUpIcon />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Track your progress</Text>
            <Text style={styles.stepDesc}>Watch your scores climb</Text>
          </View>
        </View>
      </View>
    </TutorialPage>
  );
}

const PAGES = [
  { id: 'welcome', title: 'Welcome to Momentum', Component: WelcomePage },
  { id: 'dials', title: 'Score Dials', Component: DialsPage },
  { id: 'goals', title: 'Daily Goals', Component: GoalsPage },
  { id: 'start', title: 'Start Training', Component: StartPage },
];

export default function TutorialModal({ visible, onClose }: TutorialModalProps) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / PAGE_WIDTH);
    if (page >= 0 && page < PAGES.length) {
      setCurrentPage(page);
    }
  };

  const goToPage = (page: number) => {
    scrollViewRef.current?.scrollTo({
      x: page * PAGE_WIDTH,
      animated: true,
    });
    setCurrentPage(page);
  };

  const handleNext = () => {
    if (currentPage < PAGES.length - 1) {
      goToPage(currentPage + 1);
    } else {
      onClose();
    }
  };

  const handleClose = () => {
    setCurrentPage(0);
    scrollViewRef.current?.scrollTo({ x: 0, animated: false });
    onClose();
  };

  const isLastPage = currentPage === PAGES.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View
          style={[
            styles.dialog,
            {
              maxHeight: DIALOG_HEIGHT,
              marginTop: insets.top + 20,
              marginBottom: insets.bottom + 20,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{PAGES[currentPage].title}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityLabel="Close tutorial"
            >
              <CloseIcon />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.scrollViewWrapper}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              snapToInterval={PAGE_WIDTH}
              decelerationRate="fast"
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
            >
              {PAGES.map((page) => (
                <View key={page.id} style={[styles.pageWrapper, { width: PAGE_WIDTH }]}>
                  <page.Component />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {/* Page indicators */}
            <View style={styles.dots}>
              {PAGES.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => goToPage(index)}
                  style={[styles.dot, currentPage === index && styles.dotActive]}
                  accessibilityLabel={`Go to page ${index + 1}`}
                />
              ))}
            </View>

            {/* Next/Done button */}
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              accessibilityLabel={isLastPage ? 'Get started' : 'Next page'}
            >
              <Text style={styles.nextButtonText}>
                {isLastPage ? 'Get Started' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
