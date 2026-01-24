-- Migration: Muscle XP System
-- Updates for muscle level system with rolling 7-day tracking and ordered muscle tags

-- ============================================================================
-- 1. Add muscle_order to exercise_muscle_map
-- Order: 1 = primary, 2 = secondary, 3 = tertiary
-- ============================================================================
ALTER TABLE exercise_muscle_map
ADD COLUMN IF NOT EXISTS muscle_order INTEGER DEFAULT 1;

-- Update existing data: set order based on is_primary
UPDATE exercise_muscle_map
SET muscle_order = CASE WHEN is_primary THEN 1 ELSE 2 END
WHERE muscle_order IS NULL OR muscle_order = 1;

-- Add more granular ordering for exercises with 3+ muscles
-- For compound exercises, assign secondary (2) and tertiary (3) based on typical contribution

-- Bench Press variations: Chest (1), Triceps (2), Shoulders (3)
UPDATE exercise_muscle_map SET muscle_order = 2 WHERE exercise_name LIKE '%Bench Press%' AND muscle_group = 'Triceps';
UPDATE exercise_muscle_map SET muscle_order = 3 WHERE exercise_name LIKE '%Bench Press%' AND muscle_group = 'Shoulders';

-- Push-ups: Chest (1), Triceps (2), Shoulders (3)
UPDATE exercise_muscle_map SET muscle_order = 2 WHERE exercise_name = 'Push-ups' AND muscle_group = 'Triceps';
UPDATE exercise_muscle_map SET muscle_order = 3 WHERE exercise_name = 'Push-ups' AND muscle_group = 'Shoulders';

-- Deadlift: Back (1), Glutes (2), Hamstrings (3)
UPDATE exercise_muscle_map SET muscle_order = 2 WHERE exercise_name = 'Deadlift' AND muscle_group = 'Glutes';
UPDATE exercise_muscle_map SET muscle_order = 3 WHERE exercise_name = 'Deadlift' AND muscle_group = 'Hamstrings';

-- Squats: Quads (1), Glutes (2), Hamstrings (3)
UPDATE exercise_muscle_map SET muscle_order = 2 WHERE exercise_name IN ('Squat', 'Front Squat') AND muscle_group = 'Glutes';
UPDATE exercise_muscle_map SET muscle_order = 3 WHERE exercise_name IN ('Squat', 'Front Squat') AND muscle_group = 'Hamstrings';

-- Tricep Dips: Triceps (1), Chest (2), Shoulders (3)
UPDATE exercise_muscle_map SET muscle_order = 2 WHERE exercise_name = 'Tricep Dips' AND muscle_group = 'Chest';
UPDATE exercise_muscle_map SET muscle_order = 3 WHERE exercise_name = 'Tricep Dips' AND muscle_group = 'Shoulders';

-- ============================================================================
-- 2. Update xp_for_level function for new curve (max level 25)
-- Formula: floor(12 * 1.25^level)
-- Target: ~16,000 cumulative XP to reach level 25
-- ============================================================================
CREATE OR REPLACE FUNCTION xp_for_muscle_level(level INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF level < 1 THEN
    RETURN 0;
  END IF;
  IF level > 25 THEN
    RETURN 2147483647; -- Max int, effectively unreachable
  END IF;
  -- Formula: 12 * 1.25^level
  RETURN FLOOR(12 * POWER(1.25, level));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 3. Create index for efficient rolling 7-day queries on workout_sets
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_workout_sets_completed_at
ON workout_sets(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise_completed
ON workout_sets(exercise_id, completed_at DESC);
