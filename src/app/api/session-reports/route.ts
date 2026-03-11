import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionReports } from '@/lib/db/session-reports'

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

  // If specific session_ids requested, query those directly
  if (sessionIdsParam) {
    const sessionIds = sessionIdsParam.split(',').filter(Boolean)
    const { data, error } = await supabase
      .from('session_reports')
      .select('*')
      .eq('athlete_id', user.id)
      .in('session_id', sessionIds)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reports: data || [] })
  }

  const reports = await getSessionReports(user.id, { limit, unreadOnly })
  return NextResponse.json({ reports })
}
