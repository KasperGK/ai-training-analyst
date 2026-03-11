-- Session Reports: AI-generated coaching reports for training sessions
-- Each session gets a 0-100 score, coaching headline, quick take, and deep analysis

CREATE TABLE public.session_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  headline TEXT NOT NULL,
  quick_take TEXT NOT NULL,
  deep_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  goal_relevance JSONB,
  session_context JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_reports_session_id_unique UNIQUE (session_id)
);

-- Indexes
CREATE INDEX idx_session_reports_athlete_created
  ON public.session_reports (athlete_id, created_at DESC);

CREATE INDEX idx_session_reports_unread
  ON public.session_reports (athlete_id, created_at DESC)
  WHERE is_read = false;

-- RLS
ALTER TABLE public.session_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session reports"
  ON public.session_reports
  FOR SELECT
  USING (auth.uid() = athlete_id);

CREATE POLICY "Users can update own session reports"
  ON public.session_reports
  FOR UPDATE
  USING (auth.uid() = athlete_id);

CREATE POLICY "Users can insert own session reports"
  ON public.session_reports
  FOR INSERT
  WITH CHECK (auth.uid() = athlete_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_session_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_reports_updated_at
  BEFORE UPDATE ON public.session_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_session_reports_updated_at();
