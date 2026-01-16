/**
 * Session Embeddings
 *
 * Generates embeddings for training sessions to enable semantic search
 * over athlete's training history.
 */

import { createClient } from '@/lib/supabase/server'
import { generateEmbedding, generateEmbeddings } from './embeddings'
import { storeSessionEmbedding } from './vector-store'
import type { SupabaseClient } from '@supabase/supabase-js'

interface SessionForEmbedding {
  id: string
  athlete_id: string
  date: string
  duration_seconds: number
  distance_meters: number | null
  sport: string
  workout_type: string | null
  avg_power: number | null
  max_power: number | null
  normalized_power: number | null
  intensity_factor: number | null
  tss: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_cadence: number | null
  total_ascent: number | null
  notes: string | null
}

/**
 * Infer workout type from intensity factor
 * Handles both decimal (0.65) and percentage (65) formats
 */
function inferWorkoutTypeFromIF(intensityFactor: number | null): string | null {
  if (!intensityFactor) return null

  // Normalize to decimal if stored as percentage (> 2 means it's a percentage)
  const intensity = intensityFactor > 2 ? intensityFactor / 100 : intensityFactor

  if (intensity < 0.65) return 'recovery'
  if (intensity < 0.76) return 'endurance'
  if (intensity < 0.88) return 'tempo'
  if (intensity < 0.95) return 'sweetspot'
  if (intensity < 1.05) return 'threshold'
  if (intensity < 1.20) return 'vo2max'
  return 'sprint'
}

/**
 * Generate a natural language summary of a session for embedding
 */
export function generateSessionSummary(session: SessionForEmbedding): string {
  const parts: string[] = []

  // Date and basic info
  const date = new Date(session.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const duration = Math.round(session.duration_seconds / 60)
  const hours = Math.floor(duration / 60)
  const mins = duration % 60
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`

  parts.push(`${date}: ${durationStr} ${session.sport} workout`)

  // Workout type - infer from intensity factor for better accuracy
  const inferredType = inferWorkoutTypeFromIF(session.intensity_factor)
  if (inferredType) {
    const typeDescriptions: Record<string, string> = {
      recovery: 'recovery ride',
      endurance: 'endurance/zone 2 training',
      tempo: 'tempo/zone 3 effort',
      sweetspot: 'sweet spot training',
      threshold: 'threshold/FTP work',
      vo2max: 'VO2max intervals',
      sprint: 'sprint/anaerobic efforts',
    }
    parts.push(typeDescriptions[inferredType])
  }

  // Distance
  if (session.distance_meters && session.distance_meters > 0) {
    const km = (session.distance_meters / 1000).toFixed(1)
    parts.push(`${km}km`)
  }

  // Climbing
  if (session.total_ascent && session.total_ascent > 100) {
    parts.push(`${session.total_ascent}m climbing`)
  }

  // Power metrics
  const powerParts: string[] = []
  if (session.normalized_power) {
    powerParts.push(`NP ${session.normalized_power}w`)
  }
  if (session.avg_power) {
    powerParts.push(`avg ${session.avg_power}w`)
  }
  if (session.max_power && session.max_power > (session.avg_power || 0) * 1.5) {
    powerParts.push(`peak ${session.max_power}w`)
  }
  if (powerParts.length > 0) {
    parts.push(powerParts.join(', '))
  }

  // Intensity - handle both decimal and percentage formats
  if (session.intensity_factor) {
    // Normalize: if > 2, it's stored as percentage; otherwise as decimal
    const ifDecimal = session.intensity_factor > 2
      ? session.intensity_factor / 100
      : session.intensity_factor
    const ifPercent = Math.round(ifDecimal * 100)
    parts.push(`IF ${ifPercent}%`)
  }

  // Training load
  if (session.tss) {
    parts.push(`TSS ${session.tss}`)
  }

  // Heart rate
  if (session.avg_hr) {
    parts.push(`avg HR ${session.avg_hr}bpm`)
  }

  // Cadence (for cycling)
  if (session.sport === 'cycling' && session.avg_cadence) {
    parts.push(`cadence ${session.avg_cadence}rpm`)
  }

  // Notes
  if (session.notes) {
    parts.push(session.notes)
  }

  return parts.join('. ')
}

/**
 * Embed a batch of sessions and store them
 * Returns the number of sessions successfully embedded
 * @param sessions - Sessions to embed
 * @param supabase - Supabase client to use (preserves auth context from caller)
 */
export async function embedSessions(
  sessions: SessionForEmbedding[],
  supabase: SupabaseClient
): Promise<number> {
  if (sessions.length === 0) return 0

  try {
    // Generate summaries
    const summaries = sessions.map(generateSessionSummary)

    // Generate embeddings in batch
    const embeddings = await generateEmbeddings(summaries)

    // Store each session embedding (pass Supabase client to preserve auth)
    let stored = 0
    for (let i = 0; i < sessions.length; i++) {
      const success = await storeSessionEmbedding(
        sessions[i].id,
        sessions[i].athlete_id,
        summaries[i],
        embeddings[i],
        supabase
      )
      if (success) stored++
    }

    console.log(`[Session Embeddings] Embedded ${stored}/${sessions.length} sessions`)
    return stored
  } catch (error) {
    console.error('[Session Embeddings] Error embedding sessions:', error)
    return 0
  }
}

/**
 * Embed newly synced sessions that don't have embeddings yet
 */
export async function embedNewSessions(athleteId: string): Promise<number> {
  const supabase = await createClient()
  if (!supabase) {
    console.error('[Session Embeddings] Supabase not available')
    return 0
  }

  try {
    // Find sessions without embeddings (LEFT JOIN with NULL check)
    // We'll get sessions from the last 90 days that don't have embeddings
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const dateStr = ninetyDaysAgo.toISOString().split('T')[0]

    // First, get session IDs that already have embeddings
    const { data: existingEmbeddings } = await supabase
      .from('session_embeddings')
      .select('session_id')
      .eq('athlete_id', athleteId)

    const embeddedIds = new Set(existingEmbeddings?.map(e => e.session_id) || [])

    // Get sessions that need embedding
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        athlete_id,
        date,
        duration_seconds,
        distance_meters,
        sport,
        workout_type,
        avg_power,
        max_power,
        normalized_power,
        intensity_factor,
        tss,
        avg_hr,
        max_hr,
        avg_cadence,
        total_ascent,
        notes
      `)
      .eq('athlete_id', athleteId)
      .gte('date', dateStr)
      .order('date', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[Session Embeddings] Error fetching sessions:', error)
      return 0
    }

    if (!sessions || sessions.length === 0) {
      console.log('[Session Embeddings] No sessions found')
      return 0
    }

    // Filter to sessions without embeddings
    const sessionsToEmbed = sessions.filter(s => !embeddedIds.has(s.id))

    if (sessionsToEmbed.length === 0) {
      console.log('[Session Embeddings] All sessions already embedded')
      return 0
    }

    console.log(`[Session Embeddings] Found ${sessionsToEmbed.length} sessions to embed:`)
    sessionsToEmbed.slice(0, 3).forEach(s => {
      console.log(`  - ${s.date}: ${s.sport} ${s.workout_type || ''} (TSS: ${s.tss})`)
    })
    if (sessionsToEmbed.length > 3) {
      console.log(`  ... and ${sessionsToEmbed.length - 3} more`)
    }

    // Embed in batches of 20 to avoid memory issues
    // Pass supabase client through to preserve auth context
    const BATCH_SIZE = 20
    let totalEmbedded = 0

    for (let i = 0; i < sessionsToEmbed.length; i += BATCH_SIZE) {
      const batch = sessionsToEmbed.slice(i, i + BATCH_SIZE)
      const embedded = await embedSessions(batch, supabase)
      totalEmbedded += embedded
    }

    return totalEmbedded
  } catch (error) {
    console.error('[Session Embeddings] Error in embedNewSessions:', error)
    return 0
  }
}

/**
 * Re-embed all sessions for an athlete (force update)
 * Deletes existing embeddings and regenerates them with current summary format
 */
export async function reembedAllSessions(athleteId: string): Promise<number> {
  const supabase = await createClient()
  if (!supabase) {
    console.error('[Session Embeddings] Supabase not available')
    return 0
  }

  try {
    // Delete existing embeddings for this athlete
    const { error: deleteError } = await supabase
      .from('session_embeddings')
      .delete()
      .eq('athlete_id', athleteId)

    if (deleteError) {
      console.error('[Session Embeddings] Error deleting old embeddings:', deleteError)
      return 0
    }

    console.log('[Session Embeddings] Cleared existing embeddings, regenerating...')

    // Get all sessions from the last 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const dateStr = ninetyDaysAgo.toISOString().split('T')[0]

    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        athlete_id,
        date,
        duration_seconds,
        distance_meters,
        sport,
        workout_type,
        avg_power,
        max_power,
        normalized_power,
        intensity_factor,
        tss,
        avg_hr,
        max_hr,
        avg_cadence,
        total_ascent,
        notes
      `)
      .eq('athlete_id', athleteId)
      .gte('date', dateStr)
      .order('date', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[Session Embeddings] Error fetching sessions:', error)
      return 0
    }

    if (!sessions || sessions.length === 0) {
      console.log('[Session Embeddings] No sessions found to re-embed')
      return 0
    }

    console.log(`[Session Embeddings] Re-embedding ${sessions.length} sessions...`)

    // Embed in batches
    const BATCH_SIZE = 20
    let totalEmbedded = 0

    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
      const batch = sessions.slice(i, i + BATCH_SIZE)
      const embedded = await embedSessions(batch, supabase)
      totalEmbedded += embedded
    }

    console.log(`[Session Embeddings] Re-embedded ${totalEmbedded}/${sessions.length} sessions`)
    return totalEmbedded
  } catch (error) {
    console.error('[Session Embeddings] Error in reembedAllSessions:', error)
    return 0
  }
}
