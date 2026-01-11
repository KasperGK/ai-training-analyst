/**
 * Vector Store Operations
 *
 * Handles storing and retrieving embeddings from Supabase pgvector.
 */

import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from './embeddings'

export interface WikiChunk {
  id: string
  article_slug: string
  title: string
  content: string
  similarity?: number
}

export interface SessionEmbedding {
  id: string
  session_id: string
  summary: string
  similarity?: number
}

/**
 * Store wiki chunks with their embeddings
 */
export async function storeWikiChunks(
  chunks: Array<{
    articleSlug: string
    chunkIndex: number
    title: string
    content: string
    embedding: number[]
  }>
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) {
    console.error('Supabase client not available')
    return false
  }

  // Format embedding as pgvector string: [0.1, 0.2, ...]
  const rows = chunks.map((chunk) => ({
    article_slug: chunk.articleSlug,
    chunk_index: chunk.chunkIndex,
    title: chunk.title,
    content: chunk.content,
    embedding: `[${chunk.embedding.join(',')}]`,
  }))

  const { error } = await supabase.from('wiki_chunks').upsert(rows, {
    onConflict: 'article_slug,chunk_index',
  })

  if (error) {
    console.error('Error storing wiki chunks:', error)
    return false
  }

  return true
}

/**
 * Search wiki chunks by semantic similarity
 */
export async function searchWiki(
  query: string,
  options: { matchThreshold?: number; matchCount?: number } = {}
): Promise<WikiChunk[]> {
  const { matchThreshold = 0.4, matchCount = 5 } = options

  const supabase = await createClient()
  if (!supabase) {
    console.error('Supabase client not available')
    return []
  }

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query)

  // Call the search function
  const { data, error } = await supabase.rpc('search_wiki', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_threshold: matchThreshold,
    match_count: matchCount,
  })

  if (error) {
    console.error('Error searching wiki:', error)
    return []
  }

  return data as WikiChunk[]
}

/**
 * Store session embedding
 */
export async function storeSessionEmbedding(
  sessionId: string,
  athleteId: string,
  summary: string,
  embedding: number[]
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) {
    console.error('Supabase client not available')
    return false
  }

  const { error } = await supabase.from('session_embeddings').upsert(
    {
      session_id: sessionId,
      athlete_id: athleteId,
      summary,
      embedding: `[${embedding.join(',')}]`,
    },
    { onConflict: 'session_id' }
  )

  if (error) {
    console.error('Error storing session embedding:', error)
    return false
  }

  return true
}

/**
 * Search session history by semantic similarity
 */
export async function searchSessions(
  query: string,
  athleteId: string,
  options: { matchThreshold?: number; matchCount?: number } = {}
): Promise<SessionEmbedding[]> {
  const { matchThreshold = 0.4, matchCount = 5 } = options

  const supabase = await createClient()
  if (!supabase) {
    console.error('Supabase client not available')
    return []
  }

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query)

  // Call the search function
  const { data, error } = await supabase.rpc('search_sessions', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    p_athlete_id: athleteId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  })

  if (error) {
    console.error('Error searching sessions:', error)
    return []
  }

  return data as SessionEmbedding[]
}

/**
 * Delete all wiki chunks (for re-seeding)
 */
export async function clearWikiChunks(): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase.from('wiki_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) {
    console.error('Error clearing wiki chunks:', error)
    return false
  }

  return true
}

/**
 * Get count of wiki chunks
 */
export async function getWikiChunkCount(): Promise<number> {
  const supabase = await createClient()
  if (!supabase) return 0

  const { count, error } = await supabase
    .from('wiki_chunks')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('Error counting wiki chunks:', error)
    return 0
  }

  return count || 0
}
