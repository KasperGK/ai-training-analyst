/**
 * Training Plan Export API
 *
 * GET /api/training-plans/[id]/export - Export plan as .ics calendar file
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTrainingPlan, getPlanDaysWithEvents } from '@/lib/db/training-plans'
import { generateICS, type CalendarEvent } from '@/lib/calendar/ics-generator'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
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

  const plan = await getTrainingPlan(planId)
  if (!plan) {
    return NextResponse.json(
      { error: 'Plan not found' },
      { status: 404 }
    )
  }

  const { days, events: planEvents } = await getPlanDaysWithEvents(planId, user.id)

  const calendarEvents: CalendarEvent[] = []

  // Convert plan days (workouts) to timed calendar events
  for (const day of days) {
    if (!day.workout_name) continue

    const descriptionParts: string[] = []
    if (day.workout_type) descriptionParts.push(`Type: ${day.workout_type}`)
    if (day.target_tss) descriptionParts.push(`Target TSS: ${day.target_tss}`)
    if (day.target_duration_minutes) {
      const h = Math.floor(day.target_duration_minutes / 60)
      const m = day.target_duration_minutes % 60
      descriptionParts.push(`Duration: ${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}min` : ''}`.trim())
    }
    if (day.custom_description) descriptionParts.push(day.custom_description)

    calendarEvents.push({
      uid: `workout-${day.id}@ai-training-analyst`,
      summary: day.workout_name,
      description: descriptionParts.join('\n'),
      date: day.date,
      durationMinutes: day.target_duration_minutes || 60,
      allDay: false,
      category: day.workout_type || 'Training',
    })
  }

  // Convert athlete events to all-day calendar events
  for (const event of planEvents) {
    calendarEvents.push({
      uid: `event-${event.date}-${event.name.replace(/\s+/g, '-')}@ai-training-analyst`,
      summary: event.name,
      description: `Priority: ${event.priority}`,
      date: event.date,
      allDay: true,
      category: 'Race/Event',
    })
  }

  const icsContent = generateICS(calendarEvents, plan.name)

  return new Response(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${plan.name.replace(/[^a-zA-Z0-9\-_ ]/g, '')}.ics"`,
    },
  })
}
