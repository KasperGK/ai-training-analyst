/**
 * Accept Training Plan API
 *
 * POST /api/training-plans/[id]/accept - Accept a draft plan, making it active
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getTrainingPlan,
  getActivePlan,
  updateTrainingPlan,
} from '@/lib/db/training-plans'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: planId } = await params

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

  // Get the draft plan
  const plan = await getTrainingPlan(planId)
  if (!plan) {
    return NextResponse.json(
      { error: 'Plan not found' },
      { status: 404 }
    )
  }

  if (plan.status !== 'draft') {
    return NextResponse.json(
      { error: `Plan is already ${plan.status}. Only draft plans can be accepted.` },
      { status: 400 }
    )
  }

  // Deactivate any existing active plan
  const existingActive = await getActivePlan(user.id)
  if (existingActive) {
    await updateTrainingPlan(existingActive.id, { status: 'abandoned' })
  }

  // Activate the draft plan
  const activatedPlan = await updateTrainingPlan(planId, { status: 'active' })

  if (!activatedPlan) {
    return NextResponse.json(
      { error: 'Failed to activate plan' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    plan: {
      id: activatedPlan.id,
      name: activatedPlan.name,
      status: activatedPlan.status,
      startDate: activatedPlan.start_date,
      endDate: activatedPlan.end_date,
    },
    previousPlanDeactivated: existingActive ? existingActive.name : null,
  })
}
