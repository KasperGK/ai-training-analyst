import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { intervalsClient, formatDateForApi } from '@/lib/intervals-icu'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
      { error: 'Not connected to intervals.icu' },
      { status: 401 }
    )
  }

  try {
    intervalsClient.setCredentials(accessToken, athleteId)

    // Fetch activity details first
    const activity = await intervalsClient.getActivity(id)

    // Try to fetch streams (may fail for some activities)
    let streams: { time?: number[]; watts?: number[]; heartrate?: number[]; cadence?: number[] } = {}
    try {
      streams = await intervalsClient.getActivityStreams(id, ['time', 'watts', 'heartrate', 'cadence'])
    } catch (streamError) {
      console.warn('Could not fetch streams for activity:', id, streamError)
      // Continue without streams - they're optional
    }

    // Get wellness data for activity date (for CTL/ATL/TSB context)
    const activityDate = activity.start_date_local.split('T')[0]
    let wellness = null
    try {
      wellness = await intervalsClient.getWellnessForDate(activityDate)
    } catch {
      // Wellness data might not exist for this date
    }

    // Downsample streams for chart performance (every 10 seconds for rides > 30min)
    const movingTime = activity.moving_time || 0
    const downsampleInterval = movingTime > 1800 ? 10 : 5
    const downsampledStreams = {
      time: (streams.time || []).filter((_, i) => i % downsampleInterval === 0),
      watts: (streams.watts || []).filter((_, i) => i % downsampleInterval === 0),
      heartrate: (streams.heartrate || []).filter((_, i) => i % downsampleInterval === 0),
      cadence: (streams.cadence || []).filter((_, i) => i % downsampleInterval === 0),
    }

    // Transform zone times for easier chart consumption
    const powerZones = activity.icu_zone_times?.map(z => ({
      zone: z.id,
      seconds: z.secs,
      minutes: Math.round(z.secs / 60),
    })) || []

    const hrZones = activity.icu_hr_zone_times?.map((secs, i) => ({
      zone: `Z${i + 1}`,
      seconds: secs,
      minutes: Math.round(secs / 60),
    })) || []

    return NextResponse.json({
      activity: {
        id: activity.id,
        name: activity.name,
        date: activity.start_date_local,
        type: activity.type,
        sport: activity.type?.toLowerCase().includes('ride') ? 'cycling' : 'other',
        duration_seconds: activity.moving_time,
        elapsed_seconds: activity.elapsed_time,
        distance_meters: activity.distance,
        elevation_gain: activity.total_elevation_gain,
        // Power metrics
        avg_power: activity.icu_average_watts || activity.average_watts,
        normalized_power: activity.icu_weighted_avg_watts || activity.weighted_average_watts,
        max_power: activity.max_watts,
        // HR metrics
        avg_hr: activity.average_heartrate,
        max_hr: activity.max_heartrate,
        // Cadence
        avg_cadence: activity.average_cadence,
        // Training metrics
        tss: activity.icu_training_load,
        intensity_factor: activity.icu_intensity,
        ftp: activity.icu_ftp,
        // Additional
        calories: activity.calories,
        trimp: activity.trimp,
        decoupling: activity.decoupling,
        interval_summary: activity.interval_summary,
      },
      streams: downsampledStreams,
      powerZones,
      hrZones,
      wellness: wellness ? {
        ctl: wellness.ctl,
        atl: wellness.atl,
        tsb: Math.round(wellness.ctl - wellness.atl),
        rampRate: wellness.rampRate,
      } : null,
    })
  } catch (error) {
    console.error('Error fetching activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity details' },
      { status: 500 }
    )
  }
}
