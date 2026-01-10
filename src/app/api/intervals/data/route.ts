import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { intervalsClient, getDateRange } from '@/lib/intervals-icu'

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

    // Transform activities to our format
    // Filter out STRAVA activities (blocked by Strava's API terms)
    // Keep: UPLOAD (Zwift direct), GARMIN_CONNECT, and any other direct sources
    const sessions = activities
      .filter(activity => activity.source !== 'STRAVA' && activity.type && activity.moving_time)
      .slice(0, 20)
      .map(activity => ({
        id: activity.id,
        athlete_id: athleteId,
        date: activity.start_date_local,
        duration_seconds: activity.moving_time,
        distance_meters: activity.distance,
        sport: (activity.type || '').toLowerCase().includes('ride') ? 'cycling' : 'other',
        workout_type: activity.name,
        avg_power: activity.icu_average_watts || activity.average_watts,
        normalized_power: activity.icu_weighted_avg_watts || activity.weighted_average_watts,
        tss: activity.icu_training_load,
        intensity_factor: activity.icu_intensity,
        avg_hr: activity.average_heartrate,
        max_hr: activity.max_heartrate,
        source: 'intervals_icu',
        external_id: activity.id,
      }))

    // Build PMC data from wellness (uses 'id' field for date)
    // Adjust sampling based on date range to keep chart readable
    const sampleRate = days <= 42 ? 1 : days <= 90 ? 3 : days <= 180 ? 7 : 14
    const pmcData = wellness
      .filter(w => w.id) // Only include entries with valid dates
      .filter((_, i, arr) => i % sampleRate === 0 || i === arr.length - 1) // Sample based on range
      .map(w => {
        // Handle date format - intervals.icu uses YYYY-MM-DD in 'id' field
        const dateStr = w.id
        const date = new Date(dateStr + 'T00:00:00') // Add time to avoid timezone issues
        return {
          date: isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          ctl: Math.round(w.ctl || 0),
          atl: Math.round(w.atl || 0),
          tsb: Math.round((w.ctl || 0) - (w.atl || 0)),
        }
      })

    // Calculate CTL trend (this week vs last week)
    const ctlTrend = wellness.length > 7
      ? Math.round(wellness[wellness.length - 1].ctl - wellness[wellness.length - 8].ctl)
      : 0

    return NextResponse.json({
      connected: true,
      athlete: {
        id: athlete.id,
        name: athlete.name,
        ftp: athlete.ftp,
        max_hr: athlete.maxHr,
        lthr: athlete.lthr,
        weight_kg: athlete.weight,
      },
      currentFitness: {
        ctl: today?.ctl || 0,
        atl: today?.atl || 0,
        tsb: today ? Math.round(today.ctl - today.atl) : 0,
        ctl_trend: ctlTrend > 0 ? 'up' : ctlTrend < 0 ? 'down' : 'stable',
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
