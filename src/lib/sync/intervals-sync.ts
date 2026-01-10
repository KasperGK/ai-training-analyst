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

  return {
    athlete_id: athleteId,
    date: activity.start_date_local.split('T')[0],
    duration_seconds: activity.moving_time || 0,
    distance_meters: activity.distance ? Math.round(activity.distance) : null,
    sport: mapActivityType(activity.type),
    workout_type: workoutType,
    avg_power: activity.icu_average_watts || activity.average_watts || null,
    max_power: activity.max_watts || null,
    normalized_power: activity.icu_weighted_avg_watts || activity.weighted_average_watts || null,
    intensity_factor: activity.icu_intensity || null,
    tss: activity.icu_training_load || null,
    avg_hr: activity.average_heartrate || null,
    max_hr: activity.max_heartrate || null,
    avg_cadence: activity.average_cadence || null,
    total_ascent: activity.total_elevation_gain || null,
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
 * Transform intervals.icu wellness to our FitnessHistory format
 */
function transformWellness(wellness: IntervalsWellness, athleteId: string): FitnessHistoryInsert {
  return {
    athlete_id: athleteId,
    date: wellness.date,
    ctl: wellness.ctl,
    atl: wellness.atl,
    tsb: wellness.ctl - wellness.atl,
    tss_day: 0, // Calculated from sessions
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

    // Transform to our format
    const fitnessRecords: FitnessHistoryInsert[] = wellnessData.map(w =>
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

  // Mark as syncing
  await upsertSyncLog(athleteId, { status: 'syncing' })

  // Sync activities first
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
