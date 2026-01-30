-- Migration: 017_conversation_titles
-- Adds a table for custom conversation titles that overlay auto-generated ones

CREATE TABLE IF NOT EXISTS public.conversation_titles (
  conversation_id UUID NOT NULL,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, athlete_id)
);

ALTER TABLE public.conversation_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can manage their conversation titles"
  ON public.conversation_titles FOR ALL
  USING (auth.uid() = athlete_id);
