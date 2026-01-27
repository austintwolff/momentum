-- Add workout score columns to workout_sessions table
-- These columns store the calculated workout score components

ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS final_score integer,
ADD COLUMN IF NOT EXISTS progress_score integer,
ADD COLUMN IF NOT EXISTS work_score integer,
ADD COLUMN IF NOT EXISTS consistency_score integer,
ADD COLUMN IF NOT EXISTS effective_set_count numeric(5,2),
ADD COLUMN IF NOT EXISTS epr_pr_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS weight_pr_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS closeness_aggregate_ratio numeric(5,3),
ADD COLUMN IF NOT EXISTS exercise_scores jsonb;

-- Add comments for documentation
COMMENT ON COLUMN workout_sessions.final_score IS 'Overall workout score (1-100)';
COMMENT ON COLUMN workout_sessions.progress_score IS 'Points from PRs and closeness to PR (0-55)';
COMMENT ON COLUMN workout_sessions.work_score IS 'Points from effective set volume (0-40)';
COMMENT ON COLUMN workout_sessions.consistency_score IS 'Points from workout frequency (0-5)';
COMMENT ON COLUMN workout_sessions.effective_set_count IS 'Weighted set count (warmups=0.25, working=1.0)';
COMMENT ON COLUMN workout_sessions.epr_pr_count IS 'Number of E1RM PRs achieved';
COMMENT ON COLUMN workout_sessions.weight_pr_count IS 'Number of weight PRs achieved';
COMMENT ON COLUMN workout_sessions.closeness_aggregate_ratio IS 'Average closeness to baseline across exercises';
COMMENT ON COLUMN workout_sessions.exercise_scores IS 'Per-exercise score breakdown (JSON array)';
