import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  type GoalInsert,
  type GoalUpdate,
} from '@/lib/db/goals'

export async function GET(request: NextRequest): Promise<NextResponse> {
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

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') as 'active' | 'completed' | 'abandoned' | null

  const goals = await getGoals(user.id, status || undefined)
  return NextResponse.json(goals)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    const goalData: GoalInsert = {
      athlete_id: user.id,
      event_id: body.event_id || null,
      title: body.title,
      description: body.description || null,
      target_type: body.target_type,
      target_value: body.target_value || null,
      current_value: body.current_value || null,
      deadline: body.deadline || null,
      status: body.status || 'active',
    }

    const goal = await createGoal(goalData)
    if (!goal) {
      return NextResponse.json(
        { error: 'Failed to create goal' },
        { status: 500 }
      )
    }

    return NextResponse.json(goal, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
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
        { error: 'Goal ID required' },
        { status: 400 }
      )
    }

    const allowedFields: (keyof GoalUpdate)[] = [
      'event_id', 'title', 'description', 'target_type', 'target_value',
      'current_value', 'deadline', 'status', 'updated_at'
    ]

    const goalUpdates: GoalUpdate = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        (goalUpdates as Record<string, unknown>)[field] = updates[field]
      }
    }

    const goal = await updateGoal(id, goalUpdates)
    if (!goal) {
      return NextResponse.json(
        { error: 'Failed to update goal' },
        { status: 500 }
      )
    }

    return NextResponse.json(goal)
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
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
        { error: 'Goal ID required' },
        { status: 400 }
      )
    }

    const success = await deleteGoal(id)
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete goal' },
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
