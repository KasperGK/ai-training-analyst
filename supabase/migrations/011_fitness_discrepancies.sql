-- Fitness Discrepancy Detection
-- Migration 011: Track divergence between local DB and intervals.icu fitness values

CREATE TABLE IF NOT EXISTS public.fitness_discrepancies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  date TEXT NOT NULL,  -- The date of the fitness record that diverged (YYYY-MM-DD)

  -- Local values (what we had before sync)
  local_ctl DECIMAL(6,2) NOT NULL,
  local_atl DECIMAL(6,2) NOT NULL,

  -- Intervals.icu values (what came in during sync)
  remote_ctl DECIMAL(6,2) NOT NULL,
  remote_atl DECIMAL(6,2) NOT NULL,

  -- Computed deltas
  ctl_delta DECIMAL(6,2) NOT NULL,  -- remote_ctl - local_ctl
  atl_delta DECIMAL(6,2) NOT NULL,  -- remote_atl - local_atl

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  resolved_at TIMESTAMPTZ,
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discrepancies_athlete
  ON public.fitness_discrepancies(athlete_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_active
  ON public.fitness_discrepancies(athlete_id, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_discrepancies_date
  ON public.fitness_discrepancies(athlete_id, date DESC);

-- RLS Policies
ALTER TABLE public.fitness_discrepancies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Athletes can view their own discrepancies" ON public.fitness_discrepancies;
CREATE POLICY "Athletes can view their own discrepancies"
  ON public.fitness_discrepancies FOR SELECT
  USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Athletes can insert their own discrepancies" ON public.fitness_discrepancies;
CREATE POLICY "Athletes can insert their own discrepancies"
  ON public.fitness_discrepancies FOR INSERT
  WITH CHECK (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Athletes can update their own discrepancies" ON public.fitness_discrepancies;
CREATE POLICY "Athletes can update their own discrepancies"
  ON public.fitness_discrepancies FOR UPDATE
  USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Athletes can delete their own discrepancies" ON public.fitness_discrepancies;
CREATE POLICY "Athletes can delete their own discrepancies"
  ON public.fitness_discrepancies FOR DELETE
  USING (auth.uid() = athlete_id);
