-- Proactive Insights System
-- Migration 007: Insights table for AI-generated notifications

CREATE TABLE IF NOT EXISTS public.insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'trend',       -- "CTL up 15% this month"
    'warning',     -- "High fatigue, consider rest"
    'achievement', -- "New power PR!"
    'suggestion',  -- "Good day for intensity based on form"
    'pattern',     -- "You perform best after 2 rest days"
    'event_prep'   -- "3 weeks to target event, time to peak"
  )),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  data JSONB DEFAULT '{}',  -- Supporting data (metrics, comparisons, etc.)
  source TEXT DEFAULT 'ai_generated' CHECK (source IN ('ai_generated', 'rule_based', 'pattern_detected')),
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  action_taken BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track when insights were last generated for each athlete
CREATE TABLE IF NOT EXISTS public.insight_generation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  insights_created INTEGER DEFAULT 0,
  patterns_detected JSONB DEFAULT '[]',
  model_used TEXT,
  tokens_used INTEGER,
  duration_ms INTEGER,
  UNIQUE(athlete_id, generated_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insights_athlete ON public.insights(athlete_id);
CREATE INDEX IF NOT EXISTS idx_insights_unread ON public.insights(athlete_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_insights_type ON public.insights(athlete_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON public.insights(athlete_id, priority, created_at DESC);
-- Note: Can't use NOW() in partial index, use simpler index + filter at query time
CREATE INDEX IF NOT EXISTS idx_insights_active ON public.insights(athlete_id, is_dismissed, expires_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insight_gen_log_athlete ON public.insight_generation_log(athlete_id, generated_at DESC);

-- RLS Policies
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_generation_log ENABLE ROW LEVEL SECURITY;

-- Athletes can only see their own insights
DROP POLICY IF EXISTS "Athletes can view their own insights" ON public.insights;
CREATE POLICY "Athletes can view their own insights"
  ON public.insights FOR SELECT
  USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Athletes can update their own insights" ON public.insights;
CREATE POLICY "Athletes can update their own insights"
  ON public.insights FOR UPDATE
  USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Athletes can insert their own insights" ON public.insights;
CREATE POLICY "Athletes can insert their own insights"
  ON public.insights FOR INSERT
  WITH CHECK (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Athletes can delete their own insights" ON public.insights;
CREATE POLICY "Athletes can delete their own insights"
  ON public.insights FOR DELETE
  USING (auth.uid() = athlete_id);

-- Generation log policies
DROP POLICY IF EXISTS "Athletes can view their own generation log" ON public.insight_generation_log;
CREATE POLICY "Athletes can view their own generation log"
  ON public.insight_generation_log FOR SELECT
  USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Athletes can insert their own generation log" ON public.insight_generation_log;
CREATE POLICY "Athletes can insert their own generation log"
  ON public.insight_generation_log FOR INSERT
  WITH CHECK (auth.uid() = athlete_id);

-- Helper function to get active insights for an athlete
CREATE OR REPLACE FUNCTION get_active_insights(
  p_athlete_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  insight_type TEXT,
  priority TEXT,
  title TEXT,
  content TEXT,
  data JSONB,
  is_read BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.insight_type,
    i.priority,
    i.title,
    i.content,
    i.data,
    i.is_read,
    i.created_at
  FROM public.insights i
  WHERE i.athlete_id = p_athlete_id
    AND i.is_dismissed = false
    AND (i.expires_at IS NULL OR i.expires_at > NOW())
  ORDER BY
    CASE i.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    i.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to check if insights generation is needed (not run in last 6 hours)
CREATE OR REPLACE FUNCTION should_generate_insights(p_athlete_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_gen TIMESTAMPTZ;
BEGIN
  SELECT generated_at INTO last_gen
  FROM public.insight_generation_log
  WHERE athlete_id = p_athlete_id
  ORDER BY generated_at DESC
  LIMIT 1;

  IF last_gen IS NULL THEN
    RETURN true;
  END IF;

  -- Generate if last generation was more than 6 hours ago
  RETURN last_gen < NOW() - INTERVAL '6 hours';
END;
$$;
