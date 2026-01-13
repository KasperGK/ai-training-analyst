-- Training Plans Schema
-- Phase 4: Plan Generation for multi-week structured training plans

-- Main training plans table
CREATE TABLE public.training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Plan parameters
  goal TEXT NOT NULL, -- 'base_build', 'ftp_build', 'event_prep', 'taper', 'maintenance'
  duration_weeks INTEGER NOT NULL,
  weekly_hours_target NUMERIC(4,1), -- Target hours per week

  -- Scheduling
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  key_workout_days INTEGER[] DEFAULT '{2,4,6}', -- Days of week for key workouts (0=Sun, 6=Sat)

  -- Event targeting (optional)
  target_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  target_event_date DATE,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'abandoned')),
  progress_percent INTEGER DEFAULT 0,

  -- Generated plan data (JSON for flexibility)
  plan_data JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual plan days
CREATE TABLE public.plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,

  -- Scheduling
  date DATE NOT NULL,
  week_number INTEGER NOT NULL, -- 1-indexed week within plan
  day_of_week INTEGER NOT NULL, -- 0-6 (Sun-Sat)

  -- Workout assignment
  workout_template_id TEXT, -- References library workout ID
  workout_type TEXT, -- Category: recovery, endurance, sweetspot, etc.
  workout_name TEXT,
  target_tss INTEGER,
  target_duration_minutes INTEGER,
  target_if NUMERIC(3,2), -- Intensity factor

  -- Custom workout details (if not using template)
  custom_description TEXT,
  intervals_json JSONB, -- For custom interval structure

  -- Execution tracking
  completed BOOLEAN DEFAULT FALSE,
  actual_session_id TEXT, -- Links to sessions table
  actual_tss INTEGER,
  actual_duration_minutes INTEGER,
  compliance_score NUMERIC(3,2), -- 0-1 how well they followed the plan

  -- Notes
  coach_notes TEXT,
  athlete_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(plan_id, date)
);

-- Power personal bests tracking (for plan personalization)
CREATE TABLE public.power_bests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Power data
  duration_seconds INTEGER NOT NULL, -- Duration in seconds (5, 60, 300, 1200, etc.)
  power_watts INTEGER NOT NULL,
  watts_per_kg NUMERIC(4,2), -- Calculated W/kg

  -- Source
  session_id TEXT, -- Link to source session
  recorded_date DATE NOT NULL,

  -- Context
  is_current_best BOOLEAN DEFAULT TRUE, -- False when superseded

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique index for current bests (only one current best per duration per athlete)
CREATE UNIQUE INDEX idx_power_bests_current_unique
  ON public.power_bests(athlete_id, duration_seconds)
  WHERE is_current_best = TRUE;

-- Indexes for performance
CREATE INDEX idx_training_plans_athlete ON public.training_plans(athlete_id);
CREATE INDEX idx_training_plans_status ON public.training_plans(status) WHERE status = 'active';
CREATE INDEX idx_training_plans_dates ON public.training_plans(start_date, end_date);

CREATE INDEX idx_plan_days_plan ON public.plan_days(plan_id);
CREATE INDEX idx_plan_days_date ON public.plan_days(date);
CREATE INDEX idx_plan_days_incomplete ON public.plan_days(plan_id, date) WHERE completed = FALSE;

CREATE INDEX idx_power_bests_athlete ON public.power_bests(athlete_id);
CREATE INDEX idx_power_bests_current ON public.power_bests(athlete_id, duration_seconds) WHERE is_current_best = TRUE;

-- RLS Policies
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.power_bests ENABLE ROW LEVEL SECURITY;

-- Training plans: users can only access their own
CREATE POLICY "Users can view own training plans"
  ON public.training_plans FOR SELECT
  USING (auth.uid() = athlete_id);

CREATE POLICY "Users can create own training plans"
  ON public.training_plans FOR INSERT
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Users can update own training plans"
  ON public.training_plans FOR UPDATE
  USING (auth.uid() = athlete_id);

CREATE POLICY "Users can delete own training plans"
  ON public.training_plans FOR DELETE
  USING (auth.uid() = athlete_id);

-- Plan days: inherit from plan ownership
CREATE POLICY "Users can view own plan days"
  ON public.plan_days FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.training_plans tp
    WHERE tp.id = plan_days.plan_id AND tp.athlete_id = auth.uid()
  ));

CREATE POLICY "Users can create own plan days"
  ON public.plan_days FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.training_plans tp
    WHERE tp.id = plan_days.plan_id AND tp.athlete_id = auth.uid()
  ));

CREATE POLICY "Users can update own plan days"
  ON public.plan_days FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.training_plans tp
    WHERE tp.id = plan_days.plan_id AND tp.athlete_id = auth.uid()
  ));

CREATE POLICY "Users can delete own plan days"
  ON public.plan_days FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.training_plans tp
    WHERE tp.id = plan_days.plan_id AND tp.athlete_id = auth.uid()
  ));

-- Power bests: users can only access their own
CREATE POLICY "Users can view own power bests"
  ON public.power_bests FOR SELECT
  USING (auth.uid() = athlete_id);

CREATE POLICY "Users can create own power bests"
  ON public.power_bests FOR INSERT
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Users can update own power bests"
  ON public.power_bests FOR UPDATE
  USING (auth.uid() = athlete_id);

CREATE POLICY "Users can delete own power bests"
  ON public.power_bests FOR DELETE
  USING (auth.uid() = athlete_id);

-- Trigger for updated_at on training_plans
CREATE TRIGGER update_training_plans_updated_at
  BEFORE UPDATE ON public.training_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on plan_days
CREATE TRIGGER update_plan_days_updated_at
  BEFORE UPDATE ON public.plan_days
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
