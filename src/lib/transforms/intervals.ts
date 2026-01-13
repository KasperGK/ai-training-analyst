/**
 * Centralized transformation utilities for intervals.icu data
 *
 * This module provides a single source of truth for transforming
 * intervals.icu API responses into our application's data types.
 *
 * Naming conventions:
 * - All output fields use snake_case (e.g., max_hr, sleep_seconds)
 * - intervals.icu uses mixed conventions (maxHr, sleepSecs, max_heartrate)
 */

import type { IntervalsActivity, IntervalsWellness, IntervalsAthlete } from '../intervals-icu'
import type { Session, FitnessHistory, Athlete } from '@/types'

/**
 * Get normalized power from activity, handling field variations
 */
export function getNormalizedPower(activity: IntervalsActivity): number | null {
  return activity.icu_weighted_avg_watts ?? activity.weighted_average_watts ?? null
}

/**
 * Get average power from activity, handling field variations
 */
export function getAveragePower(activity: IntervalsActivity): number | null {
  return activity.icu_average_watts ?? activity.average_watts ?? null
}

/**
 * Determine sport type from activity type string
 */
export function getSportType(activityType: string): Session['sport'] {
  const type = (activityType || '').toLowerCase()
  if (type.includes('ride') || type.includes('cycling') || type.includes('bike')) return 'cycling'
  if (type.includes('run')) return 'running'
  if (type.includes('swim')) return 'swimming'
  return 'other'
}

/**
 * Transform intervals.icu activity to Session
 */
export function transformActivity(
  activity: IntervalsActivity,
  athleteId: string
): Session {
  return {
    id: activity.id,
    athlete_id: athleteId,
    date: activity.start_date_local,
    duration_seconds: activity.moving_time,
    distance_meters: activity.distance,
    sport: getSportType(activity.type),
    workout_type: activity.name, // Free-form activity name
    avg_power: getAveragePower(activity) ?? undefined,
    normalized_power: getNormalizedPower(activity) ?? undefined,
    max_power: activity.max_watts,
    tss: activity.icu_training_load,
    intensity_factor: activity.icu_intensity,
    avg_hr: activity.average_heartrate,
    max_hr: activity.max_heartrate,
    source: 'intervals_icu',
    external_id: activity.id,
  }
}

/**
 * Transform intervals.icu wellness to FitnessHistory
 * Note: intervals.icu uses 'id' field for date in wellness records
 */
export function transformWellness(
  wellness: IntervalsWellness,
  athleteId: string
): FitnessHistory {
  return {
    athlete_id: athleteId,
    date: wellness.id, // wellness.id contains the date string
    ctl: wellness.ctl || 0,
    atl: wellness.atl || 0,
    tsb: (wellness.ctl || 0) - (wellness.atl || 0),
    tss_day: wellness.ctlLoad || 0, // Daily TSS contribution
    sleep_seconds: wellness.sleepSecs ?? null,
    sleep_score: wellness.sleepScore ?? null,
    hrv: wellness.hrv ?? null,
    resting_hr: wellness.restingHR ?? null,
    readiness: wellness.readiness ?? null,
  }
}

/**
 * Transform intervals.icu athlete to our Athlete type
 * Extracts metrics from sportSettings (cycling by default)
 */
export function transformAthlete(athlete: IntervalsAthlete): Partial<Athlete> {
  const cycling = athlete.sportSettings?.find(s => s.type === 'Bike') || athlete.sportSettings?.[0]

  return {
    id: athlete.id,
    name: athlete.name,
    email: athlete.email,
    ftp: cycling?.ftp ?? null,
    lthr: cycling?.lthr ?? null,
    max_hr: cycling?.max_hr ?? null,
    weight_kg: athlete.icu_weight ?? athlete.weight ?? null,
    resting_hr: athlete.icu_resting_hr ?? null,
  }
}

/**
 * Transform activities array, filtering out STRAVA sources
 * (blocked by Strava's API terms)
 */
export function transformActivities(
  activities: IntervalsActivity[],
  athleteId: string,
  options: { limit?: number } = {}
): Session[] {
  const { limit = 20 } = options

  return activities
    .filter(a => a.source !== 'STRAVA' && a.type && a.moving_time)
    .slice(0, limit)
    .map(a => transformActivity(a, athleteId))
}

/**
 * Build PMC chart data from wellness records
 */
export function buildPMCData(
  wellness: IntervalsWellness[],
  options: { sampleRate?: number } = {}
): Array<{ date: string; ctl: number; atl: number; tsb: number }> {
  const { sampleRate = 3 } = options

  return wellness
    .filter(w => w.id) // Only include entries with valid dates
    .filter((_, i, arr) => i % sampleRate === 0 || i === arr.length - 1)
    .map(w => {
      const dateStr = w.id
      const date = new Date(dateStr + 'T00:00:00')
      return {
        date: isNaN(date.getTime())
          ? dateStr
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ctl: Math.round(w.ctl || 0),
        atl: Math.round(w.atl || 0),
        tsb: Math.round((w.ctl || 0) - (w.atl || 0)),
      }
    })
}
