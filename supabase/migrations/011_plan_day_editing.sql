-- Plan Day Editing Schema
-- Adds support for skipping and rescheduling workouts

-- Add fields for skip/reschedule functionality
ALTER TABLE public.plan_days ADD COLUMN IF NOT EXISTS skipped BOOLEAN DEFAULT FALSE;
ALTER TABLE public.plan_days ADD COLUMN IF NOT EXISTS rescheduled_from DATE;
ALTER TABLE public.plan_days ADD COLUMN IF NOT EXISTS rescheduled_to DATE;

-- Index for finding skipped days (useful for compliance reporting)
CREATE INDEX IF NOT EXISTS idx_plan_days_skipped ON public.plan_days(plan_id) WHERE skipped = TRUE;

-- Comment on new columns
COMMENT ON COLUMN public.plan_days.skipped IS 'Whether the workout was intentionally skipped';
COMMENT ON COLUMN public.plan_days.rescheduled_from IS 'Original date if this workout was rescheduled from another day';
COMMENT ON COLUMN public.plan_days.rescheduled_to IS 'New date if this workout was rescheduled to another day';
