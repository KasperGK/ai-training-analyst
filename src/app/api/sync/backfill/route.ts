/**
 * Backfill API Endpoint
 *
 * POST /api/sync/backfill - One-time backfill of historical fitness data
 * GET /api/sync/backfill - Check backfill status
 *
 * Pulls 90+ days of historical CTL/ATL/TSB from intervals.icu
 * and stores in fitness_history table.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { intervalsClient } from '@/lib/intervals-icu'
import { backfillWellness, getSyncLog } from '@/lib/sync/intervals-sync'

/**
 * GET /api/sync/backfill - Check if backfill has been completed
 */
export async function GET() {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    )
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  const syncLog = await getSyncLog(user.id)

  // Check how many fitness records exist
  const { count } = await supabase
    .from('fitness_history')
    .select('*', { count: 'exact', head: true })
    .eq('athlete_id', user.id)

  // Backfill is considered complete if we have 90+ days of data
  // and the oldest_activity_date is tracked in sync_log
  const hasBackfilled = !!(syncLog?.oldest_activity_date) && (count || 0) >= 90

  return NextResponse.json({
    hasBackfilled,
    fitnessRecordCount: count || 0,
    oldestDate: syncLog?.oldest_activity_date || null,
    wellnessSynced: syncLog?.wellness_synced || 0,
  })
}

/**
 * POST /api/sync/backfill - Trigger historical data backfill
 *
 * Body options:
 * - days: number - Number of days to backfill (default: 120)
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    )
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  // Get intervals.icu credentials
  const cookieStore = await cookies()
  let accessToken = cookieStore.get('intervals_access_token')?.value
  let intervalsAthleteId = cookieStore.get('intervals_athlete_id')?.value

  if (!accessToken || !intervalsAthleteId) {
    accessToken = process.env.INTERVALS_ICU_API_KEY
    intervalsAthleteId = process.env.INTERVALS_ICU_ATHLETE_ID
  }

  if (!accessToken || !intervalsAthleteId) {
    return NextResponse.json(
      { error: 'intervals.icu not connected' },
      { status: 400 }
    )
  }

  // Set credentials
  intervalsClient.setCredentials(accessToken, intervalsAthleteId)

  // Parse body options
  let days = 120
  try {
    const body = await request.json()
    if (body.days && typeof body.days === 'number' && body.days > 0) {
      days = Math.min(body.days, 365) // Cap at 1 year
    }
  } catch {
    // No body or invalid JSON - use defaults
  }

  const startTime = Date.now()

  try {
    const result = await backfillWellness(user.id, { days })

    // Clear cache after backfill
    intervalsClient.clearCache()

    return NextResponse.json({
      success: result.errors.length === 0,
      synced: result.synced,
      oldest_date: result.oldest_date,
      newest_date: result.newest_date,
      errors: result.errors,
      duration_ms: Date.now() - startTime,
    })
  } catch (error) {
    console.error('Backfill error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 }
    )
  }
}
