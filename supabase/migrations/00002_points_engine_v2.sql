-- Migration: Points Engine V2
-- Adds tables for baseline tracking, muscle levels, and weekly consistency

-- ============================================================================
-- EXERCISE BASELINES
-- Track rolling average e1RM per user per exercise for progressive overload
-- ============================================================================
CREATE TABLE IF NOT EXISTS exercise_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,

  -- Rolling average data (last 4 sessions)
  rolling_avg_e1rm DECIMAL(10,2) DEFAULT 0,
  session_history JSONB DEFAULT '[]'::jsonb, -- [{e1rm, date, weight, reps}]

  -- Baseline phase tracking
  workout_count INTEGER DEFAULT 0,
  is_baselined BOOLEAN DEFAULT FALSE,

  -- Personal records
  best_e1rm DECIMAL(10,2) DEFAULT 0,
  best_e1rm_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, exercise_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_exercise_baselines_user ON exercise_baselines(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_baselines_exercise ON exercise_baselines(exercise_id);

-- ============================================================================
-- MUSCLE LEVELS
-- Track XP and levels per muscle group with decay
-- ============================================================================
CREATE TABLE IF NOT EXISTS muscle_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muscle_group TEXT NOT NULL,

  -- Level and XP
  current_level INTEGER DEFAULT 0,
  current_xp INTEGER DEFAULT 0,
  total_xp_earned INTEGER DEFAULT 0, -- lifetime, never decreases

  -- Decay tracking
  last_trained_at TIMESTAMPTZ,
  decay_applied_at TIMESTAMPTZ, -- last time decay was applied

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, muscle_group)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_muscle_levels_user ON muscle_levels(user_id);

-- ============================================================================
-- WEEKLY MUSCLE STATS
-- Track weekly consistency per muscle group for bonuses
-- ============================================================================
CREATE TABLE IF NOT EXISTS weekly_muscle_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muscle_group TEXT NOT NULL,
  week_start DATE NOT NULL, -- Monday of the week

  -- Weekly metrics
  workout_count INTEGER DEFAULT 0,
  total_sets INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,

  -- Bonus tracking
  consistency_bonus_applied BOOLEAN DEFAULT FALSE,
  bonus_percentage INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, muscle_group, week_start)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_weekly_muscle_stats_user_week ON weekly_muscle_stats(user_id, week_start);

-- ============================================================================
-- COMPOUND EXERCISE MUSCLE MAPPING
-- Maps compound exercises to all muscle groups they work
-- ============================================================================
CREATE TABLE IF NOT EXISTS exercise_muscle_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  contribution_percentage INTEGER DEFAULT 100, -- for future use, currently all get 100%
  is_primary BOOLEAN DEFAULT FALSE,

  UNIQUE(exercise_name, muscle_group)
);

-- Seed compound exercise mappings
INSERT INTO exercise_muscle_map (exercise_name, muscle_group, is_primary) VALUES
  -- Chest compounds
  ('Bench Press', 'Chest', true),
  ('Bench Press', 'Triceps', false),
  ('Bench Press', 'Shoulders', false),
  ('Incline Bench Press', 'Chest', true),
  ('Incline Bench Press', 'Triceps', false),
  ('Incline Bench Press', 'Shoulders', false),
  ('Dumbbell Bench Press', 'Chest', true),
  ('Dumbbell Bench Press', 'Triceps', false),
  ('Dumbbell Bench Press', 'Shoulders', false),
  ('Push-ups', 'Chest', true),
  ('Push-ups', 'Triceps', false),
  ('Push-ups', 'Shoulders', false),

  -- Back compounds
  ('Deadlift', 'Back', true),
  ('Deadlift', 'Glutes', false),
  ('Deadlift', 'Hamstrings', false),
  ('Pull-ups', 'Back', true),
  ('Pull-ups', 'Biceps', false),
  ('Chin-ups', 'Back', true),
  ('Chin-ups', 'Biceps', false),
  ('Barbell Row', 'Back', true),
  ('Barbell Row', 'Biceps', false),
  ('Dumbbell Row', 'Back', true),
  ('Dumbbell Row', 'Biceps', false),
  ('Lat Pulldown', 'Back', true),
  ('Lat Pulldown', 'Biceps', false),
  ('Seated Cable Row', 'Back', true),
  ('Seated Cable Row', 'Biceps', false),

  -- Shoulder compounds
  ('Overhead Press', 'Shoulders', true),
  ('Overhead Press', 'Triceps', false),
  ('Dumbbell Shoulder Press', 'Shoulders', true),
  ('Dumbbell Shoulder Press', 'Triceps', false),

  -- Tricep compounds
  ('Close Grip Bench Press', 'Triceps', true),
  ('Close Grip Bench Press', 'Chest', false),
  ('Tricep Dips', 'Triceps', true),
  ('Tricep Dips', 'Chest', false),
  ('Tricep Dips', 'Shoulders', false),

  -- Leg compounds
  ('Squat', 'Quadriceps', true),
  ('Squat', 'Glutes', false),
  ('Squat', 'Hamstrings', false),
  ('Front Squat', 'Quadriceps', true),
  ('Front Squat', 'Glutes', false),
  ('Leg Press', 'Quadriceps', true),
  ('Leg Press', 'Glutes', false),
  ('Lunges', 'Quadriceps', true),
  ('Lunges', 'Glutes', false),
  ('Bulgarian Split Squat', 'Quadriceps', true),
  ('Bulgarian Split Squat', 'Glutes', false),
  ('Romanian Deadlift', 'Hamstrings', true),
  ('Romanian Deadlift', 'Glutes', false),
  ('Good Mornings', 'Hamstrings', true),
  ('Good Mornings', 'Glutes', false),
  ('Hip Thrust', 'Glutes', true),
  ('Hip Thrust', 'Hamstrings', false)
ON CONFLICT (exercise_name, muscle_group) DO NOTHING;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get week start (Monday) for a given date
CREATE OR REPLACE FUNCTION get_week_start(input_date DATE)
RETURNS DATE AS $$
BEGIN
  RETURN input_date - EXTRACT(ISODOW FROM input_date)::INTEGER + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate XP required for a level (exponential curve)
CREATE OR REPLACE FUNCTION xp_for_level(level INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- 100 * (1.15 ^ level)
  RETURN FLOOR(100 * POWER(1.15, level));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE exercise_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE muscle_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_muscle_stats ENABLE ROW LEVEL SECURITY;

-- Exercise baselines policies
CREATE POLICY "Users can view own baselines" ON exercise_baselines
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own baselines" ON exercise_baselines
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own baselines" ON exercise_baselines
  FOR UPDATE USING (auth.uid() = user_id);

-- Muscle levels policies
CREATE POLICY "Users can view own muscle levels" ON muscle_levels
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own muscle levels" ON muscle_levels
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own muscle levels" ON muscle_levels
  FOR UPDATE USING (auth.uid() = user_id);

-- Weekly stats policies
CREATE POLICY "Users can view own weekly stats" ON weekly_muscle_stats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weekly stats" ON weekly_muscle_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weekly stats" ON weekly_muscle_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- Exercise muscle map is public read
CREATE POLICY "Anyone can view muscle map" ON exercise_muscle_map
  FOR SELECT USING (true);
