/**
 * Race Results Database Module
 *
 * CRUD operations for ZwiftPower race results.
 */

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Zod schema for validating DB rows
const raceResultRowSchema = z.object({
  id: z.string(),
  athlete_id: z.string(),
  zwift_event_id: z.string(),
  race_name: z.string(),
  race_date: z.string(),
  race_type: z.string().nullable(),
  distance_km: z.number().nullable(),
  elevation_m: z.number().nullable(),
  route_name: z.string().nullable(),
  category: z.string().nullable(),
  placement: z.number().nullable(),
  total_in_category: z.number().nullable(),
  zwift_racing_score: z.number().nullable(),
  duration_seconds: z.number().nullable(),
  avg_power: z.number().nullable(),
  avg_wkg: z.number().nullable(),
  normalized_power: z.number().nullable(),
  max_power: z.number().nullable(),
  avg_hr: z.number().nullable(),
  max_hr: z.number().nullable(),
  ctl_at_race: z.number().nullable(),
  atl_at_race: z.number().nullable(),
  tsb_at_race: z.number().nullable(),
  source: z.string(),
  raw_data: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type RaceResultRow = z.infer<typeof raceResultRowSchema>

export interface RaceResult {
  id: string
  athlete_id: string
  zwift_event_id: string
  race_name: string
  race_date: string
  race_type?: 'flat' | 'hilly' | 'mixed' | 'tt'
  distance_km?: number
  elevation_m?: number
  route_name?: string
  category?: string
  placement?: number
  total_in_category?: number
  zwift_racing_score?: number
  duration_seconds?: number
  avg_power?: number
  avg_wkg?: number
  normalized_power?: number
  max_power?: number
  avg_hr?: number
  max_hr?: number
  ctl_at_race?: number
  atl_at_race?: number
  tsb_at_race?: number
  source: string
}

export type RaceResultInsert = Omit<RaceResult, 'id'> & { raw_data?: Record<string, unknown> }

function parseRaceResultRow(row: unknown): RaceResultRow | null {
  const result = raceResultRowSchema.safeParse(row)
  if (!result.success) {
    console.warn('[race-results] Invalid row:', result.error.issues)
    return null
  }
  return result.data
}

function rowToRaceResult(row: RaceResultRow): RaceResult {
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    zwift_event_id: row.zwift_event_id,
    race_name: row.race_name,
    race_date: row.race_date,
    race_type: (row.race_type as RaceResult['race_type']) ?? undefined,
    distance_km: row.distance_km ?? undefined,
    elevation_m: row.elevation_m ?? undefined,
    route_name: row.route_name ?? undefined,
    category: row.category ?? undefined,
    placement: row.placement ?? undefined,
    total_in_category: row.total_in_category ?? undefined,
    zwift_racing_score: row.zwift_racing_score ?? undefined,
    duration_seconds: row.duration_seconds ?? undefined,
    avg_power: row.avg_power ?? undefined,
    avg_wkg: row.avg_wkg ?? undefined,
    normalized_power: row.normalized_power ?? undefined,
    max_power: row.max_power ?? undefined,
    avg_hr: row.avg_hr ?? undefined,
    max_hr: row.max_hr ?? undefined,
    ctl_at_race: row.ctl_at_race ?? undefined,
    atl_at_race: row.atl_at_race ?? undefined,
    tsb_at_race: row.tsb_at_race ?? undefined,
    source: row.source,
  }
}

export interface GetRaceResultsOptions {
  limit?: number
  offset?: number
  startDate?: string
  endDate?: string
  raceType?: 'flat' | 'hilly' | 'mixed' | 'tt'
  category?: string
}

/**
 * Get race results for an athlete
 */
export async function getRaceResults(
  athleteId: string,
  options: GetRaceResultsOptions = {}
): Promise<RaceResult[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { limit = 50, offset = 0, startDate, endDate, raceType, category } = options

  let query = supabase
    .from('race_results')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('race_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (startDate) {
    query = query.gte('race_date', startDate)
  }
  if (endDate) {
    query = query.lte('race_date', endDate)
  }
  if (raceType) {
    query = query.eq('race_type', raceType)
  }
  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error('[race-results] Error fetching:', error)
    return []
  }

  return data
    .map((row) => parseRaceResultRow(row))
    .filter((row): row is RaceResultRow => row !== null)
    .map((row) => rowToRaceResult(row))
}

/**
 * Get a single race result by ID
 */
export async function getRaceResult(raceResultId: string): Promise<RaceResult | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('race_results')
    .select('*')
    .eq('id', raceResultId)
    .single()

  if (error || !data) return null

  const validatedRow = parseRaceResultRow(data)
  if (!validatedRow) return null

  return rowToRaceResult(validatedRow)
}

/**
 * Get race result by Zwift event ID
 */
export async function getRaceResultByEventId(
  athleteId: string,
  zwiftEventId: string
): Promise<RaceResult | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('race_results')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('zwift_event_id', zwiftEventId)
    .single()

  if (error || !data) return null

  const validatedRow = parseRaceResultRow(data)
  if (!validatedRow) return null

  return rowToRaceResult(validatedRow)
}

/**
 * Create or update a race result
 */
export async function upsertRaceResult(
  result: RaceResultInsert
): Promise<RaceResult | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('race_results')
    .upsert(result, {
      onConflict: 'athlete_id,zwift_event_id',
    })
    .select()
    .single()

  if (error || !data) {
    console.error('[race-results] Error upserting:', error)
    return null
  }

  const validatedRow = parseRaceResultRow(data)
  if (!validatedRow) return null

  return rowToRaceResult(validatedRow)
}

/**
 * Get race statistics summary for an athlete
 */
export async function getRaceStatistics(athleteId: string): Promise<{
  totalRaces: number
  avgPlacement: number | null
  avgPlacementPercent: number | null
  categoryCounts: Record<string, number>
  raceTypeCounts: Record<string, number>
  bestPlacement: number | null
  worstPlacement: number | null
}> {
  const supabase = await createClient()
  if (!supabase) {
    return {
      totalRaces: 0,
      avgPlacement: null,
      avgPlacementPercent: null,
      categoryCounts: {},
      raceTypeCounts: {},
      bestPlacement: null,
      worstPlacement: null,
    }
  }

  const { data, error } = await supabase
    .from('race_results')
    .select('placement, total_in_category, category, race_type')
    .eq('athlete_id', athleteId)

  if (error || !data || data.length === 0) {
    return {
      totalRaces: 0,
      avgPlacement: null,
      avgPlacementPercent: null,
      categoryCounts: {},
      raceTypeCounts: {},
      bestPlacement: null,
      worstPlacement: null,
    }
  }

  const placements = data.filter(r => r.placement !== null).map(r => r.placement!)
  const placementPercents = data
    .filter(r => r.placement !== null && r.total_in_category !== null && r.total_in_category > 0)
    .map(r => (r.placement! / r.total_in_category!) * 100)

  const categoryCounts: Record<string, number> = {}
  const raceTypeCounts: Record<string, number> = {}

  data.forEach(r => {
    if (r.category) {
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1
    }
    if (r.race_type) {
      raceTypeCounts[r.race_type] = (raceTypeCounts[r.race_type] || 0) + 1
    }
  })

  return {
    totalRaces: data.length,
    avgPlacement: placements.length > 0
      ? Math.round(placements.reduce((a, b) => a + b, 0) / placements.length)
      : null,
    avgPlacementPercent: placementPercents.length > 0
      ? Math.round(placementPercents.reduce((a, b) => a + b, 0) / placementPercents.length)
      : null,
    categoryCounts,
    raceTypeCounts,
    bestPlacement: placements.length > 0 ? Math.min(...placements) : null,
    worstPlacement: placements.length > 0 ? Math.max(...placements) : null,
  }
}

/**
 * Get races grouped by form (TSB ranges)
 */
export async function getRacesByForm(athleteId: string): Promise<{
  tsbRange: string
  races: number
  avgPlacement: number | null
  avgPlacementPercent: number | null
}[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('race_results')
    .select('tsb_at_race, placement, total_in_category')
    .eq('athlete_id', athleteId)
    .not('tsb_at_race', 'is', null)
    .not('placement', 'is', null)

  if (error || !data || data.length === 0) return []

  // Group by TSB ranges
  const ranges = [
    { label: 'Very Fatigued (<-20)', min: -100, max: -20 },
    { label: 'Fatigued (-20 to -10)', min: -20, max: -10 },
    { label: 'Neutral (-10 to 5)', min: -10, max: 5 },
    { label: 'Fresh (5 to 15)', min: 5, max: 15 },
    { label: 'Very Fresh (>15)', min: 15, max: 100 },
  ]

  return ranges.map(range => {
    const racesInRange = data.filter(
      r => r.tsb_at_race !== null && r.tsb_at_race >= range.min && r.tsb_at_race < range.max
    )

    const placements = racesInRange.filter(r => r.placement !== null).map(r => r.placement!)
    const placementPercents = racesInRange
      .filter(r => r.placement !== null && r.total_in_category !== null && r.total_in_category > 0)
      .map(r => (r.placement! / r.total_in_category!) * 100)

    return {
      tsbRange: range.label,
      races: racesInRange.length,
      avgPlacement: placements.length > 0
        ? Math.round(placements.reduce((a, b) => a + b, 0) / placements.length)
        : null,
      avgPlacementPercent: placementPercents.length > 0
        ? Math.round(placementPercents.reduce((a, b) => a + b, 0) / placementPercents.length)
        : null,
    }
  }).filter(r => r.races > 0)
}

/**
 * Check if an athlete has any ZwiftPower race data
 */
export async function hasZwiftPowerData(athleteId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { count } = await supabase
    .from('race_results')
    .select('*', { count: 'exact', head: true })
    .eq('athlete_id', athleteId)
    .limit(1)

  return (count ?? 0) > 0
}

/**
 * Get performance by race type (terrain)
 */
export async function getPerformanceByRaceType(athleteId: string): Promise<{
  raceType: string
  races: number
  avgPlacement: number | null
  avgPlacementPercent: number | null
  avgWkg: number | null
}[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('race_results')
    .select('race_type, placement, total_in_category, avg_wkg')
    .eq('athlete_id', athleteId)
    .not('race_type', 'is', null)

  if (error || !data || data.length === 0) return []

  // Group by race type
  const byType: Record<string, typeof data> = {}
  data.forEach(r => {
    if (r.race_type) {
      if (!byType[r.race_type]) byType[r.race_type] = []
      byType[r.race_type].push(r)
    }
  })

  return Object.entries(byType).map(([raceType, races]) => {
    const placements = races.filter(r => r.placement !== null).map(r => r.placement!)
    const placementPercents = races
      .filter(r => r.placement !== null && r.total_in_category !== null && r.total_in_category > 0)
      .map(r => (r.placement! / r.total_in_category!) * 100)
    const wkgs = races.filter(r => r.avg_wkg !== null).map(r => r.avg_wkg!)

    return {
      raceType,
      races: races.length,
      avgPlacement: placements.length > 0
        ? Math.round(placements.reduce((a, b) => a + b, 0) / placements.length)
        : null,
      avgPlacementPercent: placementPercents.length > 0
        ? Math.round(placementPercents.reduce((a, b) => a + b, 0) / placementPercents.length)
        : null,
      avgWkg: wkgs.length > 0
        ? Math.round((wkgs.reduce((a, b) => a + b, 0) / wkgs.length) * 100) / 100
        : null,
    }
  })
}
