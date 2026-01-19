-- AI Training Analyst Database Schema
-- Migration 013: Body Measurements (Withings integration)

-- Body measurements table (weight, body composition from scales)
CREATE TABLE public.body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  measured_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual', -- 'withings', 'manual', 'garmin'
  external_id TEXT, -- Withings grpid or external reference

  -- Core measurements
  weight_kg DECIMAL(5,2),

  -- Body composition (from smart scales)
  fat_mass_kg DECIMAL(5,2),
  fat_ratio_percent DECIMAL(4,1),
  fat_free_mass_kg DECIMAL(5,2),
  muscle_mass_kg DECIMAL(5,2),
  bone_mass_kg DECIMAL(4,2),
  hydration_kg DECIMAL(5,2),

  -- Calculated/derived
  bmi DECIMAL(4,1),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate measurements
  UNIQUE(athlete_id, measured_at, source)
);

-- Index for querying measurements by date
CREATE INDEX idx_body_measurements_athlete_date
  ON public.body_measurements(athlete_id, measured_at DESC);

-- Index for source filtering
CREATE INDEX idx_body_measurements_source
  ON public.body_measurements(athlete_id, source);

-- Enable RLS
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own body measurements"
  ON public.body_measurements FOR SELECT
  USING (auth.uid() = athlete_id);

CREATE POLICY "Users can insert own body measurements"
  ON public.body_measurements FOR INSERT
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Users can update own body measurements"
  ON public.body_measurements FOR UPDATE
  USING (auth.uid() = athlete_id);

CREATE POLICY "Users can delete own body measurements"
  ON public.body_measurements FOR DELETE
  USING (auth.uid() = athlete_id);

-- Add Withings to provider enum comment (for documentation)
COMMENT ON TABLE public.body_measurements IS
  'Body weight and composition measurements from scales (Withings, Garmin, manual)';

-- Update athletes table to track last weight sync
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS weight_updated_at TIMESTAMPTZ;
