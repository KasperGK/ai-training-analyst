/**
 * ZwiftPower Race Sync Service
 *
 * Syncs race results from ZwiftPower to local Supabase storage.
 * Triggered after intervals.icu sync to look for new Zwift races.
 */

import { createClient } from '@/lib/supabase/server'
import { getSessions } from '@/lib/db/sessions'
import { upsertRaceResult, getRaceResultByEventId } from '@/lib/db/race-results'
import { insertCompetitors, deleteCompetitorsForRace } from '@/lib/db/race-competitors'
import { getFitnessForDate } from '@/lib/db/fitness'
import {
  zwiftPowerClient,
  parseZwiftActivityName,
  inferRaceType,
  decryptPassword,
  type ZwiftPowerEventResult,
  type ZwiftPowerRiderResult,
} from '@/lib/zwiftpower'
import type { RaceResultInsert } from '@/lib/db/race-results'
import type { RaceCompetitorInsert } from '@/lib/db/race-competitors'

const COMPETITOR_RANGE = 5 // Save competitors ±5 positions from user
const DEFAULT_LOOKBACK_DAYS = 90

// Tolerance for matching races between intervals.icu and ZwiftPower
const DURATION_TOLERANCE_SECONDS = 180 // 3 minutes
const POWER_TOLERANCE_WATTS = 20 // 20W

// Category number to letter mapping (ZwiftPower API returns "1", "2", etc.)
const categoryMap: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' }

// Helper to safely round numbers (DB columns are integers)
const safeRound = (v: number | undefined): number | undefined =>
  v !== undefined ? Math.round(v) : undefined

// Convert category number to letter
const mapCategory = (cat: string): string => categoryMap[cat] || cat

export interface ZwiftPowerSyncResult {
  success: boolean
  racesSynced: number
  competitorsSynced: number
  errors: string[]
  duration_ms: number
}

export interface ZwiftPowerSyncOptions {
  /** Only sync races newer than this date */
  since?: string
  /** Force re-sync of all races */
  force?: boolean
}

/**
 * Check if ZwiftPower is connected and authenticated for this athlete
 */
export async function isZwiftPowerConnected(athleteId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { data, error } = await supabase
    .from('integrations')
    .select('zwift_username, zwift_password_encrypted')
    .eq('athlete_id', athleteId)
    .eq('provider', 'zwiftpower')
    .single()

  if (error || !data) return false

  return !!(data.zwift_username && data.zwift_password_encrypted)
}

/**
 * Initialize ZwiftPower client with athlete's credentials
 */
async function initZwiftPowerClient(athleteId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  const { data, error } = await supabase
    .from('integrations')
    .select('zwift_username, zwift_password_encrypted, zwift_id')
    .eq('athlete_id', athleteId)
    .eq('provider', 'zwiftpower')
    .single()

  if (error || !data || !data.zwift_username || !data.zwift_password_encrypted) {
    console.log('[ZwiftPower Sync] No ZwiftPower credentials found')
    return false
  }

  try {
    const password = await decryptPassword(data.zwift_password_encrypted)
    zwiftPowerClient.setCredentials(data.zwift_username, password)
    return await zwiftPowerClient.authenticate()
  } catch (err) {
    console.error('[ZwiftPower Sync] Authentication failed:', err)
    return false
  }
}

/**
 * Find Zwift races from recent activities
 */
async function findRecentRaces(
  athleteId: string,
  since?: string
): Promise<Array<{
  sessionId: string
  externalId: string
  date: string
  eventName: string
  workoutType: string
}>> {
  const startDate = since || (() => {
    const d = new Date()
    d.setDate(d.getDate() - DEFAULT_LOOKBACK_DAYS)
    return d.toISOString().split('T')[0]
  })()

  const sessions = await getSessions(athleteId, {
    startDate,
    sport: 'cycling',
    limit: 200,
  })

  // Filter for Zwift races
  const races = sessions
    .filter(s => {
      // Check if it's a Zwift activity (source or name indicates Zwift)
      const isZwift = s.source === 'intervals_icu' ||
        s.workout_type?.toLowerCase().includes('zwift')

      // Check if it looks like a race
      const { isRace, eventName } = parseZwiftActivityName(s.workout_type || '')

      return isZwift && isRace && eventName
    })
    .map(s => {
      const { eventName } = parseZwiftActivityName(s.workout_type || '')
      return {
        sessionId: s.id,
        externalId: s.external_id || s.id,
        date: s.date,
        eventName: eventName || s.workout_type || 'Unknown Race',
        workoutType: s.workout_type || '',
      }
    })

  return races
}

/**
 * Match an intervals.icu race to ZwiftPower history entry
 * Uses date + duration + power matching instead of unreliable event search
 */
function matchRaceToHistory(
  race: { date: string; duration?: number; avgPower?: number; eventName: string },
  history: ZwiftPowerRiderResult[]
): ZwiftPowerRiderResult | null {
  const raceDate = new Date(race.date).toDateString()

  for (const entry of history) {
    // Match by date first
    const entryDate = new Date(entry.event_date).toDateString()
    if (entryDate !== raceDate) continue

    // Match by duration (within tolerance)
    if (race.duration && entry.time) {
      if (Math.abs(entry.time - race.duration) > DURATION_TOLERANCE_SECONDS) continue
    }

    // Match by power (within tolerance)
    if (race.avgPower && entry.avg_power) {
      if (Math.abs(entry.avg_power - race.avgPower) > POWER_TOLERANCE_WATTS) continue
    }

    console.log(`[ZwiftPower Sync] Matched: ${race.eventName} → event_id: ${entry.event_id}`)
    return entry // Found match
  }

  return null
}

/**
 * Find the user's result in event results by matching Zwift ID or power/time
 * Note: Event results API returns zwid as string, and uses different field names
 */
function findUserResult(
  results: ZwiftPowerEventResult[],
  userZwiftId?: string,
  sessionPower?: number,
  sessionDuration?: number
): ZwiftPowerEventResult | null {
  // If we have Zwift ID, use it (compare as strings since API returns string)
  if (userZwiftId) {
    const byId = results.find(r => String(r.zwid) === String(userZwiftId))
    if (byId) return byId
  }

  // Otherwise try to match by power (within 5W) and time (within 30s)
  if (sessionPower && sessionDuration) {
    const match = results.find(r => {
      const powerMatch = r.avg_power &&
        Math.abs((r.avg_power || 0) - sessionPower) <= 5
      const timeMatch = r.time &&
        Math.abs(r.time - sessionDuration) <= 30
      return powerMatch && timeMatch
    })
    if (match) return match
  }

  return null
}

/**
 * Sync a single race result
 */
async function syncRace(
  athleteId: string,
  race: {
    sessionId: string
    externalId: string
    date: string
    eventName: string
  },
  session: {
    avg_power?: number
    duration_seconds: number
    normalized_power?: number
    avg_hr?: number
    max_hr?: number
    max_power?: number
    distance_meters?: number
    total_ascent?: number
  },
  riderHistory: ZwiftPowerRiderResult[],
  userZwiftId?: string
): Promise<{ success: boolean; competitorCount: number; error?: string }> {
  try {
    // Check if already synced
    const existing = await getRaceResultByEventId(athleteId, race.externalId)
    if (existing) {
      return { success: true, competitorCount: 0 } // Already synced
    }

    // Match to rider history using date + duration + power
    const historyMatch = matchRaceToHistory(
      {
        date: race.date,
        duration: session.duration_seconds,
        avgPower: session.avg_power,
        eventName: race.eventName,
      },
      riderHistory
    )

    if (!historyMatch) {
      console.log(`[ZwiftPower Sync] Could not match in history: ${race.eventName}`)
      return { success: false, competitorCount: 0, error: 'Event not found in ZwiftPower history' }
    }

    const zwiftEventId = historyMatch.event_id

    // Get event results
    const results = await zwiftPowerClient.getEventResults(zwiftEventId)
    if (results.length === 0) {
      return { success: false, competitorCount: 0, error: 'No results found for event' }
    }

    // Find user's result
    const userResult = findUserResult(
      results,
      userZwiftId,
      session.avg_power,
      session.duration_seconds
    )

    if (!userResult) {
      console.log(`[ZwiftPower Sync] Could not find user in results for: ${race.eventName}`)
      return { success: false, competitorCount: 0, error: 'User not found in event results' }
    }

    // Get fitness data at race date for context
    const fitness = await getFitnessForDate(athleteId, race.date)

    // Get event details for terrain info
    const eventDetails = await zwiftPowerClient.getEventDetails(zwiftEventId)

    // Count riders in same category
    const sameCategoryRiders = results.filter(r => r.category === userResult.category)

    // Convert category number to letter using module helper
    const categoryLetter = mapCategory(userResult.category)

    // Build race result
    const raceResult: RaceResultInsert = {
      athlete_id: athleteId,
      zwift_event_id: zwiftEventId,
      race_name: race.eventName,
      race_date: race.date.split('T')[0], // Normalize to YYYY-MM-DD
      race_type: inferRaceType(
        eventDetails?.elevation_m || session.total_ascent,
        eventDetails?.distance_km || (session.distance_meters ? session.distance_meters / 1000 : undefined)
      ) ?? undefined,
      distance_km: eventDetails?.distance_km || (session.distance_meters ? session.distance_meters / 1000 : undefined),
      elevation_m: safeRound(eventDetails?.elevation_m || session.total_ascent),
      route_name: eventDetails?.route,
      category: categoryLetter,
      placement: safeRound(userResult.pos),
      total_in_category: sameCategoryRiders.length,
      zwift_racing_score: safeRound(userResult.zrs),
      duration_seconds: safeRound(userResult.time || session.duration_seconds),
      avg_power: safeRound(userResult.avg_power || session.avg_power),
      avg_wkg: userResult.wkg, // Keep as float for W/kg
      normalized_power: safeRound(session.normalized_power),
      max_power: safeRound(session.max_power),
      avg_hr: safeRound(userResult.avg_hr || session.avg_hr),
      max_hr: safeRound(userResult.max_hr || session.max_hr),
      ctl_at_race: fitness?.ctl ? Math.round(fitness.ctl) : undefined,
      atl_at_race: fitness?.atl ? Math.round(fitness.atl) : undefined,
      tsb_at_race: fitness ? Math.round(fitness.ctl - fitness.atl) : undefined,
      source: 'zwiftpower_api',
      raw_data: { userResult, eventDetails },
    }

    // Save race result
    const savedResult = await upsertRaceResult(raceResult)
    if (!savedResult) {
      return { success: false, competitorCount: 0, error: 'Failed to save race result' }
    }

    // Save nearby competitors
    const userPosition = userResult.pos
    const nearbyResults = sameCategoryRiders.filter(r =>
      Math.abs(r.pos - userPosition) <= COMPETITOR_RANGE && r.zwid !== userResult.zwid
    )

    // Deduplicate by zwift_id (API may return same rider multiple times)
    const seenZwids = new Set<string>()
    const uniqueNearbyResults = nearbyResults.filter(r => {
      const zwid = String(r.zwid)
      if (seenZwids.has(zwid)) return false
      seenZwids.add(zwid)
      return true
    })

    const competitors: RaceCompetitorInsert[] = uniqueNearbyResults.map(r => ({
      race_result_id: savedResult.id,
      zwift_id: r.zwid.toString(),
      rider_name: r.name,
      placement: safeRound(r.pos) || 0,
      category: mapCategory(r.category),
      avg_power: safeRound(r.avg_power),
      avg_wkg: r.wkg, // Keep as float for W/kg
      duration_seconds: safeRound(r.time),
      zwift_racing_score: safeRound(r.zrs),
      position_delta: safeRound(r.pos - userPosition), // negative = ahead, positive = behind
      time_delta_seconds: r.time && userResult.time ? safeRound(r.time - userResult.time) : undefined,
      power_delta: r.avg_power && userResult.avg_power
        ? safeRound(r.avg_power - userResult.avg_power)
        : undefined,
    }))

    // Delete existing competitors (in case of re-sync)
    await deleteCompetitorsForRace(savedResult.id)

    // Insert new competitors
    const savedCompetitors = await insertCompetitors(competitors)

    console.log(`[ZwiftPower Sync] Synced race: ${race.eventName} - P${userPosition}/${sameCategoryRiders.length} in ${userResult.category}`)

    return { success: true, competitorCount: savedCompetitors.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[ZwiftPower Sync] Error syncing race ${race.eventName}:`, message)
    return { success: false, competitorCount: 0, error: message }
  }
}

/**
 * Sync all recent races from ZwiftPower
 */
export async function syncZwiftPowerRaces(
  athleteId: string,
  options: ZwiftPowerSyncOptions = {}
): Promise<ZwiftPowerSyncResult> {
  const startTime = Date.now()
  const errors: string[] = []
  let racesSynced = 0
  let competitorsSynced = 0

  // Initialize client
  const authenticated = await initZwiftPowerClient(athleteId)
  if (!authenticated) {
    return {
      success: false,
      racesSynced: 0,
      competitorsSynced: 0,
      errors: ['ZwiftPower authentication failed'],
      duration_ms: Date.now() - startTime,
    }
  }

  // Get user's Zwift ID from integrations
  const supabase = await createClient()
  let userZwiftId: string | undefined

  if (supabase) {
    const { data } = await supabase
      .from('integrations')
      .select('zwift_id')
      .eq('athlete_id', athleteId)
      .eq('provider', 'zwiftpower')
      .single()

    userZwiftId = data?.zwift_id || undefined
  }

  // Fetch rider's complete race history from ZwiftPower once
  let riderHistory: ZwiftPowerRiderResult[] = []
  if (userZwiftId) {
    riderHistory = await zwiftPowerClient.getRiderHistory(userZwiftId)
    console.log(`[ZwiftPower Sync] Fetched ${riderHistory.length} races from rider history`)
  } else {
    console.log('[ZwiftPower Sync] No Zwift ID available, cannot fetch rider history')
    return {
      success: false,
      racesSynced: 0,
      competitorsSynced: 0,
      errors: ['No Zwift ID configured - cannot match races'],
      duration_ms: Date.now() - startTime,
    }
  }

  // Find recent races from intervals.icu
  const races = await findRecentRaces(athleteId, options.since)
  console.log(`[ZwiftPower Sync] Found ${races.length} potential races to sync`)

  // Get session data for each race
  for (const race of races) {
    const sessions = await getSessions(athleteId, {
      startDate: race.date,
      endDate: race.date,
      limit: 10,
    })

    const session = sessions.find(s => s.external_id === race.externalId || s.id === race.sessionId)
    if (!session) {
      errors.push(`Session not found for race: ${race.eventName}`)
      continue
    }

    const result = await syncRace(
      athleteId,
      race,
      {
        avg_power: session.avg_power,
        duration_seconds: session.duration_seconds,
        normalized_power: session.normalized_power,
        avg_hr: session.avg_hr,
        max_hr: session.max_hr,
        max_power: session.max_power,
        distance_meters: session.distance_meters,
        total_ascent: undefined, // Would need raw_data access
      },
      riderHistory,
      userZwiftId
    )

    if (result.success) {
      racesSynced++
      competitorsSynced += result.competitorCount
    } else if (result.error) {
      errors.push(`${race.eventName}: ${result.error}`)
    }
  }

  return {
    success: errors.length === 0,
    racesSynced,
    competitorsSynced,
    errors,
    duration_ms: Date.now() - startTime,
  }
}

/**
 * Check if ZwiftPower sync is needed
 * Called after intervals.icu sync to see if we should sync race data
 */
export async function shouldSyncZwiftPower(athleteId: string): Promise<boolean> {
  // Check if ZwiftPower is connected
  const connected = await isZwiftPowerConnected(athleteId)
  if (!connected) return false

  // Check if we have any recent Zwift races that might need syncing
  const races = await findRecentRaces(athleteId)
  return races.length > 0
}
