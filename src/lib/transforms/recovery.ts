/**
 * Recovery Data Transforms
 *
 * Handles recovery/wellness metrics separately from training load (PMC).
 * This includes sleep, HRV, resting HR, readiness, and other recovery indicators.
 */

import type { IntervalsWellness } from '@/lib/intervals-icu'

/**
 * Recovery data point for historical tracking
 */
export interface RecoveryDataPoint {
  date: string
  sleepSeconds: number | null
  sleepScore: number | null
  sleepQuality: number | null
  hrv: number | null
  hrvSDNN: number | null
  restingHR: number | null
  readiness: number | null
  fatigue: number | null
  mood: number | null
}

/**
 * Current recovery status (latest day)
 */
export interface CurrentRecovery {
  sleepSeconds: number | null
  sleepScore: number | null
  sleepQuality: number | null
  hrv: number | null
  restingHR: number | null
  readiness: number | null
  fatigue: number | null
  mood: number | null
  // Formatted helpers
  sleepHours: number | null
  sleepFormatted: string | null
}

/**
 * Build recovery history from wellness records
 */
export function getRecoveryData(
  wellness: IntervalsWellness[],
  options: { sampleRate?: number } = {}
): RecoveryDataPoint[] {
  const { sampleRate = 1 } = options // Default to no sampling for recovery data

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
        sleepSeconds: w.sleepSecs ?? null,
        sleepScore: w.sleepScore ?? null,
        sleepQuality: w.sleepQuality ?? null,
        hrv: w.hrv ?? null,
        hrvSDNN: w.hrvSDNN ?? null,
        restingHR: w.restingHR ?? null,
        readiness: w.readiness ?? null,
        fatigue: w.fatigue ?? null,
        mood: w.mood ?? null,
      }
    })
}

/**
 * Get current recovery status from the most recent wellness record
 */
export function getCurrentRecovery(wellness: IntervalsWellness[]): CurrentRecovery | null {
  if (wellness.length === 0) return null

  // Get the most recent record
  const latest = wellness[wellness.length - 1]

  const sleepSeconds = latest.sleepSecs ?? null
  const sleepHours = sleepSeconds ? sleepSeconds / 3600 : null

  return {
    sleepSeconds,
    sleepScore: latest.sleepScore ?? null,
    sleepQuality: latest.sleepQuality ?? null,
    hrv: latest.hrv ?? null,
    restingHR: latest.restingHR ?? null,
    readiness: latest.readiness ?? null,
    fatigue: latest.fatigue ?? null,
    mood: latest.mood ?? null,
    // Helpers
    sleepHours,
    sleepFormatted: sleepHours
      ? `${Math.floor(sleepHours)}h ${Math.round((sleepHours % 1) * 60)}m`
      : null,
  }
}

/**
 * Build recovery data from local fitness history records
 */
export function getRecoveryDataFromLocal(
  fitnessHistory: Array<{
    date: string
    sleep_seconds?: number | null
    sleep_score?: number | null
    hrv?: number | null
    resting_hr?: number | null
    readiness?: number | null
  }>
): RecoveryDataPoint[] {
  return fitnessHistory.map(f => {
    const date = new Date(f.date + 'T00:00:00')
    return {
      date: isNaN(date.getTime())
        ? f.date
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sleepSeconds: f.sleep_seconds ?? null,
      sleepScore: f.sleep_score ?? null,
      sleepQuality: null, // Not stored locally
      hrv: f.hrv ?? null,
      hrvSDNN: null, // Not stored locally
      restingHR: f.resting_hr ?? null,
      readiness: f.readiness ?? null,
      fatigue: null, // Not stored locally
      mood: null, // Not stored locally
    }
  })
}

/**
 * Get current recovery from local fitness history
 */
export function getCurrentRecoveryFromLocal(
  fitnessHistory: Array<{
    sleep_seconds?: number | null
    sleep_score?: number | null
    hrv?: number | null
    resting_hr?: number | null
    readiness?: number | null
  }>
): CurrentRecovery | null {
  if (fitnessHistory.length === 0) return null

  const latest = fitnessHistory[fitnessHistory.length - 1]
  const sleepSeconds = latest.sleep_seconds ?? null
  const sleepHours = sleepSeconds ? sleepSeconds / 3600 : null

  return {
    sleepSeconds,
    sleepScore: latest.sleep_score ?? null,
    sleepQuality: null,
    hrv: latest.hrv ?? null,
    restingHR: latest.resting_hr ?? null,
    readiness: latest.readiness ?? null,
    fatigue: null,
    mood: null,
    sleepHours,
    sleepFormatted: sleepHours
      ? `${Math.floor(sleepHours)}h ${Math.round((sleepHours % 1) * 60)}m`
      : null,
  }
}
