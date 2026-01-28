/**
 * Race Competitors Database Module
 *
 * CRUD operations for competitor data from ZwiftPower races.
 */

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Zod schema for validating DB rows
const raceCompetitorRowSchema = z.object({
  id: z.string(),
  race_result_id: z.string(),
  zwift_id: z.string().nullable(),
  rider_name: z.string(),
  placement: z.number(),
  category: z.string().nullable(),
  avg_power: z.number().nullable(),
  avg_wkg: z.number().nullable(),
  duration_seconds: z.number().nullable(),
  zwift_racing_score: z.number().nullable(),
  position_delta: z.number().nullable(),
  time_delta_seconds: z.number().nullable(),
  power_delta: z.number().nullable(),
  created_at: z.string(),
})

export type RaceCompetitorRow = z.infer<typeof raceCompetitorRowSchema>

export interface RaceCompetitor {
  id: string
  race_result_id: string
  zwift_id?: string
  rider_name: string
  placement: number
  category?: string
  avg_power?: number
  avg_wkg?: number
  duration_seconds?: number
  zwift_racing_score?: number
  position_delta?: number       // negative = ahead, positive = behind
  time_delta_seconds?: number   // negative = faster, positive = slower
  power_delta?: number          // their power minus user's power
}

export type RaceCompetitorInsert = Omit<RaceCompetitor, 'id'>

function parseRaceCompetitorRow(row: unknown): RaceCompetitorRow | null {
  const result = raceCompetitorRowSchema.safeParse(row)
  if (!result.success) {
    console.warn('[race-competitors] Invalid row:', result.error.issues)
    return null
  }
  return result.data
}

function rowToRaceCompetitor(row: RaceCompetitorRow): RaceCompetitor {
  return {
    id: row.id,
    race_result_id: row.race_result_id,
    zwift_id: row.zwift_id ?? undefined,
    rider_name: row.rider_name,
    placement: row.placement,
    category: row.category ?? undefined,
    avg_power: row.avg_power ?? undefined,
    avg_wkg: row.avg_wkg ?? undefined,
    duration_seconds: row.duration_seconds ?? undefined,
    zwift_racing_score: row.zwift_racing_score ?? undefined,
    position_delta: row.position_delta ?? undefined,
    time_delta_seconds: row.time_delta_seconds ?? undefined,
    power_delta: row.power_delta ?? undefined,
  }
}

/**
 * Get competitors for a specific race result
 */
export async function getCompetitorsForRace(
  raceResultId: string
): Promise<RaceCompetitor[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('race_competitors')
    .select('*')
    .eq('race_result_id', raceResultId)
    .order('placement', { ascending: true })

  if (error || !data) {
    console.error('[race-competitors] Error fetching:', error)
    return []
  }

  return data
    .map((row) => parseRaceCompetitorRow(row))
    .filter((row): row is RaceCompetitorRow => row !== null)
    .map((row) => rowToRaceCompetitor(row))
}

/**
 * Insert competitors for a race
 */
export async function insertCompetitors(
  competitors: RaceCompetitorInsert[]
): Promise<RaceCompetitor[]> {
  const supabase = await createClient()
  if (!supabase) return []

  if (competitors.length === 0) return []

  const { data, error } = await supabase
    .from('race_competitors')
    .insert(competitors)
    .select()

  if (error || !data) {
    console.error('[race-competitors] Error inserting:', error)
    return []
  }

  return data
    .map((row) => parseRaceCompetitorRow(row))
    .filter((row): row is RaceCompetitorRow => row !== null)
    .map((row) => rowToRaceCompetitor(row))
}

/**
 * Delete competitors for a race (useful when re-syncing)
 */
export async function deleteCompetitorsForRace(
  raceResultId: string
): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('race_competitors')
    .delete()
    .eq('race_result_id', raceResultId)

  if (error) {
    console.error('[race-competitors] Error deleting:', error)
    return false
  }

  return true
}

/**
 * Get frequent opponents (riders who appear in multiple races with the user)
 */
export async function getFrequentOpponents(
  athleteId: string,
  minRaces: number = 2
): Promise<{
  zwift_id: string
  rider_name: string
  races_together: number
  wins_against: number      // times user beat them
  losses_against: number    // times they beat user
  avg_power_gap: number | null
  avg_position_gap: number | null
}[]> {
  const supabase = await createClient()
  if (!supabase) return []

  // First get all race result IDs for this athlete
  const { data: raceResults } = await supabase
    .from('race_results')
    .select('id')
    .eq('athlete_id', athleteId)

  if (!raceResults || raceResults.length === 0) return []

  const raceIds = raceResults.map(r => r.id)

  // Get all competitors from those races
  const { data: competitors, error } = await supabase
    .from('race_competitors')
    .select('*')
    .in('race_result_id', raceIds)
    .not('zwift_id', 'is', null)

  if (error || !competitors) {
    console.error('[race-competitors] Error fetching opponents:', error)
    return []
  }

  // Group by zwift_id
  const byZwiftId: Record<string, RaceCompetitorRow[]> = {}
  competitors.forEach(c => {
    const validated = parseRaceCompetitorRow(c)
    if (validated && validated.zwift_id) {
      if (!byZwiftId[validated.zwift_id]) byZwiftId[validated.zwift_id] = []
      byZwiftId[validated.zwift_id].push(validated)
    }
  })

  // Calculate stats for frequent opponents
  return Object.entries(byZwiftId)
    .filter(([, races]) => races.length >= minRaces)
    .map(([zwiftId, races]) => {
      const winsAgainst = races.filter(r => r.position_delta !== null && r.position_delta > 0).length
      const lossesAgainst = races.filter(r => r.position_delta !== null && r.position_delta < 0).length

      const powerGaps = races.filter(r => r.power_delta !== null).map(r => r.power_delta!)
      const positionGaps = races.filter(r => r.position_delta !== null).map(r => r.position_delta!)

      return {
        zwift_id: zwiftId,
        rider_name: races[0].rider_name,
        races_together: races.length,
        wins_against: winsAgainst,
        losses_against: lossesAgainst,
        avg_power_gap: powerGaps.length > 0
          ? Math.round(powerGaps.reduce((a, b) => a + b, 0) / powerGaps.length)
          : null,
        avg_position_gap: positionGaps.length > 0
          ? Math.round((positionGaps.reduce((a, b) => a + b, 0) / positionGaps.length) * 10) / 10
          : null,
      }
    })
    .sort((a, b) => b.races_together - a.races_together)
}

/**
 * Get near finishers analysis (riders who finished close to the user)
 */
export async function getNearFinishersAnalysis(
  athleteId: string,
  positionRange: number = 3
): Promise<{
  avgPowerGapToNextPlace: number | null
  avgTimeGapToNextPlace: number | null
  racesAnalyzed: number
  potentialPositionGain: number | null
}> {
  const supabase = await createClient()
  if (!supabase) {
    return {
      avgPowerGapToNextPlace: null,
      avgTimeGapToNextPlace: null,
      racesAnalyzed: 0,
      potentialPositionGain: null,
    }
  }

  // Get all race results with their competitors
  const { data: raceResults } = await supabase
    .from('race_results')
    .select('id')
    .eq('athlete_id', athleteId)

  if (!raceResults || raceResults.length === 0) {
    return {
      avgPowerGapToNextPlace: null,
      avgTimeGapToNextPlace: null,
      racesAnalyzed: 0,
      potentialPositionGain: null,
    }
  }

  const raceIds = raceResults.map(r => r.id)

  // Get competitors who finished just ahead (position_delta between -positionRange and -1)
  const { data: nearCompetitors, error } = await supabase
    .from('race_competitors')
    .select('*')
    .in('race_result_id', raceIds)
    .gte('position_delta', -positionRange)
    .lt('position_delta', 0)

  if (error || !nearCompetitors || nearCompetitors.length === 0) {
    return {
      avgPowerGapToNextPlace: null,
      avgTimeGapToNextPlace: null,
      racesAnalyzed: 0,
      potentialPositionGain: null,
    }
  }

  // Find the closest finisher ahead in each race (position_delta = -1)
  const nextPlaceFinishers = nearCompetitors.filter(c => c.position_delta === -1)

  const powerGaps = nextPlaceFinishers
    .filter(c => c.power_delta !== null)
    .map(c => Math.abs(c.power_delta!))

  const timeGaps = nextPlaceFinishers
    .filter(c => c.time_delta_seconds !== null)
    .map(c => Math.abs(c.time_delta_seconds!))

  // Calculate potential position gain based on small power improvements
  // Assumption: +5W could gain you how many positions on average?
  const potentialGains = nearCompetitors
    .filter(c => c.power_delta !== null && c.power_delta < 0 && Math.abs(c.power_delta) <= 10)
    .length

  const uniqueRaces = new Set(nearCompetitors.map(c => c.race_result_id)).size

  return {
    avgPowerGapToNextPlace: powerGaps.length > 0
      ? Math.round(powerGaps.reduce((a, b) => a + b, 0) / powerGaps.length)
      : null,
    avgTimeGapToNextPlace: timeGaps.length > 0
      ? Math.round(timeGaps.reduce((a, b) => a + b, 0) / timeGaps.length)
      : null,
    racesAnalyzed: uniqueRaces,
    potentialPositionGain: potentialGains > 0 ? Math.round(potentialGains / uniqueRaces) : null,
  }
}

/**
 * Get category comparison (user vs category average)
 */
export async function getCategoryComparison(
  athleteId: string
): Promise<{
  category: string
  races: number
  userAvgPower: number | null
  categoryAvgPower: number | null
  powerDifference: number | null
  userAvgWkg: number | null
  categoryAvgWkg: number | null
  wkgDifference: number | null
}[]> {
  const supabase = await createClient()
  if (!supabase) return []

  // Get user's race results grouped by category
  const { data: userResults } = await supabase
    .from('race_results')
    .select('id, category, avg_power, avg_wkg')
    .eq('athlete_id', athleteId)
    .not('category', 'is', null)

  if (!userResults || userResults.length === 0) return []

  // Group by category
  const byCategory: Record<string, { results: typeof userResults; raceIds: string[] }> = {}
  userResults.forEach(r => {
    if (r.category) {
      if (!byCategory[r.category]) {
        byCategory[r.category] = { results: [], raceIds: [] }
      }
      byCategory[r.category].results.push(r)
      byCategory[r.category].raceIds.push(r.id)
    }
  })

  // Get competitor data for each category
  const comparisons = await Promise.all(
    Object.entries(byCategory).map(async ([category, { results, raceIds }]) => {
      const { data: competitors } = await supabase
        .from('race_competitors')
        .select('avg_power, avg_wkg')
        .in('race_result_id', raceIds)
        .eq('category', category)

      const userPowers = results.filter(r => r.avg_power !== null).map(r => r.avg_power!)
      const userWkgs = results.filter(r => r.avg_wkg !== null).map(r => r.avg_wkg!)

      const competitorPowers = competitors
        ?.filter(c => c.avg_power !== null)
        .map(c => c.avg_power!) || []
      const competitorWkgs = competitors
        ?.filter(c => c.avg_wkg !== null)
        .map(c => c.avg_wkg!) || []

      const userAvgPower = userPowers.length > 0
        ? Math.round(userPowers.reduce((a, b) => a + b, 0) / userPowers.length)
        : null
      const categoryAvgPower = competitorPowers.length > 0
        ? Math.round(competitorPowers.reduce((a, b) => a + b, 0) / competitorPowers.length)
        : null

      const userAvgWkg = userWkgs.length > 0
        ? Math.round((userWkgs.reduce((a, b) => a + b, 0) / userWkgs.length) * 100) / 100
        : null
      const categoryAvgWkg = competitorWkgs.length > 0
        ? Math.round((competitorWkgs.reduce((a, b) => a + b, 0) / competitorWkgs.length) * 100) / 100
        : null

      return {
        category,
        races: results.length,
        userAvgPower,
        categoryAvgPower,
        powerDifference: userAvgPower !== null && categoryAvgPower !== null
          ? userAvgPower - categoryAvgPower
          : null,
        userAvgWkg,
        categoryAvgWkg,
        wkgDifference: userAvgWkg !== null && categoryAvgWkg !== null
          ? Math.round((userAvgWkg - categoryAvgWkg) * 100) / 100
          : null,
      }
    })
  )

  return comparisons.sort((a, b) => b.races - a.races)
}
