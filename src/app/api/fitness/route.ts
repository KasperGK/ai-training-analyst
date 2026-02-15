/**
 * Fitness API Endpoint
 *
 * GET /api/fitness - Returns fitness data from local Supabase (source of truth)
 *
 * Reads CTL/ATL/TSB, athlete profile, sessions, and PMC chart data from the
 * local database. Falls back to intervals.icu only if local data is empty
 * or stale (>2 days old).
 *
 * Query params:
 * - days: number of days of history (default: 90)
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAthlete } from '@/lib/db/athletes'
import { getSessions } from '@/lib/db/sessions'
import { getFitnessHistory, getCurrentFitness } from '@/lib/db/fitness'
import { intervalsClient, getDateRange } from '@/lib/intervals-icu'
import { transformActivities, transformAthlete, buildPMCData } from '@/lib/transforms'

const STALE_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000 // 2 days

/**
 * Check if local fitness data is stale (latest entry > 2 days old)
 */
function isDataStale(fitnessHistory: { date: string }[]): boolean {
  if (fitnessHistory.length === 0) return true

  const latestDate = fitnessHistory[fitnessHistory.length - 1].date
  const latest = new Date(latestDate + 'T00:00:00')
  const now = new Date()

  return now.getTime() - latest.getTime() > STALE_THRESHOLD_MS
}

/**
 * Build PMC chart data from local fitness history
 */
function buildLocalPMCData(
  fitnessHistory: { date: string; ctl: number; atl: number; tsb: number }[],
  sampleRate: number
): { date: string; ctl: number; atl: number; tsb: number }[] {
  return fitnessHistory
    .filter((_, i, arr) => i % sampleRate === 0 || i === arr.length - 1)
    .map(entry => {
      const date = new Date(entry.date + 'T00:00:00')
      return {
        date: isNaN(date.getTime())
          ? entry.date
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ctl: Math.round(entry.ctl),
        atl: Math.round(entry.atl),
        tsb: Math.round(entry.tsb),
      }
    })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '90', 10)

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured', connected: false },
      { status: 500 }
    )
  }

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated', connected: false },
      { status: 401 }
    )
  }

  // Try local data first
  const [athlete, fitnessHistory, currentFitness, sessions] = await Promise.all([
    getAthlete(user.id),
    getFitnessHistory(user.id, days),
    getCurrentFitness(user.id),
    getSessions(user.id, { limit: 20 }),
  ])

  // If we have local data and it's not stale, use it
  if (athlete && fitnessHistory.length > 0 && currentFitness && !isDataStale(fitnessHistory)) {
    const sampleRate = days <= 42 ? 1 : days <= 90 ? 3 : days <= 180 ? 7 : 14
    const pmcData = buildLocalPMCData(fitnessHistory, sampleRate)

    // Calculate CTL trend as numeric value (matching intervals/data response shape)
    const ctlTrend = fitnessHistory.length > 7
      ? Math.round(
          fitnessHistory[fitnessHistory.length - 1].ctl -
          fitnessHistory[fitnessHistory.length - 8].ctl
        )
      : 0

    return NextResponse.json({
      connected: true,
      source: 'local',
      athlete: {
        id: athlete.id,
        name: athlete.name,
        ftp: athlete.ftp,
        max_hr: athlete.max_hr,
        lthr: athlete.lthr,
        weight_kg: athlete.weight_kg,
        resting_hr: athlete.resting_hr,
      },
      currentFitness,
      sessions,
      pmcData,
      ctlTrend,
    })
  }

  // Fallback: fetch from intervals.icu
  const cookieStore = await cookies()
  let accessToken = cookieStore.get('intervals_access_token')?.value
  let athleteId = cookieStore.get('intervals_athlete_id')?.value

  if (!accessToken || !athleteId) {
    accessToken = process.env.INTERVALS_ICU_API_KEY
    athleteId = process.env.INTERVALS_ICU_ATHLETE_ID
  }

  if (!accessToken || !athleteId) {
    // No intervals.icu connection and no local data
    if (athlete) {
      // We have an athlete but no fitness data yet - return what we have
      return NextResponse.json({
        connected: false,
        source: 'local',
        athlete: {
          id: athlete.id,
          name: athlete.name,
          ftp: athlete.ftp,
          max_hr: athlete.max_hr,
          lthr: athlete.lthr,
          weight_kg: athlete.weight_kg,
          resting_hr: athlete.resting_hr,
        },
        currentFitness: null,
        sessions,
        pmcData: [],
        ctlTrend: 0,
      })
    }
    return NextResponse.json(
      { error: 'Not connected to intervals.icu', connected: false },
      { status: 401 }
    )
  }

  try {
    intervalsClient.setCredentials(accessToken, athleteId)

    const { oldest, newest } = getDateRange(days)

    const [intervalsAthlete, activities, wellness] = await Promise.all([
      intervalsClient.getAthlete(),
      intervalsClient.getActivities(oldest, newest),
      intervalsClient.getWellness(oldest, newest),
    ])

    const today = wellness.find(w => w.id === newest) || wellness[wellness.length - 1]
    const transformedSessions = transformActivities(activities, athleteId, { limit: 20 })
    const athleteData = transformAthlete(intervalsAthlete)

    const sampleRate = days <= 42 ? 1 : days <= 90 ? 3 : days <= 180 ? 7 : 14
    const pmcData = buildPMCData(wellness, { sampleRate })

    const ctlTrend = wellness.length > 7
      ? Math.round(wellness[wellness.length - 1].ctl - wellness[wellness.length - 8].ctl)
      : 0

    return NextResponse.json({
      connected: true,
      source: 'intervals_icu',
      athlete: {
        id: athleteData.id,
        name: athleteData.name,
        ftp: athleteData.ftp,
        max_hr: athleteData.max_hr,
        lthr: athleteData.lthr,
        weight_kg: athleteData.weight_kg,
        resting_hr: athleteData.resting_hr,
      },
      currentFitness: {
        ctl: today?.ctl || 0,
        atl: today?.atl || 0,
        tsb: today ? Math.round(today.ctl - today.atl) : 0,
        ctl_trend: ctlTrend > 0 ? 'up' : ctlTrend < 0 ? 'down' : 'stable',
        sleep_seconds: today?.sleepSecs ?? null,
        sleep_score: today?.sleepScore ?? null,
        hrv: today?.hrv ?? null,
        resting_hr: today?.restingHR ?? null,
      },
      sessions: transformedSessions,
      pmcData,
      ctlTrend,
    })
  } catch (error) {
    console.error('intervals.icu fallback error:', error)

    // If intervals.icu also fails, return whatever local data we have
    if (athlete && fitnessHistory.length > 0) {
      const sampleRate = days <= 42 ? 1 : days <= 90 ? 3 : days <= 180 ? 7 : 14
      const pmcData = buildLocalPMCData(fitnessHistory, sampleRate)
      const ctlTrend = fitnessHistory.length > 7
        ? Math.round(
            fitnessHistory[fitnessHistory.length - 1].ctl -
            fitnessHistory[fitnessHistory.length - 8].ctl
          )
        : 0

      return NextResponse.json({
        connected: true,
        source: 'local',
        athlete: {
          id: athlete.id,
          name: athlete.name,
          ftp: athlete.ftp,
          max_hr: athlete.max_hr,
          lthr: athlete.lthr,
          weight_kg: athlete.weight_kg,
          resting_hr: athlete.resting_hr,
        },
        currentFitness,
        sessions,
        pmcData,
        ctlTrend,
      })
    }

    return NextResponse.json(
      { error: 'Failed to fetch data', connected: true },
      { status: 500 }
    )
  }
}
