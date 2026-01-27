/**
 * Workout Score Calculation Fixtures & Sanity Tests
 *
 * Run with: npx ts-node services/__tests__/workout-score.fixtures.ts
 * Or import and use in development for manual testing
 */

import { calculateOneRepMax } from '@/lib/points-engine';

// ============================================================================
// SCORING CONSTANTS (mirrored from service for validation)
// ============================================================================

const EPR_MIN_REPS = 3;
const EPR_MAX_REPS = 12;
const EPR_MIN_PERCENT_IMPROVEMENT = 0.01;
const EPR_MIN_ABSOLUTE_IMPROVEMENT_KG = 1.0;

const BASE_EPR_VALUE = 12;
const BASE_WPR_VALUE = 6;
const PR_MULTIPLIERS = [1.0, 0.85, 0.70, 0.55, 0.45, 0.35, 0.30, 0.25, 0.22, 0.20];

const CLOSENESS_BRACKETS = [
  { min: 1.00, points: 1.00 },
  { min: 0.98, points: 0.80 },
  { min: 0.95, points: 0.53 },
  { min: 0.90, points: 0.27 },
  { min: 0.00, points: 0.00 },
];

// ============================================================================
// FIXTURE TYPES
// ============================================================================

interface MockSetData {
  exerciseId: string;
  exerciseName: string;
  weightKg: number | null;
  reps: number;
  setType: 'warmup' | 'working' | 'dropset' | 'failure';
  isBodyweight: boolean;
}

interface MockExerciseData {
  exerciseId: string;
  exerciseName: string;
  priorMaxWeight: number;
  baselineE1RM: number | null;
  todayBestE1RM: number | null;
  didWeightPR: boolean;
  didEPRPR: boolean;
  closenessRatio: number | null;
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

function calculateWorkScoreFromSets(sets: MockSetData[]): { workScore: number; effectiveSetCount: number } {
  let effectiveSetCount = 0;
  for (const set of sets) {
    const weight = set.setType === 'warmup' ? 0.25 : 1.0;
    effectiveSetCount += weight;
  }

  let workScore: number;
  if (effectiveSetCount < 6) {
    workScore = (effectiveSetCount / 6) * 10;
  } else if (effectiveSetCount <= 12) {
    workScore = 10 + ((effectiveSetCount - 6) / 6) * 15;
  } else if (effectiveSetCount <= 20) {
    workScore = 25 + ((effectiveSetCount - 12) / 8) * 15;
  } else {
    workScore = 40;
  }

  return {
    workScore: Math.min(40, Math.max(0, Math.round(workScore))),
    effectiveSetCount,
  };
}

function calculateClosenessPoints(closeness: number): number {
  for (const bracket of CLOSENESS_BRACKETS) {
    if (closeness >= bracket.min) {
      return bracket.points;
    }
  }
  return 0;
}

function calculateProgressScoreFromExercises(exercises: MockExerciseData[]): number {
  const prEvents: { type: 'epr' | 'weight'; value: number }[] = [];

  for (const exercise of exercises) {
    if (exercise.didEPRPR) {
      prEvents.push({ type: 'epr', value: BASE_EPR_VALUE });
    }
  }
  for (const exercise of exercises) {
    if (exercise.didWeightPR) {
      prEvents.push({ type: 'weight', value: BASE_WPR_VALUE });
    }
  }

  let prPoints = 0;
  for (let i = 0; i < prEvents.length; i++) {
    const multiplier = i < PR_MULTIPLIERS.length ? PR_MULTIPLIERS[i] : 0.20;
    prPoints += prEvents[i].value * multiplier;
  }
  const prComponent = Math.min(40, Math.round(prPoints));

  const exercisesWithBaseline = exercises.filter(e =>
    e.baselineE1RM !== null && e.closenessRatio !== null
  );

  let closenessAggregateRatio = 0;
  if (exercisesWithBaseline.length > 0) {
    let totalPoints = 0;
    for (const exercise of exercisesWithBaseline) {
      totalPoints += calculateClosenessPoints(exercise.closenessRatio!);
    }
    closenessAggregateRatio = totalPoints / exercisesWithBaseline.length;
  }

  const closenessScore = Math.min(15, Math.round(15 * closenessAggregateRatio));

  return Math.min(55, prComponent + closenessScore);
}

function getConsistencyScore(workoutsLast7Days: number): number {
  if (workoutsLast7Days >= 4) return 5;
  if (workoutsLast7Days === 3) return 4;
  if (workoutsLast7Days === 2) return 3;
  if (workoutsLast7Days === 1) return 1;
  return 0;
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

export const TEST_FIXTURES = {
  /**
   * Scenario 1: New exercise first time
   * - No baseline → no EPR PR possible
   * - No prior max → Weight PR IS possible
   */
  newExerciseFirstTime: {
    exercises: [{
      exerciseId: '1',
      exerciseName: 'New Exercise',
      priorMaxWeight: 0,
      baselineE1RM: null,
      todayBestE1RM: 100,
      didWeightPR: true,
      didEPRPR: false,
      closenessRatio: null,
    }] as MockExerciseData[],
    expectedProgressScore: 6, // Only Weight PR: 6 * 1.0
  },

  /**
   * Scenario 2: Second time with improvement
   * - Baseline exists → EPR PR can trigger
   */
  secondTimeImprovement: {
    exercises: [{
      exerciseId: '1',
      exerciseName: 'Bench Press',
      priorMaxWeight: 100,
      baselineE1RM: 120,
      todayBestE1RM: 123,
      didWeightPR: false,
      didEPRPR: true,
      closenessRatio: 1.025,
    }] as MockExerciseData[],
    expectedProgressScore: 27, // EPR: 12 + closeness: 15
  },

  /**
   * Scenario 3: Heavy single (1 rep)
   * - Weight PR yes (if exceeded)
   * - EPR ignored (reps < 3)
   */
  heavySingle: {
    exercises: [{
      exerciseId: '1',
      exerciseName: 'Squat',
      priorMaxWeight: 180,
      baselineE1RM: 190,
      todayBestE1RM: null, // No eligible sets
      didWeightPR: true,
      didEPRPR: false,
      closenessRatio: null,
    }] as MockExerciseData[],
    expectedProgressScore: 6, // Only Weight PR
  },

  /**
   * Scenario 4: High volume workout
   * - 18 working sets → work score near 40
   */
  highVolume: {
    sets: Array(18).fill(null).map((_, i) => ({
      exerciseId: 'ex1',
      exerciseName: 'Various',
      weightKg: 100,
      reps: 8,
      setType: 'working' as const,
      isBodyweight: false,
    })),
    expectedWorkScore: { min: 35, max: 40 },
  },

  /**
   * Scenario 5: Low effort day
   * - 4 sets, no PRs, closeness below threshold
   */
  lowEffort: {
    sets: Array(4).fill(null).map((_, i) => ({
      exerciseId: 'ex1',
      exerciseName: 'Bench',
      weightKg: 80,
      reps: 8,
      setType: 'working' as const,
      isBodyweight: false,
    })),
    exercises: [{
      exerciseId: 'ex1',
      exerciseName: 'Bench',
      priorMaxWeight: 100,
      baselineE1RM: 130,
      todayBestE1RM: 107,
      didWeightPR: false,
      didEPRPR: false,
      closenessRatio: 0.82,
    }] as MockExerciseData[],
    workoutsLast7Days: 1,
    expectedFinalScore: { max: 15 },
  },
};

// ============================================================================
// VALIDATION RUNNER
// ============================================================================

export function runSanityTests(): { passed: number; failed: number; results: string[] } {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  // Test 1: New exercise
  const test1Progress = calculateProgressScoreFromExercises(TEST_FIXTURES.newExerciseFirstTime.exercises);
  if (test1Progress === TEST_FIXTURES.newExerciseFirstTime.expectedProgressScore) {
    passed++;
    results.push('✓ Scenario 1: New exercise first time - PASSED');
  } else {
    failed++;
    results.push(`✗ Scenario 1: Expected progress ${TEST_FIXTURES.newExerciseFirstTime.expectedProgressScore}, got ${test1Progress}`);
  }

  // Test 2: Second time improvement
  const test2Progress = calculateProgressScoreFromExercises(TEST_FIXTURES.secondTimeImprovement.exercises);
  if (test2Progress === TEST_FIXTURES.secondTimeImprovement.expectedProgressScore) {
    passed++;
    results.push('✓ Scenario 2: Second time improvement - PASSED');
  } else {
    failed++;
    results.push(`✗ Scenario 2: Expected progress ${TEST_FIXTURES.secondTimeImprovement.expectedProgressScore}, got ${test2Progress}`);
  }

  // Test 3: Heavy single
  const test3Progress = calculateProgressScoreFromExercises(TEST_FIXTURES.heavySingle.exercises);
  if (test3Progress === TEST_FIXTURES.heavySingle.expectedProgressScore) {
    passed++;
    results.push('✓ Scenario 3: Heavy single - PASSED');
  } else {
    failed++;
    results.push(`✗ Scenario 3: Expected progress ${TEST_FIXTURES.heavySingle.expectedProgressScore}, got ${test3Progress}`);
  }

  // Test 4: High volume
  const test4Work = calculateWorkScoreFromSets(TEST_FIXTURES.highVolume.sets);
  if (test4Work.workScore >= TEST_FIXTURES.highVolume.expectedWorkScore.min &&
      test4Work.workScore <= TEST_FIXTURES.highVolume.expectedWorkScore.max) {
    passed++;
    results.push(`✓ Scenario 4: High volume (work score ${test4Work.workScore}) - PASSED`);
  } else {
    failed++;
    results.push(`✗ Scenario 4: Expected work ${TEST_FIXTURES.highVolume.expectedWorkScore.min}-${TEST_FIXTURES.highVolume.expectedWorkScore.max}, got ${test4Work.workScore}`);
  }

  // Test 5: Low effort
  const test5Work = calculateWorkScoreFromSets(TEST_FIXTURES.lowEffort.sets);
  const test5Progress = calculateProgressScoreFromExercises(TEST_FIXTURES.lowEffort.exercises);
  const test5Consistency = getConsistencyScore(TEST_FIXTURES.lowEffort.workoutsLast7Days);
  const test5Final = Math.max(1, test5Work.workScore + test5Progress + test5Consistency);
  if (test5Final <= TEST_FIXTURES.lowEffort.expectedFinalScore.max) {
    passed++;
    results.push(`✓ Scenario 5: Low effort (final ${test5Final}) - PASSED`);
  } else {
    failed++;
    results.push(`✗ Scenario 5: Expected final <= ${TEST_FIXTURES.lowEffort.expectedFinalScore.max}, got ${test5Final}`);
  }

  // E1RM calculation test
  const e1rm = calculateOneRepMax(100, 8);
  if (Math.abs(e1rm - 126.67) < 0.1) {
    passed++;
    results.push('✓ E1RM calculation (Epley formula) - PASSED');
  } else {
    failed++;
    results.push(`✗ E1RM calculation: Expected ~126.67, got ${e1rm}`);
  }

  return { passed, failed, results };
}

// Run if executed directly
if (require.main === module) {
  console.log('Running Workout Score Sanity Tests...\n');
  const { passed, failed, results } = runSanityTests();
  results.forEach(r => console.log(r));
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
