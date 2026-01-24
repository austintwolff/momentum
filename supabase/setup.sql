-- Rep Logic Complete Database Setup
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/osntayaxccjjxzomqtbk/sql

-- ============================================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bodyweight_kg DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USER STATS (denormalized for performance)
-- ============================================================================
CREATE TABLE public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_points BIGINT DEFAULT 0,
  weekly_points BIGINT DEFAULT 0,
  current_workout_streak INTEGER DEFAULT 0,
  longest_workout_streak INTEGER DEFAULT 0,
  total_workouts INTEGER DEFAULT 0,
  total_volume_kg DECIMAL(12,2) DEFAULT 0,
  current_overload_streak INTEGER DEFAULT 0,
  last_workout_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EXERCISES (library of exercises)
-- ============================================================================
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  exercise_type TEXT NOT NULL CHECK (exercise_type IN ('weighted', 'bodyweight')),
  muscle_group TEXT NOT NULL,
  equipment TEXT[],
  is_compound BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WORKOUT SESSIONS
-- ============================================================================
CREATE TABLE public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT,
  total_volume_kg DECIMAL(10,2) DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WORKOUT SETS
-- ============================================================================
CREATE TABLE public.workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  set_number INTEGER NOT NULL,
  set_type TEXT DEFAULT 'working' CHECK (set_type IN ('warmup', 'working', 'dropset', 'failure')),
  weight_kg DECIMAL(6,2),
  reps INTEGER NOT NULL,
  rpe DECIMAL(3,1) CHECK (rpe >= 1 AND rpe <= 10),
  is_bodyweight BOOLEAN DEFAULT FALSE,
  points_earned INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- POINT TRANSACTIONS (immutable ledger)
-- ============================================================================
CREATE TABLE public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_session_id UUID REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  workout_set_id UUID REFERENCES public.workout_sets(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'set_completed',
    'workout_completed',
    'streak_bonus',
    'overload_bonus'
  )),
  base_points INTEGER NOT NULL,
  multiplier DECIMAL(4,2) DEFAULT 1.00,
  final_points INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_workout_sessions_user_date ON public.workout_sessions(user_id, started_at DESC);
CREATE INDEX idx_workout_sets_session ON public.workout_sets(workout_session_id);
CREATE INDEX idx_workout_sets_exercise ON public.workout_sets(exercise_id, completed_at DESC);
CREATE INDEX idx_point_transactions_user ON public.point_transactions(user_id, created_at DESC);
CREATE INDEX idx_user_stats_total_points ON public.user_stats(total_points DESC);
CREATE INDEX idx_exercises_muscle_group ON public.exercises(muscle_group);
CREATE INDEX idx_exercises_public ON public.exercises(is_public) WHERE is_public = TRUE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User stats policies
CREATE POLICY "Users can view own stats" ON public.user_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own stats" ON public.user_stats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats" ON public.user_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Exercises policies (public exercises visible to all, own exercises editable)
CREATE POLICY "Anyone can view public exercises" ON public.exercises
  FOR SELECT USING (is_public = TRUE OR auth.uid() = created_by);

CREATE POLICY "Users can create exercises" ON public.exercises
  FOR INSERT WITH CHECK (created_by IS NULL OR auth.uid() = created_by);

CREATE POLICY "Users can update own exercises" ON public.exercises
  FOR UPDATE USING (auth.uid() = created_by);

-- Workout sessions policies
CREATE POLICY "Users can view own workouts" ON public.workout_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own workouts" ON public.workout_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts" ON public.workout_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts" ON public.workout_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Workout sets policies
CREATE POLICY "Users can view own sets" ON public.workout_sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = workout_session_id AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sets in own workouts" ON public.workout_sets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = workout_session_id AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own sets" ON public.workout_sets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = workout_session_id AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own sets" ON public.workout_sets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = workout_session_id AND ws.user_id = auth.uid()
    )
  );

-- Point transactions policies
CREATE POLICY "Users can view own transactions" ON public.point_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions" ON public.point_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
  );

  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON public.user_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- SEED EXERCISES
-- ============================================================================

INSERT INTO public.exercises (name, description, exercise_type, muscle_group, equipment, is_compound, is_public) VALUES
-- Chest
('Bench Press', 'Barbell bench press for chest development', 'weighted', 'Chest', ARRAY['barbell', 'bench'], true, true),
('Incline Bench Press', 'Incline barbell press targeting upper chest', 'weighted', 'Chest', ARRAY['barbell', 'incline bench'], true, true),
('Dumbbell Bench Press', 'Dumbbell press for chest with greater range of motion', 'weighted', 'Chest', ARRAY['dumbbells', 'bench'], true, true),
('Dumbbell Flyes', 'Isolation exercise for chest', 'weighted', 'Chest', ARRAY['dumbbells', 'bench'], false, true),
('Push-ups', 'Classic bodyweight chest exercise', 'bodyweight', 'Chest', ARRAY[]::TEXT[], true, true),
('Cable Crossover', 'Cable isolation for chest', 'weighted', 'Chest', ARRAY['cable machine'], false, true),

-- Back
('Deadlift', 'Full body compound lift focusing on posterior chain', 'weighted', 'Back', ARRAY['barbell'], true, true),
('Pull-ups', 'Bodyweight vertical pull for back width', 'bodyweight', 'Back', ARRAY['pull-up bar'], true, true),
('Chin-ups', 'Underhand grip pull-up emphasizing biceps', 'bodyweight', 'Back', ARRAY['pull-up bar'], true, true),
('Barbell Row', 'Bent over row for back thickness', 'weighted', 'Back', ARRAY['barbell'], true, true),
('Dumbbell Row', 'Single arm row for unilateral back development', 'weighted', 'Back', ARRAY['dumbbell', 'bench'], true, true),
('Lat Pulldown', 'Cable exercise for lat width', 'weighted', 'Back', ARRAY['cable machine'], true, true),
('Seated Cable Row', 'Cable row for back thickness', 'weighted', 'Back', ARRAY['cable machine'], true, true),

-- Shoulders
('Overhead Press', 'Standing barbell press for shoulders', 'weighted', 'Shoulders', ARRAY['barbell'], true, true),
('Dumbbell Shoulder Press', 'Seated or standing dumbbell press', 'weighted', 'Shoulders', ARRAY['dumbbells'], true, true),
('Lateral Raises', 'Isolation for lateral deltoids', 'weighted', 'Shoulders', ARRAY['dumbbells'], false, true),
('Front Raises', 'Isolation for front deltoids', 'weighted', 'Shoulders', ARRAY['dumbbells'], false, true),
('Rear Delt Flyes', 'Isolation for rear deltoids', 'weighted', 'Shoulders', ARRAY['dumbbells'], false, true),
('Face Pulls', 'Cable exercise for rear delts and rotator cuff', 'weighted', 'Shoulders', ARRAY['cable machine'], false, true),

-- Biceps
('Barbell Curl', 'Classic bicep builder', 'weighted', 'Biceps', ARRAY['barbell'], false, true),
('Dumbbell Curl', 'Alternating or simultaneous dumbbell curls', 'weighted', 'Biceps', ARRAY['dumbbells'], false, true),
('Hammer Curl', 'Neutral grip curls for brachialis', 'weighted', 'Biceps', ARRAY['dumbbells'], false, true),
('Preacher Curl', 'Isolated bicep curl on preacher bench', 'weighted', 'Biceps', ARRAY['barbell', 'preacher bench'], false, true),

-- Triceps
('Close Grip Bench Press', 'Bench press variation emphasizing triceps', 'weighted', 'Triceps', ARRAY['barbell', 'bench'], true, true),
('Tricep Dips', 'Bodyweight tricep exercise', 'bodyweight', 'Triceps', ARRAY['dip bars'], true, true),
('Tricep Pushdown', 'Cable pushdown for triceps', 'weighted', 'Triceps', ARRAY['cable machine'], false, true),
('Skull Crushers', 'Lying tricep extension', 'weighted', 'Triceps', ARRAY['barbell', 'bench'], false, true),
('Overhead Tricep Extension', 'Overhead dumbbell or cable extension', 'weighted', 'Triceps', ARRAY['dumbbell'], false, true),

-- Quadriceps
('Squat', 'King of leg exercises', 'weighted', 'Quadriceps', ARRAY['barbell', 'squat rack'], true, true),
('Front Squat', 'Quad-dominant squat variation', 'weighted', 'Quadriceps', ARRAY['barbell', 'squat rack'], true, true),
('Leg Press', 'Machine compound leg exercise', 'weighted', 'Quadriceps', ARRAY['leg press machine'], true, true),
('Leg Extension', 'Isolation for quadriceps', 'weighted', 'Quadriceps', ARRAY['leg extension machine'], false, true),
('Lunges', 'Unilateral leg exercise', 'weighted', 'Quadriceps', ARRAY['dumbbells'], true, true),
('Bulgarian Split Squat', 'Single leg squat with rear foot elevated', 'weighted', 'Quadriceps', ARRAY['dumbbells', 'bench'], true, true),

-- Hamstrings
('Romanian Deadlift', 'Hip hinge for hamstrings and glutes', 'weighted', 'Hamstrings', ARRAY['barbell'], true, true),
('Leg Curl', 'Isolation for hamstrings', 'weighted', 'Hamstrings', ARRAY['leg curl machine'], false, true),
('Good Mornings', 'Barbell hip hinge for posterior chain', 'weighted', 'Hamstrings', ARRAY['barbell'], true, true),

-- Glutes
('Hip Thrust', 'Primary glute builder', 'weighted', 'Glutes', ARRAY['barbell', 'bench'], true, true),
('Glute Bridge', 'Bodyweight or weighted glute exercise', 'bodyweight', 'Glutes', ARRAY[]::TEXT[], false, true),
('Cable Kickback', 'Cable isolation for glutes', 'weighted', 'Glutes', ARRAY['cable machine'], false, true),

-- Calves
('Standing Calf Raise', 'Standing calf raise on machine or smith machine', 'weighted', 'Calves', ARRAY['calf raise machine'], false, true),
('Seated Calf Raise', 'Seated calf raise for soleus', 'weighted', 'Calves', ARRAY['seated calf machine'], false, true),

-- Core
('Plank', 'Isometric core stability exercise', 'bodyweight', 'Core', ARRAY[]::TEXT[], false, true),
('Hanging Leg Raise', 'Advanced ab exercise', 'bodyweight', 'Core', ARRAY['pull-up bar'], false, true),
('Cable Crunch', 'Weighted ab exercise', 'weighted', 'Core', ARRAY['cable machine'], false, true),
('Ab Wheel Rollout', 'Dynamic core stability exercise', 'bodyweight', 'Core', ARRAY['ab wheel'], false, true),
('Russian Twist', 'Rotational core exercise', 'bodyweight', 'Core', ARRAY[]::TEXT[], false, true);
