import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionReports, getSessionReportsBySessionIds } from '@/lib/db/session-reports'
import { getSessions } from '@/lib/db/sessions'
import { generateSessionReports } from '@/lib/reports/report-generator'

/**
 * GET /api/session-reports
 *
 * Returns session reports for authenticated user.
 * Query params: limit, unread_only, session_ids (comma-separated)
 */
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const unreadOnly = searchParams.get('unread_only') === 'true'
  const sessionIdsParam = searchParams.get('session_ids')

  // If specific session_ids requested, query those via DAL
  if (sessionIdsParam) {
    const sessionIds = sessionIdsParam.split(',').filter(Boolean)
    const reports = await getSessionReportsBySessionIds(user.id, sessionIds)
    return NextResponse.json({ reports })
  }

  const reports = await getSessionReports(user.id, { limit, unreadOnly })
  return NextResponse.json({ reports })
}

/**
 * POST /api/session-reports/generate
 *
 * Generate reports for recent sessions that don't have reports yet.
 * Body: { days?: number } (default 7)
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const days = body.days || 7

  const startDateObj = new Date()
  startDateObj.setDate(startDateObj.getDate() - days)
  const startDate = startDateObj.toISOString().split('T')[0]

  const sessions = await getSessions(user.id, { startDate, limit: 50 })
  const sessionIds = sessions.map(s => s.id)

  if (sessionIds.length === 0) {
    return NextResponse.json({ message: 'No sessions found', reports_created: 0 })
  }

  const result = await generateSessionReports(user.id, sessionIds)
  return NextResponse.json(result)
}
