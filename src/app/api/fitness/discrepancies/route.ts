/**
 * Fitness Discrepancies API Endpoint
 *
 * GET /api/fitness/discrepancies - Get active discrepancies for current user
 * PATCH /api/fitness/discrepancies - Acknowledge or resolve discrepancies
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getActiveDiscrepancies,
  acknowledgeDiscrepancy,
  resolveAllDiscrepancies,
} from '@/lib/db/fitness-discrepancies'

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

  const discrepancies = await getActiveDiscrepancies(user.id)

  return NextResponse.json({ discrepancies })
}

export async function PATCH(request: Request) {
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

  const body = await request.json()
  const { action, discrepancyId } = body

  if (action === 'acknowledge_all') {
    const success = await resolveAllDiscrepancies(user.id)
    return NextResponse.json({ success })
  }

  if (action === 'acknowledge' && discrepancyId) {
    const success = await acknowledgeDiscrepancy(discrepancyId, user.id)
    return NextResponse.json({ success })
  }

  return NextResponse.json(
    { error: 'Invalid action' },
    { status: 400 }
  )
}
