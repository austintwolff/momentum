-- Migration: Fix Function Search Path Security
-- Sets search_path = '' on all functions to prevent search_path injection attacks

-- ============================================================================
-- 1. FIX get_week_start
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_week_start(input_date DATE)
RETURNS DATE AS $$
BEGIN
  RETURN input_date - EXTRACT(ISODOW FROM input_date)::INTEGER + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = '';

-- ============================================================================
-- 2. FIX xp_for_level
-- ============================================================================
CREATE OR REPLACE FUNCTION public.xp_for_level(level INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- 100 * (1.15 ^ level)
  RETURN FLOOR(100 * POWER(1.15, level));
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = '';

-- ============================================================================
-- 3. FIX xp_for_muscle_level (two-phase curve)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.xp_for_muscle_level(level INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF level < 1 THEN
    RETURN 0;
  END IF;
  IF level > 25 THEN
    RETURN 2147483647;
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
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = '';

-- ============================================================================
-- 4. FIX update_updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 5. FIX handle_new_user
-- ============================================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
