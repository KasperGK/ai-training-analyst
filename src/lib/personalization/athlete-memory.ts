/**
 * Athlete Memory Service
 *
 * Manages persistent memories about athletes: preferences, patterns,
 * injuries, goals, and feedback. Used to personalize AI coaching.
 */

import { createClient } from '@/lib/supabase/server'

export type MemoryType =
  | 'preference'   // e.g., "prefers morning workouts"
  | 'pattern'      // e.g., "performs best after 2 rest days"
  | 'injury'       // e.g., "knee issues - avoid high cadence"
  | 'lifestyle'    // e.g., "works shifts, irregular schedule"
  | 'feedback'     // e.g., "found sweetspot intervals too hard"
  | 'achievement'  // e.g., "completed first century ride"
  | 'goal'         // e.g., "targeting sub-5hr century in June"
  | 'context'      // e.g., "has power meter on outdoor bike only"

export type MemorySource =
  | 'user_stated'   // explicitly told by athlete
  | 'ai_inferred'   // AI concluded from conversation
  | 'data_derived'  // derived from training data patterns

export interface AthleteMemory {
  id: string
  athlete_id: string
  memory_type: MemoryType
  content: string
  confidence: number
  source: MemorySource
  metadata?: Record<string, unknown>
  expires_at?: string | null
  created_at: string
  updated_at: string
}

export interface CreateMemoryInput {
  memory_type: MemoryType
  content: string
  confidence?: number
  source?: MemorySource
  metadata?: Record<string, unknown>
  expires_at?: string | null
}

export interface UpdateMemoryInput {
  content?: string
  confidence?: number
  expires_at?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Get all active memories for an athlete
 */
export async function getMemories(
  athleteId: string,
  options: {
    types?: MemoryType[]
    limit?: number
    includeExpired?: boolean
  } = {}
): Promise<AthleteMemory[]> {
  const supabase = await createClient()
  if (!supabase) return []

  let query = supabase
    .from('athlete_memory')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })

  if (options.types && options.types.length > 0) {
    query = query.in('memory_type', options.types)
  }

  if (!options.includeExpired) {
    query = query.or('expires_at.is.null,expires_at.gt.now()')
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('[AthleteMemory] Error fetching memories:', error)
    return []
  }

  return data as AthleteMemory[]
}

/**
 * Get memories formatted for system prompt injection
 */
export async function getMemoriesForPrompt(
  athleteId: string
): Promise<string> {
  const memories = await getMemories(athleteId, { limit: 30 })

  if (memories.length === 0) {
    return ''
  }

  // Group by type for better organization
  const grouped = memories.reduce((acc, m) => {
    if (!acc[m.memory_type]) acc[m.memory_type] = []
    acc[m.memory_type].push(m)
    return acc
  }, {} as Record<string, AthleteMemory[]>)

  const sections: string[] = []

  // Priority order for sections
  const typeOrder: MemoryType[] = [
    'injury', 'goal', 'preference', 'pattern', 'lifestyle', 'context', 'achievement', 'feedback'
  ]

  const typeLabels: Record<MemoryType, string> = {
    injury: 'Health/Injuries',
    goal: 'Goals',
    preference: 'Preferences',
    pattern: 'Patterns',
    lifestyle: 'Lifestyle',
    context: 'Context',
    achievement: 'Achievements',
    feedback: 'Feedback',
  }

  for (const type of typeOrder) {
    const items = grouped[type]
    if (items && items.length > 0) {
      sections.push(`**${typeLabels[type]}:**`)
      for (const m of items) {
        const confidence = m.confidence < 1 ? ` (${Math.round(m.confidence * 100)}% confidence)` : ''
        sections.push(`- ${m.content}${confidence}`)
      }
    }
  }

  return sections.join('\n')
}

/**
 * Create a new memory
 */
export async function createMemory(
  athleteId: string,
  input: CreateMemoryInput
): Promise<AthleteMemory | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('athlete_memory')
    .insert({
      athlete_id: athleteId,
      memory_type: input.memory_type,
      content: input.content,
      confidence: input.confidence ?? 1.0,
      source: input.source ?? 'user_stated',
      metadata: input.metadata ?? {},
      expires_at: input.expires_at,
    })
    .select()
    .single()

  if (error) {
    console.error('[AthleteMemory] Error creating memory:', error)
    return null
  }

  return data as AthleteMemory
}

/**
 * Update an existing memory
 */
export async function updateMemory(
  memoryId: string,
  athleteId: string,
  input: UpdateMemoryInput
): Promise<AthleteMemory | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('athlete_memory')
    .update(input)
    .eq('id', memoryId)
    .eq('athlete_id', athleteId) // Ensure ownership
    .select()
    .single()

  if (error) {
    console.error('[AthleteMemory] Error updating memory:', error)
    return null
  }

  return data as AthleteMemory
}

/**
 * Delete a memory
 */
export async function deleteMemory(
  memoryId: string,
  athleteId: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('athlete_memory')
    .delete()
    .eq('id', memoryId)
    .eq('athlete_id', athleteId) // Ensure ownership

  if (error) {
    console.error('[AthleteMemory] Error deleting memory:', error)
    return false
  }

  return true
}

/**
 * Find similar memories to avoid duplicates
 */
export async function findSimilarMemory(
  athleteId: string,
  memoryType: MemoryType,
  content: string
): Promise<AthleteMemory | null> {
  const supabase = await createClient()
  if (!supabase) return null

  // Simple text matching - could be enhanced with embeddings
  const { data, error } = await supabase
    .from('athlete_memory')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('memory_type', memoryType)
    .or('expires_at.is.null,expires_at.gt.now()')
    .ilike('content', `%${content.slice(0, 50)}%`)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[AthleteMemory] Error finding similar:', error)
  }

  return data as AthleteMemory | null
}

/**
 * Upsert a memory - update if similar exists, create if not
 */
export async function upsertMemory(
  athleteId: string,
  input: CreateMemoryInput
): Promise<AthleteMemory | null> {
  // Check for existing similar memory
  const existing = await findSimilarMemory(
    athleteId,
    input.memory_type,
    input.content
  )

  if (existing) {
    // Update existing with higher confidence if AI inferred matches user stated
    const newConfidence = input.source === 'user_stated' && existing.source === 'ai_inferred'
      ? 1.0
      : Math.max(existing.confidence, input.confidence ?? 1.0)

    return updateMemory(existing.id, athleteId, {
      content: input.content,
      confidence: newConfidence,
      metadata: { ...existing.metadata, ...input.metadata },
    })
  }

  return createMemory(athleteId, input)
}

/**
 * Expire old memories that haven't been reinforced
 */
export async function expireStaleMemories(
  athleteId: string,
  daysOld: number = 90
): Promise<number> {
  const supabase = await createClient()
  if (!supabase) return 0

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysOld)

  const { data, error } = await supabase
    .from('athlete_memory')
    .update({ expires_at: new Date().toISOString() })
    .eq('athlete_id', athleteId)
    .eq('source', 'ai_inferred') // Only expire AI-inferred, not user-stated
    .lt('confidence', 0.7)       // Only low-confidence
    .lt('updated_at', cutoff.toISOString())
    .is('expires_at', null)
    .select('id')

  if (error) {
    console.error('[AthleteMemory] Error expiring memories:', error)
    return 0
  }

  return data?.length ?? 0
}

/**
 * Get memory statistics for an athlete
 */
export async function getMemoryStats(
  athleteId: string
): Promise<{
  total: number
  byType: Record<string, number>
  bySource: Record<string, number>
}> {
  const supabase = await createClient()
  if (!supabase) return { total: 0, byType: {}, bySource: {} }

  const { data, error } = await supabase
    .from('athlete_memory')
    .select('memory_type, source')
    .eq('athlete_id', athleteId)
    .or('expires_at.is.null,expires_at.gt.now()')

  if (error) {
    console.error('[AthleteMemory] Error getting stats:', error)
    return { total: 0, byType: {}, bySource: {} }
  }

  const byType: Record<string, number> = {}
  const bySource: Record<string, number> = {}

  for (const row of data) {
    byType[row.memory_type] = (byType[row.memory_type] || 0) + 1
    bySource[row.source] = (bySource[row.source] || 0) + 1
  }

  return {
    total: data.length,
    byType,
    bySource,
  }
}
