import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getActivePlan,
  getPlanDays,
  getPlanDaysWithEvents,
  updateTrainingPlan,
} from '@/lib/db/training-plans'
import { getUpcomingEvents } from '@/lib/db/events'
import { getCurrentFitness } from '@/lib/db/fitness'

// GET /api/training-plans - Get active plan with days
// GET /api/training-plans?suggest=true - Get plan suggestions for upcoming events
export async function GET(request: NextRequest) {
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

  const searchParams = request.nextUrl.searchParams
  const suggest = searchParams.get('suggest') === 'true'

  // Suggestion mode: return upcoming events and recommended plan
  if (suggest) {
    const activePlan = await getActivePlan(user.id)
    const upcomingEvents = await getUpcomingEvents(user.id, 10)
    const fitness = await getCurrentFitness(user.id)

    // Filter to priority A and B events
    const targetableEvents = upcomingEvents.filter(e =>
      e.priority === 'A' || e.priority === 'B'
    )

    // Calculate weeks until each event
    const today = new Date()
    const eventsWithWeeks = targetableEvents.map(event => {
      const eventDate = new Date(event.date)
      const weeksUntil = Math.ceil(
        (eventDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000)
      )
      return {
        ...event,
        weeksUntil,
        suggestedTemplate: getSuggestedTemplate(weeksUntil, fitness?.ctl || 0),
      }
    })

    return NextResponse.json({
      hasActivePlan: !!activePlan,
      activePlanId: activePlan?.id || null,
      upcomingEvents: eventsWithWeeks,
      currentFitness: fitness ? {
        ctl: fitness.ctl,
        atl: fitness.atl,
        tsb: fitness.tsb,
      } : null,
    })
  }

  // Normal mode: return active plan with days
  const plan = await getActivePlan(user.id)

  if (!plan) {
    return NextResponse.json({
      plan: null,
      days: [],
      events: [],
    })
  }

  // Get date range from query params or default to plan dates
  const startDate = searchParams.get('start') || plan.start_date
  const endDate = searchParams.get('end') || plan.end_date

  const days = await getPlanDays(plan.id, { startDate, endDate })

  // Get events within plan range
  const { events } = await getPlanDaysWithEvents(plan.id, user.id)

  return NextResponse.json({
    plan,
    days,
    events,
  })
}

// PATCH /api/training-plans - Update plan status
export async function PATCH(request: NextRequest) {
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

  try {
    const body = await request.json()
    const { planId, status, progress_percent } = body

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {}
    if (status) updates.status = status
    if (progress_percent !== undefined) updates.progress_percent = progress_percent

    const updated = await updateTrainingPlan(planId, updates)

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update plan' },
        { status: 500 }
      )
    }

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}

// Helper to suggest template based on weeks until event and current fitness
function getSuggestedTemplate(weeksUntil: number, currentCtl: number): string {
  if (weeksUntil <= 3) {
    return 'taper3Week'
  } else if (weeksUntil <= 4) {
    return 'taper3Week' // 4 weeks can use 3-week taper with 1 week buffer
  } else if (weeksUntil >= 10) {
    return 'eventPrep12Week'
  } else if (weeksUntil >= 6 && currentCtl < 50) {
    return 'baseBuilding4Week'
  } else {
    return 'ftpBuild8Week'
  }
}
