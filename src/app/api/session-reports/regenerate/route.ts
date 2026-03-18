import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteSessionReports } from '@/lib/db/session-reports'
import { generateSessionReports } from '@/lib/reports/report-generator'
import { intervalsClient } from '@/lib/intervals-icu'
import { logger } from '@/lib/logger'

/**
 * POST /api/session-reports/regenerate
 *
 * Regenerate session reports with full stream data (peak powers, pacing).
 * Body: { session_ids?: string[] }
 * If session_ids omitted, regenerates reports for recent sessions.
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
  const { data: integration } = await supabase
    .from('integrations')
    .select('access_token, external_athlete_id')
    .eq('athlete_id', user.id)
    .eq('provider', 'intervals_icu')
    .single()

  let accessToken = integration?.access_token
  let athleteId = integration?.external_athlete_id

  // Fall back to env vars
  if (!accessToken) {
    accessToken = process.env.INTERVALS_ICU_API_KEY
    athleteId = process.env.INTERVALS_ICU_ATHLETE_ID
  }

  if (!accessToken || !athleteId) {
    return NextResponse.json(
      { error: 'intervals.icu not connected — cannot fetch stream data' },
      { status: 400 }
    )
  }

  intervalsClient.setCredentials(accessToken, athleteId)

  // Parse request body
  let sessionIds: string[] | undefined
  try {
    const body = await request.json()
    sessionIds = body.session_ids
  } catch {
    // Empty body is fine — will regenerate recent sessions
  }

  // If no specific sessions, get recent cycling sessions with reports
  if (!sessionIds || sessionIds.length === 0) {
    const { data: recentReports } = await supabase
      .from('session_reports')
      .select('session_id')
      .eq('athlete_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    sessionIds = recentReports?.map(r => r.session_id) ?? []
  }

  if (sessionIds.length === 0) {
    return NextResponse.json({ message: 'No sessions to regenerate', reports_created: 0 })
  }

  // Delete existing reports
  const deleted = await deleteSessionReports(user.id, sessionIds)
  if (!deleted) {
    logger.warn('[Regenerate] Failed to delete existing reports, proceeding anyway')
  }

  // Regenerate with stream data
  const result = await generateSessionReports(user.id, sessionIds, intervalsClient)

  logger.info(`[Regenerate] Regenerated ${result.reports_created} reports`)

  return NextResponse.json({
    message: `Regenerated ${result.reports_created} reports`,
    reports_created: result.reports_created,
    errors: result.errors,
  })
}
