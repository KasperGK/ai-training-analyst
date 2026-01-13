import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { intervalsClient, getDateRange } from '@/lib/intervals-icu'
import { transformActivities, transformAthlete, buildPMCData } from '@/lib/transforms'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '90', 10)

  const cookieStore = await cookies()

  // Try OAuth tokens first (from cookie), then fall back to API key from env
  let accessToken = cookieStore.get('intervals_access_token')?.value
  let athleteId = cookieStore.get('intervals_athlete_id')?.value

  // Fall back to API key from environment variables
  if (!accessToken || !athleteId) {
    accessToken = process.env.INTERVALS_ICU_API_KEY
    athleteId = process.env.INTERVALS_ICU_ATHLETE_ID
  }

  if (!accessToken || !athleteId) {
    return NextResponse.json(
      { error: 'Not connected to intervals.icu', connected: false },
      { status: 401 }
    )
  }

  try {
    // Set credentials
    intervalsClient.setCredentials(accessToken, athleteId)

    // Get date range for requested days (default 90)
    const { oldest, newest } = getDateRange(days)

    // Fetch data in parallel
    const [athlete, activities, wellness] = await Promise.all([
      intervalsClient.getAthlete(),
      intervalsClient.getActivities(oldest, newest),
      intervalsClient.getWellness(oldest, newest),
    ])

    // Get today's fitness data (wellness uses 'id' field for date, not 'date')
    const today = wellness.find(w => w.id === newest) || wellness[wellness.length - 1]

    // Transform using shared transforms
    const sessions = transformActivities(activities, athleteId, { limit: 20 })
    const athleteData = transformAthlete(athlete)

    // Build PMC data with appropriate sampling
    const sampleRate = days <= 42 ? 1 : days <= 90 ? 3 : days <= 180 ? 7 : 14
    const pmcData = buildPMCData(wellness, { sampleRate })

    // Calculate CTL trend (this week vs last week)
    const ctlTrend = wellness.length > 7
      ? Math.round(wellness[wellness.length - 1].ctl - wellness[wellness.length - 8].ctl)
      : 0

    return NextResponse.json({
      connected: true,
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
        // Sleep data from Garmin via intervals.icu
        sleep_seconds: today?.sleepSecs ?? null,
        sleep_score: today?.sleepScore ?? null,
        hrv: today?.hrv ?? null,
        resting_hr: today?.restingHR ?? null,
      },
      sessions,
      pmcData,
      ctlTrend,
    })
  } catch (error) {
    console.error('intervals.icu API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data from intervals.icu', connected: true },
      { status: 500 }
    )
  }
}
