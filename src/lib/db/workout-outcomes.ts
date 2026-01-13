// Workout outcome tracking
// Tracks suggestions vs actual execution for learning

import { createClient } from '@/lib/supabase/server'

export interface WorkoutOutcome {
  id: string
  athlete_id: string
  session_id: string | null
  conversation_id: string | null
  suggested_workout: string | null
  suggested_type: string | null
  actual_type: string | null
  followed_suggestion: boolean | null
  rpe: number | null
  feedback: string | null
  created_at: string
}

export interface CreateOutcomeInput {
  session_id?: string
  conversation_id?: string
  suggested_workout?: string
  suggested_type?: string
  actual_type?: string
  followed_suggestion?: boolean
  rpe?: number // 1-10 scale
  feedback?: string
}

/**
 * Log a workout outcome (what was suggested vs what happened)
 */
export async function logWorkoutOutcome(
  athleteId: string,
  input: CreateOutcomeInput
): Promise<WorkoutOutcome | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('workout_outcomes')
    .insert({
      athlete_id: athleteId,
      session_id: input.session_id || null,
      conversation_id: input.conversation_id || null,
      suggested_workout: input.suggested_workout || null,
      suggested_type: input.suggested_type || null,
      actual_type: input.actual_type || null,
      followed_suggestion: input.followed_suggestion ?? null,
      rpe: input.rpe || null,
      feedback: input.feedback || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[logWorkoutOutcome] Error:', error)
    return null
  }

  return data as WorkoutOutcome
}

/**
 * Get recent workout outcomes for an athlete
 */
export async function getWorkoutOutcomes(
  athleteId: string,
  options: { limit?: number; days?: number } = {}
): Promise<WorkoutOutcome[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { limit = 20, days } = options

  let query = supabase
    .from('workout_outcomes')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (days) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    query = query.gte('created_at', startDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('[getWorkoutOutcomes] Error:', error)
    return []
  }

  return (data || []) as WorkoutOutcome[]
}

/**
 * Get outcome statistics for an athlete
 */
export async function getOutcomeStats(
  athleteId: string,
  days: number = 90
): Promise<{
  totalOutcomes: number
  followedSuggestions: number
  averageRPE: number | null
  commonFeedbackThemes: string[]
}> {
  const outcomes = await getWorkoutOutcomes(athleteId, { limit: 100, days })

  if (outcomes.length === 0) {
    return {
      totalOutcomes: 0,
      followedSuggestions: 0,
      averageRPE: null,
      commonFeedbackThemes: [],
    }
  }

  const withSuggestion = outcomes.filter(o => o.followed_suggestion !== null)
  const followedCount = withSuggestion.filter(o => o.followed_suggestion).length

  const withRPE = outcomes.filter(o => o.rpe !== null)
  const avgRPE = withRPE.length > 0
    ? Math.round(withRPE.reduce((sum, o) => sum + (o.rpe || 0), 0) / withRPE.length * 10) / 10
    : null

  // Simple feedback theme extraction (could be enhanced with NLP)
  const feedbackWords = outcomes
    .filter(o => o.feedback)
    .flatMap(o => o.feedback!.toLowerCase().split(/\s+/))

  const wordCounts: Record<string, number> = {}
  const ignoreWords = ['the', 'a', 'an', 'was', 'were', 'is', 'are', 'it', 'i', 'my', 'and', 'but', 'or', 'to', 'for']

  feedbackWords.forEach(word => {
    if (word.length > 3 && !ignoreWords.includes(word)) {
      wordCounts[word] = (wordCounts[word] || 0) + 1
    }
  })

  const themes = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)

  return {
    totalOutcomes: outcomes.length,
    followedSuggestions: followedCount,
    averageRPE: avgRPE,
    commonFeedbackThemes: themes,
  }
}
