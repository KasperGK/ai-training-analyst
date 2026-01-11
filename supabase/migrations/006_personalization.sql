-- Personalization Layer
-- Migration 006: Athlete memory and workout outcomes

-- Athlete memory: stores preferences, patterns, injuries, achievements, etc.
CREATE TABLE IF NOT EXISTS public.athlete_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'preference',    -- e.g., "prefers morning workouts", "likes zone 2 rides"
    'pattern',       -- e.g., "performs best after 2 rest days"
    'injury',        -- e.g., "knee issues - avoid high cadence"
    'lifestyle',     -- e.g., "works shifts, irregular schedule"
    'feedback',      -- e.g., "found sweetspot intervals too hard"
    'achievement',   -- e.g., "completed first century ride"
    'goal',          -- e.g., "targeting sub-5hr century in June"
    'context'        -- e.g., "has power meter on outdoor bike only"
  )),
  content TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL DEFAULT 'user_stated' CHECK (source IN (
    'user_stated',   -- explicitly told by athlete
    'ai_inferred',   -- AI concluded from conversation
    'data_derived'   -- derived from training data patterns
  )),
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workout outcomes: track what was suggested vs what happened
CREATE TABLE IF NOT EXISTS public.workout_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  conversation_id UUID,
  suggested_workout TEXT,
  suggested_type TEXT,
  actual_type TEXT,
  followed_suggestion BOOLEAN,
  rpe INTEGER CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_athlete_memory_athlete ON public.athlete_memory(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_memory_type ON public.athlete_memory(athlete_id, memory_type);
-- Note: Can't use NOW() in partial index, so we index expires_at for filtering at query time
CREATE INDEX IF NOT EXISTS idx_athlete_memory_expires ON public.athlete_memory(athlete_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_workout_outcomes_athlete ON public.workout_outcomes(athlete_id);
CREATE INDEX IF NOT EXISTS idx_workout_outcomes_session ON public.workout_outcomes(session_id);

-- RLS Policies
ALTER TABLE public.athlete_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_outcomes ENABLE ROW LEVEL SECURITY;

-- Athletes can only access their own memories
DROP POLICY IF EXISTS "Athletes can view their own memories" ON public.athlete_memory;
CREATE POLICY "Athletes can view their own memories"
  ON public.athlete_memory FOR SELECT
  USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Athletes can insert their own memories" ON public.athlete_memory;
CREATE POLICY "Athletes can insert their own memories"
  ON public.athlete_memory FOR INSERT
  WITH CHECK (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Athletes can update their own memories" ON public.athlete_memory;
CREATE POLICY "Athletes can update their own memories"
  ON public.athlete_memory FOR UPDATE
  USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Athletes can delete their own memories" ON public.athlete_memory;
CREATE POLICY "Athletes can delete their own memories"
  ON public.athlete_memory FOR DELETE
  USING (auth.uid() = athlete_id);

-- Athletes can only access their own workout outcomes
DROP POLICY IF EXISTS "Athletes can view their own outcomes" ON public.workout_outcomes;
CREATE POLICY "Athletes can view their own outcomes"
  ON public.workout_outcomes FOR SELECT
  USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Athletes can insert their own outcomes" ON public.workout_outcomes;
CREATE POLICY "Athletes can insert their own outcomes"
  ON public.workout_outcomes FOR INSERT
  WITH CHECK (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Athletes can update their own outcomes" ON public.workout_outcomes;
CREATE POLICY "Athletes can update their own outcomes"
  ON public.workout_outcomes FOR UPDATE
  USING (auth.uid() = athlete_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_athlete_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS athlete_memory_updated_at ON public.athlete_memory;
CREATE TRIGGER athlete_memory_updated_at
  BEFORE UPDATE ON public.athlete_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_athlete_memory_updated_at();

-- Helper function to get active memories for an athlete
CREATE OR REPLACE FUNCTION get_athlete_memories(
  p_athlete_id UUID,
  p_memory_types TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  memory_type TEXT,
  content TEXT,
  confidence DECIMAL(3,2),
  source TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.memory_type,
    am.content,
    am.confidence,
    am.source,
    am.created_at
  FROM public.athlete_memory am
  WHERE am.athlete_id = p_athlete_id
    AND (am.expires_at IS NULL OR am.expires_at > NOW())
    AND (p_memory_types IS NULL OR am.memory_type = ANY(p_memory_types))
  ORDER BY
    CASE am.memory_type
      WHEN 'injury' THEN 1      -- injuries first (safety)
      WHEN 'goal' THEN 2        -- goals second
      WHEN 'preference' THEN 3  -- preferences third
      ELSE 4
    END,
    am.confidence DESC,
    am.created_at DESC
  LIMIT p_limit;
END;
$$;
