/**
 * Exercise Sync Service
 *
 * Syncs DEFAULT_EXERCISES to the Supabase database so all exercises
 * have proper UUIDs and can accumulate workout history.
 */

import { supabase } from '@/lib/supabase';
import { DEFAULT_EXERCISES, ExerciseDefinition } from '@/constants/exercises';
import { Exercise } from '@/types/database';

// Module-level cache
let cachedExercises: Exercise[] | null = null;
let syncPromise: Promise<Exercise[]> | null = null;

/**
 * Sync DEFAULT_EXERCISES to the database and return all exercises.
 *
 * - Exercises are matched by name (case-insensitive)
 * - Missing exercises are inserted as public exercises
 * - Returns combined list of all database exercises
 * - Results are cached for the session
 */
export async function syncAndFetchExercises(): Promise<Exercise[]> {
  // Return cached if available
  if (cachedExercises) {
    return cachedExercises;
  }

  // If sync is already in progress, wait for it
  if (syncPromise) {
    return syncPromise;
  }

  // Start sync
  syncPromise = performSync();

  try {
    cachedExercises = await syncPromise;
    return cachedExercises;
  } finally {
    syncPromise = null;
  }
}

async function performSync(): Promise<Exercise[]> {
  try {
    // 1. Fetch all existing exercises from database
    const { data: existingExercises, error: fetchError } = await supabase
      .from('exercises')
      .select('id, name, description, exercise_type, muscle_group, equipment, is_compound, is_public, created_by, created_at')
      .eq('is_public', true)
      .order('name');

    if (fetchError) {
      console.error('[ExerciseSync] Error fetching exercises:', fetchError);
      // Return local exercises as fallback with generated UUIDs
      return convertDefaultExercisesToFallback();
    }

    const dbExercises = (existingExercises || []) as Exercise[];

    // 2. Find exercises that need to be synced
    const existingNames = new Set(
      dbExercises.map(e => e.name.toLowerCase())
    );

    const exercisesToInsert = DEFAULT_EXERCISES.filter(
      def => !existingNames.has(def.name.toLowerCase())
    );

    // 3. Insert missing exercises (requires authenticated user for RLS)
    if (exercisesToInsert.length > 0) {
      // Get current user for RLS compliance
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.warn('[ExerciseSync] No authenticated user, skipping insert');
        // Return what we have from database
        return dbExercises.length > 0 ? dbExercises : convertDefaultExercisesToFallback();
      }

      console.log(`[ExerciseSync] Inserting ${exercisesToInsert.length} new exercises`);

      const inserts = exercisesToInsert.map(def => ({
        name: def.name,
        description: def.description,
        exercise_type: def.exerciseType,
        muscle_group: def.muscleGroup,
        equipment: def.equipment,
        is_compound: def.isCompound,
        is_public: true,
        created_by: user.id,
      }));

      const { data: insertedExercises, error: insertError } = await (supabase
        .from('exercises') as any)
        .insert(inserts)
        .select();

      if (insertError) {
        console.error('[ExerciseSync] Error inserting exercises:', insertError);
        // Continue with what we have
      } else if (insertedExercises) {
        console.log(`[ExerciseSync] Successfully inserted ${insertedExercises.length} exercises`);
        // Add newly inserted exercises to the list
        dbExercises.push(...(insertedExercises as Exercise[]));
      }
    }

    // 4. Sort and return
    dbExercises.sort((a, b) => a.name.localeCompare(b.name));

    // If no exercises available (database empty, insert failed), use fallback
    if (dbExercises.length === 0) {
      console.warn('[ExerciseSync] No exercises in database, using fallback');
      return convertDefaultExercisesToFallback();
    }

    console.log(`[ExerciseSync] Total exercises available: ${dbExercises.length}`);
    return dbExercises;

  } catch (error) {
    console.error('[ExerciseSync] Unexpected error:', error);
    return convertDefaultExercisesToFallback();
  }
}

/**
 * Fallback: Convert DEFAULT_EXERCISES to Exercise format with generated UUIDs.
 * Used when database is unavailable.
 */
function convertDefaultExercisesToFallback(): Exercise[] {
  console.warn('[ExerciseSync] Using fallback local exercises');

  return DEFAULT_EXERCISES.map((def) => ({
    // Generate a deterministic UUID-like ID based on exercise name
    // This ensures the same exercise always gets the same ID
    id: generateDeterministicId(def.name),
    name: def.name,
    description: def.description,
    exercise_type: def.exerciseType,
    muscle_group: def.muscleGroup,
    equipment: def.equipment,
    is_compound: def.isCompound,
    created_by: null,
    is_public: true,
    created_at: new Date().toISOString(),
  }));
}

/**
 * Generate a deterministic ID from exercise name.
 * Format: fallback-{hash}
 */
function generateDeterministicId(name: string): string {
  // Simple hash function for deterministic IDs
  let hash = 0;
  const str = name.toLowerCase();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `fallback-${Math.abs(hash).toString(16)}`;
}

/**
 * Clear the exercise cache. Call this when exercises might have changed.
 */
export function clearExerciseCache(): void {
  cachedExercises = null;
}

/**
 * Find an exercise by name from the cache or database.
 */
export async function findExerciseByName(name: string): Promise<Exercise | null> {
  const exercises = await syncAndFetchExercises();
  const nameLower = name.toLowerCase();
  return exercises.find(e => e.name.toLowerCase() === nameLower) || null;
}
