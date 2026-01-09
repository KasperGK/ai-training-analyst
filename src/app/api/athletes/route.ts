import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAthlete, updateAthlete, type AthleteUpdate } from '@/lib/db/athletes'

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

  const athlete = await getAthlete(user.id)
  if (!athlete) {
    return NextResponse.json(
      { error: 'Athlete profile not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(athlete)
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
    const body = await request.json() as AthleteUpdate

    // Validate the update fields
    const allowedFields: (keyof AthleteUpdate)[] = [
      'name', 'ftp', 'weight_kg', 'max_hr', 'lthr', 'resting_hr',
      'weekly_hours_available', 'updated_at'
    ]

    const updates: AthleteUpdate = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (updates as Record<string, unknown>)[field] = body[field]
      }
    }

    const athlete = await updateAthlete(user.id, updates)
    if (!athlete) {
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json(athlete)
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
