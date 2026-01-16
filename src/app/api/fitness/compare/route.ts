import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentFitness } from '@/lib/db/fitness'
import { intervalsClient, formatDateForApi } from '@/lib/intervals-icu'

/**
 * GET /api/fitness/compare
 *
 * Compares local fitness data with live intervals.icu values.
 * Returns discrepancies if CTL differs by more than threshold.
 */
export async function GET() {
  const cookieStore = await cookies()

  // Get credentials
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
    // Get local fitness from database
    const localFitness = await getCurrentFitness(athleteId)

    // Get live fitness from intervals.icu
    intervalsClient.setCredentials(accessToken, athleteId)
    const today = formatDateForApi(new Date())
    const yesterday = formatDateForApi(new Date(Date.now() - 24 * 60 * 60 * 1000))
    const wellness = await intervalsClient.getWellness(yesterday, today)

    const remoteFitness = wellness.find(w => w.id === today) || wellness[wellness.length - 1]

    if (!localFitness || !remoteFitness) {
      return NextResponse.json({
        connected: true,
        hasDiscrepancy: false,
        message: 'No data to compare',
        local: localFitness || null,
        remote: remoteFitness ? {
          ctl: remoteFitness.ctl,
          atl: remoteFitness.atl,
          tsb: Math.round(remoteFitness.ctl - remoteFitness.atl),
        } : null,
      })
    }

    // Calculate differences
    const ctlDiff = Math.abs(localFitness.ctl - remoteFitness.ctl)
    const atlDiff = Math.abs(localFitness.atl - remoteFitness.atl)

    // Discrepancy threshold: 5 CTL points or 10% difference
    const ctlThreshold = Math.max(5, localFitness.ctl * 0.1)
    const hasDiscrepancy = ctlDiff > ctlThreshold

    // Calculate percentage differences
    const ctlPercentDiff = localFitness.ctl > 0
      ? Math.round((ctlDiff / localFitness.ctl) * 100)
      : 0

    return NextResponse.json({
      connected: true,
      hasDiscrepancy,
      severity: hasDiscrepancy ? (ctlDiff > 10 ? 'high' : 'medium') : 'none',
      message: hasDiscrepancy
        ? `CTL differs by ${Math.round(ctlDiff)} points (${ctlPercentDiff}%)`
        : 'Values match within threshold',
      local: {
        ctl: localFitness.ctl,
        atl: localFitness.atl,
        tsb: localFitness.tsb,
      },
      remote: {
        ctl: Math.round(remoteFitness.ctl),
        atl: Math.round(remoteFitness.atl),
        tsb: Math.round(remoteFitness.ctl - remoteFitness.atl),
      },
      diff: {
        ctl: Math.round(ctlDiff),
        atl: Math.round(atlDiff),
        ctlPercent: ctlPercentDiff,
      },
    })
  } catch (error) {
    console.error('Fitness compare error:', error)
    return NextResponse.json(
      { error: 'Failed to compare fitness data', connected: true },
      { status: 500 }
    )
  }
}
