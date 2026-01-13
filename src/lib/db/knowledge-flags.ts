/**
 * Knowledge Flag Database Operations
 *
 * Handles creating and querying content flags for wiki articles.
 */

import { createClient } from '@/lib/supabase/server'

export type FlagType = 'inaccurate' | 'outdated' | 'misleading' | 'needs_source'
export type FlagStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected'

export interface KnowledgeFlag {
  id: string
  articleSlug: string
  flaggedBy: string
  flagType: FlagType
  description: string
  status: FlagStatus
  adminNotes: string | null
  createdAt: string
  resolvedAt: string | null
}

interface KnowledgeFlagRow {
  id: string
  article_slug: string
  flagged_by: string
  flag_type: FlagType
  description: string
  status: FlagStatus
  admin_notes: string | null
  created_at: string
  resolved_at: string | null
}

function rowToFlag(row: KnowledgeFlagRow): KnowledgeFlag {
  return {
    id: row.id,
    articleSlug: row.article_slug,
    flaggedBy: row.flagged_by,
    flagType: row.flag_type,
    description: row.description,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

/**
 * Create a new content flag
 */
export async function createFlag(
  userId: string,
  articleSlug: string,
  flagType: FlagType,
  description: string
): Promise<KnowledgeFlag | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('knowledge_flags')
    .insert({
      article_slug: articleSlug,
      flagged_by: userId,
      flag_type: flagType,
      description,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating knowledge flag:', error)
    return null
  }

  return rowToFlag(data as KnowledgeFlagRow)
}

/**
 * Get flags submitted by a user
 */
export async function getUserFlags(userId: string): Promise<KnowledgeFlag[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('knowledge_flags')
    .select('*')
    .eq('flagged_by', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user flags:', error)
    return []
  }

  return (data as KnowledgeFlagRow[]).map(rowToFlag)
}

/**
 * Check if user has already flagged an article
 */
export async function hasUserFlaggedArticle(
  userId: string,
  articleSlug: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { count, error } = await supabase
    .from('knowledge_flags')
    .select('*', { count: 'exact', head: true })
    .eq('flagged_by', userId)
    .eq('article_slug', articleSlug)
    .eq('status', 'pending')

  if (error) {
    console.error('Error checking existing flag:', error)
    return false
  }

  return (count || 0) > 0
}
