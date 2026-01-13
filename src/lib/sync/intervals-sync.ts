/**
 * Intervals.icu -> Supabase Sync Service
 *
 * Syncs training activities and wellness data from intervals.icu to local Supabase storage.
 * This provides:
 * - Reliable local data (no dependency on intervals.icu being up)
 * - Faster queries for AI tools
 * - Ability to work offline with cached data
 */

import { createClient } from '@/lib/supabase/server'
import { intervalsClient, formatDateForApi } from '@/lib/intervals-icu'
import type { IntervalsActivity, IntervalsWellness } from '@/lib/intervals-icu'
import type { SyncLog, SyncResult, SyncOptions, SessionInsert, FitnessHistoryInsert } from './types'

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_LOOKBACK_DAYS = 365

/**
 * Ensure athlete record exists in database
 * Creates one if missing (for users who signed up before trigger was created)
 */
async function ensureAthleteExists(athleteId: string): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false

  // Check if athlete exists
  const { data: existing } = await supabase
    .from('athletes')
    .select('id')
    .eq('id', athleteId)
    .single()

  if (existing) return true

  // Get user info from auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // Create athlete record
  const { error } = await supabase
    .from('athletes')
    .insert({
      id: athleteId,
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'Athlete',
      email: user.email || '',
    })

  if (error) {
    console.error('Failed to create athlete record:', error)
    return false
  }

  console.log('[Sync] Created athlete record for user:', athleteId)
  return true
}

/**
 * Get or create sync log for an athlete
 */
export async function getSyncLog(athleteId: string): Promise<SyncLog | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('sync_log')
    .select('*')
    .eq('athlete_id', athleteId)
    .eq('provider', 'intervals_icu')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching sync log:', error)
    return null
  }

  return data as SyncLog | null
}

/**
 * Create or update sync log
 */
async function upsertSyncLog(
  athleteId: string,
  updates: Partial<SyncLog>
): Promise<void> {
  const supabase = await createClient()
  if (!supabase) return

  await supabase
    .from('sync_log')
    .upsert({
      athlete_id: athleteId,
      provider: 'intervals_icu',
      ...updates,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'athlete_id,provider',
    })
}

/**
 * Transform intervals.icu activity to our Session format
 */
function transformActivity(activity: IntervalsActivity, athleteId: string): SessionInsert {
  // Calculate power zones percentages
  let powerZones: Record<string, number> | null = null
  if (activity.power_zone_times && activity.power_zone_times.length > 0) {
    const total = activity.power_zone_times.reduce((a, b) => a + b, 0)
    if (total > 0) {
      powerZones = {
        z1: Math.round((activity.power_zone_times[0] || 0) / total * 100),
        z2: Math.round((activity.power_zone_times[1] || 0) / total * 100),
        z3: Math.round((activity.power_zone_times[2] || 0) / total * 100),
        z4: Math.round((activity.power_zone_times[3] || 0) / total * 100),
        z5: Math.round((activity.power_zone_times[4] || 0) / total * 100),
        z6: Math.round((activity.power_zone_times[5] || 0) / total * 100),
      }
    }
  }

  // Calculate HR zones percentages
  let hrZones: Record<string, number> | null = null
  if (activity.hr_zone_times && activity.hr_zone_times.length > 0) {
    const total = activity.hr_zone_times.reduce((a, b) => a + b, 0)
    if (total > 0) {
      hrZones = {
        z1: Math.round((activity.hr_zone_times[0] || 0) / total * 100),
        z2: Math.round((activity.hr_zone_times[1] || 0) / total * 100),
        z3: Math.round((activity.hr_zone_times[2] || 0) / total * 100),
        z4: Math.round((activity.hr_zone_times[3] || 0) / total * 100),
        z5: Math.round((activity.hr_zone_times[4] || 0) / total * 100),
      }
    }
  }

  // Determine workout type from activity type/name
  const workoutType = inferWorkoutType(activity)

  // Helper to safely round numbers
  const roundOrNull = (val: number | undefined | null): number | null =>
    val != null ? Math.round(val) : null

  return {
    athlete_id: athleteId,
    date: activity.start_date_local.split('T')[0],
    duration_seconds: activity.moving_time || 0,
    distance_meters: roundOrNull(activity.distance),
    sport: mapActivityType(activity.type),
    workout_type: workoutType,
    avg_power: roundOrNull(activity.icu_average_watts ?? activity.average_watts),
    max_power: roundOrNull(activity.max_watts),
    normalized_power: roundOrNull(activity.icu_weighted_avg_watts ?? activity.weighted_average_watts),
    intensity_factor: activity.icu_intensity || null, // This is DECIMAL in schema, keep as-is
    tss: roundOrNull(activity.icu_training_load),
    avg_hr: roundOrNull(activity.average_heartrate),
    max_hr: roundOrNull(activity.max_heartrate),
    avg_cadence: roundOrNull(activity.average_cadence),
    total_ascent: roundOrNull(activity.total_elevation_gain),
    power_zones: powerZones,
    hr_zones: hrZones,
    source: 'intervals_icu',
    external_id: activity.id,
    raw_data: activity as unknown as Record<string, unknown>,
    synced_at: new Date().toISOString(),
  }
}

/**
 * Map intervals.icu activity type to our sport type
 */
function mapActivityType(type: string): string {
  const typeMap: Record<string, string> = {
    'Ride': 'cycling',
    'VirtualRide': 'cycling',
    'Run': 'running',
    'VirtualRun': 'running',
    'Swim': 'swimming',
    'Walk': 'other',
    'Hike': 'other',
    'WeightTraining': 'other',
    'Workout': 'other',
  }
  return typeMap[type] || 'other'
}

/**
 * Infer workout type from activity data
 */
function inferWorkoutType(activity: IntervalsActivity): string | null {
  const intensity = activity.icu_intensity || 0

  if (intensity < 0.65) return 'recovery'
  if (intensity < 0.76) return 'endurance'
  if (intensity < 0.88) return 'tempo'
  if (intensity < 0.95) return 'sweetspot'
  if (intensity < 1.05) return 'threshold'
  if (intensity < 1.20) return 'vo2max'
  return 'sprint'
}

/**
 * Sync athlete profile from intervals.icu to Supabase
 * Updates FTP, max_hr, lthr, weight, and resting_hr from sportSettings
 */
export async function syncAthleteProfile(
  athleteId: string
): Promise<{ updated: boolean; error?: string }> {
  const supabase = await createClient()
  if (!supabase) {
    return { updated: false, error: 'Supabase not configured' }
  }

  try {
    // Fetch athlete data from intervals.icu
    const athlete = await intervalsClient.getAthlete()

    // Extract cycling settings (or first sport if no cycling)
    const cycling = athlete.sportSettings?.find(
      (s: { type?: string }) => s.type === 'Bike'
    ) || athlete.sportSettings?.[0]

    // Update the athletes table with intervals.icu values
    const { error } = await supabase
      .from('athletes')
      .update({
        ftp: cycling?.ftp ?? null,
        max_hr: cycling?.max_hr ?? null,
        lthr: cycling?.lthr ?? null,
        weight_kg: athlete.icu_weight ?? athlete.weight ?? null,
        resting_hr: athlete.icu_resting_hr ?? null,
        intervals_icu_id: athlete.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', athleteId)

    if (error) {
      console.error('[Sync] Failed to sync athlete profile:', error)
      return { updated: false, error: error.message }
    }

    console.log('[Sync] Synced athlete profile:', {
      ftp: cycling?.ftp,
      max_hr: cycling?.max_hr,
      lthr: cycling?.lthr,
      weight_kg: athlete.icu_weight ?? athlete.weight,
      resting_hr: athlete.icu_resting_hr,
    })

    return { updated: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Sync] Failed to fetch athlete from intervals.icu:', message)
    return { updated: false, error: message }
  }
}

/**
 * Transform intervals.icu wellness to our FitnessHistory format
 */
function transformWellness(wellness: IntervalsWellness, athleteId: string): FitnessHistoryInsert {
  // Note: intervals.icu uses 'id' field for date (YYYY-MM-DD), not 'date'
  const date = wellness.id || wellness.date
  if (!date) {
    throw new Error('Wellness record missing date')
  }

  return {
    athlete_id: athleteId,
    date,
    ctl: Math.round(wellness.ctl || 0),
    atl: Math.round(wellness.atl || 0),
    tsb: Math.round((wellness.ctl || 0) - (wellness.atl || 0)),
    tss_day: 0, // Calculated from sessions
    // Sleep and recovery metrics from Garmin
    sleep_seconds: wellness.sleepSecs ?? null,
    sleep_score: wellness.sleepScore ?? null,
    hrv: wellness.hrv ?? null,
    resting_hr: wellness.restingHR ?? null,
    readiness: wellness.readiness ?? null,
    synced_at: new Date().toISOString(),
    source: 'intervals_icu',
  }
}

/**
 * Sync activities from intervals.icu to Supabase
 */
export async function syncActivities(
  athleteId: string,
  options: SyncOptions = {}
): Promise<{ synced: number; errors: string[] }> {
  const supabase = await createClient()
  if (!supabase) {
    return { synced: 0, errors: ['Supabase not configured'] }
  }

  const syncLog = await getSyncLog(athleteId)
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE
  const errors: string[] = []
  let synced = 0

  // Determine date range
  let oldest: string
  let newest: string = formatDateForApi(new Date())

  if (options.force || !syncLog?.last_activity_date) {
    // Full sync: go back DEFAULT_LOOKBACK_DAYS
    const oldestDate = new Date()
    oldestDate.setDate(oldestDate.getDate() - DEFAULT_LOOKBACK_DAYS)
    oldest = options.since || formatDateForApi(oldestDate)
  } else {
    // Incremental: start from last synced activity
    oldest = options.since || syncLog.last_activity_date
  }

  if (options.until) {
    newest = options.until
  }

  try {
    // Fetch activities from intervals.icu
    const activities = await intervalsClient.getActivities(oldest, newest)

    if (!activities || activities.length === 0) {
      return { synced: 0, errors: [] }
    }

    // Filter out STRAVA activities (blocked by API terms)
    const validActivities = activities.filter(a =>
      a.source !== 'STRAVA' && a.type && a.moving_time
    )

    // Transform and batch insert
    const sessions: SessionInsert[] = validActivities.map(a =>
      transformActivity(a, athleteId)
    )

    // Upsert in batches
    for (let i = 0; i < sessions.length; i += batchSize) {
      const batch = sessions.slice(i, i + batchSize)

      const { error } = await supabase
        .from('sessions')
        .upsert(batch, {
          onConflict: 'athlete_id,external_id',
          ignoreDuplicates: false,
        })

      if (error) {
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`)
      } else {
        synced += batch.length
      }
    }

    // Find the newest activity date for sync log
    const newestActivity = validActivities.reduce((newest, a) => {
      const date = a.start_date_local.split('T')[0]
      return date > newest ? date : newest
    }, oldest)

    // Update sync log
    await upsertSyncLog(athleteId, {
      last_sync_at: new Date().toISOString(),
      last_activity_date: newestActivity,
      activities_synced: (syncLog?.activities_synced || 0) + synced,
      status: errors.length > 0 ? 'error' : 'idle',
      error_message: errors.length > 0 ? errors.join('; ') : null,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    errors.push(message)

    await upsertSyncLog(athleteId, {
      status: 'error',
      error_message: message,
    })
  }

  return { synced, errors }
}

/**
 * Sync wellness/fitness data from intervals.icu to Supabase
 */
export async function syncWellness(
  athleteId: string,
  options: SyncOptions = {}
): Promise<{ synced: number; errors: string[] }> {
  const supabase = await createClient()
  if (!supabase) {
    return { synced: 0, errors: ['Supabase not configured'] }
  }

  const errors: string[] = []
  let synced = 0

  // Determine date range
  const newest = options.until || formatDateForApi(new Date())
  let oldest: string

  if (options.force) {
    const oldestDate = new Date()
    oldestDate.setDate(oldestDate.getDate() - DEFAULT_LOOKBACK_DAYS)
    oldest = options.since || formatDateForApi(oldestDate)
  } else {
    // For wellness, always get last 90 days to ensure CTL/ATL are accurate
    const oldestDate = new Date()
    oldestDate.setDate(oldestDate.getDate() - 90)
    oldest = options.since || formatDateForApi(oldestDate)
  }

  try {
    // Fetch wellness from intervals.icu
    const wellnessData = await intervalsClient.getWellness(oldest, newest)

    if (!wellnessData || wellnessData.length === 0) {
      return { synced: 0, errors: [] }
    }

    // Filter out records without valid dates and transform
    const validWellness = wellnessData.filter(w => w.id || w.date)
    const fitnessRecords: FitnessHistoryInsert[] = validWellness.map(w =>
      transformWellness(w, athleteId)
    )

    // Upsert all fitness records
    const { error } = await supabase
      .from('fitness_history')
      .upsert(fitnessRecords, {
        onConflict: 'athlete_id,date',
        ignoreDuplicates: false,
      })

    if (error) {
      errors.push(error.message)
    } else {
      synced = fitnessRecords.length
    }

    // Update sync log
    const syncLog = await getSyncLog(athleteId)
    await upsertSyncLog(athleteId, {
      wellness_synced: (syncLog?.wellness_synced || 0) + synced,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    errors.push(message)
  }

  return { synced, errors }
}

/**
 * Full sync: activities + wellness
 */
export async function syncAll(
  athleteId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const startTime = Date.now()
  const allErrors: string[] = []

  // Ensure athlete record exists (for users who signed up before trigger)
  const athleteExists = await ensureAthleteExists(athleteId)
  if (!athleteExists) {
    return {
      success: false,
      activitiesSynced: 0,
      wellnessSynced: 0,
      lastActivityDate: null,
      errors: ['Failed to create athlete record'],
      duration_ms: Date.now() - startTime,
    }
  }

  // Mark as syncing
  await upsertSyncLog(athleteId, { status: 'syncing' })

  // Sync athlete profile first (FTP, max_hr, lthr, weight, resting_hr)
  const profileResult = await syncAthleteProfile(athleteId)
  if (profileResult.error) {
    allErrors.push(`Profile: ${profileResult.error}`)
  }

  // Sync activities
  const activitiesResult = await syncActivities(athleteId, options)
  allErrors.push(...activitiesResult.errors)

  // Then sync wellness
  const wellnessResult = await syncWellness(athleteId, options)
  allErrors.push(...wellnessResult.errors)

  // Update final status
  const syncLog = await getSyncLog(athleteId)
  await upsertSyncLog(athleteId, {
    status: allErrors.length > 0 ? 'error' : 'idle',
    error_message: allErrors.length > 0 ? allErrors.join('; ') : null,
  })

  return {
    success: allErrors.length === 0,
    activitiesSynced: activitiesResult.synced,
    wellnessSynced: wellnessResult.synced,
    lastActivityDate: syncLog?.last_activity_date || null,
    errors: allErrors,
    duration_ms: Date.now() - startTime,
  }
}

/**
 * Check if sync is needed (more than 15 minutes since last sync)
 */
export async function isSyncNeeded(athleteId: string): Promise<boolean> {
  const syncLog = await getSyncLog(athleteId)

  if (!syncLog || !syncLog.last_sync_at) {
    return true
  }

  const lastSync = new Date(syncLog.last_sync_at)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)

  return lastSync < fifteenMinutesAgo
}
