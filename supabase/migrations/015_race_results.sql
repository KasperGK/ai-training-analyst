-- ZwiftPower Race Results Schema
-- Migration 015: Race results and competitor tracking

-- Race results for the athlete
CREATE TABLE public.race_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  zwift_event_id TEXT NOT NULL,
  race_name TEXT NOT NULL,
  race_date TIMESTAMPTZ NOT NULL,

  -- Course metadata
  race_type TEXT,                -- flat, hilly, mixed, tt
  distance_km DECIMAL(6,2),
  elevation_m INTEGER,
  route_name TEXT,               -- Zwift route name (e.g., "Tempus Fugit")

  -- Results
  category TEXT,                 -- A, B, C, D, E (or ZRS-based)
  placement INTEGER,
  total_in_category INTEGER,
  zwift_racing_score INTEGER,    -- ZRS if available

  -- Performance metrics
  duration_seconds INTEGER,
  avg_power INTEGER,
  avg_wkg DECIMAL(4,2),
  normalized_power INTEGER,
  max_power INTEGER,
  avg_hr INTEGER,
  max_hr INTEGER,

  -- Training context (auto-captured from fitness_history at race date)
  ctl_at_race INTEGER,
  atl_at_race INTEGER,
  tsb_at_race INTEGER,

  -- Metadata
  source TEXT DEFAULT 'zwiftpower_api',
  raw_data JSONB,                -- Full ZwiftPower response for this result
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(athlete_id, zwift_event_id)
);

-- Competitors data (riders near user's position)
CREATE TABLE public.race_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_result_id UUID NOT NULL REFERENCES public.race_results(id) ON DELETE CASCADE,

  zwift_id TEXT,                 -- ZwiftPower/Zwift rider ID
  rider_name TEXT NOT NULL,
  placement INTEGER NOT NULL,
  category TEXT,

  -- Their performance
  avg_power INTEGER,
  avg_wkg DECIMAL(4,2),
  duration_seconds INTEGER,
  zwift_racing_score INTEGER,

  -- Relative to user
  position_delta INTEGER,        -- negative = places ahead, positive = places behind
  time_delta_seconds INTEGER,    -- negative = faster, positive = slower
  power_delta INTEGER,           -- their avg_power minus user's avg_power

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Zwift credentials to integrations table
-- Using encrypted storage for password (application-level encryption)
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS zwift_username TEXT,
  ADD COLUMN IF NOT EXISTS zwift_password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS zwift_id TEXT;

-- Indexes for common queries
CREATE INDEX idx_race_results_athlete_date ON public.race_results(athlete_id, race_date DESC);
CREATE INDEX idx_race_results_race_type ON public.race_results(athlete_id, race_type);
CREATE INDEX idx_race_results_category ON public.race_results(athlete_id, category);
CREATE INDEX idx_race_competitors_result ON public.race_competitors(race_result_id);
CREATE INDEX idx_race_competitors_zwift_id ON public.race_competitors(zwift_id);

-- RLS Policies for race_results
ALTER TABLE public.race_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own race results"
  ON public.race_results FOR SELECT
  USING (athlete_id = auth.uid());

CREATE POLICY "Users can insert their own race results"
  ON public.race_results FOR INSERT
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Users can update their own race results"
  ON public.race_results FOR UPDATE
  USING (athlete_id = auth.uid());

CREATE POLICY "Users can delete their own race results"
  ON public.race_results FOR DELETE
  USING (athlete_id = auth.uid());

-- RLS Policies for race_competitors
ALTER TABLE public.race_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view competitors from their races"
  ON public.race_competitors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.race_results rr
      WHERE rr.id = race_result_id AND rr.athlete_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert competitors for their races"
  ON public.race_competitors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.race_results rr
      WHERE rr.id = race_result_id AND rr.athlete_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete competitors from their races"
  ON public.race_competitors FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.race_results rr
      WHERE rr.id = race_result_id AND rr.athlete_id = auth.uid()
    )
  );

-- Updated_at trigger for race_results
CREATE OR REPLACE FUNCTION public.update_race_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER race_results_updated_at
  BEFORE UPDATE ON public.race_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_race_results_updated_at();

-- Comment on tables
COMMENT ON TABLE public.race_results IS 'ZwiftPower race results for athletes, including placement and performance data';
COMMENT ON TABLE public.race_competitors IS 'Competitor data from races, capturing nearby finishers for analysis';
