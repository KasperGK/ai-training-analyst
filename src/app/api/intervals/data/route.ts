/**
 * Intervals Data API - Local-First with Fallback
 *
 * GET /api/intervals/data - Get athlete data, sessions, fitness, and recovery
 *
 * Returns data from local Supabase database first.
 * Falls back to intervals.icu if local data is stale or missing.
 *
 * Response structure separates concerns:
 * - athlete: Profile data
 * - currentFitness: Training load (CTL/ATL/TSB)
 * - recovery: Sleep, HRV, readiness (separate from training load)
 * - sessions: Recent activities
 * - pmcData: Historical training load for charts
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { intervalsClient, getDateRange } from '@/lib/intervals-icu'
import { createClient } from '@/lib/supabase/server'
import {
  transformActivities,
  transformAthlete,
  buildPMCData,
  getCurrentRecovery,
  getCurrentRecoveryFromLocal,
} from '@/lib/transforms'
import { getAthlete } from '@/lib/db/athletes'
import { getSessions } from '@/lib/db/sessions'
import { getFitnessHistory, getCurrentFitness } from '@/lib/db/fitness'
import type { PMCDataPoint } from '@/lib/transforms'

/**
 * Build PMC data from local fitness history
 * Only includes training load metrics (CTL/ATL/TSB)
 */
function buildLocalPMCData(
  fitnessHistory: Array<{
    date: string
    ctl: number
    atl: number
    tsb: number
  }>,
  options: { sampleRate?: number } = {}
): PMCDataPoint[] {
  const { sampleRate = 3 } = options

  return fitnessHistory
    .filter((_, i, arr) => i % sampleRate === 0 || i === arr.length - 1)
    .map(f => {
      const date = new Date(f.date + 'T00:00:00')
      return {
        date: isNaN(date.getTime())
          ? f.date
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ctl: Math.round(f.ctl),
        atl: Math.round(f.atl),
        tsb: Math.round(f.tsb),
      }
    })
}

/**
 * Check if fitness data is recent (within specified days)
 */
function isDataRecent(fitnessHistory: Array<{ date: string }>, maxAgeDays: number = 2): boolean {
  if (fitnessHistory.length === 0) return false

  const latestDate = new Date(fitnessHistory[fitnessHistory.length - 1].date)
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays)

  return latestDate >= cutoffDate
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '90', 10)

  const cookieStore = await cookies()

  // Get intervals.icu athlete ID from OAuth cookie or env (for API calls)
  let intervalsAthleteId = cookieStore.get('intervals_athlete_id')?.value
  if (!intervalsAthleteId) {
    intervalsAthleteId = process.env.INTERVALS_ICU_ATHLETE_ID
  }

  // Get Supabase user.id for local database queries
  // Sessions are stored with Supabase user.id, not intervals.icu athlete_id
  let userId: string | null = null
  const supabase = await createClient()
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }

  // Need at least one ID to proceed
  if (!intervalsAthleteId && !userId) {
    return NextResponse.json(
      { error: 'Not connected to intervals.icu', connected: false },
      { status: 401 }
    )
  }

  // Use userId for local queries (sessions are stored with Supabase user.id)
  // Fall back to intervalsAthleteId only if userId not available
  const localQueryId = userId || intervalsAthleteId!
  console.log('[intervals/data] Using localQueryId for DB queries:', localQueryId, userId ? '(Supabase user.id)' : '(intervals athlete_id fallback)')

  try {
    // Try local data first (using Supabase user.id)
    const [localAthlete, localSessions, localFitnessHistory, localCurrentFitness] = await Promise.all([
      getAthlete(localQueryId),
      getSessions(localQueryId, { limit: 20 }),
      getFitnessHistory(localQueryId, days),
      getCurrentFitness(localQueryId),
    ])

    // Check if we have recent local data
    const hasRecentLocalData = isDataRecent(localFitnessHistory, 2)

    if (localAthlete && localCurrentFitness && hasRecentLocalData && localSessions.length > 0) {
      // Use local data (source of truth)
      const sampleRate = days <= 42 ? 1 : days <= 90 ? 3 : days <= 180 ? 7 : 14
      const pmcData = buildLocalPMCData(localFitnessHistory, { sampleRate })

      // Calculate CTL trend from local history
      const ctlTrend = localFitnessHistory.length >= 8
        ? Math.round(localFitnessHistory[localFitnessHistory.length - 1].ctl - localFitnessHistory[localFitnessHistory.length - 8].ctl)
        : 0

      // Get recovery data from local fitness history (separate pipeline)
      const recovery = getCurrentRecoveryFromLocal(localFitnessHistory)

      return NextResponse.json({
        connected: true,
        source: 'local',
        athlete: {
          id: localAthlete.id,
          name: localAthlete.name,
          ftp: localAthlete.ftp,
          max_hr: localAthlete.max_hr,
          lthr: localAthlete.lthr,
          weight_kg: localAthlete.weight_kg,
          resting_hr: localAthlete.resting_hr,
        },
        // Training load metrics (PMC)
        currentFitness: {
          ctl: localCurrentFitness.ctl,
          atl: localCurrentFitness.atl,
          tsb: localCurrentFitness.tsb,
          ctl_trend: localCurrentFitness.ctl_trend,
          ctl_change: ctlTrend,
        },
        // Recovery metrics (separate concern)
        recovery,
        sessions: localSessions,
        pmcData,
        ctlTrend,
      })
    }

    // Fall back to intervals.icu if local data is missing or stale
    let accessToken = cookieStore.get('intervals_access_token')?.value
    if (!accessToken) {
      accessToken = process.env.INTERVALS_ICU_API_KEY
    }

    if (!accessToken || !intervalsAthleteId) {
      // No local data and no way to fetch from intervals.icu
      return NextResponse.json(
        { error: 'No local data and not connected to intervals.icu', connected: false },
        { status: 401 }
      )
    }

    // Set credentials and fetch from intervals.icu (use intervals.icu athlete ID)
    intervalsClient.setCredentials(accessToken, intervalsAthleteId)
    const { oldest, newest } = getDateRange(days)

    const [athlete, activities, wellness] = await Promise.all([
      intervalsClient.getAthlete(),
      intervalsClient.getActivities(oldest, newest),
      intervalsClient.getWellness(oldest, newest),
    ])

    // Get today's fitness data
    const today = wellness.find(w => w.id === newest)
      ?? (wellness.length > 0 ? wellness[wellness.length - 1] : null)

    // Transform using shared transforms (use Supabase user.id for consistency)
    const sessions = transformActivities(activities, localQueryId, { limit: 20 })
    const athleteData = transformAthlete(athlete)

    // Build PMC data with appropriate sampling (training load only)
    const sampleRate = days <= 42 ? 1 : days <= 90 ? 3 : days <= 180 ? 7 : 14
    const pmcData = buildPMCData(wellness, { sampleRate })

    // Calculate CTL trend
    const ctlTrend = wellness.length >= 8
      ? Math.round(wellness[wellness.length - 1]!.ctl - wellness[wellness.length - 8]!.ctl)
      : 0

    // Get recovery data (separate pipeline)
    const recovery = getCurrentRecovery(wellness)

    return NextResponse.json({
      connected: true,
      source: 'intervals_icu',
      athlete: {
        // Always use Supabase user.id for consistency with local database
        // Sessions are stored with Supabase user.id, not intervals.icu athlete_id
        id: userId || athleteData.id,
        name: athleteData.name,
        ftp: athleteData.ftp,
        max_hr: athleteData.max_hr,
        lthr: athleteData.lthr,
        weight_kg: athleteData.weight_kg,
        resting_hr: athleteData.resting_hr,
      },
      // Training load metrics (PMC)
      currentFitness: {
        ctl: today?.ctl || 0,
        atl: today?.atl || 0,
        tsb: today ? Math.round(today.ctl - today.atl) : 0,
        ctl_trend: ctlTrend > 0 ? 'up' : ctlTrend < 0 ? 'down' : 'stable',
        ctl_change: ctlTrend,
      },
      // Recovery metrics (separate concern)
      recovery,
      sessions,
      pmcData,
      ctlTrend,
    })
  } catch (error) {
    console.error('intervals data API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data', connected: true },
      { status: 500 }
    )
  }
}
