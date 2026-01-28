-- Migration: Enhanced Goals System
-- Adds support for metric goals and progress tracking

-- Add metric goal support columns to goals table
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS metric_type TEXT;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS metric_conditions JSONB;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS achievement_session_id TEXT;

-- Comment on new columns
COMMENT ON COLUMN public.goals.metric_type IS 'Type of metric goal: hr_at_power, power_duration, relative_power';
COMMENT ON COLUMN public.goals.metric_conditions IS 'JSON conditions for metric goals, e.g., {"target_hr": 150, "target_power": 250}';
COMMENT ON COLUMN public.goals.last_checked_at IS 'When goal progress was last checked against activity data';
COMMENT ON COLUMN public.goals.achievement_session_id IS 'Session ID where goal was achieved (if applicable)';

-- Create goal_progress table for tracking progress over time
CREATE TABLE IF NOT EXISTS public.goal_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  value DECIMAL(10,2) NOT NULL,
  session_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient goal progress queries
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON public.goal_progress(goal_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_progress_session ON public.goal_progress(session_id) WHERE session_id IS NOT NULL;

-- Enable RLS on goal_progress
ALTER TABLE public.goal_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for goal_progress (users can only access progress for their own goals)
CREATE POLICY "Users can view their own goal progress" ON public.goal_progress
  FOR SELECT USING (
    goal_id IN (SELECT id FROM public.goals WHERE athlete_id = auth.uid())
  );

CREATE POLICY "Users can insert their own goal progress" ON public.goal_progress
  FOR INSERT WITH CHECK (
    goal_id IN (SELECT id FROM public.goals WHERE athlete_id = auth.uid())
  );

CREATE POLICY "Users can update their own goal progress" ON public.goal_progress
  FOR UPDATE USING (
    goal_id IN (SELECT id FROM public.goals WHERE athlete_id = auth.uid())
  );

CREATE POLICY "Users can delete their own goal progress" ON public.goal_progress
  FOR DELETE USING (
    goal_id IN (SELECT id FROM public.goals WHERE athlete_id = auth.uid())
  );

-- Index on goals for metric goal queries
CREATE INDEX IF NOT EXISTS idx_goals_metric_type ON public.goals(metric_type) WHERE metric_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_last_checked ON public.goals(athlete_id, last_checked_at) WHERE status = 'active';
