-- Fix session_embeddings RLS policy for server-side inserts
-- Migration 012: Allow authenticated users to manage session embeddings for their sessions

-- Drop ALL existing policies on session_embeddings
DROP POLICY IF EXISTS "Athletes can view their own session embeddings" ON public.session_embeddings;
DROP POLICY IF EXISTS "Athletes can insert their own session embeddings" ON public.session_embeddings;
DROP POLICY IF EXISTS "Athletes can delete their own session embeddings" ON public.session_embeddings;
DROP POLICY IF EXISTS "Users can insert embeddings for their sessions" ON public.session_embeddings;
DROP POLICY IF EXISTS "Users can update embeddings for their sessions" ON public.session_embeddings;

-- Create new policies that check ownership via the sessions table
-- This works because session_id references sessions.id, and sessions.athlete_id = auth.uid()

CREATE POLICY "Users can view embeddings for their sessions"
  ON public.session_embeddings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id
      AND s.athlete_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert embeddings for their sessions"
  ON public.session_embeddings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id
      AND s.athlete_id = auth.uid()
    )
  );

CREATE POLICY "Users can update embeddings for their sessions"
  ON public.session_embeddings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id
      AND s.athlete_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete embeddings for their sessions"
  ON public.session_embeddings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id
      AND s.athlete_id = auth.uid()
    )
  );
