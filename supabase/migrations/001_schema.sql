-- AI Training Analyst Database Schema
-- Migration 001: Core Tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Athletes table (extends Supabase auth.users)
CREATE TABLE public.athletes (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  ftp INTEGER DEFAULT 200,
  ftp_updated_at TIMESTAMPTZ,
  max_hr INTEGER,
  lthr INTEGER,
  resting_hr INTEGER,
  weight_kg DECIMAL(5,2),
  weekly_hours_available INTEGER DEFAULT 10,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table (training activities)
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  duration_seconds INTEGER NOT NULL,
  distance_meters INTEGER,
  sport TEXT NOT NULL DEFAULT 'cycling',
  workout_type TEXT,
  avg_power INTEGER,
  max_power INTEGER,
  normalized_power INTEGER,
  intensity_factor DECIMAL(4,2),
  tss INTEGER,
  avg_hr INTEGER,
  max_hr INTEGER,
  avg_cadence INTEGER,
  total_ascent INTEGER,
  power_zones JSONB,
  hr_zones JSONB,
  notes TEXT,
  ai_summary TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(athlete_id, external_id)
);

-- Fitness history (daily CTL/ATL/TSB snapshots)
CREATE TABLE public.fitness_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  ctl DECIMAL(6,2) NOT NULL,
  atl DECIMAL(6,2) NOT NULL,
  tsb DECIMAL(6,2) NOT NULL,
  tss_day INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(athlete_id, date)
);

-- Events (races, targets)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  priority CHAR(1) NOT NULL DEFAULT 'B' CHECK (priority IN ('A', 'B', 'C')),
  event_type TEXT,
  distance_km INTEGER,
  elevation_m INTEGER,
  target_ctl INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'dns', 'dnf', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals (training targets)
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_type TEXT NOT NULL,
  target_value DECIMAL(10,2),
  current_value DECIMAL(10,2),
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages (persisted conversations)
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integrations (OAuth tokens)
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  external_athlete_id TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(athlete_id, provider)
);

-- Create indexes for common queries
CREATE INDEX idx_sessions_athlete_date ON public.sessions(athlete_id, date DESC);
CREATE INDEX idx_sessions_sport ON public.sessions(athlete_id, sport);
CREATE INDEX idx_fitness_history_athlete_date ON public.fitness_history(athlete_id, date DESC);
CREATE INDEX idx_events_athlete_date ON public.events(athlete_id, date);
CREATE INDEX idx_events_status ON public.events(athlete_id, status);
CREATE INDEX idx_goals_athlete_status ON public.goals(athlete_id, status);
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at);
CREATE INDEX idx_chat_messages_athlete ON public.chat_messages(athlete_id, created_at DESC);
CREATE INDEX idx_integrations_athlete_provider ON public.integrations(athlete_id, provider);
