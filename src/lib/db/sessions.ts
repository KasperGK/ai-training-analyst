import { createClient } from '@/lib/supabase/server'
import type { Session, PowerZones, HRZones } from '@/types'

export type SessionRow = {
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
  power_zones: PowerZones | null
  hr_zones: HRZones | null
  notes: string | null
  ai_summary: string | null
  source: string
  external_id: string | null
  raw_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type SessionInsert = Omit<SessionRow, 'id' | 'created_at' | 'updated_at'>

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    date: row.date,
    duration_seconds: row.duration_seconds,
    distance_meters: row.distance_meters ?? undefined,
    sport: row.sport as Session['sport'],
    workout_type: row.workout_type as Session['workout_type'],
    avg_power: row.avg_power ?? undefined,
    max_power: row.max_power ?? undefined,
    normalized_power: row.normalized_power ?? undefined,
    intensity_factor: row.intensity_factor ?? undefined,
    tss: row.tss ?? undefined,
    avg_hr: row.avg_hr ?? undefined,
    max_hr: row.max_hr ?? undefined,
    power_zones: row.power_zones ?? undefined,
    hr_zones: row.hr_zones ?? undefined,
    ai_summary: row.ai_summary ?? undefined,
    source: row.source as Session['source'],
    external_id: row.external_id ?? undefined,
  }
}

export interface GetSessionsOptions {
  limit?: number
  offset?: number
  startDate?: string
  endDate?: string
  sport?: string
}

export async function getSessions(
  athleteId: string,
  options: GetSessionsOptions = {}
): Promise<Session[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { limit = 50, offset = 0, startDate, endDate, sport } = options

  let query = supabase
    .from('sessions')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (startDate) {
    query = query.gte('date', startDate)
  }
  if (endDate) {
    query = query.lte('date', endDate)
  }
  if (sport) {
    query = query.eq('sport', sport)
  }

  const { data, error } = await query

  if (error || !data) return []
  return data.map((row) => rowToSession(row as SessionRow))
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error || !data) return null
  return rowToSession(data as SessionRow)
}

export async function createSession(session: SessionInsert): Promise<Session | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('sessions')
    .insert(session)
    .select()
    .single()

  if (error || !data) return null
  return rowToSession(data as SessionRow)
}

export async function upsertSession(session: SessionInsert): Promise<Session | null> {
  const supabase = await createClient()
  if (!supabase) return null

  // Use external_id for conflict detection if available
  const { data, error } = await supabase
    .from('sessions')
    .upsert(session, {
      onConflict: 'athlete_id,external_id',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (error || !data) return null
  return rowToSession(data as SessionRow)
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)

  return !error
}

export async function getSessionStats(
  athleteId: string,
  days: number = 7
): Promise<{
  totalSessions: number
  totalTSS: number
  totalDuration: number
  avgTSS: number
}> {
  const supabase = await createClient()
  if (!supabase) {
    return { totalSessions: 0, totalTSS: 0, totalDuration: 0, avgTSS: 0 }
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('sessions')
    .select('tss, duration_seconds')
    .eq('athlete_id', athleteId)
    .gte('date', startDate.toISOString().split('T')[0])

  if (error || !data) {
    return { totalSessions: 0, totalTSS: 0, totalDuration: 0, avgTSS: 0 }
  }

  const totalSessions = data.length
  const totalTSS = data.reduce((sum, s) => sum + (s.tss || 0), 0)
  const totalDuration = data.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
  const avgTSS = totalSessions > 0 ? totalTSS / totalSessions : 0

  return { totalSessions, totalTSS, totalDuration, avgTSS }
}
