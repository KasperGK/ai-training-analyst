import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getPlanDay,
  updatePlanDay,
  skipPlanDay,
  reschedulePlanDay,
  calculatePlanProgress,
  updateTrainingPlan,
} from '@/lib/db/training-plans'

interface RouteParams {
  params: Promise<{
    id: string
    dayId: string
  }>
}

// GET /api/training-plans/[id]/days/[dayId] - Get single day
export async function GET(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { dayId } = await params
  const day = await getPlanDay(dayId)

  if (!day) {
    return NextResponse.json(
      { error: 'Day not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(day)
}

// PATCH /api/training-plans/[id]/days/[dayId] - Update day
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { id: planId, dayId } = await params

  try {
    const body = await request.json()
    const {
      action,
      completed,
      skipped,
      rescheduledTo,
      actualTss,
      actualDuration,
      notes,
    } = body

    let result

    // Handle specific actions
    if (action === 'skip') {
      result = await skipPlanDay(dayId)
    } else if (action === 'reschedule' && rescheduledTo) {
      const { newDay } = await reschedulePlanDay(dayId, rescheduledTo, planId)
      result = newDay
    } else {
      // General update
      const updates: Record<string, unknown> = {}

      if (completed !== undefined) {
        updates.completed = completed
        if (completed) {
          // Calculate compliance score if we have target and actual TSS
          const day = await getPlanDay(dayId)
          if (day?.target_tss && actualTss) {
            updates.compliance_score = Math.min(
              (actualTss / day.target_tss) * 100,
              150 // Cap at 150%
            ) / 100
          }
        }
      }

      if (skipped !== undefined) updates.skipped = skipped
      if (actualTss !== undefined) updates.actual_tss = actualTss
      if (actualDuration !== undefined) updates.actual_duration_minutes = actualDuration
      if (notes !== undefined) updates.athlete_notes = notes

      result = await updatePlanDay(dayId, updates)
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to update day' },
        { status: 500 }
      )
    }

    // Update plan progress
    const progress = await calculatePlanProgress(planId)
    await updateTrainingPlan(planId, { progress_percent: progress })

    return NextResponse.json({
      day: result,
      planProgress: progress,
    })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
