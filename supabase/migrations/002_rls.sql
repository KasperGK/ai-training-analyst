-- AI Training Analyst Database Schema
-- Migration 002: Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Athletes: users can only access their own profile
CREATE POLICY "Athletes can view own profile" ON public.athletes
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Athletes can update own profile" ON public.athletes
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Athletes can insert own profile" ON public.athletes
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Sessions: users can only access their own sessions
CREATE POLICY "Users can view own sessions" ON public.sessions
  FOR SELECT USING (auth.uid() = athlete_id);

CREATE POLICY "Users can insert own sessions" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Users can update own sessions" ON public.sessions
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "Users can delete own sessions" ON public.sessions
  FOR DELETE USING (auth.uid() = athlete_id);

-- Fitness history: users can only access their own data
CREATE POLICY "Users can view own fitness history" ON public.fitness_history
  FOR SELECT USING (auth.uid() = athlete_id);

CREATE POLICY "Users can insert own fitness history" ON public.fitness_history
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Users can update own fitness history" ON public.fitness_history
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "Users can delete own fitness history" ON public.fitness_history
  FOR DELETE USING (auth.uid() = athlete_id);

-- Events: users can only access their own events
CREATE POLICY "Users can view own events" ON public.events
  FOR SELECT USING (auth.uid() = athlete_id);

CREATE POLICY "Users can insert own events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Users can update own events" ON public.events
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "Users can delete own events" ON public.events
  FOR DELETE USING (auth.uid() = athlete_id);

-- Goals: users can only access their own goals
CREATE POLICY "Users can view own goals" ON public.goals
  FOR SELECT USING (auth.uid() = athlete_id);

CREATE POLICY "Users can insert own goals" ON public.goals
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Users can update own goals" ON public.goals
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "Users can delete own goals" ON public.goals
  FOR DELETE USING (auth.uid() = athlete_id);

-- Chat messages: users can only access their own messages
CREATE POLICY "Users can view own chat messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = athlete_id);

CREATE POLICY "Users can insert own chat messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Users can delete own chat messages" ON public.chat_messages
  FOR DELETE USING (auth.uid() = athlete_id);

-- Integrations: users can only access their own integrations
CREATE POLICY "Users can view own integrations" ON public.integrations
  FOR SELECT USING (auth.uid() = athlete_id);

CREATE POLICY "Users can insert own integrations" ON public.integrations
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Users can update own integrations" ON public.integrations
  FOR UPDATE USING (auth.uid() = athlete_id);

CREATE POLICY "Users can delete own integrations" ON public.integrations
  FOR DELETE USING (auth.uid() = athlete_id);
