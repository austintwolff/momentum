-- Migration: PR Tracking
-- Adds goal-bucket-specific e1RM tracking and is_pr flag on sets

-- Add is_pr flag to workout_sets
ALTER TABLE workout_sets
ADD COLUMN is_pr BOOLEAN DEFAULT FALSE;

-- Add goal-bucket-specific best e1RM fields to exercise_baselines
-- Strength: 1-6 reps, Hypertrophy: 6-12 reps, Endurance: 12+ reps
ALTER TABLE exercise_baselines
ADD COLUMN best_e1rm_strength REAL DEFAULT 0,
ADD COLUMN best_e1rm_hypertrophy REAL DEFAULT 0,
ADD COLUMN best_e1rm_endurance REAL DEFAULT 0;

-- Create index for efficient PR queries
CREATE INDEX idx_workout_sets_is_pr ON workout_sets(is_pr) WHERE is_pr = TRUE;
