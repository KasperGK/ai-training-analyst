-- Sleep and Recovery Data
-- Migration 008: Add sleep metrics from Garmin via intervals.icu

-- Add sleep and recovery columns to fitness_history
ALTER TABLE public.fitness_history ADD COLUMN IF NOT EXISTS sleep_seconds INTEGER;
ALTER TABLE public.fitness_history ADD COLUMN IF NOT EXISTS sleep_score INTEGER;
ALTER TABLE public.fitness_history ADD COLUMN IF NOT EXISTS hrv DECIMAL(6,2);
ALTER TABLE public.fitness_history ADD COLUMN IF NOT EXISTS resting_hr INTEGER;
ALTER TABLE public.fitness_history ADD COLUMN IF NOT EXISTS readiness INTEGER;

-- Add index for sleep queries
CREATE INDEX IF NOT EXISTS idx_fitness_history_sleep ON public.fitness_history(athlete_id, date DESC) WHERE sleep_seconds IS NOT NULL;
