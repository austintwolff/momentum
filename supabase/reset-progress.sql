-- Reset all user progress to zero
-- Run this in the Supabase SQL Editor to test as a new user
-- Replace 'YOUR_USER_ID' with your actual user ID, or remove the WHERE clauses to reset ALL users

-- Get your user ID first by running:
-- SELECT id FROM auth.users WHERE email = 'your-email@example.com';

-- Option 1: Reset a specific user (safer)
-- Uncomment and set your user ID:

-- DO $$
-- DECLARE
--   target_user_id uuid := 'YOUR_USER_ID';
-- BEGIN
--   -- Delete workout sets first (foreign key constraint)
--   DELETE FROM workout_sets
--   WHERE workout_session_id IN (
--     SELECT id FROM workout_sessions WHERE user_id = target_user_id
--   );
--
--   -- Delete workout sessions
--   DELETE FROM workout_sessions WHERE user_id = target_user_id;
--
--   -- Delete point transactions
--   DELETE FROM point_transactions WHERE user_id = target_user_id;
--
--   -- Delete exercise baselines
--   DELETE FROM exercise_baselines WHERE user_id = target_user_id;
--
--   -- Delete muscle levels
--   DELETE FROM muscle_levels WHERE user_id = target_user_id;
--
--   -- Delete weekly muscle stats
--   DELETE FROM weekly_muscle_stats WHERE user_id = target_user_id;
--
--   -- Reset user stats to zero
--   UPDATE user_stats
--   SET
--     total_points = 0,
--     weekly_points = 0,
--     current_workout_streak = 0,
--     longest_workout_streak = 0,
--     total_workouts = 0,
--     total_volume_kg = 0,
--     current_overload_streak = 0,
--     last_workout_at = NULL,
--     updated_at = NOW()
--   WHERE user_id = target_user_id;
-- END $$;


-- Option 2: Reset ALL users (use with caution!)
-- Delete in order to respect foreign key constraints

-- Delete workout sets first
DELETE FROM workout_sets;

-- Delete workout sessions
DELETE FROM workout_sessions;

-- Delete point transactions
DELETE FROM point_transactions;

-- Delete exercise baselines
DELETE FROM exercise_baselines;

-- Delete muscle levels
DELETE FROM muscle_levels;

-- Delete weekly muscle stats
DELETE FROM weekly_muscle_stats;

-- Reset all user stats to zero
UPDATE user_stats
SET
  total_points = 0,
  weekly_points = 0,
  current_workout_streak = 0,
  longest_workout_streak = 0,
  total_workouts = 0,
  total_volume_kg = 0,
  current_overload_streak = 0,
  last_workout_at = NULL,
  updated_at = NOW();

-- Verify the reset
SELECT
  'user_stats' as table_name,
  COUNT(*) as rows,
  SUM(total_points) as total_points
FROM user_stats
UNION ALL
SELECT 'workout_sessions', COUNT(*), NULL FROM workout_sessions
UNION ALL
SELECT 'workout_sets', COUNT(*), NULL FROM workout_sets
UNION ALL
SELECT 'exercise_baselines', COUNT(*), NULL FROM exercise_baselines
UNION ALL
SELECT 'muscle_levels', COUNT(*), NULL FROM muscle_levels;
