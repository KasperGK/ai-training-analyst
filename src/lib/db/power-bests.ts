import { createClient } from '@/lib/supabase/server'
import type { PowerBest } from '@/types'

// Row type matching database schema
export type PowerBestRow = {
  id: string
  athlete_id: string
  duration_seconds: number
  power_watts: number
  watts_per_kg: number | null
  session_id: string | null
  recorded_date: string
  is_current_best: boolean
  created_at: string
}

export type PowerBestInsert = Omit<PowerBestRow, 'id' | 'created_at'>

function rowToPowerBest(row: PowerBestRow): PowerBest {
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    duration_seconds: row.duration_seconds,
    power_watts: row.power_watts,
    watts_per_kg: row.watts_per_kg,
    session_id: row.session_id,
    recorded_date: row.recorded_date,
    is_current_best: row.is_current_best,
    created_at: row.created_at,
  }
}

// Standard power curve durations in seconds
export const STANDARD_DURATIONS = [
  5,      // 5 second (sprint)
  30,     // 30 second
  60,     // 1 minute
  120,    // 2 minutes
  300,    // 5 minutes
  600,    // 10 minutes
  1200,   // 20 minutes
  3600,   // 1 hour
] as const

export type StandardDuration = typeof STANDARD_DURATIONS[number]

// Get all power bests for an athlete
export async function getPowerBests(
  athleteId: string,
  options: { currentOnly?: boolean; duration?: number } = {}
): Promise<PowerBest[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { currentOnly = true, duration } = options

  let query = supabase
    .from('power_bests')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('duration_seconds', { ascending: true })

  if (currentOnly) {
    query = query.eq('is_current_best', true)
  }

  if (duration) {
    query = query.eq('duration_seconds', duration)
  }

  const { data, error } = await query

  if (error || !data) return []
  return data.map((row) => rowToPowerBest(row as PowerBestRow))
}

// Get current bests as a map: duration -> power
export async function getCurrentBests(athleteId: string): Promise<Map<number, PowerBest>> {
  const bests = await getPowerBests(athleteId, { currentOnly: true })
  const map = new Map<number, PowerBest>()
  for (const best of bests) {
    map.set(best.duration_seconds, best)
  }
  return map
}

// Get best power for a specific duration
export async function getBestForDuration(
  athleteId: string,
  durationSeconds: number
): Promise<PowerBest | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('power_bests')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('duration_seconds', durationSeconds)
    .eq('is_current_best', true)
    .single()

  if (error || !data) return null
  return rowToPowerBest(data as PowerBestRow)
}

// Upsert a power best (handles superseding old records)
export async function upsertPowerBest(best: PowerBestInsert): Promise<PowerBest | null> {
  const supabase = await createClient()
  if (!supabase) return null

  // First, mark any existing current best for this duration as not current
  if (best.is_current_best) {
    await supabase
      .from('power_bests')
      .update({ is_current_best: false })
      .eq('athlete_id', best.athlete_id)
      .eq('duration_seconds', best.duration_seconds)
      .eq('is_current_best', true)
  }

  // Insert the new record
  const { data, error } = await supabase
    .from('power_bests')
    .insert(best)
    .select()
    .single()

  if (error || !data) return null
  return rowToPowerBest(data as PowerBestRow)
}

// Update power bests from a session's power curve data
export async function updatePowerBestsFromSession(
  athleteId: string,
  sessionId: string,
  sessionDate: string,
  powerCurve: { durationSeconds: number; watts: number }[],
  weightKg?: number
): Promise<PowerBest[]> {
  const currentBests = await getCurrentBests(athleteId)
  const newBests: PowerBest[] = []

  for (const point of powerCurve) {
    const { durationSeconds, watts } = point
    const currentBest = currentBests.get(durationSeconds)

    // Only update if this is a new best
    if (!currentBest || watts > currentBest.power_watts) {
      const newBest = await upsertPowerBest({
        athlete_id: athleteId,
        duration_seconds: durationSeconds,
        power_watts: watts,
        watts_per_kg: weightKg ? Math.round((watts / weightKg) * 100) / 100 : null,
        session_id: sessionId,
        recorded_date: sessionDate,
        is_current_best: true,
      })

      if (newBest) {
        newBests.push(newBest)
      }
    }
  }

  return newBests
}

// Get power curve data formatted for display
export async function getPowerCurveDisplay(athleteId: string): Promise<{
  duration: number
  durationLabel: string
  watts: number
  wattsPerKg: number | null
  date: string
}[]> {
  const bests = await getPowerBests(athleteId, { currentOnly: true })

  const durationLabels: Record<number, string> = {
    5: '5s',
    30: '30s',
    60: '1min',
    120: '2min',
    300: '5min',
    600: '10min',
    1200: '20min',
    3600: '1hr',
  }

  return bests.map((best) => ({
    duration: best.duration_seconds,
    durationLabel: durationLabels[best.duration_seconds] || `${best.duration_seconds}s`,
    watts: best.power_watts,
    wattsPerKg: best.watts_per_kg ?? null,
    date: best.recorded_date,
  }))
}

// Delete a power best (rarely needed)
export async function deletePowerBest(bestId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('power_bests')
    .delete()
    .eq('id', bestId)

  return !error
}

// Get history for a specific duration
export async function getPowerHistory(
  athleteId: string,
  durationSeconds: number
): Promise<PowerBest[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('power_bests')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('duration_seconds', durationSeconds)
    .order('recorded_date', { ascending: false })

  if (error || !data) return []
  return data.map((row) => rowToPowerBest(row as PowerBestRow))
}
