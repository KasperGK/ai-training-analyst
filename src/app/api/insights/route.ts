/**
 * Insights API
 *
 * GET: Fetch insights for the authenticated athlete
 * PATCH: Mark insight as read or dismissed
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInsights, markInsightRead, dismissInsight, getInsightCounts } from '@/lib/insights/insight-generator'

export async function GET(req: Request): Promise<NextResponse> {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(req.url)
  const includeRead = url.searchParams.get('includeRead') === 'true'
  const types = url.searchParams.get('types')?.split(',').filter(Boolean)
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const countsOnly = url.searchParams.get('countsOnly') === 'true'

  try {
    if (countsOnly) {
      const counts = await getInsightCounts(user.id)
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      return NextResponse.json({ counts, total })
    }

    const insights = await getInsights(user.id, {
      limit,
      includeRead,
      types,
    })

    return NextResponse.json({
      insights,
      count: insights.length,
    })
  } catch (error) {
    console.error('[Insights API] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { insightId, action } = await req.json()

    if (!insightId || !action) {
      return NextResponse.json({ error: 'Missing insightId or action' }, { status: 400 })
    }

    let success = false

    if (action === 'read') {
      success = await markInsightRead(insightId, user.id)
    } else if (action === 'dismiss') {
      success = await dismissInsight(insightId, user.id)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (!success) {
      return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Insights API] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 })
  }
}
