-- AI Training Analyst Database Schema
-- Migration 004: Sync Infrastructure
-- Enables syncing data from intervals.icu to local Supabase storage

-- Track sync state for each athlete
CREATE TABLE public.sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'intervals_icu',
  last_sync_at TIMESTAMPTZ,
  last_activity_date DATE,  -- newest synced activity date
  oldest_activity_date DATE, -- oldest synced activity date (for incremental backfill)
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'error')),
  error_message TEXT,
  activities_synced INTEGER DEFAULT 0,
  wellness_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(athlete_id, provider)
);

-- Add sync tracking columns to sessions
-- Note: external_id and raw_data already exist in 001_schema.sql
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

-- Add sync tracking to fitness_history
ALTER TABLE public.fitness_history
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Create index for finding unsynced or stale sessions
CREATE INDEX IF NOT EXISTS idx_sessions_synced ON public.sessions(athlete_id, synced_at);
CREATE INDEX IF NOT EXISTS idx_fitness_synced ON public.fitness_history(athlete_id, synced_at);
CREATE INDEX IF NOT EXISTS idx_sync_log_athlete ON public.sync_log(athlete_id, provider);

-- RLS policy for sync_log (users can only see their own sync status)
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync log"
  ON public.sync_log FOR SELECT
  USING (auth.uid() = athlete_id);

CREATE POLICY "Users can insert their own sync log"
  ON public.sync_log FOR INSERT
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Users can update their own sync log"
  ON public.sync_log FOR UPDATE
  USING (auth.uid() = athlete_id);

-- Function to update sync_log.updated_at on changes
CREATE OR REPLACE FUNCTION update_sync_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_log_updated_at
  BEFORE UPDATE ON public.sync_log
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_log_updated_at();
