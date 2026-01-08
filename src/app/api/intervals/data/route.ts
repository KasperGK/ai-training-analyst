import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { intervalsClient, getDateRange } from '@/lib/intervals-icu'

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('intervals_access_token')?.value
  const athleteId = cookieStore.get('intervals_athlete_id')?.value

  if (!accessToken || !athleteId) {
    return NextResponse.json(
      { error: 'Not connected to intervals.icu', connected: false },
      { status: 401 }
    )
  }

  try {
    // Set credentials
    intervalsClient.setCredentials(accessToken, athleteId)

    // Get date range for last 90 days
    const { oldest, newest } = getDateRange(90)

    // Fetch data in parallel
    const [athlete, activities, wellness] = await Promise.all([
      intervalsClient.getAthlete(),
      intervalsClient.getActivities(oldest, newest),
      intervalsClient.getWellness(oldest, newest),
    ])

    // Get today's fitness data
    const today = wellness.find(w => w.date === newest) || wellness[wellness.length - 1]

    // Transform activities to our format
    const sessions = activities.slice(0, 10).map(activity => ({
      id: activity.id,
      athlete_id: athleteId,
      date: activity.start_date_local,
      duration_seconds: activity.moving_time,
      distance_meters: activity.distance,
      sport: activity.type.toLowerCase().includes('ride') ? 'cycling' : 'other',
      avg_power: activity.average_watts,
      normalized_power: activity.weighted_average_watts,
      tss: activity.icu_training_load,
      intensity_factor: activity.icu_intensity,
      avg_hr: activity.average_heartrate,
      max_hr: activity.max_heartrate,
      source: 'intervals_icu',
      external_id: activity.id,
    }))

    // Build PMC data from wellness
    const pmcData = wellness
      .filter((_, i) => i % 7 === 0 || i === wellness.length - 1) // Weekly points
      .map(w => ({
        date: new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ctl: Math.round(w.ctl),
        atl: Math.round(w.atl),
        tsb: Math.round(w.ctl - w.atl),
      }))

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
