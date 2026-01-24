-- Migration: Fix RLS Performance and Duplicate Index
-- Fixes:
-- 1. Wrap auth.uid() in (select auth.uid()) for all RLS policies
-- 2. Drop duplicate index idx_workout_sets_exercise_completed

-- ============================================================================
-- 1. DROP DUPLICATE INDEX
-- ============================================================================
DROP INDEX IF EXISTS idx_workout_sets_exercise_completed;

-- ============================================================================
-- 2. FIX PROFILES RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- ============================================================================
-- 3. FIX USER_STATS RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can insert own stats" ON public.user_stats;

CREATE POLICY "Users can view own stats" ON public.user_stats
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own stats" ON public.user_stats
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own stats" ON public.user_stats
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 4. FIX EXERCISES RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view public exercises" ON public.exercises;
DROP POLICY IF EXISTS "Users can create exercises" ON public.exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON public.exercises;

CREATE POLICY "Anyone can view public exercises" ON public.exercises
  FOR SELECT USING (is_public = TRUE OR (select auth.uid()) = created_by);

CREATE POLICY "Users can create exercises" ON public.exercises
  FOR INSERT WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY "Users can update own exercises" ON public.exercises
  FOR UPDATE USING ((select auth.uid()) = created_by);

-- ============================================================================
-- 5. FIX WORKOUT_SESSIONS RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own workouts" ON public.workout_sessions;
DROP POLICY IF EXISTS "Users can create own workouts" ON public.workout_sessions;
DROP POLICY IF EXISTS "Users can update own workouts" ON public.workout_sessions;
DROP POLICY IF EXISTS "Users can delete own workouts" ON public.workout_sessions;

CREATE POLICY "Users can view own workouts" ON public.workout_sessions
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own workouts" ON public.workout_sessions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own workouts" ON public.workout_sessions
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own workouts" ON public.workout_sessions
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 6. FIX WORKOUT_SETS RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own sets" ON public.workout_sets;
DROP POLICY IF EXISTS "Users can create sets in own workouts" ON public.workout_sets;
DROP POLICY IF EXISTS "Users can update own sets" ON public.workout_sets;
DROP POLICY IF EXISTS "Users can delete own sets" ON public.workout_sets;

CREATE POLICY "Users can view own sets" ON public.workout_sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = workout_session_id AND ws.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create sets in own workouts" ON public.workout_sets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = workout_session_id AND ws.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own sets" ON public.workout_sets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = workout_session_id AND ws.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete own sets" ON public.workout_sets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = workout_session_id AND ws.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 7. FIX POINT_TRANSACTIONS RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own transactions" ON public.point_transactions;
DROP POLICY IF EXISTS "Users can create own transactions" ON public.point_transactions;

CREATE POLICY "Users can view own transactions" ON public.point_transactions
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own transactions" ON public.point_transactions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 8. FIX EXERCISE_BASELINES RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own baselines" ON public.exercise_baselines;
DROP POLICY IF EXISTS "Users can insert own baselines" ON public.exercise_baselines;
DROP POLICY IF EXISTS "Users can update own baselines" ON public.exercise_baselines;

CREATE POLICY "Users can view own baselines" ON public.exercise_baselines
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own baselines" ON public.exercise_baselines
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own baselines" ON public.exercise_baselines
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 9. FIX MUSCLE_LEVELS RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own muscle levels" ON public.muscle_levels;
DROP POLICY IF EXISTS "Users can insert own muscle levels" ON public.muscle_levels;
DROP POLICY IF EXISTS "Users can update own muscle levels" ON public.muscle_levels;

CREATE POLICY "Users can view own muscle levels" ON public.muscle_levels
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own muscle levels" ON public.muscle_levels
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own muscle levels" ON public.muscle_levels
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 10. FIX WEEKLY_MUSCLE_STATS RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own weekly stats" ON public.weekly_muscle_stats;
DROP POLICY IF EXISTS "Users can insert own weekly stats" ON public.weekly_muscle_stats;
DROP POLICY IF EXISTS "Users can update own weekly stats" ON public.weekly_muscle_stats;

CREATE POLICY "Users can view own weekly stats" ON public.weekly_muscle_stats
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own weekly stats" ON public.weekly_muscle_stats
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own weekly stats" ON public.weekly_muscle_stats
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 11. UPDATE XP_FOR_MUSCLE_LEVEL FUNCTION (new two-phase curve)
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

  -- Two-phase curve:
  -- Onboarding (L 1-5): 120 * 1.12^(L-1)
  -- Main curve (L 6-25): 300 * 1.10^(L-6)
  IF level <= 5 THEN
    RETURN FLOOR(120 * POWER(1.12, level - 1));
  ELSE
    RETURN FLOOR(300 * POWER(1.10, level - 6));
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
