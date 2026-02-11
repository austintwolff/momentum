-- Double stored weight_kg for all dumbbell exercise sets
-- so the DB consistently stores total weight moved (both dumbbells combined).
-- The app UI will halve this value for display and double user input before saving.

UPDATE workout_sets
SET weight_kg = weight_kg * 2
WHERE exercise_id IN (
  SELECT id FROM exercises
  WHERE 'dumbbell' = ANY(equipment)
    AND exercise_type = 'weighted'
)
AND weight_kg IS NOT NULL;
