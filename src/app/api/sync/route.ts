/**
 * Sync API Endpoint
 *
 * POST /api/sync - Trigger a sync from intervals.icu to Supabase
 * GET /api/sync - Get sync status
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { intervalsClient } from '@/lib/intervals-icu'
import { syncAll, getSyncLog, isSyncNeeded } from '@/lib/sync/intervals-sync'

/**
 * GET /api/sync - Get sync status for current user
 */
export async function GET() {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    )
  }

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  // Get sync log
  const syncLog = await getSyncLog(user.id)
  const needsSync = await isSyncNeeded(user.id)

  // Check if intervals.icu is connected
  const cookieStore = await cookies()
  const hasToken = !!(
    cookieStore.get('intervals_access_token')?.value ||
    process.env.INTERVALS_ICU_API_KEY
  )

  return NextResponse.json({
    connected: hasToken,
    syncLog: syncLog ? {
      lastSyncAt: syncLog.last_sync_at,
      lastActivityDate: syncLog.last_activity_date,
      status: syncLog.status,
      errorMessage: syncLog.error_message,
      activitiesSynced: syncLog.activities_synced,
      wellnessSynced: syncLog.wellness_synced,
    } : null,
    needsSync,
  })
}

/**
 * POST /api/sync - Trigger sync
 *
 * Body options:
 * - force: boolean - Force full re-sync (ignore last sync date)
 * - since: string - Only sync activities newer than this date (YYYY-MM-DD)
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    )
  }

  // Get authenticated user
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

  // Fall back to env vars
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

  // Set credentials for intervals client
  intervalsClient.setCredentials(accessToken, intervalsAthleteId)

  // Parse body options
  let options = {}
  try {
    const body = await request.json()
    options = {
      force: body.force === true,
      since: body.since,
      until: body.until,
    }
  } catch {
    // No body or invalid JSON - use defaults
  }

  // Run sync
  try {
    const result = await syncAll(user.id, options)

    return NextResponse.json({
      success: result.success,
      activitiesSynced: result.activitiesSynced,
      wellnessSynced: result.wellnessSynced,
      lastActivityDate: result.lastActivityDate,
      errors: result.errors,
      duration_ms: result.duration_ms,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
