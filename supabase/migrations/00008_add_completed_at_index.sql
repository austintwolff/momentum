-- Add index for completed_at queries
-- Queries frequently filter/order by completed_at but only started_at was indexed

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_completed
ON public.workout_sessions(user_id, completed_at DESC);
