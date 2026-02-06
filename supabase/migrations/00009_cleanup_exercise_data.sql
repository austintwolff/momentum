-- Cleanup exercise data: fix capitalization, names, and equipment types
-- Safe version that handles foreign key constraints

-- 1. Fix muscle_group capitalization (lowercase -> Title Case)
UPDATE public.exercises SET muscle_group = 'Chest' WHERE lower(muscle_group) = 'chest';
UPDATE public.exercises SET muscle_group = 'Back' WHERE lower(muscle_group) = 'back';
UPDATE public.exercises SET muscle_group = 'Shoulders' WHERE lower(muscle_group) = 'shoulders';
UPDATE public.exercises SET muscle_group = 'Biceps' WHERE lower(muscle_group) = 'biceps';
UPDATE public.exercises SET muscle_group = 'Triceps' WHERE lower(muscle_group) = 'triceps';
UPDATE public.exercises SET muscle_group = 'Quadriceps' WHERE lower(muscle_group) IN ('quadriceps', 'quads', 'legs');
UPDATE public.exercises SET muscle_group = 'Hamstrings' WHERE lower(muscle_group) = 'hamstrings';
UPDATE public.exercises SET muscle_group = 'Glutes' WHERE lower(muscle_group) = 'glutes';
UPDATE public.exercises SET muscle_group = 'Calves' WHERE lower(muscle_group) = 'calves';
UPDATE public.exercises SET muscle_group = 'Core' WHERE lower(muscle_group) IN ('core', 'abs', 'abdominals');
UPDATE public.exercises SET muscle_group = 'Forearms' WHERE lower(muscle_group) = 'forearms';
UPDATE public.exercises SET muscle_group = 'Back' WHERE lower(muscle_group) = 'upper back';

-- 2. Fix exercise_type for exercises incorrectly marked as bodyweight
UPDATE public.exercises
SET exercise_type = 'weighted'
WHERE exercise_type = 'bodyweight'
AND (
  lower(name) LIKE '%dumbbell%' OR
  lower(name) LIKE '%barbell%' OR
  lower(name) LIKE '%cable%' OR
  lower(name) LIKE '%machine%' OR
  lower(name) LIKE '%(db)%' OR
  lower(name) LIKE '%(bb)%'
);

-- 3. Clean up exercise names - update to canonical names
UPDATE public.exercises SET name = 'Arnold Press', equipment = ARRAY['dumbbell']
WHERE lower(name) IN ('arnold press (dumbbell)', 'arnold press (db)', 'dumbbell arnold press');

UPDATE public.exercises SET name = 'Dumbbell Bench Press', equipment = ARRAY['dumbbell']
WHERE lower(name) IN ('bench press (dumbbell)', 'bench press (db)', 'db bench press');

UPDATE public.exercises SET name = 'Incline Dumbbell Press', equipment = ARRAY['dumbbell']
WHERE lower(name) IN ('incline bench press (dumbbell)', 'incline dumbbell bench press', 'incline press (dumbbell)');

UPDATE public.exercises SET name = 'Close Grip Bench Press', equipment = ARRAY['barbell']
WHERE lower(name) LIKE '%close grip%bench%' OR lower(name) LIKE '%bench%close grip%';

UPDATE public.exercises SET name = 'Dumbbell Row', equipment = ARRAY['dumbbell']
WHERE lower(name) IN ('bent over row (dumbbell)', 'row (dumbbell)', 'one arm dumbbell row', 'single arm dumbbell row');

UPDATE public.exercises SET name = 'Dumbbell Curl', equipment = ARRAY['dumbbell']
WHERE lower(name) IN ('bicep curl (dumbbell)', 'curl (dumbbell)', 'dumbbell bicep curl');

UPDATE public.exercises SET name = 'Hammer Curl', equipment = ARRAY['dumbbell']
WHERE lower(name) IN ('hammer curl (dumbbell)', 'hammer curls', 'dumbbell hammer curl');

UPDATE public.exercises SET name = 'Dumbbell Shoulder Press', equipment = ARRAY['dumbbell']
WHERE lower(name) IN ('shoulder press (dumbbell)', 'overhead press (dumbbell)', 'dumbbell overhead press', 'seated dumbbell press', 'seated shoulder press (dumbbell)');

UPDATE public.exercises SET name = 'Lateral Raises', equipment = ARRAY['dumbbell']
WHERE lower(name) IN ('lateral raise (dumbbell)', 'lateral raises (dumbbell)', 'dumbbell lateral raise', 'side lateral raise');

UPDATE public.exercises SET name = 'Triceps Pushdown', equipment = ARRAY['cable']
WHERE lower(name) IN ('tricep pushdown (cable)', 'triceps pushdown (cable)', 'cable pushdown', 'rope pushdown', 'tricep rope pushdown');

UPDATE public.exercises SET name = 'Skull Crushers', equipment = ARRAY['barbell']
WHERE lower(name) IN ('skull crusher', 'skullcrushers', 'lying tricep extension', 'ez bar skull crusher');

UPDATE public.exercises SET name = 'Squat', equipment = ARRAY['barbell']
WHERE lower(name) IN ('squat (barbell)', 'back squat', 'barbell squat', 'barbell back squat');

UPDATE public.exercises SET name = 'Romanian Deadlift', equipment = ARRAY['barbell']
WHERE lower(name) IN ('romanian deadlift (barbell)', 'rdl (barbell)', 'stiff leg deadlift');

UPDATE public.exercises SET name = 'Dumbbell Romanian Deadlift', equipment = ARRAY['dumbbell']
WHERE lower(name) IN ('romanian deadlift (dumbbell)', 'rdl (dumbbell)', 'dumbbell rdl');

UPDATE public.exercises SET name = 'Dumbbell Flyes', equipment = ARRAY['dumbbell']
WHERE lower(name) IN ('chest fly (dumbbell)', 'fly (dumbbell)', 'dumbbell fly', 'dumbbell flyes', 'dumbbell chest fly');

UPDATE public.exercises SET name = 'Lunges', equipment = ARRAY['dumbbell']
WHERE lower(name) IN ('lunge (dumbbell)', 'dumbbell lunge', 'dumbbell lunges', 'walking lunge', 'walking lunges');

-- 4. Merge duplicates: Update workout_sets to point to the canonical exercise (oldest one)
-- Then delete the duplicate exercise records

-- For each duplicate name, update workout_sets to use the oldest exercise_id
UPDATE public.workout_sets ws
SET exercise_id = canonical.keep_id
FROM (
  SELECT
    e1.id as dup_id,
    (SELECT e2.id FROM public.exercises e2
     WHERE lower(e2.name) = lower(e1.name)
     ORDER BY e2.created_at ASC, e2.id ASC
     LIMIT 1) as keep_id
  FROM public.exercises e1
  WHERE EXISTS (
    SELECT 1 FROM public.exercises e2
    WHERE lower(e2.name) = lower(e1.name)
    AND e2.id != e1.id
  )
) canonical
WHERE ws.exercise_id = canonical.dup_id
AND canonical.dup_id != canonical.keep_id;

-- Also update exercise_baselines
UPDATE public.exercise_baselines eb
SET exercise_id = canonical.keep_id
FROM (
  SELECT
    e1.id as dup_id,
    (SELECT e2.id FROM public.exercises e2
     WHERE lower(e2.name) = lower(e1.name)
     ORDER BY e2.created_at ASC, e2.id ASC
     LIMIT 1) as keep_id
  FROM public.exercises e1
  WHERE EXISTS (
    SELECT 1 FROM public.exercises e2
    WHERE lower(e2.name) = lower(e1.name)
    AND e2.id != e1.id
  )
) canonical
WHERE eb.exercise_id = canonical.dup_id
AND canonical.dup_id != canonical.keep_id;

-- Now safe to delete duplicates (keeping the oldest)
DELETE FROM public.exercises e1
WHERE EXISTS (
  SELECT 1 FROM public.exercises e2
  WHERE lower(e2.name) = lower(e1.name)
  AND (e2.created_at < e1.created_at OR (e2.created_at = e1.created_at AND e2.id < e1.id))
);

-- 5. Fix bodyweight equipment arrays
UPDATE public.exercises
SET equipment = ARRAY[]::text[]
WHERE exercise_type = 'bodyweight' AND (equipment IS NULL OR equipment = ARRAY['bodyweight']);
