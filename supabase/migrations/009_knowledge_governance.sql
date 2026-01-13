-- Knowledge Governance Tables
-- Migration: 009_knowledge_governance.sql
-- Purpose: Support content flagging and version history for wiki articles

-- Content flags from users
CREATE TABLE public.knowledge_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_slug TEXT NOT NULL,
  flagged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('inaccurate', 'outdated', 'misleading', 'needs_source')),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Version history for content rollback
CREATE TABLE public.knowledge_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_slug TEXT NOT NULL,
  version INTEGER NOT NULL,
  content JSONB NOT NULL,
  changed_by TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_slug, version)
);

-- Indexes for efficient queries
CREATE INDEX knowledge_flags_status_idx ON public.knowledge_flags(status) WHERE status = 'pending';
CREATE INDEX knowledge_flags_slug_idx ON public.knowledge_flags(article_slug);
CREATE INDEX knowledge_versions_slug_idx ON public.knowledge_versions(article_slug);

-- Enable RLS
ALTER TABLE public.knowledge_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_flags
-- Users can view their own flags
CREATE POLICY "Users can view own flags" ON public.knowledge_flags
  FOR SELECT USING (auth.uid() = flagged_by);

-- Users can create flags (must be authenticated)
CREATE POLICY "Users can create flags" ON public.knowledge_flags
  FOR INSERT WITH CHECK (auth.uid() = flagged_by);

-- RLS Policies for knowledge_versions
-- Anyone can view version history (public knowledge)
CREATE POLICY "Anyone can view versions" ON public.knowledge_versions
  FOR SELECT USING (true);
