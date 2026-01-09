import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  type EventInsert,
  type EventUpdate,
} from '@/lib/db/events'

export async function GET() {
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

  const events = await getEvents(user.id)
  return NextResponse.json(events)
}

export async function POST(request: NextRequest) {
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

    const eventData: EventInsert = {
      athlete_id: user.id,
      name: body.name,
      date: body.date,
      priority: body.priority || 'B',
      event_type: body.event_type || null,
      distance_km: body.distance_km || null,
      elevation_m: body.elevation_m || null,
      target_ctl: body.target_ctl || null,
      notes: body.notes || null,
      status: body.status || 'planned',
    }

    const event = await createEvent(eventData)
    if (!event) {
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      )
    }

    return NextResponse.json(event, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}

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
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Event ID required' },
        { status: 400 }
      )
    }

    const allowedFields: (keyof EventUpdate)[] = [
      'name', 'date', 'priority', 'event_type', 'distance_km',
      'elevation_m', 'target_ctl', 'notes', 'status', 'updated_at'
    ]

    const eventUpdates: EventUpdate = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        (eventUpdates as Record<string, unknown>)[field] = updates[field]
      }
    }

    const event = await updateEvent(id, eventUpdates)
    if (!event) {
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 500 }
      )
    }

    return NextResponse.json(event)
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Event ID required' },
        { status: 400 }
      )
    }

    const success = await deleteEvent(id)
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete event' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
