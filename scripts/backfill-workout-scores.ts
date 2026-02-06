/**
 * Backfill Workout Scores Script
 *
 * Run this script to calculate and save workout scores for workouts
 * that don't have a final_score yet.
 *
 * Usage: npx ts-node scripts/backfill-workout-scores.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env file
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.EXPO_PUBLIC_SUPABASE_URL || 'https://zrjsbkpzqnkzdustqvgf.supabase.co';
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('Missing Supabase key in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// E1RM calculation using Brzycki formula
function calculateOneRepMax(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps > 12) reps = 12;
  return weight * (36 / (37 - reps));
}

// Constants from workout-score.service.ts
const EPR_MIN_REPS = 1;
const EPR_MAX_REPS = 12;
const EPR_MIN_PERCENT_IMPROVEMENT = 0.01;
const EPR_MIN_ABSOLUTE_IMPROVEMENT_KG = 1.0;

const BASE_EPR_VALUE = 10;
const BASE_WPR_VALUE = 8;
const PR_MULTIPLIERS = [1.0, 0.85, 0.70, 0.55, 0.45, 0.35, 0.30, 0.25, 0.22, 0.20];

const CLOSENESS_BRACKETS = [
  { min: 1.00, points: 1.00 },
  { min: 0.98, points: 0.85 },
  { min: 0.95, points: 0.65 },
  { min: 0.90, points: 0.45 },
  { min: 0.85, points: 0.30 },
  { min: 0.80, points: 0.15 },
  { min: 0.00, points: 0.00 },
];

const CLOSENESS_MAX = 25;
const NO_BASELINE_CLOSENESS_POINTS = 0.5;
const NEAR_PR_BONUS = 3;
const NEAR_PR_MAX = 9;

const MAINTENANCE_BONUS_TIERS = [
  { minCloseness: 0.95, points: 19 },
  { minCloseness: 0.90, points: 16 },
  { minCloseness: 0.85, points: 12 },
  { minCloseness: 0.80, points: 6 },
];
const MAINTENANCE_PR_DIVISOR = 40;

interface SetData {
  exercise_id: string;
  exercise_name: string;
  weight_kg: number | null;
  reps: number;
  set_type: string;
}

interface ExerciseData {
  exerciseId: string;
  exerciseName: string;
  sets: SetData[];
  priorMaxWeight: number;
  baselineE1RM: number | null;
  todayBestE1RM: number | null;
  didWeightPR: boolean;
  didEPRPR: boolean;
  closenessRatio: number | null;
}

async function fetchPriorMaxWeights(
  userId: string,
  exerciseIds: string[],
  beforeDate: Date
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (exerciseIds.length === 0) return result;

  const { data, error } = await supabase
    .from('workout_sets')
    .select(`
      exercise_id,
      weight_kg,
      workout_sessions!inner(user_id, completed_at)
    `)
    .in('exercise_id', exerciseIds)
    .eq('workout_sessions.user_id', userId)
    .lt('workout_sessions.completed_at', beforeDate.toISOString())
    .not('weight_kg', 'is', null);

  if (error) {
    console.error('Error fetching prior max weights:', error);
    return result;
  }

  for (const row of (data || []) as any[]) {
    const current = result.get(row.exercise_id) || 0;
    if (row.weight_kg > current) {
      result.set(row.exercise_id, row.weight_kg);
    }
  }

  return result;
}

async function fetchBaselineE1RMs(
  userId: string,
  exerciseIds: string[],
  beforeDate: Date
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (exerciseIds.length === 0) return result;

  const thirtyDaysAgo = new Date(beforeDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('workout_sets')
    .select(`
      exercise_id,
      weight_kg,
      reps,
      workout_sessions!inner(user_id, completed_at)
    `)
    .in('exercise_id', exerciseIds)
    .eq('workout_sessions.user_id', userId)
    .lt('workout_sessions.completed_at', beforeDate.toISOString())
    .gte('workout_sessions.completed_at', thirtyDaysAgo.toISOString())
    .gte('reps', EPR_MIN_REPS)
    .lte('reps', EPR_MAX_REPS)
    .not('weight_kg', 'is', null);

  if (error) {
    console.error('Error fetching baseline E1RMs:', error);
    return result;
  }

  for (const row of (data || []) as any[]) {
    const e1rm = calculateOneRepMax(row.weight_kg, row.reps);
    const current = result.get(row.exercise_id) || 0;
    if (e1rm > current) {
      result.set(row.exercise_id, e1rm);
    }
  }

  return result;
}

async function getWorkoutsInLast7Days(userId: string, beforeDate: Date): Promise<number> {
  const sevenDaysAgo = new Date(beforeDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('workout_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .gte('completed_at', sevenDaysAgo.toISOString())
    .lt('completed_at', beforeDate.toISOString());

  if (error) {
    console.error('Error fetching workout count:', error);
    return 0;
  }

  return count || 0;
}

function calculateClosenessAggregate(exercises: ExerciseData[]): number {
  if (exercises.length === 0) return 0;

  let totalPoints = 0;
  for (const exercise of exercises) {
    if (exercise.baselineE1RM === null || exercise.closenessRatio === null) {
      totalPoints += NO_BASELINE_CLOSENESS_POINTS;
      continue;
    }

    const closeness = exercise.closenessRatio;
    let pointsRatio = 0;

    for (const bracket of CLOSENESS_BRACKETS) {
      if (closeness >= bracket.min) {
        pointsRatio = bracket.points;
        break;
      }
    }

    totalPoints += pointsRatio;
  }

  return totalPoints / exercises.length;
}

function calculateProgressScore(exercises: ExerciseData[]): { progressScore: number; prPoints: number } {
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
  const closenessAggregateRatio = calculateClosenessAggregate(exercises);
  const closenessScore = Math.min(CLOSENESS_MAX, Math.round(CLOSENESS_MAX * closenessAggregateRatio));

  let nearPRBonus = 0;
  for (const exercise of exercises) {
    if (exercise.closenessRatio !== null &&
        exercise.closenessRatio >= 0.98 &&
        exercise.closenessRatio < 1.00 &&
        !exercise.didEPRPR) {
      nearPRBonus += NEAR_PR_BONUS;
    }
  }
  nearPRBonus = Math.min(NEAR_PR_MAX, nearPRBonus);

  const progressScore = Math.min(55, prComponent + closenessScore + nearPRBonus);

  return { progressScore, prPoints };
}

function calculateMaintenanceBonus(exercises: ExerciseData[], prPoints: number): number {
  const prScaleFactor = Math.max(0, 1 - (prPoints / MAINTENANCE_PR_DIVISOR));
  if (prScaleFactor <= 0) return 0;

  const exercisesWithBaseline = exercises.filter(
    e => e.closenessRatio !== null && e.baselineE1RM !== null
  );

  if (exercisesWithBaseline.length === 0) return 0;

  const avgCloseness = exercisesWithBaseline.reduce(
    (sum, e) => sum + (e.closenessRatio || 0),
    0
  ) / exercisesWithBaseline.length;

  let baseBonus = 0;
  for (const tier of MAINTENANCE_BONUS_TIERS) {
    if (avgCloseness >= tier.minCloseness) {
      baseBonus = tier.points;
      break;
    }
  }

  return Math.round(baseBonus * prScaleFactor);
}

function calculateWorkScore(sets: SetData[]): { workScore: number; effectiveSetCount: number } {
  let effectiveSetCount = 0;
  for (const set of sets) {
    const weight = set.set_type === 'warmup' ? 0.25 : 1.0;
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

function calculateConsistencyScore(workoutCount: number): number {
  if (workoutCount >= 4) return 5;
  if (workoutCount === 3) return 4;
  if (workoutCount === 2) return 3;
  if (workoutCount === 1) return 1;
  return 0;
}

async function calculateScoreForWorkout(
  workout: any,
  sets: SetData[]
): Promise<{
  finalScore: number;
  progressScore: number;
  workScore: number;
  consistencyScore: number;
  effectiveSetCount: number;
  eprPrCount: number;
  weightPrCount: number;
  closenessAggregateRatio: number;
}> {
  const userId = workout.user_id;
  const completedAt = new Date(workout.completed_at);

  // Group sets by exercise
  const exerciseMap = new Map<string, SetData[]>();
  for (const set of sets) {
    const existing = exerciseMap.get(set.exercise_id) || [];
    existing.push(set);
    exerciseMap.set(set.exercise_id, existing);
  }

  const exerciseIds = Array.from(exerciseMap.keys());

  // Fetch historical data
  const [priorMaxWeights, baselineData] = await Promise.all([
    fetchPriorMaxWeights(userId, exerciseIds, completedAt),
    fetchBaselineE1RMs(userId, exerciseIds, completedAt),
  ]);

  // Calculate per-exercise metrics
  const exercises: ExerciseData[] = [];

  for (const [exerciseId, exerciseSets] of exerciseMap) {
    const exerciseName = exerciseSets[0].exercise_name;
    const priorMaxWeight = priorMaxWeights.get(exerciseId) || 0;
    const baselineE1RM = baselineData.get(exerciseId) || null;

    // Calculate today's best E1RM
    let todayBestE1RM: number | null = null;
    for (const set of exerciseSets) {
      if (set.reps >= EPR_MIN_REPS && set.reps <= EPR_MAX_REPS && set.weight_kg !== null) {
        const e1rm = calculateOneRepMax(set.weight_kg, set.reps);
        if (todayBestE1RM === null || e1rm > todayBestE1RM) {
          todayBestE1RM = e1rm;
        }
      }
    }

    // Check for Weight PR
    let didWeightPR = false;
    for (const set of exerciseSets) {
      if (set.weight_kg !== null && set.weight_kg > priorMaxWeight) {
        didWeightPR = true;
        break;
      }
    }

    // Check for EPR PR
    let didEPRPR = false;
    if (baselineE1RM !== null && todayBestE1RM !== null) {
      const percentImprovement = (todayBestE1RM - baselineE1RM) / baselineE1RM;
      const absoluteImprovement = todayBestE1RM - baselineE1RM;

      if (percentImprovement >= EPR_MIN_PERCENT_IMPROVEMENT &&
          absoluteImprovement >= EPR_MIN_ABSOLUTE_IMPROVEMENT_KG) {
        didEPRPR = true;
      }
    }

    // Calculate closeness ratio
    let closenessRatio: number | null = null;
    if (baselineE1RM !== null && todayBestE1RM !== null && baselineE1RM > 0) {
      closenessRatio = Math.min(todayBestE1RM / baselineE1RM, 1.05);
      closenessRatio = Math.max(closenessRatio, 0);
    }

    exercises.push({
      exerciseId,
      exerciseName,
      sets: exerciseSets,
      priorMaxWeight,
      baselineE1RM,
      todayBestE1RM,
      didWeightPR,
      didEPRPR,
      closenessRatio,
    });
  }

  // Count PRs
  const nEPR = exercises.filter(e => e.didEPRPR).length;
  const nWPR = exercises.filter(e => e.didWeightPR).length;

  // Calculate scores
  const { progressScore, prPoints } = calculateProgressScore(exercises);
  const { workScore, effectiveSetCount } = calculateWorkScore(sets);

  const workoutCountBefore = await getWorkoutsInLast7Days(userId, completedAt);
  const consistencyScore = calculateConsistencyScore(workoutCountBefore + 1);

  const closenessAggregateRatio = calculateClosenessAggregate(exercises);
  const maintenanceBonus = calculateMaintenanceBonus(exercises, prPoints);

  const finalScore = Math.max(1, Math.min(100,
    progressScore + maintenanceBonus + workScore + consistencyScore
  ));

  return {
    finalScore: Math.round(finalScore),
    progressScore: Math.round(progressScore),
    workScore: Math.round(workScore),
    consistencyScore: Math.round(consistencyScore),
    effectiveSetCount: Math.round(effectiveSetCount * 100) / 100,
    eprPrCount: nEPR,
    weightPrCount: nWPR,
    closenessAggregateRatio: Math.round(closenessAggregateRatio * 1000) / 1000,
  };
}

async function backfillWorkoutScores(limit: number = 20) {
  console.log(`Fetching last ${limit} completed workouts without scores...`);

  // Fetch workouts without final_score
  const { data: workouts, error: workoutsError } = await supabase
    .from('workout_sessions')
    .select('*')
    .not('completed_at', 'is', null)
    .is('final_score', null)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (workoutsError) {
    console.error('Error fetching workouts:', workoutsError);
    return;
  }

  if (!workouts || workouts.length === 0) {
    console.log('No workouts found without scores. Fetching last 20 workouts to recalculate...');

    // Fetch last 20 workouts regardless of score
    const { data: allWorkouts, error: allError } = await supabase
      .from('workout_sessions')
      .select('*')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (allError || !allWorkouts || allWorkouts.length === 0) {
      console.log('No completed workouts found.');
      return;
    }

    console.log(`Found ${allWorkouts.length} workouts to process.`);

    for (const workout of allWorkouts) {
      await processWorkout(workout);
    }
  } else {
    console.log(`Found ${workouts.length} workouts without scores.`);

    for (const workout of workouts) {
      await processWorkout(workout);
    }
  }

  console.log('\nDone!');
}

async function processWorkout(workout: any) {
  console.log(`\nProcessing workout: ${workout.name} (${workout.id})`);
  console.log(`  Completed: ${workout.completed_at}`);

  // Fetch sets for this workout
  const { data: sets, error: setsError } = await supabase
    .from('workout_sets')
    .select(`
      exercise_id,
      weight_kg,
      reps,
      set_type,
      exercises(name)
    `)
    .eq('workout_session_id', workout.id);

  if (setsError) {
    console.error(`  Error fetching sets:`, setsError);
    return;
  }

  if (!sets || sets.length === 0) {
    console.log(`  No sets found, skipping.`);
    return;
  }

  // Transform sets data
  const transformedSets: SetData[] = sets.map((s: any) => ({
    exercise_id: s.exercise_id,
    exercise_name: s.exercises?.name || 'Unknown',
    weight_kg: s.weight_kg,
    reps: s.reps,
    set_type: s.set_type,
  }));

  console.log(`  Found ${transformedSets.length} sets`);

  try {
    const score = await calculateScoreForWorkout(workout, transformedSets);

    console.log(`  Score breakdown:`);
    console.log(`    Final Score: ${score.finalScore}`);
    console.log(`    Progress: ${score.progressScore}, Work: ${score.workScore}, Consistency: ${score.consistencyScore}`);
    console.log(`    EPR PRs: ${score.eprPrCount}, Weight PRs: ${score.weightPrCount}`);

    // Update the workout with the score
    const { error: updateError } = await supabase
      .from('workout_sessions')
      .update({
        final_score: score.finalScore,
        progress_score: score.progressScore,
        work_score: score.workScore,
        consistency_score: score.consistencyScore,
        effective_set_count: score.effectiveSetCount,
        epr_pr_count: score.eprPrCount,
        weight_pr_count: score.weightPrCount,
        closeness_aggregate_ratio: score.closenessAggregateRatio,
      })
      .eq('id', workout.id);

    if (updateError) {
      console.error(`  Error updating workout:`, updateError);
    } else {
      console.log(`  ✓ Score saved!`);
    }
  } catch (err) {
    console.error(`  Error calculating score:`, err);
  }
}

// Run the script
backfillWorkoutScores(20);
