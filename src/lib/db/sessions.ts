import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Session, PowerZones, HRZones } from '@/types'

// Zod schema for validating DB rows
const powerZonesSchema = z.object({
  z1: z.number(),
  z2: z.number(),
  z3: z.number(),
  z4: z.number(),
  z5: z.number(),
  z6: z.number(),
})

const hrZonesSchema = z.object({
  z1: z.number(),
  z2: z.number(),
  z3: z.number(),
  z4: z.number(),
  z5: z.number(),
})

const sessionRowSchema = z.object({
  id: z.string(),
  athlete_id: z.string(),
  date: z.string(),
  duration_seconds: z.number(),
  distance_meters: z.number().nullable(),
  sport: z.string(),
  workout_type: z.string().nullable(),
  avg_power: z.number().nullable(),
  max_power: z.number().nullable(),
  normalized_power: z.number().nullable(),
  intensity_factor: z.number().nullable(),
  tss: z.number().nullable(),
  avg_hr: z.number().nullable(),
  max_hr: z.number().nullable(),
  avg_cadence: z.number().nullable(),
  total_ascent: z.number().nullable(),
  power_zones: powerZonesSchema.nullable(),
  hr_zones: hrZonesSchema.nullable(),
  notes: z.string().nullable(),
  ai_summary: z.string().nullable(),
  source: z.string(),
  external_id: z.string().nullable(),
  raw_data: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type SessionRow = z.infer<typeof sessionRowSchema>

// Valid sport values for type narrowing
const VALID_SPORTS = ['cycling', 'running', 'swimming', 'other'] as const

/**
 * Parse and validate a row from the database
 * Returns null if validation fails (logs warning)
 */
function parseSessionRow(row: unknown): SessionRow | null {
  const result = sessionRowSchema.safeParse(row)
  if (!result.success) {
    console.warn('[sessions] Invalid session row:', result.error.issues)
    return null
  }
  return result.data
}

export type SessionInsert = Omit<SessionRow, 'id' | 'created_at' | 'updated_at'>

function rowToSession(row: SessionRow): Session {
  // Validate sport is a known value, default to 'other' if not
  const sport = VALID_SPORTS.includes(row.sport as typeof VALID_SPORTS[number])
    ? (row.sport as Session['sport'])
    : 'other'

  return {
    id: row.id,
    athlete_id: row.athlete_id,
    date: row.date,
    duration_seconds: row.duration_seconds,
    distance_meters: row.distance_meters ?? undefined,
    sport,
    workout_type: row.workout_type ?? undefined,
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

  // Validate and transform each row, filtering out invalid ones
  return data
    .map((row) => parseSessionRow(row))
    .filter((row): row is SessionRow => row !== null)
    .map((row) => rowToSession(row))
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

  // Validate row before transforming
  const validatedRow = parseSessionRow(data)
  if (!validatedRow) return null

  return rowToSession(validatedRow)
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
