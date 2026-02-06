-- Comprehensive cleanup: Remove ALL equipment from exercise names and fix types

-- 1. Fix exercises ending with (Barbell) - set equipment and clean name
UPDATE public.exercises
SET
  name = TRIM(regexp_replace(name, '\s*\(Barbell\)\s*$', '', 'i')),
  equipment = ARRAY['barbell'],
  exercise_type = 'weighted'
WHERE lower(name) LIKE '%(barbell)';

-- 2. Fix exercises ending with (Dumbbell) - set equipment and clean name
UPDATE public.exercises
SET
  name = TRIM(regexp_replace(name, '\s*\(Dumbbell\)\s*$', '', 'i')),
  equipment = ARRAY['dumbbell'],
  exercise_type = 'weighted'
WHERE lower(name) LIKE '%(dumbbell)';

-- 3. Fix exercises ending with (Cable) - set equipment and clean name
UPDATE public.exercises
SET
  name = TRIM(regexp_replace(name, '\s*\(Cable\)\s*$', '', 'i')),
  equipment = ARRAY['cable'],
  exercise_type = 'weighted'
WHERE lower(name) LIKE '%(cable)';

-- 4. Fix exercises ending with (Machine) - set equipment and clean name
UPDATE public.exercises
SET
  name = TRIM(regexp_replace(name, '\s*\(Machine\)\s*$', '', 'i')),
  equipment = ARRAY['machine'],
  exercise_type = 'weighted'
WHERE lower(name) LIKE '%(machine)';

-- 5. Fix exercises ending with (DB) - set equipment and clean name
UPDATE public.exercises
SET
  name = TRIM(regexp_replace(name, '\s*\(DB\)\s*$', '', 'i')),
  equipment = ARRAY['dumbbell'],
  exercise_type = 'weighted'
WHERE lower(name) LIKE '%(db)';

-- 6. Fix exercises ending with (BB) - set equipment and clean name
UPDATE public.exercises
SET
  name = TRIM(regexp_replace(name, '\s*\(BB\)\s*$', '', 'i')),
  equipment = ARRAY['barbell'],
  exercise_type = 'weighted'
WHERE lower(name) LIKE '%(bb)';

-- 7. Fix exercises ending with (Bodyweight) - clean name and set type
UPDATE public.exercises
SET
  name = TRIM(regexp_replace(name, '\s*\(Bodyweight\)\s*$', '', 'i')),
  equipment = ARRAY[]::text[],
  exercise_type = 'bodyweight'
WHERE lower(name) LIKE '%(bodyweight)';

-- 8. Fix exercises ending with (Band) or (Resistance Band)
UPDATE public.exercises
SET
  name = TRIM(regexp_replace(name, '\s*\(Band\)\s*$', '', 'i')),
  equipment = ARRAY['band'],
  exercise_type = 'weighted'
WHERE lower(name) LIKE '%(band)';

UPDATE public.exercises
SET
  name = TRIM(regexp_replace(name, '\s*\(Resistance Band\)\s*$', '', 'i')),
  equipment = ARRAY['band'],
  exercise_type = 'weighted'
WHERE lower(name) LIKE '%(resistance band)';

-- 9. Fix exercises with equipment in middle like "Bench Press - Close Grip (Barbell)"
UPDATE public.exercises
SET
  name = TRIM(regexp_replace(name, '\s*\([^)]*\)\s*$', '')),
  equipment = ARRAY['barbell'],
  exercise_type = 'weighted'
WHERE name ~ '\s+-\s+.*\(Barbell\)$';

UPDATE public.exercises
SET
  name = TRIM(regexp_replace(name, '\s*\([^)]*\)\s*$', '')),
  equipment = ARRAY['dumbbell'],
  exercise_type = 'weighted'
WHERE name ~ '\s+-\s+.*\(Dumbbell\)$';

UPDATE public.exercises
SET
  name = TRIM(regexp_replace(name, '\s*\([^)]*\)\s*$', '')),
  equipment = ARRAY['cable'],
  exercise_type = 'weighted'
WHERE name ~ '\s+-\s+.*\(Cable\)$';

-- 10. Fix specific bodyweight exercises that should NOT be bodyweight
-- These use equipment but might have been incorrectly imported
UPDATE public.exercises
SET exercise_type = 'weighted', equipment = ARRAY['dumbbell']
WHERE exercise_type = 'bodyweight'
AND lower(name) IN (
  'dumbbell bench press', 'dumbbell row', 'dumbbell curl', 'dumbbell shoulder press',
  'dumbbell flyes', 'lateral raises', 'front raises', 'hammer curl', 'arnold press',
  'dumbbell shrug', 'lunges', 'goblet squat', 'dumbbell romanian deadlift',
  'incline dumbbell press', 'concentration curl', 'rear delt flyes'
);

UPDATE public.exercises
SET exercise_type = 'weighted', equipment = ARRAY['barbell']
WHERE exercise_type = 'bodyweight'
AND lower(name) IN (
  'bench press', 'squat', 'deadlift', 'barbell row', 'overhead press',
  'barbell curl', 'romanian deadlift', 'front squat', 'barbell shrug',
  'skull crushers', 'close grip bench press', 'incline bench press',
  'decline bench press', 'upright row', 'good mornings', 'hip thrust'
);

UPDATE public.exercises
SET exercise_type = 'weighted', equipment = ARRAY['cable']
WHERE exercise_type = 'bodyweight'
AND lower(name) IN (
  'lat pulldown', 'cable crossover', 'cable fly', 'triceps pushdown',
  'face pulls', 'cable curl', 'seated cable row', 'cable lateral raise',
  'cable crunch', 'straight arm pulldown', 'overhead tricep extension',
  'cable kickback'
);

UPDATE public.exercises
SET exercise_type = 'weighted', equipment = ARRAY['machine']
WHERE exercise_type = 'bodyweight'
AND lower(name) IN (
  'leg press', 'leg extension', 'leg curl', 'seated leg curl', 'hack squat',
  'chest press machine', 'shoulder press machine', 'seated row machine',
  'lat pulldown machine', 'chest fly machine', 'machine curl', 'preacher curl machine',
  'tricep extension machine', 'standing calf raise', 'seated calf raise',
  'crunch machine', 't-bar row', 'incline chest press machine'
);

-- 11. Ensure actual bodyweight exercises are marked correctly
UPDATE public.exercises
SET exercise_type = 'bodyweight', equipment = ARRAY[]::text[]
WHERE lower(name) IN (
  'push-ups', 'pull-ups', 'chin-ups', 'dips', 'tricep dips', 'chest dip',
  'plank', 'hanging leg raise', 'russian twist', 'ab wheel rollout',
  'glute bridge', 'bodyweight squat', 'burpees', 'mountain climbers',
  'lunges' -- bodyweight lunges without dumbbells
);

-- Actually, lunges often use dumbbells, let's be more specific
UPDATE public.exercises
SET exercise_type = 'weighted', equipment = ARRAY['dumbbell']
WHERE lower(name) = 'lunges';

-- 12. Merge duplicates again after renaming
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

DELETE FROM public.exercises e1
WHERE EXISTS (
  SELECT 1 FROM public.exercises e2
  WHERE lower(e2.name) = lower(e1.name)
  AND (e2.created_at < e1.created_at OR (e2.created_at = e1.created_at AND e2.id < e1.id))
);
