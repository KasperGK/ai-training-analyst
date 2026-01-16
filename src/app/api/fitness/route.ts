import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentFitness, getFitnessHistory } from '@/lib/db/fitness'
import { intervalsClient, getDateRange } from '@/lib/intervals-icu'
import { buildPMCData } from '@/lib/transforms'

/**
 * GET /api/fitness
 *
 * Returns fitness data from LOCAL database (source of truth).
 * Falls back to intervals.icu if local data is empty/stale.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '90', 10)

  const cookieStore = await cookies()

  // Get athlete ID from OAuth cookie or env
  let athleteId = cookieStore.get('intervals_athlete_id')?.value
  if (!athleteId) {
    athleteId = process.env.INTERVALS_ICU_ATHLETE_ID
  }

  if (!athleteId) {
    return NextResponse.json(
      { error: 'Not connected', connected: false },
      { status: 401 }
    )
  }

  try {
    // First, try to get fitness from local database
    const [currentFitness, fitnessHistory] = await Promise.all([
      getCurrentFitness(athleteId),
      getFitnessHistory(athleteId, days),
    ])

    // Check if we have recent local data (within last 2 days)
    const hasRecentData = fitnessHistory.length > 0 && (() => {
      const latestDate = new Date(fitnessHistory[fitnessHistory.length - 1].date)
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
      return latestDate >= twoDaysAgo
    })()

    if (currentFitness && hasRecentData) {
      // Use local data (source of truth)
      const pmcData = fitnessHistory.map(f => ({
        date: f.date,
        ctl: f.ctl,
        atl: f.atl,
        tsb: f.tsb,
      }))

      // Calculate CTL trend from local history
      const ctlTrend = fitnessHistory.length > 7
        ? fitnessHistory[fitnessHistory.length - 1].ctl - fitnessHistory[fitnessHistory.length - 8].ctl
        : 0

      return NextResponse.json({
        connected: true,
        source: 'local',
        currentFitness: {
          ...currentFitness,
          ctl_change: ctlTrend,
        },
        pmcData,
        ctlTrend: Math.round(ctlTrend),
        lastUpdated: fitnessHistory[fitnessHistory.length - 1]?.date || null,
      })
    }

    // Fall back to intervals.icu if local data is empty/stale
    let accessToken = cookieStore.get('intervals_access_token')?.value
    if (!accessToken) {
      accessToken = process.env.INTERVALS_ICU_API_KEY
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No local fitness data and not connected to intervals.icu', connected: false },
        { status: 401 }
      )
    }

    // Fetch from intervals.icu as fallback
    intervalsClient.setCredentials(accessToken, athleteId)
    const { oldest, newest } = getDateRange(days)
    const wellness = await intervalsClient.getWellness(oldest, newest)

    const today = wellness.find(w => w.id === newest) || wellness[wellness.length - 1]

    // Build PMC data
    const sampleRate = days <= 42 ? 1 : days <= 90 ? 3 : days <= 180 ? 7 : 14
    const pmcData = buildPMCData(wellness, { sampleRate })

    const ctlTrend = wellness.length > 7
      ? Math.round(wellness[wellness.length - 1].ctl - wellness[wellness.length - 8].ctl)
      : 0

    return NextResponse.json({
      connected: true,
      source: 'intervals_icu',
      currentFitness: {
        ctl: today?.ctl || 0,
        atl: today?.atl || 0,
        tsb: today ? Math.round(today.ctl - today.atl) : 0,
        ctl_trend: ctlTrend > 0 ? 'up' : ctlTrend < 0 ? 'down' : 'stable',
        ctl_change: ctlTrend,
        sleep_seconds: today?.sleepSecs ?? null,
        sleep_score: today?.sleepScore ?? null,
        hrv: today?.hrv ?? null,
        resting_hr: today?.restingHR ?? null,
      },
      pmcData,
      ctlTrend,
      lastUpdated: newest,
    })
  } catch (error) {
    console.error('Fitness API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fitness data', connected: true },
      { status: 500 }
    )
  }
}
