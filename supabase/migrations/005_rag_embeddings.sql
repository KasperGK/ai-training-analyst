-- RAG Embeddings Infrastructure
-- Migration 005: pgvector extension and embedding tables

-- Enable pgvector extension (may already be enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- Wiki article chunks with embeddings
-- Using 384 dimensions for all-MiniLM-L6-v2 local model
CREATE TABLE public.wiki_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_slug TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_slug, chunk_index)
);

-- Session summaries with embeddings (for semantic search over training history)
CREATE TABLE public.session_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id)
);

-- Indexes for fast similarity search using HNSW
CREATE INDEX wiki_chunks_embedding_idx ON public.wiki_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX session_embeddings_embedding_idx ON public.session_embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX session_embeddings_athlete_idx ON public.session_embeddings(athlete_id);

-- RLS Policies
ALTER TABLE public.wiki_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_embeddings ENABLE ROW LEVEL SECURITY;

-- Wiki chunks are public (read-only for everyone)
CREATE POLICY "Wiki chunks are publicly readable"
  ON public.wiki_chunks FOR SELECT
  USING (true);

-- Session embeddings are private to the athlete
CREATE POLICY "Athletes can view their own session embeddings"
  ON public.session_embeddings FOR SELECT
  USING (auth.uid() = athlete_id);

CREATE POLICY "Athletes can insert their own session embeddings"
  ON public.session_embeddings FOR INSERT
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Athletes can delete their own session embeddings"
  ON public.session_embeddings FOR DELETE
  USING (auth.uid() = athlete_id);

-- Function to search wiki by similarity
CREATE OR REPLACE FUNCTION search_wiki(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  article_slug TEXT,
  title TEXT,
  content TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    wc.id,
    wc.article_slug,
    wc.title,
    wc.content,
    1 - (wc.embedding <=> query_embedding) AS similarity
  FROM public.wiki_chunks wc
  WHERE 1 - (wc.embedding <=> query_embedding) > match_threshold
  ORDER BY wc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search session history by similarity
CREATE OR REPLACE FUNCTION search_sessions(
  query_embedding vector(384),
  p_athlete_id UUID,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  session_id UUID,
  summary TEXT,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id,
    se.session_id,
    se.summary,
    1 - (se.embedding <=> query_embedding) AS similarity
  FROM public.session_embeddings se
  WHERE se.athlete_id = p_athlete_id
    AND 1 - (se.embedding <=> query_embedding) > match_threshold
  ORDER BY se.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
