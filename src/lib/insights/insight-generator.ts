/**
 * Insight Generator
 *
 * Generates proactive insights using detected patterns and AI enhancement.
 * Uses Haiku for cost-effective generation of natural language insights.
 */

import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { detectPatterns, type DetectedPattern } from './pattern-detector'

export interface Insight {
  id: string
  athlete_id: string
  insight_type: string
  priority: string
  title: string
  content: string
  data: Record<string, unknown>
  is_read: boolean
  is_dismissed: boolean
  created_at: string
}

interface GenerationResult {
  success: boolean
  insightsCreated: number
  patternsDetected: number
  error?: string
}

/**
 * Generate insights for an athlete
 */
export async function generateInsights(athleteId: string): Promise<GenerationResult> {
  const supabase = await createClient()
  if (!supabase) {
    return { success: false, insightsCreated: 0, patternsDetected: 0, error: 'Database not available' }
  }

  const startTime = Date.now()

  try {
    // Check if generation is needed (not run in last 6 hours)
    const { data: shouldGenerate } = await supabase.rpc('should_generate_insights', {
      p_athlete_id: athleteId,
    })

    if (!shouldGenerate) {
      return { success: true, insightsCreated: 0, patternsDetected: 0 }
    }

    // Detect patterns in training data
    const patterns = await detectPatterns(athleteId)

    if (patterns.length === 0) {
      // Log empty generation
      await logGeneration(supabase, athleteId, 0, [], null, 0, Date.now() - startTime)
      return { success: true, insightsCreated: 0, patternsDetected: 0 }
    }

    // Filter out patterns that already have recent similar insights
    const newPatterns = await filterExistingInsights(supabase, athleteId, patterns)

    if (newPatterns.length === 0) {
      await logGeneration(supabase, athleteId, 0, patterns.map(p => p.type), null, 0, Date.now() - startTime)
      return { success: true, insightsCreated: 0, patternsDetected: patterns.length }
    }

    // Enhance high-priority insights with AI
    const enhancedPatterns = await enhanceWithAI(newPatterns)

    // Store insights in database
    const insights = enhancedPatterns.map(p => ({
      athlete_id: athleteId,
      insight_type: p.type,
      priority: p.priority,
      title: p.title,
      content: p.description,
      data: p.data,
      source: 'pattern_detected',
    }))

    const { error } = await supabase.from('insights').insert(insights)

    if (error) {
      console.error('[InsightGenerator] Error storing insights:', error)
      return { success: false, insightsCreated: 0, patternsDetected: patterns.length, error: error.message }
    }

    // Log generation
    await logGeneration(
      supabase,
      athleteId,
      insights.length,
      patterns.map(p => p.type),
      'claude-3-5-haiku-20241022',
      0, // Token counting would need more infrastructure
      Date.now() - startTime
    )

    return {
      success: true,
      insightsCreated: insights.length,
      patternsDetected: patterns.length,
    }
  } catch (error) {
    console.error('[InsightGenerator] Error:', error)
    return {
      success: false,
      insightsCreated: 0,
      patternsDetected: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Filter out patterns that already have recent similar insights
 */
async function filterExistingInsights(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  patterns: DetectedPattern[]
): Promise<DetectedPattern[]> {
  if (!supabase) return patterns

  // Get recent insights (last 24 hours)
  const { data: recentInsights } = await supabase
    .from('insights')
    .select('insight_type, title')
    .eq('athlete_id', athleteId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  if (!recentInsights || recentInsights.length === 0) {
    return patterns
  }

  // Filter out patterns with similar recent insights
  const recentTypes = new Set(recentInsights.map(i => `${i.insight_type}:${i.title}`))

  return patterns.filter(p => !recentTypes.has(`${p.type}:${p.title}`))
}

/**
 * Enhance high-priority patterns with AI-generated content
 */
async function enhanceWithAI(patterns: DetectedPattern[]): Promise<DetectedPattern[]> {
  // Only enhance urgent/high priority with AI to save costs
  const highPriority = patterns.filter(p => p.priority === 'urgent' || p.priority === 'high')
  const lowPriority = patterns.filter(p => p.priority !== 'urgent' && p.priority !== 'high')

  if (highPriority.length === 0) {
    return patterns
  }

  try {
    const result = await generateText({
      model: anthropic('claude-3-5-haiku-20241022'),
      system: `You are a cycling coach providing brief, actionable insights.
Keep responses concise (1-2 sentences max).
Be encouraging but direct.
Focus on what the athlete should do, not just what the data shows.`,
      prompt: `Enhance these training insights with personalized coaching advice. Keep each under 2 sentences.

${highPriority.map((p, i) => `${i + 1}. [${p.type.toUpperCase()}] ${p.title}: ${p.description}`).join('\n\n')}

Return each enhanced insight on a new line, numbered to match.`,
    })

    // Parse enhanced descriptions
    const enhanced = result.text.split('\n').filter(line => line.trim())

    for (let i = 0; i < highPriority.length && i < enhanced.length; i++) {
      const enhancedText = enhanced[i].replace(/^\d+\.\s*/, '').trim()
      if (enhancedText.length > 20) {
        highPriority[i].description = enhancedText
      }
    }
  } catch (error) {
    console.error('[InsightGenerator] AI enhancement failed, using original:', error)
    // Continue with original descriptions
  }

  return [...highPriority, ...lowPriority]
}

/**
 * Log insight generation
 */
async function logGeneration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  insightsCreated: number,
  patternsDetected: string[],
  modelUsed: string | null,
  tokensUsed: number,
  durationMs: number
): Promise<void> {
  if (!supabase) return

  await supabase.from('insight_generation_log').insert({
    athlete_id: athleteId,
    insights_created: insightsCreated,
    patterns_detected: patternsDetected,
    model_used: modelUsed,
    tokens_used: tokensUsed,
    duration_ms: durationMs,
  })
}

/**
 * Get active insights for an athlete
 */
export async function getInsights(
  athleteId: string,
  options: {
    limit?: number
    includeRead?: boolean
    types?: string[]
  } = {}
): Promise<Insight[]> {
  const supabase = await createClient()
  if (!supabase) return []

  let query = supabase
    .from('insights')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })

  if (!options.includeRead) {
    query = query.eq('is_read', false)
  }

  if (options.types && options.types.length > 0) {
    query = query.in('insight_type', options.types)
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('[InsightGenerator] Error fetching insights:', error)
    return []
  }

  return data as Insight[]
}

/**
 * Mark an insight as read
 */
export async function markInsightRead(insightId: string, athleteId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('insights')
    .update({ is_read: true })
    .eq('id', insightId)
    .eq('athlete_id', athleteId)

  return !error
}

/**
 * Dismiss an insight
 */
export async function dismissInsight(insightId: string, athleteId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('insights')
    .update({ is_dismissed: true })
    .eq('id', insightId)
    .eq('athlete_id', athleteId)

  return !error
}

/**
 * Get insight counts by type
 */
export async function getInsightCounts(athleteId: string): Promise<Record<string, number>> {
  const supabase = await createClient()
  if (!supabase) return {}

  const { data, error } = await supabase
    .from('insights')
    .select('insight_type')
    .eq('athlete_id', athleteId)
    .eq('is_dismissed', false)
    .eq('is_read', false)

  if (error || !data) return {}

  const counts: Record<string, number> = {}
  for (const row of data) {
    counts[row.insight_type] = (counts[row.insight_type] || 0) + 1
  }

  return counts
}
