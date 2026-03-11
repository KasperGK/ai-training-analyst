import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionReport, markReportReadBySessionId } from '@/lib/db/session-reports'

/**
 * GET /api/session-reports/[id]
 *
 * Returns a single session report by session ID.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: sessionId } = await params

  const report = await getSessionReport(sessionId)
  if (!report) {
    return NextResponse.json(
      { error: 'Report not found' },
      { status: 404 }
    )
  }

  // Verify ownership
  if (report.athlete_id !== user.id) {
    return NextResponse.json(
      { error: 'Not authorized' },
      { status: 403 }
    )
  }

  return NextResponse.json({ report })
}

/**
 * PATCH /api/session-reports/[id]
 *
 * Mark a session report as read.
 * Body: { is_read: true }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: sessionId } = await params

  let body: { is_read?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }

  if (body.is_read === true) {
    const success = await markReportReadBySessionId(sessionId, user.id)
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ success: true })
}
