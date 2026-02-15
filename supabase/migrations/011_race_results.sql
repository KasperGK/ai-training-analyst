-- Race results table for ZwiftPower and other race data sources
-- Used as ground truth for race detection (vs heuristic-based detection)
CREATE TABLE public.race_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  race_name TEXT NOT NULL,
  race_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'zwiftpower' CHECK (source IN ('zwiftpower', 'manual', 'strava', 'other')),
  external_race_id TEXT,
  category TEXT,
  position INTEGER,
  total_riders INTEGER,
  avg_power INTEGER,
  normalized_power INTEGER,
  avg_hr INTEGER,
  duration_seconds INTEGER,
  race_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_race_results_athlete ON public.race_results(athlete_id);
CREATE INDEX idx_race_results_date ON public.race_results(race_date);
CREATE INDEX idx_race_results_session ON public.race_results(session_id);
CREATE UNIQUE INDEX idx_race_results_external ON public.race_results(athlete_id, source, external_race_id) WHERE external_race_id IS NOT NULL;

-- RLS
ALTER TABLE public.race_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own race results" ON public.race_results FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "Users can insert own race results" ON public.race_results FOR INSERT WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "Users can update own race results" ON public.race_results FOR UPDATE USING (auth.uid() = athlete_id);
