-- Add ramp_rate column to fitness_history for overtraining detection
-- Ramp rate is the rate of CTL (fitness) change per week
-- Values > 7 indicate aggressive build, > 10 indicate overtraining risk

ALTER TABLE public.fitness_history ADD COLUMN IF NOT EXISTS ramp_rate DECIMAL(5,2);

-- Add index for querying recent wellness with ramp rate
CREATE INDEX IF NOT EXISTS idx_fitness_history_ramp_rate ON public.fitness_history(athlete_id, date DESC) WHERE ramp_rate IS NOT NULL;
