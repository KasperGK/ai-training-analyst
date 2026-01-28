-- Migration: Change sessions.date from DATE to TIMESTAMPTZ to preserve workout start time
-- This allows displaying the actual time of day when workouts occurred

-- Alter the column type from DATE to TIMESTAMPTZ
-- Existing DATE values will be converted to TIMESTAMPTZ at midnight UTC
ALTER TABLE public.sessions
  ALTER COLUMN date TYPE TIMESTAMPTZ USING date::TIMESTAMPTZ;

-- Add a comment explaining the column
COMMENT ON COLUMN public.sessions.date IS 'Workout start timestamp (local time from intervals.icu)';
