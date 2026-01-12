import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { intervalsClient, getDateRange } from '@/lib/intervals-icu'

export interface WellnessDataPoint {
  date: string
  sleepHours: number
  sleepScore: number | null
  hrv: number | null
  restingHR: number | null
  readiness: number | null
}

export interface RecoveryData {
  connected: boolean
  current: {
    sleepSeconds: number | null
    sleepScore: number | null
    hrv: number | null
    restingHR: number | null
    readiness: number | null
  }
  history: WellnessDataPoint[]
  averages: {
    sleepHours: number
    sleepScore: number
    hrv: number
    restingHR: number
  }
  // Sessions for correlation analysis
  sessions: Array<{
    date: string
    tss: number
  }>
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '90', 10)

  const cookieStore = await cookies()

  // Try OAuth tokens first, then fall back to API key from env
  let accessToken = cookieStore.get('intervals_access_token')?.value
  let athleteId = cookieStore.get('intervals_athlete_id')?.value

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
    intervalsClient.setCredentials(accessToken, athleteId)
    const { oldest, newest } = getDateRange(days)

    // Fetch wellness and activities in parallel
    const [wellness, activities] = await Promise.all([
      intervalsClient.getWellness(oldest, newest),
      intervalsClient.getActivities(oldest, newest),
    ])

    // Get today's/latest data
    const today = wellness.find(w => w.id === newest) || wellness[wellness.length - 1]

    // Transform wellness to history data points
    const history: WellnessDataPoint[] = wellness
      .filter(w => w.id)
      .map(w => ({
        date: formatDateLabel(w.id),
        sleepHours: w.sleepSecs ? Math.round((w.sleepSecs / 3600) * 10) / 10 : 0,
        sleepScore: w.sleepScore ?? null,
        hrv: w.hrv ?? null,
        restingHR: w.restingHR ?? null,
        readiness: w.readiness ?? null,
      }))

    // Calculate averages (only from days with data)
    const sleepData = history.filter(h => h.sleepHours > 0)
    const hrvData = history.filter(h => h.hrv !== null)
    const hrData = history.filter(h => h.restingHR !== null)
    const scoreData = history.filter(h => h.sleepScore !== null)

    const averages = {
      sleepHours: sleepData.length > 0
        ? Math.round((sleepData.reduce((sum, h) => sum + h.sleepHours, 0) / sleepData.length) * 10) / 10
        : 0,
      sleepScore: scoreData.length > 0
        ? Math.round(scoreData.reduce((sum, h) => sum + (h.sleepScore || 0), 0) / scoreData.length)
        : 0,
      hrv: hrvData.length > 0
        ? Math.round(hrvData.reduce((sum, h) => sum + (h.hrv || 0), 0) / hrvData.length)
        : 0,
      restingHR: hrData.length > 0
        ? Math.round(hrData.reduce((sum, h) => sum + (h.restingHR || 0), 0) / hrData.length)
        : 0,
    }

    // Get sessions for correlation (date + TSS only)
    const sessions = activities
      .filter(a => a.source !== 'STRAVA' && a.icu_training_load)
      .map(a => ({
        date: a.start_date_local.split('T')[0],
        tss: a.icu_training_load || 0,
      }))

    return NextResponse.json({
      connected: true,
      current: {
        sleepSeconds: today?.sleepSecs ?? null,
        sleepScore: today?.sleepScore ?? null,
        hrv: today?.hrv ?? null,
        restingHR: today?.restingHR ?? null,
        readiness: today?.readiness ?? null,
      },
      history,
      averages,
      sessions,
    } satisfies RecoveryData)
  } catch (error) {
    console.error('Recovery API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recovery data', connected: true },
      { status: 500 }
    )
  }
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
